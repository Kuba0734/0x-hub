//! Turns a drawn or photographed signature into black ink on a transparent background,
//! cropped to the strokes.

use windows::Graphics::Imaging::BitmapAlphaMode;

use super::{decode_pixels, Pixels};
use crate::error::{AppError, AppResult};

const MAX_DIM: u32 = 1600;
/// Alpha below this counts as background when cropping.
const CROP_ALPHA: u8 = 16;
const PAD: u32 = 6;

/// Drawn signatures come with transparency; scans and photos of paper don't.
fn has_transparency(p: &Pixels) -> bool {
    let clear = p.bgra.chunks_exact(4).filter(|px| px[3] < 250).count();
    clear * 50 > p.bgra.len() / 4
}

fn luminance(px: &[u8]) -> f32 {
    0.114 * px[0] as f32 + 0.587 * px[1] as f32 + 0.299 * px[2] as f32
}

/// Ink opacity from darkness relative to the paper, so shadows and paper texture drop out.
fn alpha_from_paper(p: &Pixels) -> Vec<u8> {
    let mut lum: Vec<f32> = p.bgra.chunks_exact(4).map(luminance).collect();
    let mut sorted = lum.clone();
    sorted.sort_by(f32::total_cmp);
    let paper = sorted[sorted.len() * 9 / 10].max(64.0);
    for l in lum.iter_mut() {
        let dark = paper - *l;
        *l = if dark < 28.0 {
            0.0
        } else {
            (dark / (paper * 0.55) * 255.0).min(255.0)
        };
    }
    lum.into_iter().map(|a| a as u8).collect()
}

pub fn to_ink(bytes: &[u8]) -> AppResult<Pixels> {
    let p = decode_pixels(bytes, Some(MAX_DIM), BitmapAlphaMode::Straight)?;
    if p.width == 0 || p.height == 0 {
        return Err(no_signature());
    }
    let alpha: Vec<u8> = if has_transparency(&p) {
        p.bgra.chunks_exact(4).map(|px| px[3]).collect()
    } else {
        alpha_from_paper(&p)
    };
    crop(&alpha, p.width, p.height)
}

fn no_signature() -> AppError {
    AppError::Invalid("No signature found in this image".into())
}

fn crop(alpha: &[u8], width: u32, height: u32) -> AppResult<Pixels> {
    let (mut x0, mut y0, mut x1, mut y1) = (u32::MAX, u32::MAX, 0, 0);
    for y in 0..height {
        for x in 0..width {
            if alpha[(y * width + x) as usize] >= CROP_ALPHA {
                x0 = x0.min(x);
                y0 = y0.min(y);
                x1 = x1.max(x + 1);
                y1 = y1.max(y + 1);
            }
        }
    }
    if x0 >= x1 || y0 >= y1 {
        return Err(no_signature());
    }
    let (x0, y0) = (x0.saturating_sub(PAD), y0.saturating_sub(PAD));
    let (x1, y1) = ((x1 + PAD).min(width), (y1 + PAD).min(height));
    let (w, h) = (x1 - x0, y1 - y0);
    let mut bgra = Vec::with_capacity((w * h * 4) as usize);
    for y in y0..y1 {
        for x in x0..x1 {
            bgra.extend_from_slice(&[0, 0, 0, alpha[(y * width + x) as usize]]);
        }
    }
    Ok(Pixels {
        width: w,
        height: h,
        bgra,
    })
}

#[cfg(test)]
mod tests {
    use super::super::{encode_pixels, Format};
    use super::*;

    fn canvas(w: u32, h: u32, bg: [u8; 4]) -> Pixels {
        Pixels {
            width: w,
            height: h,
            bgra: bg.repeat((w * h) as usize),
        }
    }

    fn paint(p: &mut Pixels, x0: u32, y0: u32, x1: u32, y1: u32, c: [u8; 4]) {
        for y in y0..y1 {
            for x in x0..x1 {
                let i = ((y * p.width + x) * 4) as usize;
                p.bgra[i..i + 4].copy_from_slice(&c);
            }
        }
    }

    #[test]
    fn drawn_strokes_keep_their_alpha_and_are_cropped() {
        crate::ocr::init_thread();
        let mut p = canvas(200, 100, [0, 0, 0, 0]);
        paint(&mut p, 50, 40, 150, 60, [255, 255, 255, 255]);
        let ink = to_ink(&encode_pixels(&p, Format::Png).unwrap()).unwrap();
        assert_eq!((ink.width, ink.height), (100 + 2 * PAD, 20 + 2 * PAD));
        // White strokes become black ink.
        let mid = ((ink.height / 2 * ink.width + ink.width / 2) * 4) as usize;
        assert_eq!(&ink.bgra[mid..mid + 4], &[0, 0, 0, 255]);
        assert_eq!(ink.bgra[3], 0);
    }

    #[test]
    fn photographed_paper_turns_transparent() {
        crate::ocr::init_thread();
        let mut p = canvas(120, 80, [235, 235, 235, 255]);
        paint(&mut p, 10, 30, 110, 34, [30, 30, 30, 255]);
        let ink = to_ink(&encode_pixels(&p, Format::Jpeg).unwrap()).unwrap();
        assert!(ink.height < 30, "cropped to the stroke, got {}", ink.height);
        assert!(ink.bgra.chunks_exact(4).any(|px| px[3] > 200));
        assert_eq!(ink.bgra[3], 0);
    }

    #[test]
    fn blank_images_are_rejected() {
        crate::ocr::init_thread();
        let p = canvas(50, 50, [255, 255, 255, 255]);
        assert!(to_ink(&encode_pixels(&p, Format::Png).unwrap()).is_err());
    }
}
