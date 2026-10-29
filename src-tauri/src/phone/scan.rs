//! Multi-page scans from the phone: the page sends every page as a JPEG in one request
//! (lengths in `X-Scan-Pages`), and they become one PDF document here.

use crate::error::{AppError, AppResult};
use crate::pdf::build;

/// Most pages per scan.
pub const MAX_PAGES: usize = 100;
/// Largest single page image.
const MAX_PAGE_BYTES: usize = 40 * 1024 * 1024;

/// Splits the request body by the comma-separated byte lengths from the header.
pub fn split_pages<'a>(body: &'a [u8], lengths: &str) -> AppResult<Vec<&'a [u8]>> {
    let bad = || AppError::Invalid("The scan didn't arrive completely. Try again.".into());
    let sizes: Vec<usize> = lengths
        .split(',')
        .map(|n| n.trim().parse::<usize>())
        .collect::<Result<_, _>>()
        .map_err(|_| bad())?;
    if sizes.is_empty() || sizes.len() > MAX_PAGES {
        return Err(AppError::Invalid(format!(
            "A scan can have 1 to {MAX_PAGES} pages"
        )));
    }
    if sizes.iter().any(|&n| n == 0 || n > MAX_PAGE_BYTES)
        || sizes.iter().sum::<usize>() != body.len()
    {
        return Err(bad());
    }
    let mut pages = Vec::with_capacity(sizes.len());
    let mut at = 0;
    for n in sizes {
        pages.push(&body[at..at + n]);
        at += n;
    }
    Ok(pages)
}

/// Page images (any format Windows decodes) → PDF.
pub fn assemble(pages: &[&[u8]]) -> AppResult<Vec<u8>> {
    let jpegs = pages
        .iter()
        .map(|p| build::image_page(p))
        .collect::<AppResult<Vec<_>>>()?;
    build::jpeg_pages_to_pdf(&jpegs)
}

/// `name` with a `.pdf` extension (the phone sends the name the user typed).
pub fn pdf_name(name: &str) -> String {
    let trimmed = name.trim();
    let base = if trimmed.is_empty() { "Scan" } else { trimmed };
    if base.to_ascii_lowercase().ends_with(".pdf") {
        base.to_string()
    } else {
        format!("{base}.pdf")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::imaging::{encode_pixels, Format, Pixels};

    #[test]
    fn splits_by_lengths_and_rejects_mismatches() {
        let body = b"aaabbbbc";
        let pages = split_pages(body, "3, 4,1").unwrap();
        assert_eq!(pages, vec![&b"aaa"[..], &b"bbbb"[..], &b"c"[..]]);
        assert!(split_pages(body, "3,4").is_err());
        assert!(split_pages(body, "3,4,2").is_err());
        assert!(split_pages(body, "8,0").is_err());
        assert!(split_pages(body, "x").is_err());
        assert!(split_pages(b"", "").is_err());
    }

    #[test]
    fn names_end_in_pdf() {
        assert_eq!(pdf_name("Mietvertrag"), "Mietvertrag.pdf");
        assert_eq!(pdf_name("a.PDF"), "a.PDF");
        assert_eq!(pdf_name("  "), "Scan.pdf");
    }

    #[test]
    fn pages_become_one_pdf() {
        crate::ocr::init_thread();
        let page = |w: u32, h: u32| {
            encode_pixels(
                &Pixels {
                    width: w,
                    height: h,
                    bgra: vec![230; (w * h * 4) as usize],
                },
                Format::Jpeg,
            )
            .unwrap()
        };
        let (a, b) = (page(60, 85), page(85, 60));
        let pdf = assemble(&[&a, &b]).unwrap();
        assert!(pdf.starts_with(b"%PDF"));
        assert_eq!(crate::pdf::edit::page_count(&pdf).unwrap(), 2);
    }
}
