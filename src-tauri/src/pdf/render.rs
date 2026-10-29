//! Page rasterization with the built-in `Windows.Data.Pdf` renderer.

use windows::core::Interface;
use windows::Data::Pdf::{PdfDocument, PdfPageRenderOptions};
use windows::Graphics::Imaging::BitmapAlphaMode;
use windows::Storage::Streams::InMemoryRandomAccessStream;

use crate::error::{AppError, AppResult};
use crate::imaging::{decode_stream_pixels, stream_from_bytes, Pixels};

/// Longest rendered side, whatever the page size, to bound memory.
const MAX_RENDER_DIM: f64 = 5000.0;

pub struct RenderedPage {
    pub pixels: Pixels,
    /// Displayed page size (rotation applied) in PDF points.
    pub pt_width: f64,
    pub pt_height: f64,
}

/// Renders every page at `dpi`, calling `f(index, total, page)` in order.
pub fn for_each_page(
    bytes: &[u8],
    dpi: f64,
    max_pages: u32,
    mut f: impl FnMut(u32, u32, RenderedPage) -> AppResult<()>,
) -> AppResult<()> {
    let doc = PdfDocument::LoadFromStreamAsync(&stream_from_bytes(bytes)?)
        .and_then(|op| op.get())
        .map_err(|_| {
            AppError::Invalid("This PDF can't be opened (it may be password-protected)".into())
        })?;
    let total = doc.PageCount()?;
    if total > max_pages {
        return Err(AppError::Invalid(format!(
            "PDFs with more than {max_pages} pages are not supported here"
        )));
    }
    for i in 0..total {
        let page = doc.GetPage(i)?;
        // Size is in device-independent pixels (1/96 inch), with /Rotate applied.
        let size = page.Size()?;
        let (w_dip, h_dip) = (size.Width as f64, size.Height as f64);
        let scale = (dpi / 96.0).min(MAX_RENDER_DIM / w_dip.max(h_dip).max(1.0));
        let opts = PdfPageRenderOptions::new()?;
        opts.SetDestinationWidth((w_dip * scale).round().max(1.0) as u32)?;
        opts.SetDestinationHeight((h_dip * scale).round().max(1.0) as u32)?;
        let out = InMemoryRandomAccessStream::new()?;
        page.RenderWithOptionsToStreamAsync(&out, &opts)?.get()?;
        out.Seek(0)?;
        let pixels = decode_stream_pixels(&out.cast()?, None, BitmapAlphaMode::Ignore)?;
        f(
            i,
            total,
            RenderedPage {
                pixels,
                pt_width: w_dip * 72.0 / 96.0,
                pt_height: h_dip * 72.0 / 96.0,
            },
        )?;
    }
    Ok(())
}
