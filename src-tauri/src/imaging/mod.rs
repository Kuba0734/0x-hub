//! In-memory image decoding with the Windows Imaging Component. Decodes everything WIC
//! knows (incl. HEIC/HEIF when Microsoft's "HEIF Image Extensions" are installed), applies
//! the EXIF orientation and re-encodes as JPEG for the WebView, which can't show HEIC.

pub mod ink;

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

fn open_decoder(stream: &IRandomAccessStream) -> AppResult<BitmapDecoder> {
    BitmapDecoder::CreateAsync(stream)
        .and_then(|op| op.get())
        .map_err(|_| unsupported())
}

/// Scales so the longer side is ≤ `max_dim`. Scaling is applied before rotation, so this
/// uses the raw (unrotated) size.
fn scaled_transform(decoder: &BitmapDecoder, max_dim: Option<u32>) -> AppResult<BitmapTransform> {
    let transform = BitmapTransform::new()?;
    if let Some(max) = max_dim {
        let (w, h) = (decoder.PixelWidth()?, decoder.PixelHeight()?);
        let longest = w.max(h).max(1);
        if longest > max {
            let scale = max as f64 / longest as f64;
            transform.SetScaledWidth(((w as f64 * scale).round() as u32).max(1))?;
            transform.SetScaledHeight(((h as f64 * scale).round() as u32).max(1))?;
            transform.SetInterpolationMode(BitmapInterpolationMode::Fant)?;
        }
    }
    Ok(transform)
}

/// Decodes an image as upright BGRA8, optionally scaled so the longer side is ≤ `max_dim`.
pub fn decode_oriented(
    stream: &IRandomAccessStream,
    max_dim: Option<u32>,
    alpha: BitmapAlphaMode,
) -> AppResult<SoftwareBitmap> {
    let decoder = open_decoder(stream)?;
    let transform = scaled_transform(&decoder, max_dim)?;
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

/// Raw upright BGRA8 pixels, row-major, 4 bytes per pixel.
pub struct Pixels {
    pub width: u32,
    pub height: u32,
    pub bgra: Vec<u8>,
}

impl Pixels {
    /// Fills a rectangle (in pixels, clamped to the image) with opaque black.
    pub fn fill_black(&mut self, x0: u32, y0: u32, x1: u32, y1: u32) {
        let (x1, y1) = (x1.min(self.width), y1.min(self.height));
        for y in y0.min(y1)..y1 {
            let row = (y * self.width) as usize * 4;
            for x in x0.min(x1)..x1 {
                let i = row + x as usize * 4;
                self.bgra[i..i + 4].copy_from_slice(&[0, 0, 0, 255]);
            }
        }
    }
}

/// Decodes upright pixels from a stream, longer side ≤ `max_dim`.
pub fn decode_stream_pixels(
    stream: &IRandomAccessStream,
    max_dim: Option<u32>,
    alpha: BitmapAlphaMode,
) -> AppResult<Pixels> {
    let decoder = open_decoder(stream)?;
    let transform = scaled_transform(&decoder, max_dim)?;
    let provider = decoder
        .GetPixelDataTransformedAsync(
            BitmapPixelFormat::Bgra8,
            alpha,
            &transform,
            ExifOrientationMode::RespectExifOrientation,
            ColorManagementMode::ColorManageToSRgb,
        )
        .and_then(|op| op.get())
        .map_err(|_| unsupported())?;
    let bgra = provider.DetachPixelData()?.to_vec();
    // Oriented size: a 90° EXIF rotation swaps width and height.
    let (w, h) = (transform.ScaledWidth()?, transform.ScaledHeight()?);
    let (mut width, mut height) = if w > 0 && h > 0 {
        (w, h)
    } else {
        (
            decoder.OrientedPixelWidth()?,
            decoder.OrientedPixelHeight()?,
        )
    };
    if width as usize * height as usize * 4 != bgra.len() {
        std::mem::swap(&mut width, &mut height);
    }
    if width as usize * height as usize * 4 != bgra.len() {
        return Err(unsupported());
    }
    Ok(Pixels {
        width,
        height,
        bgra,
    })
}

pub fn decode_pixels(
    bytes: &[u8],
    max_dim: Option<u32>,
    alpha: BitmapAlphaMode,
) -> AppResult<Pixels> {
    decode_stream_pixels(&stream_from_bytes(bytes)?, max_dim, alpha)
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Format {
    Jpeg,
    Png,
}

/// Encodes pixels. Nothing from the source file (EXIF, GPS, XMP) is carried over.
pub fn encode_pixels(p: &Pixels, format: Format) -> AppResult<Vec<u8>> {
    let (id, alpha) = match format {
        Format::Jpeg => (BitmapEncoder::JpegEncoderId()?, BitmapAlphaMode::Ignore),
        Format::Png => (BitmapEncoder::PngEncoderId()?, BitmapAlphaMode::Straight),
    };
    let out = InMemoryRandomAccessStream::new()?;
    let encoder = BitmapEncoder::CreateAsync(id, &out)?.get()?;
    encoder.SetPixelData(
        BitmapPixelFormat::Bgra8,
        alpha,
        p.width,
        p.height,
        96.0,
        96.0,
        &p.bgra,
    )?;
    encoder.FlushAsync()?.get()?;
    read_stream(&out)
}

fn read_stream(out: &InMemoryRandomAccessStream) -> AppResult<Vec<u8>> {
    let size = out.Size()? as u32;
    let reader = DataReader::CreateDataReader(&out.GetInputStreamAt(0)?)?;
    reader.LoadAsync(size)?.get()?;
    let mut buf = vec![0u8; size as usize];
    reader.ReadBytes(&mut buf)?;
    Ok(buf)
}

fn encode(bitmap: &SoftwareBitmap, encoder_id: windows::core::GUID) -> AppResult<Vec<u8>> {
    let out = InMemoryRandomAccessStream::new()?;
    let encoder = BitmapEncoder::CreateAsync(encoder_id, &out)?.get()?;
    encoder.SetSoftwareBitmap(bitmap)?;
    encoder.FlushAsync()?.get()?;
    read_stream(&out)
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
    fn pixels_round_trip_with_black_fill() {
        crate::ocr::init_thread();
        let mut p = Pixels {
            width: 8,
            height: 4,
            bgra: vec![255; 8 * 4 * 4],
        };
        p.fill_black(2, 1, 20, 3);
        let png = encode_pixels(&p, Format::Png).unwrap();
        let back = decode_pixels(&png, None, BitmapAlphaMode::Straight).unwrap();
        assert_eq!((back.width, back.height), (8, 4));
        let px = |x: usize, y: usize| &back.bgra[(y * 8 + x) * 4..(y * 8 + x) * 4 + 4];
        assert_eq!(px(0, 0), &[255, 255, 255, 255]);
        assert_eq!(px(2, 1), &[0, 0, 0, 255]);
        assert_eq!(px(7, 2), &[0, 0, 0, 255]);
        assert_eq!(px(7, 3), &[255, 255, 255, 255]);
        let small = decode_pixels(&png, Some(4), BitmapAlphaMode::Ignore).unwrap();
        assert_eq!((small.width, small.height), (4, 2));
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
