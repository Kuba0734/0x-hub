//! In-memory image decoding with the Windows Imaging Component. Decodes everything WIC
//! knows (incl. HEIC/HEIF when Microsoft's "HEIF Image Extensions" are installed), applies
//! the EXIF orientation and re-encodes as JPEG for the WebView, which can't show HEIC.

use windows::core::Interface;
use windows::Graphics::Imaging::{
    BitmapAlphaMode, BitmapDecoder, BitmapEncoder, BitmapInterpolationMode, BitmapPixelFormat,
    BitmapTransform, ColorManagementMode, ExifOrientationMode, SoftwareBitmap,
};
use windows::Storage::Streams::{
    DataReader, DataWriter, IRandomAccessStream, InMemoryRandomAccessStream,
};

use crate::error::{AppError, AppResult};

pub fn stream_from_bytes(bytes: &[u8]) -> AppResult<IRandomAccessStream> {
    let stream = InMemoryRandomAccessStream::new()?;
    let writer = DataWriter::CreateDataWriter(&stream)?;
    writer.WriteBytes(bytes)?;
    writer.StoreAsync()?.get()?;
    writer.FlushAsync()?.get()?;
    writer.DetachStream()?;
    stream.Seek(0)?;
    Ok(stream.cast()?)
}

fn unsupported() -> AppError {
    AppError::Invalid(
        "Windows can't decode this image. For HEIC photos, install \"HEIF Image Extensions\" \
         from the Microsoft Store."
            .into(),
    )
}

/// Decodes an image as upright BGRA8, optionally scaled so the longer side is ≤ `max_dim`.
pub fn decode_oriented(
    stream: &IRandomAccessStream,
    max_dim: Option<u32>,
    alpha: BitmapAlphaMode,
) -> AppResult<SoftwareBitmap> {
    let decoder = BitmapDecoder::CreateAsync(stream)
        .and_then(|op| op.get())
        .map_err(|_| unsupported())?;
    let transform = BitmapTransform::new()?;
    if let Some(max) = max_dim {
        // Scaling is applied before rotation, so use the raw (unrotated) size.
        let (w, h) = (decoder.PixelWidth()?, decoder.PixelHeight()?);
        let longest = w.max(h).max(1);
        if longest > max {
            let scale = max as f64 / longest as f64;
            transform.SetScaledWidth(((w as f64 * scale).round() as u32).max(1))?;
            transform.SetScaledHeight(((h as f64 * scale).round() as u32).max(1))?;
            transform.SetInterpolationMode(BitmapInterpolationMode::Fant)?;
        }
    }
    let bitmap = decoder
        .GetSoftwareBitmapTransformedAsync(
            BitmapPixelFormat::Bgra8,
            alpha,
            &transform,
            ExifOrientationMode::RespectExifOrientation,
            ColorManagementMode::ColorManageToSRgb,
        )
        .and_then(|op| op.get())
        .map_err(|_| unsupported())?;
    Ok(bitmap)
}

fn encode(bitmap: &SoftwareBitmap, encoder_id: windows::core::GUID) -> AppResult<Vec<u8>> {
    let out = InMemoryRandomAccessStream::new()?;
    let encoder = BitmapEncoder::CreateAsync(encoder_id, &out)?.get()?;
    encoder.SetSoftwareBitmap(bitmap)?;
    encoder.FlushAsync()?.get()?;
    let size = out.Size()? as u32;
    let reader = DataReader::CreateDataReader(&out.GetInputStreamAt(0)?)?;
    reader.LoadAsync(size)?.get()?;
    let mut buf = vec![0u8; size as usize];
    reader.ReadBytes(&mut buf)?;
    Ok(buf)
}

/// Any WIC-decodable image → upright JPEG, longer side ≤ `max_dim`.
pub fn to_jpeg(bytes: &[u8], max_dim: u32) -> AppResult<Vec<u8>> {
    let bitmap = decode_oriented(
        &stream_from_bytes(bytes)?,
        Some(max_dim),
        BitmapAlphaMode::Ignore,
    )?;
    encode(&bitmap, BitmapEncoder::JpegEncoderId()?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use windows::Graphics::Imaging::BitmapEncoder;

    /// Builds a test image of `w`×`h` in the given container format via WIC.
    fn make_image(w: i32, h: i32, encoder_id: windows::core::GUID) -> AppResult<Vec<u8>> {
        let bmp = SoftwareBitmap::CreateWithAlpha(
            BitmapPixelFormat::Bgra8,
            w,
            h,
            BitmapAlphaMode::Ignore,
        )?;
        encode(&bmp, encoder_id)
    }

    #[test]
    fn png_to_scaled_jpeg() {
        crate::ocr::init_thread();
        let png = make_image(400, 200, BitmapEncoder::PngEncoderId().unwrap()).unwrap();
        let jpeg = to_jpeg(&png, 100).unwrap();
        assert_eq!(&jpeg[..2], &[0xFF, 0xD8]);
        let bmp = decode_oriented(
            &stream_from_bytes(&jpeg).unwrap(),
            None,
            BitmapAlphaMode::Ignore,
        )
        .unwrap();
        assert_eq!(
            (bmp.PixelWidth().unwrap(), bmp.PixelHeight().unwrap()),
            (100, 50)
        );
    }

    #[test]
    fn heic_round_trip_when_codec_installed() {
        crate::ocr::init_thread();
        let Ok(heic) = BitmapEncoder::HeifEncoderId()
            .map_err(AppError::from)
            .and_then(|id| make_image(64, 32, id))
        else {
            eprintln!("HEIF codec not installed; skipping");
            return;
        };
        let jpeg = to_jpeg(&heic, 2048).unwrap();
        assert_eq!(&jpeg[..2], &[0xFF, 0xD8]);
    }

    #[test]
    fn garbage_is_a_friendly_error() {
        crate::ocr::init_thread();
        assert!(matches!(
            to_jpeg(b"not an image", 100),
            Err(AppError::Invalid(_))
        ));
    }
}
