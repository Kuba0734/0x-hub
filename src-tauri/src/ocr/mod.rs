//! OCR via the built-in Windows OCR engine. PDFs are rendered page by page with
//! `Windows.Data.Pdf` first. Everything happens in memory.

pub mod jobs;

use windows::core::Interface;
use windows::Data::Pdf::{PdfDocument, PdfPageRenderOptions};
use windows::Graphics::Imaging::{BitmapDecoder, BitmapPixelFormat, SoftwareBitmap};
use windows::Media::Ocr::OcrEngine;
use windows::Storage::Streams::{DataWriter, IRandomAccessStream, InMemoryRandomAccessStream};
use windows::Win32::System::Com::{CoInitializeEx, COINIT_MULTITHREADED};

use crate::error::{AppError, AppResult};

/// Upper bound on rendered pages per PDF, to keep background work predictable.
pub const MAX_PDF_PAGES: u32 = 40;

/// Must be called once on every worker thread that touches WinRT.
pub fn init_thread() {
    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
    }
}

fn engine() -> AppResult<OcrEngine> {
    OcrEngine::TryCreateFromUserProfileLanguages()
        .map_err(|_| AppError::Windows("No OCR language is installed in Windows".into()))
}

fn stream_from_bytes(bytes: &[u8]) -> AppResult<IRandomAccessStream> {
    let stream = InMemoryRandomAccessStream::new()?;
    let writer = DataWriter::CreateDataWriter(&stream)?;
    writer.WriteBytes(bytes)?;
    writer.StoreAsync()?.get()?;
    writer.FlushAsync()?.get()?;
    writer.DetachStream()?;
    stream.Seek(0)?;
    Ok(stream.cast()?)
}

fn decode(stream: &IRandomAccessStream) -> AppResult<SoftwareBitmap> {
    let decoder = BitmapDecoder::CreateAsync(stream)?.get()?;
    let bitmap = decoder.GetSoftwareBitmapAsync()?.get()?;
    Ok(SoftwareBitmap::Convert(&bitmap, BitmapPixelFormat::Bgra8)?)
}

fn recognize(engine: &OcrEngine, bitmap: &SoftwareBitmap) -> AppResult<String> {
    let max = OcrEngine::MaxImageDimension()?;
    if bitmap.PixelWidth()? as u32 > max || bitmap.PixelHeight()? as u32 > max {
        // The engine rejects oversized bitmaps; skip rather than fail the whole document.
        return Ok(String::new());
    }
    let result = engine.RecognizeAsync(bitmap)?.get()?;
    Ok(result.Text()?.to_string_lossy())
}

pub fn image_text(bytes: &[u8]) -> AppResult<String> {
    let engine = engine()?;
    let bitmap = decode(&stream_from_bytes(bytes)?)?;
    recognize(&engine, &bitmap)
}

/// OCRs each PDF page. `progress(done, total)` is called after every page.
pub fn pdf_text(bytes: &[u8], mut progress: impl FnMut(u32, u32)) -> AppResult<String> {
    let engine = engine()?;
    let doc = PdfDocument::LoadFromStreamAsync(&stream_from_bytes(bytes)?)?.get()?;
    let total = doc.PageCount()?.min(MAX_PDF_PAGES);
    let mut text = String::new();
    for i in 0..total {
        let page = doc.GetPage(i)?;
        let out = InMemoryRandomAccessStream::new()?;
        // Render at 2x (~192 dpi); the default 96 dpi is too coarse for reliable OCR.
        let opts = PdfPageRenderOptions::new()?;
        let width = (page.Size()?.Width * 2.0) as u32;
        opts.SetDestinationWidth(width.min(OcrEngine::MaxImageDimension()?))?;
        page.RenderWithOptionsToStreamAsync(&out, &opts)?.get()?;
        out.Seek(0)?;
        let bitmap = decode(&out.cast()?)?;
        let page_text = recognize(&engine, &bitmap)?;
        if !page_text.is_empty() {
            if !text.is_empty() {
                text.push('\n');
            }
            text.push_str(&page_text);
        }
        progress(i + 1, total);
    }
    Ok(text)
}
