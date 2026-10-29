//! Content-stream operators for things placed on a page: images (signatures), text,
//! check marks, crosses and white cover boxes. All geometry comes from the displayed
//! (rotated) page via [`PageFrame`], so marks appear upright however the page is rotated.

use super::geometry::{NormRect, PageFrame};

/// Resource name of the Helvetica font added for text marks.
pub const FONT_NAME: &str = "ZxHelv";
/// Baseline of the first line below the top of a text box, in font sizes. Matches the
/// editor's preview (Arial, line-height 1.2), which is metric-compatible with Helvetica.
const FIRST_BASELINE: f64 = 0.9465;
const LINE_HEIGHT: f64 = 1.2;
/// Most characters per text mark; anything longer is cut off.
const MAX_TEXT: usize = 4000;

#[derive(Debug, Clone, PartialEq)]
pub enum MarkKind {
    /// Index into the images passed to `edit`.
    Image(usize),
    /// `size` is the font size as a fraction of the displayed page height.
    Text {
        text: String,
        size: f64,
    },
    Check,
    Cross,
    /// Opaque white box. It only covers visually; the content underneath stays in the file.
    Cover,
}

/// Something placed on output page `page` (0-based) at `rect` of the displayed page.
#[derive(Debug, Clone, PartialEq)]
pub struct Mark {
    pub page: usize,
    pub rect: NormRect,
    pub kind: MarkKind,
}

fn m6(m: [f64; 6]) -> String {
    format!(
        "{:.4} {:.4} {:.4} {:.4} {:.4} {:.4} cm",
        m[0], m[1], m[2], m[3], m[4], m[5]
    )
}

/// Operators for one mark. `image_name` is the XObject name for image marks.
pub fn ops(frame: PageFrame, mark: &Mark, image_name: Option<&str>) -> Vec<u8> {
    let r = match &mark.kind {
        // Text boxes are only positioned by their top-left corner.
        MarkKind::Text { .. } => mark.rect,
        _ => match mark.rect.clamped() {
            Some(r) => r,
            None => return vec![],
        },
    };
    let unit = m6(frame.image_matrix(r));
    match &mark.kind {
        MarkKind::Image(_) => match image_name {
            Some(name) => format!("q {unit} /{name} Do Q\n").into_bytes(),
            None => vec![],
        },
        MarkKind::Check => {
            format!("q {unit} 0 g 0 G 0.12 w 1 J 1 j 0.15 0.5 m 0.4 0.22 l 0.85 0.8 l S Q\n")
                .into_bytes()
        }
        MarkKind::Cross => format!(
            "q {unit} 0 G 0.12 w 1 J 0.18 0.18 m 0.82 0.82 l S 0.18 0.82 m 0.82 0.18 l S Q\n"
        )
        .into_bytes(),
        MarkKind::Cover => format!("q {unit} 1 g 0 0 1 1 re f Q\n").into_bytes(),
        MarkKind::Text { text, size } => text_ops(frame, r, text, *size),
    }
}

fn text_ops(frame: PageFrame, r: NormRect, text: &str, size: f64) -> Vec<u8> {
    let (_, page_h) = frame.displayed_size();
    let pt = (size * page_h).clamp(2.0, 400.0);
    if !pt.is_finite() || text.trim().is_empty() {
        return vec![];
    }
    // A coordinate system in points with its origin at the box's top-left corner and the
    // axes along the displayed page (x right, y up).
    let o = frame.to_user(r.x.clamp(0.0, 1.0), r.y.clamp(0.0, 1.0));
    let right = sub(frame.to_user(1.0, 0.0), frame.to_user(0.0, 0.0));
    let up = sub(frame.to_user(0.0, 0.0), frame.to_user(0.0, 1.0));
    let (ux, uy) = (unit(right), unit(up));
    let mut out = format!(
        "q {} BT /{FONT_NAME} {pt:.2} Tf 0 g {:.2} TL 0 {:.2} Td\n",
        m6([ux.0, ux.1, uy.0, uy.1, o.0, o.1]),
        pt * LINE_HEIGHT,
        -pt * FIRST_BASELINE,
    )
    .into_bytes();
    let clipped: String = text.chars().take(MAX_TEXT).collect();
    for (i, line) in clipped.lines().enumerate() {
        if i > 0 {
            out.extend_from_slice(b"T* ");
        }
        out.push(b'(');
        out.extend(win_ansi_literal(line));
        out.extend_from_slice(b") Tj\n");
    }
    out.extend_from_slice(b"ET Q\n");
    out
}

