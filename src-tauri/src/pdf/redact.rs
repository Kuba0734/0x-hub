//! Redacted copies. Pages are rendered to pixels, boxes are burned in as solid black, and
//! the result is rebuilt from those pixels: no text layer, hidden objects or metadata of the
//! original survive, so nothing under a box can be recovered.

use serde::Deserialize;
use windows::Graphics::Imaging::BitmapAlphaMode;

use super::build::{jpeg_pages_to_pdf, JpegPage};
use super::geometry::NormRect;
use super::render;
use crate::error::AppResult;
use crate::imaging::{self, Format, Pixels};

/// Render resolution for redacted PDFs: sharp enough to print and read small print.
const REDACT_DPI: f64 = 200.0;
pub const MAX_REDACT_PAGES: u32 = 300;

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RedactBox {
    /// 0-based page (always 0 for images).
    pub page: u32,
    pub rect: NormRect,
}

fn burn(p: &mut Pixels, page: u32, boxes: &[RedactBox]) {
    for b in boxes.iter().filter(|b| b.page == page) {
        if let Some(r) = b.rect.clamped() {
            let (x0, y0, x1, y1) = r.to_pixels(p.width, p.height);
            p.fill_black(x0, y0, x1, y1);
        }
    }
}

pub fn redact_pdf(
    bytes: &[u8],
    boxes: &[RedactBox],
    mut progress: impl FnMut(u32, u32),
) -> AppResult<Vec<u8>> {
    let mut pages = Vec::new();
    render::for_each_page(bytes, REDACT_DPI, MAX_REDACT_PAGES, |i, total, mut page| {
        burn(&mut page.pixels, i, boxes);
        pages.push(JpegPage::from_pixels(
            &page.pixels,
            page.pt_width,
            page.pt_height,
        )?);
        progress(i + 1, total);
        Ok(())
    })?;
    jpeg_pages_to_pdf(&pages)
}

/// Upright image with the boxes burned in, re-encoded without EXIF/GPS metadata.
pub fn redact_image(bytes: &[u8], boxes: &[RedactBox], format: Format) -> AppResult<Vec<u8>> {
    let mut p = imaging::decode_pixels(bytes, None, BitmapAlphaMode::Ignore)?;
    burn(&mut p, 0, boxes);
    imaging::encode_pixels(&p, format)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn burns_boxes_into_images() {
        crate::ocr::init_thread();
        let src = Pixels {
            width: 100,
            height: 50,
            bgra: vec![255; 100 * 50 * 4],
        };
        let png = imaging::encode_pixels(&src, Format::Png).unwrap();
        let boxes = [
            RedactBox {
                page: 0,
                rect: NormRect {
                    x: 0.1,
                    y: 0.2,
                    w: 0.3,
                    h: 0.4,
                },
            },
            // Boxes for other pages are ignored for images.
            RedactBox {
                page: 1,
                rect: NormRect {
                    x: 0.8,
                    y: 0.0,
                    w: 0.2,
                    h: 1.0,
                },
            },
        ];
        let out = redact_image(&png, &boxes, Format::Png).unwrap();
        let p = imaging::decode_pixels(&out, None, BitmapAlphaMode::Ignore).unwrap();
        let px = |x: usize, y: usize| p.bgra[(y * 100 + x) * 4];
        assert_eq!(px(20, 20), 0);
        assert_eq!(px(5, 5), 255);
        assert_eq!(px(90, 25), 255);
    }

    #[test]
    fn redacted_pdf_is_flattened() {
        crate::ocr::init_thread();
        let src = super::super::edit::tests::sample_pdf(2);
        let boxes = [RedactBox {
            page: 0,
            rect: NormRect {
                x: 0.0,
                y: 0.0,
                w: 1.0,
                h: 0.5,
            },
        }];
        let mut calls = 0;
        let out = redact_pdf(&src, &boxes, |_, _| calls += 1).unwrap();
        assert_eq!(calls, 2);
        assert_eq!(super::super::edit::page_count(&out).unwrap(), 2);
        // The original text operators are gone; only images remain.
        assert!(!out.windows(5).any(|w| w == b"Page0"));
        assert!(!out.windows(9).any(|w| w == b"Helvetica"));
    }
}
