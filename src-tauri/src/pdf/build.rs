//! New PDFs from images: one JPEG per page, no text layer and no metadata.

use lopdf::{dictionary, Dictionary, Document, Object, Stream};
use windows::Graphics::Imaging::BitmapAlphaMode;

use crate::error::AppResult;
use crate::imaging::{self, Format, Pixels};

/// Width of a portrait page (A4) in points; other sizes follow the image's aspect ratio.
const PAGE_SHORT_SIDE_PT: f64 = 595.28;
/// Longer side cap for images combined into a PDF.
const MAX_IMAGE_DIM: u32 = 3000;

pub struct JpegPage {
    pub jpeg: Vec<u8>,
    pub px_width: u32,
    pub px_height: u32,
    pub pt_width: f64,
    pub pt_height: f64,
}

impl JpegPage {
    pub fn from_pixels(p: &Pixels, pt_width: f64, pt_height: f64) -> AppResult<JpegPage> {
        Ok(JpegPage {
            jpeg: imaging::encode_pixels(p, Format::Jpeg)?,
            px_width: p.width,
            px_height: p.height,
            pt_width,
            pt_height,
        })
    }
}

/// Page size in points for an image: the shorter side is A4 width, so pages print at a
/// consistent scale and long receipts stay readable.
pub fn page_size_for(px_width: u32, px_height: u32) -> (f64, f64) {
    let (w, h) = (px_width.max(1) as f64, px_height.max(1) as f64);
    if h >= w {
        (PAGE_SHORT_SIDE_PT, PAGE_SHORT_SIDE_PT * h / w)
    } else {
        (PAGE_SHORT_SIDE_PT * w / h, PAGE_SHORT_SIDE_PT)
    }
}

/// Any WIC-decodable image (incl. HEIC) → an upright JPEG page.
pub fn image_page(bytes: &[u8]) -> AppResult<JpegPage> {
    let p = imaging::decode_pixels(bytes, Some(MAX_IMAGE_DIM), BitmapAlphaMode::Ignore)?;
    let (w, h) = page_size_for(p.width, p.height);
    JpegPage::from_pixels(&p, w, h)
}

pub fn jpeg_pages_to_pdf(pages: &[JpegPage]) -> AppResult<Vec<u8>> {
    let mut doc = Document::with_version("1.7");
    let pages_id = doc.new_object_id();
    let mut kids = Vec::with_capacity(pages.len());
    for p in pages {
        let image = Stream::new(
            dictionary! {
                "Type" => "XObject",
                "Subtype" => "Image",
                "Width" => p.px_width as i64,
                "Height" => p.px_height as i64,
                "ColorSpace" => "DeviceRGB",
                "BitsPerComponent" => 8,
                "Filter" => "DCTDecode",
            },
            p.jpeg.clone(),
        )
        .with_compression(false);
        let image_id = doc.add_object(image);
        let ops = format!(
            "q {:.4} 0 0 {:.4} 0 0 cm /Im0 Do Q",
            p.pt_width, p.pt_height
        );
        let content = doc.add_object(Stream::new(Dictionary::new(), ops.into_bytes()));
        let page = doc.add_object(dictionary! {
            "Type" => "Page",
            "Parent" => pages_id,
            "MediaBox" => vec![0.into(), 0.into(), Object::Real(p.pt_width as f32), Object::Real(p.pt_height as f32)],
            "Resources" => dictionary! { "XObject" => dictionary! { "Im0" => image_id } },
            "Contents" => content,
        });
        kids.push(Object::Reference(page));
    }
    let count = kids.len() as i64;
    doc.objects.insert(
        pages_id,
        Object::Dictionary(dictionary! { "Type" => "Pages", "Kids" => kids, "Count" => count }),
    );
    let catalog = doc.add_object(dictionary! { "Type" => "Catalog", "Pages" => pages_id });
    doc.trailer.set("Root", catalog);
    let mut out = Vec::new();
    doc.save_to(&mut out)?;
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn page_sizes_follow_aspect() {
        assert_eq!(page_size_for(1000, 1000), (595.28, 595.28));
        let (w, h) = page_size_for(1000, 3000);
        assert_eq!(w, 595.28);
        assert!((h - 1785.84).abs() < 1e-6);
        let (w, h) = page_size_for(2000, 1000);
        assert!((w - 1190.56).abs() < 1e-6 && h == 595.28);
    }

    #[test]
    fn images_become_pages() {
        crate::ocr::init_thread();
        let img = |w: u32, h: u32| {
            let p = Pixels {
                width: w,
                height: h,
                bgra: vec![200; (w * h * 4) as usize],
            };
            imaging::encode_pixels(&p, Format::Png).unwrap()
        };
        let pages = vec![
            image_page(&img(40, 80)).unwrap(),
            image_page(&img(90, 30)).unwrap(),
        ];
        let pdf = jpeg_pages_to_pdf(&pages).unwrap();
        assert!(pdf.starts_with(b"%PDF-1.7"));
        assert_eq!(super::super::edit::page_count(&pdf).unwrap(), 2);
    }
}