fn sub(a: (f64, f64), b: (f64, f64)) -> (f64, f64) {
    (a.0 - b.0, a.1 - b.1)
}

fn unit(v: (f64, f64)) -> (f64, f64) {
    let len = (v.0 * v.0 + v.1 * v.1).sqrt().max(1e-9);
    (v.0 / len, v.1 / len)
}

/// WinAnsiEncoding bytes of `s`, escaped for a PDF literal string. Characters the
/// standard fonts can't show become `?`.
pub fn win_ansi_literal(s: &str) -> Vec<u8> {
    let mut out = Vec::with_capacity(s.len());
    for c in s.chars() {
        let b = match c {
            '\u{20}'..='\u{7E}' => c as u8,
            '\u{A0}'..='\u{FF}' => c as u32 as u8,
            '€' => 0x80,
            '‚' => 0x82,
            '„' => 0x84,
            '…' => 0x85,
            '‘' => 0x91,
            '’' => 0x92,
            '“' => 0x93,
            '”' => 0x94,
            '•' => 0x95,
            '–' => 0x96,
            '—' => 0x97,
            '\t' => b' ',
            _ => b'?',
        };
        if matches!(b, b'(' | b')' | b'\\') {
            out.push(b'\\');
        }
        out.push(b);
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    const A4: [f64; 4] = [0.0, 0.0, 595.0, 842.0];

    fn mark(kind: MarkKind) -> Mark {
        Mark {
            page: 0,
            rect: NormRect {
                x: 0.1,
                y: 0.1,
                w: 0.2,
                h: 0.05,
            },
            kind,
        }
    }

    #[test]
    fn encodes_german_text_and_escapes() {
        assert_eq!(
            win_ansi_literal("Grüße (ä)"),
            b"Gr\xFC\xDFe \\(\xE4\\)".to_vec()
        );
        assert_eq!(win_ansi_literal("5 €"), b"5 \x80".to_vec());
        assert_eq!(win_ansi_literal("日本"), b"??".to_vec());
        assert_eq!(win_ansi_literal("a\\b"), b"a\\\\b".to_vec());
    }

    #[test]
    fn text_has_lines_size_and_upright_matrix() {
        let frame = PageFrame::new(A4, 0);
        let m = mark(MarkKind::Text {
            text: "Berlin\n29.10.2026".into(),
            size: 12.0 / 842.0,
        });
        let s = String::from_utf8_lossy(&ops(frame, &m, None)).into_owned();
        assert!(s.contains("/ZxHelv 12.00 Tf"), "{s}");
        assert!(s.contains("(Berlin) Tj") && s.contains("T* (29.10.2026) Tj"));
        // Origin is the box's top-left corner in user space (y measured from the bottom).
        assert!(
            s.contains("1.0000 0.0000 0.0000 1.0000 59.5000 757.8000 cm"),
            "{s}"
        );
        let empty = mark(MarkKind::Text {
            text: "  ".into(),
            size: 0.02,
        });
        assert!(ops(frame, &empty, None).is_empty());
    }

    #[test]
    fn rotated_text_runs_along_the_displayed_page() {
        // Shown rotated 90°: displayed "right" is user-space +y, displayed "up" is -x.
        let frame = PageFrame::new(A4, 90);
        let m = mark(MarkKind::Text {
            text: "x".into(),
            size: 0.02,
        });
        let s = String::from_utf8_lossy(&ops(frame, &m, None)).into_owned();
        assert!(s.contains("0.0000 1.0000 -1.0000 0.0000"), "{s}");
        // Font size follows the displayed height, which is the user-space width here.
        assert!(s.contains("/ZxHelv 11.90 Tf"), "{s}");
    }

    #[test]
    fn shapes_and_images() {
        let frame = PageFrame::new(A4, 0);
        let check = String::from_utf8(ops(frame, &mark(MarkKind::Check), None)).unwrap();
        assert!(check.contains(" S Q"));
        let cover = String::from_utf8(ops(frame, &mark(MarkKind::Cover), None)).unwrap();
        assert!(cover.contains("1 g 0 0 1 1 re f"));
        let img = String::from_utf8(ops(frame, &mark(MarkKind::Image(0)), Some("Im9"))).unwrap();
        assert!(img.contains("/Im9 Do"));
        assert!(ops(frame, &mark(MarkKind::Image(0)), None).is_empty());
    }
}
