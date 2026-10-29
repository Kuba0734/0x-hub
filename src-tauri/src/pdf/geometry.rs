//! Maps rectangles picked on the displayed (rotated) page into PDF user space.

use serde::Deserialize;

/// A rectangle in 0..1 page coordinates, origin top-left of the page as displayed.
#[derive(Debug, Clone, Copy, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NormRect {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
}

impl NormRect {
    /// Clamps to the page; `None` if nothing (or something non-finite) is left.
    pub fn clamped(self) -> Option<NormRect> {
        let vals = [self.x, self.y, self.w, self.h];
        if vals.iter().any(|v| !v.is_finite()) {
            return None;
        }
        let x0 = self.x.clamp(0.0, 1.0);
        let y0 = self.y.clamp(0.0, 1.0);
        let x1 = (self.x + self.w).clamp(0.0, 1.0);
        let y1 = (self.y + self.h).clamp(0.0, 1.0);
        (x1 > x0 && y1 > y0).then_some(NormRect {
            x: x0,
            y: y0,
            w: x1 - x0,
            h: y1 - y0,
        })
    }

    /// Pixel bounds on a `width`×`height` raster, grown by one pixel to cover anti-aliasing.
    pub fn to_pixels(self, width: u32, height: u32) -> (u32, u32, u32, u32) {
        let (w, h) = (width as f64, height as f64);
        let x0 = ((self.x * w).floor() - 1.0).max(0.0) as u32;
        let y0 = ((self.y * h).floor() - 1.0).max(0.0) as u32;
        let x1 = (((self.x + self.w) * w).ceil() + 1.0).min(w) as u32;
        let y1 = (((self.y + self.h) * h).ceil() + 1.0).min(h) as u32;
        (x0, y0, x1, y1)
    }
}

/// The visible box of a page in user space plus its `/Rotate` (0, 90, 180 or 270).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct PageFrame {
    pub x0: f64,
    pub y0: f64,
    pub x1: f64,
    pub y1: f64,
    pub rotate: i32,
}

pub fn normalize_rotation(deg: i64) -> i32 {
    (((deg / 90) * 90).rem_euclid(360)) as i32
}

impl PageFrame {
    pub fn new(b: [f64; 4], rotate: i32) -> PageFrame {
        PageFrame {
            x0: b[0].min(b[2]),
            y0: b[1].min(b[3]),
            x1: b[0].max(b[2]),
            y1: b[1].max(b[3]),
            rotate: normalize_rotation(rotate as i64),
        }
    }

    /// Displayed point (u right, v down, both 0..1) → user-space point.
    /// Viewers rotate pages clockwise by `/Rotate`.
    pub fn to_user(self, u: f64, v: f64) -> (f64, f64) {
        let (w, h) = (self.x1 - self.x0, self.y1 - self.y0);
        match self.rotate {
            90 => (self.x0 + v * w, self.y0 + u * h),
            180 => (self.x1 - u * w, self.y0 + v * h),
            270 => (self.x1 - v * w, self.y1 - u * h),
            _ => (self.x0 + u * w, self.y0 + (1.0 - v) * h),
        }
    }

    /// `cm` matrix that draws a unit-square image upright into `r` on the displayed page.
    pub fn image_matrix(self, r: NormRect) -> [f64; 6] {
        let bl = self.to_user(r.x, r.y + r.h);
        let br = self.to_user(r.x + r.w, r.y + r.h);
        let tl = self.to_user(r.x, r.y);
        [
            br.0 - bl.0,
            br.1 - bl.1,
            tl.0 - bl.0,
            tl.1 - bl.1,
            bl.0,
            bl.1,
        ]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const A4: [f64; 4] = [0.0, 0.0, 600.0, 800.0];

    fn close(a: (f64, f64), b: (f64, f64)) -> bool {
        (a.0 - b.0).abs() < 1e-9 && (a.1 - b.1).abs() < 1e-9
    }

    #[test]
    fn corners_map_for_every_rotation() {
        // Displayed top-left corner for each rotation.
        let cases = [
            (0, (0.0, 800.0)),
            (90, (0.0, 0.0)),
            (180, (600.0, 0.0)),
            (270, (600.0, 800.0)),
        ];
        for (rot, top_left) in cases {
            let f = PageFrame::new(A4, rot);
            assert!(close(f.to_user(0.0, 0.0), top_left), "rotate {rot}");
        }
        // Rotated 90°: displayed top-right is the user-space top-left.
        assert!(close(
            PageFrame::new(A4, 90).to_user(1.0, 0.0),
            (0.0, 800.0)
        ));
    }

    #[test]
    fn honours_crop_box_offset() {
        let f = PageFrame::new([50.0, 100.0, 650.0, 900.0], 0);
        assert!(close(f.to_user(0.5, 0.5), (350.0, 500.0)));
    }

    #[test]
    fn image_matrix_unrotated() {
        let f = PageFrame::new(A4, 0);
        let m = f.image_matrix(NormRect {
            x: 0.5,
            y: 0.0,
            w: 0.25,
            h: 0.125,
        });
        assert_eq!(m, [150.0, 0.0, 0.0, 100.0, 300.0, 700.0]);
    }

    #[test]
    fn image_matrix_rotated_keeps_image_upright() {
        // On a page shown rotated 90°, the image's x axis runs along user-space +y.
        let m = PageFrame::new(A4, 90).image_matrix(NormRect {
            x: 0.0,
            y: 0.0,
            w: 1.0,
            h: 1.0,
        });
        assert_eq!(m, [0.0, 800.0, -600.0, 0.0, 600.0, 0.0]);
    }

    #[test]
    fn rects_are_clamped() {
        let r = NormRect {
            x: -0.5,
            y: 0.9,
            w: 1.0,
            h: 0.5,
        };
        let c = r.clamped().unwrap();
        assert!((c.w - 0.5).abs() < 1e-9 && (c.h - 0.1).abs() < 1e-9);
        assert!(NormRect {
            x: 2.0,
            y: 0.0,
            w: 1.0,
            h: 1.0
        }
        .clamped()
        .is_none());
        assert!(NormRect {
            x: f64::NAN,
            y: 0.0,
            w: 1.0,
            h: 1.0
        }
        .clamped()
        .is_none());
        let px = NormRect {
            x: 0.5,
            y: 0.5,
            w: 0.5,
            h: 0.5,
        }
        .to_pixels(100, 10);
        assert_eq!(px, (49, 4, 100, 10));
    }

    #[test]
    fn rotations_normalize() {
        assert_eq!(normalize_rotation(-90), 270);
        assert_eq!(normalize_rotation(450), 90);
        assert_eq!(normalize_rotation(0), 0);
    }
}
