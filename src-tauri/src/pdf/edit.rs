//! Page edits on an existing PDF: reorder, delete, rotate, and stamp images (signatures).

use std::collections::HashSet;

use lopdf::{dictionary, Dictionary, Document, Object, ObjectId, Stream};
use serde::Deserialize;

use super::geometry::{normalize_rotation, NormRect, PageFrame};
use super::pdf_err;
use crate::error::{AppError, AppResult};
use crate::imaging::Pixels;

/// One page of the result: which source page (0-based) and how much to rotate it.
#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PageOp {
    pub source: u32,
    /// Extra clockwise rotation in degrees (multiples of 90).
    pub rotate: i32,
}

/// An image placed on output page `page` (0-based) at `rect` of the displayed page.
pub struct Stamp {
    pub page: usize,
    pub rect: NormRect,
    /// Index into the `images` passed to [`edit`].
    pub image: usize,
}

/// Attributes a page may inherit from its ancestors in the page tree.
const INHERITABLE: [&[u8]; 4] = [b"Resources", b"MediaBox", b"CropBox", b"Rotate"];

pub fn load(bytes: &[u8]) -> AppResult<Document> {
    let doc = Document::load_mem(bytes).map_err(pdf_err)?;
    if doc.is_encrypted() {
        return Err(AppError::Invalid(
            "This PDF is password-protected and can't be edited".into(),
        ));
    }
    Ok(doc)
}

#[cfg(test)]
pub fn page_count(bytes: &[u8]) -> AppResult<u32> {
    Ok(load(bytes)?.get_pages().len() as u32)
}

/// Applies the new page list and stamps; returns the saved PDF.
pub fn edit(
    bytes: &[u8],
    ops: &[PageOp],
    stamps: &[Stamp],
    images: &[Pixels],
) -> AppResult<Vec<u8>> {
    let mut doc = load(bytes)?;
    let pages: Vec<ObjectId> = doc.get_pages().into_values().collect();
    validate(ops, pages.len())?;

    // Copy inherited attributes into each kept page so it no longer depends on the old tree.
    let kept: Vec<ObjectId> = ops.iter().map(|o| pages[o.source as usize]).collect();
    for id in &kept {
        flatten_inherited(&mut doc, *id)?;
    }
    let root = pages_root(&doc)?;
    for (op, id) in ops.iter().zip(&kept) {
        let page = doc.get_dictionary_mut(*id).map_err(pdf_err)?;
        let current = page.get(b"Rotate").and_then(Object::as_i64).unwrap_or(0);
        page.set(
            "Rotate",
            normalize_rotation(current + op.rotate as i64) as i64,
        );
        page.set("Parent", Object::Reference(root));
    }
    {
        let node = doc.get_dictionary_mut(root).map_err(pdf_err)?;
        node.set(
            "Kids",
            kept.iter()
                .map(|id| Object::Reference(*id))
                .collect::<Vec<_>>(),
        );
        node.set("Count", kept.len() as i64);
    }

    let xobjects: Vec<ObjectId> = images
        .iter()
        .map(|img| add_image_xobject(&mut doc, img))
        .collect();
    for (i, id) in kept.iter().enumerate() {
        let on_page: Vec<&Stamp> = stamps.iter().filter(|s| s.page == i).collect();
        if !on_page.is_empty() {
            stamp_page(&mut doc, *id, &on_page, &xobjects)?;
        }
    }

    // Deleted pages disappear completely, including content only they referenced.
    let keep: HashSet<ObjectId> = kept.iter().copied().collect();
    for id in pages.iter().filter(|id| !keep.contains(id)) {
        doc.delete_object(*id);
    }
    doc.prune_objects();
    doc.compress();
    let mut out = Vec::new();
    doc.save_to(&mut out)?;
    Ok(out)
}

fn validate(ops: &[PageOp], count: usize) -> AppResult<()> {
    if ops.is_empty() {
        return Err(AppError::Invalid("A PDF needs at least one page".into()));
    }
    let mut seen = HashSet::new();
    for op in ops {
        if op.source as usize >= count || !seen.insert(op.source) || op.rotate % 90 != 0 {
            return Err(AppError::Invalid("Invalid page list".into()));
        }
    }
    Ok(())
}

fn pages_root(doc: &Document) -> AppResult<ObjectId> {
    doc.catalog()
        .and_then(|c| c.get(b"Pages"))
        .and_then(Object::as_reference)
        .map_err(pdf_err)
}

fn flatten_inherited(doc: &mut Document, page_id: ObjectId) -> AppResult<()> {
    let mut found: Vec<(&[u8], Object)> = vec![];
    let page = doc.get_dictionary(page_id).map_err(pdf_err)?;
    let mut parent = page.get(b"Parent").and_then(Object::as_reference).ok();
    // The depth cap guards against malformed (cyclic) trees.
    for _ in 0..64 {
        let Some(pid) = parent else {
            break;
        };
        let Ok(node) = doc.get_dictionary(pid) else {
            break;
        };
        for key in INHERITABLE {
            let missing = !page.has(key) && !found.iter().any(|(k, _)| *k == key);
            if missing {
                if let Ok(v) = node.get(key) {
                    found.push((key, v.clone()));
                }
            }
        }
        parent = node.get(b"Parent").and_then(Object::as_reference).ok();
    }
    let page = doc.get_dictionary_mut(page_id).map_err(pdf_err)?;
    for (k, v) in found {
        page.set(k, v);
    }
    if !page.has(b"MediaBox") {
        page.set("MediaBox", vec![0.into(), 0.into(), 612.into(), 792.into()]);
    }
    Ok(())
}

fn number(o: &Object) -> Option<f64> {
    match o {
        Object::Integer(i) => Some(*i as f64),
        Object::Real(r) => Some(*r as f64),
        _ => None,
    }
}

fn rect_of(doc: &Document, page: &Dictionary, key: &[u8]) -> Option<[f64; 4]> {
    let (_, obj) = doc.dereference(page.get(key).ok()?).ok()?;
    let v: Vec<f64> = obj.as_array().ok()?.iter().filter_map(number).collect();
    (v.len() == 4).then(|| [v[0], v[1], v[2], v[3]])
}

pub fn frame_of(doc: &Document, page: &Dictionary) -> PageFrame {
    let b = rect_of(doc, page, b"CropBox")
        .or_else(|| rect_of(doc, page, b"MediaBox"))
        .unwrap_or([0.0, 0.0, 612.0, 792.0]);
    let rotate = page.get(b"Rotate").and_then(Object::as_i64).unwrap_or(0);
    PageFrame::new(b, normalize_rotation(rotate))
}

/// RGB image with a soft mask from the alpha channel, both Flate-compressed.
fn add_image_xobject(doc: &mut Document, img: &Pixels) -> ObjectId {
    let n = (img.width * img.height) as usize;
    let mut rgb = Vec::with_capacity(n * 3);
    let mut alpha = Vec::with_capacity(n);
    for px in img.bgra.chunks_exact(4) {
        rgb.extend_from_slice(&[px[2], px[1], px[0]]);
        alpha.push(px[3]);
    }
    let image_dict = |space: &str| {
        dictionary! {
            "Type" => "XObject",
            "Subtype" => "Image",
            "Width" => img.width as i64,
            "Height" => img.height as i64,
            "ColorSpace" => space,
            "BitsPerComponent" => 8,
        }
    };
    let mut mask = Stream::new(image_dict("DeviceGray"), alpha);
    let _ = mask.compress();
    let mask_id = doc.add_object(mask);
    let mut image = Stream::new(image_dict("DeviceRGB"), rgb);
    let _ = image.compress();
    image.dict.set("SMask", Object::Reference(mask_id));
    doc.add_object(image)
}

/// Resolves `key` in `dict` (inline or by reference) to an owned dictionary.
fn owned_dict(doc: &Document, dict: &Dictionary, key: &[u8]) -> Dictionary {
    dict.get(key)
        .ok()
        .and_then(|o| doc.dereference(o).ok())
        .and_then(|(_, r)| r.as_dict().ok().cloned())
        .unwrap_or_default()
}

fn stamp_page(
    doc: &mut Document,
    page_id: ObjectId,
    stamps: &[&Stamp],
    xobjects: &[ObjectId],
) -> AppResult<()> {
    let page = doc.get_dictionary(page_id).map_err(pdf_err)?.clone();
    let frame = frame_of(doc, &page);

    // Resources and their XObject dictionary are copied inline, so pages sharing them keep theirs.
    let mut resources = owned_dict(doc, &page, b"Resources");
    let mut xdict = owned_dict(doc, &resources, b"XObject");

    let mut ops = String::new();
    for (n, s) in stamps.iter().enumerate() {
        let (Some(&xobj), Some(rect)) = (xobjects.get(s.image), s.rect.clamped()) else {
            continue;
        };
        let name = format!("ZxSig{n}");
        xdict.set(name.as_bytes(), Object::Reference(xobj));
        let m = frame.image_matrix(rect);
        ops.push_str(&format!(
            "q {:.4} {:.4} {:.4} {:.4} {:.4} {:.4} cm /{name} Do Q\n",
            m[0], m[1], m[2], m[3], m[4], m[5]
        ));
    }
    resources.set("XObject", Object::Dictionary(xdict));

    // Wrap the existing content in q/Q so its graphics state can't leak into the stamp.
    let mut contents: Vec<Object> = match page.get(b"Contents") {
        Ok(Object::Reference(id)) => vec![Object::Reference(*id)],
        Ok(Object::Array(a)) => a.clone(),
        _ => vec![],
    };
    let open = doc.add_object(Stream::new(Dictionary::new(), b"q\n".to_vec()));
    let close = doc.add_object(Stream::new(Dictionary::new(), b"\nQ\n".to_vec()));
    let stamp = doc.add_object(Stream::new(Dictionary::new(), ops.into_bytes()));
    contents.insert(0, Object::Reference(open));
    contents.push(Object::Reference(close));
    contents.push(Object::Reference(stamp));

    let page = doc.get_dictionary_mut(page_id).map_err(pdf_err)?;
    page.set("Resources", Object::Dictionary(resources));
    page.set("Contents", contents);
    Ok(())
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;

    /// A small PDF with `n` pages; page i draws the marker text `Page<i>`.
    pub fn sample_pdf(n: usize) -> Vec<u8> {
        let mut doc = Document::with_version("1.7");
        let pages_id = doc.new_object_id();
        let font = doc.add_object(dictionary! {
            "Type" => "Font", "Subtype" => "Type1", "BaseFont" => "Helvetica",
        });
        let resources = doc.add_object(dictionary! { "Font" => dictionary! { "F1" => font } });
        let mut kids = vec![];
        for i in 0..n {
            let content = format!("BT /F1 24 Tf 72 700 Td (Page{i}) Tj ET");
            let c = doc.add_object(Stream::new(Dictionary::new(), content.into_bytes()));
            let page = doc.add_object(dictionary! {
                "Type" => "Page", "Parent" => pages_id, "Contents" => c,
            });
            kids.push(Object::Reference(page));
        }
        // MediaBox and Resources are inherited from the tree root.
        doc.objects.insert(
            pages_id,
            Object::Dictionary(dictionary! {
                "Type" => "Pages", "Kids" => kids, "Count" => n as i64,
                "Resources" => resources,
                "MediaBox" => vec![0.into(), 0.into(), 600.into(), 800.into()],
            }),
        );
        let catalog = doc.add_object(dictionary! { "Type" => "Catalog", "Pages" => pages_id });
        doc.trailer.set("Root", catalog);
        let mut out = Vec::new();
        doc.save_to(&mut out).unwrap();
        out
    }

    fn page_texts(bytes: &[u8]) -> Vec<String> {
        let doc = Document::load_mem(bytes).unwrap();
        doc.get_pages()
            .into_values()
            .map(|id| String::from_utf8_lossy(&doc.get_page_content(id).unwrap()).into_owned())
            .collect()
    }

    fn all_stream_bytes(doc: &Document) -> Vec<u8> {
        doc.objects
            .values()
            .filter_map(|o| o.as_stream().ok())
            .flat_map(|s| {
                s.decompressed_content()
                    .unwrap_or_else(|_| s.content.clone())
            })
            .collect()
    }

    #[test]
    fn reorders_deletes_and_rotates() {
        let src = sample_pdf(3);
        let ops = [
            PageOp {
                source: 2,
                rotate: 90,
            },
            PageOp {
                source: 0,
                rotate: -90,
            },
        ];
        let out = edit(&src, &ops, &[], &[]).unwrap();
        let texts = page_texts(&out);
        assert_eq!(texts.len(), 2);
        assert!(texts[0].contains("Page2") && texts[1].contains("Page0"));
        let doc = Document::load_mem(&out).unwrap();
        // The deleted page's content is gone from the file.
        assert!(!all_stream_bytes(&doc).windows(5).any(|w| w == b"Page1"));
        let rot: Vec<i64> = doc
            .get_pages()
            .into_values()
            .map(|id| {
                doc.get_dictionary(id)
                    .unwrap()
                    .get(b"Rotate")
                    .unwrap()
                    .as_i64()
                    .unwrap()
            })
            .collect();
        assert_eq!(rot, vec![90, 270]);
        // Inherited MediaBox survives the flattened tree.
        let first = doc.get_pages()[&1];
        assert!(doc.get_dictionary(first).unwrap().has(b"MediaBox"));
    }

    #[test]
    fn rejects_bad_page_lists() {
        let src = sample_pdf(2);
        let op = |source, rotate| PageOp { source, rotate };
        for ops in [
            vec![],
            vec![op(5, 0)],
            vec![op(0, 0), op(0, 0)],
            vec![op(0, 45)],
        ] {
            assert!(edit(&src, &ops, &[], &[]).is_err());
        }
        assert!(load(b"not a pdf").is_err());
    }

    #[test]
    fn stamps_an_image_with_soft_mask() {
        let src = sample_pdf(2);
        let img = Pixels {
            width: 2,
            height: 1,
            bgra: vec![0, 0, 0, 255, 0, 0, 0, 0],
        };
        let stamps = [Stamp {
            page: 1,
            rect: NormRect {
                x: 0.5,
                y: 0.8,
                w: 0.3,
                h: 0.1,
            },
            image: 0,
        }];
        let ops = [
            PageOp {
                source: 0,
                rotate: 0,
            },
            PageOp {
                source: 1,
                rotate: 0,
            },
        ];
        let out = edit(&src, &ops, &stamps, &[img]).unwrap();
        let texts = page_texts(&out);
        assert!(!texts[0].contains("ZxSig"));
        assert!(texts[1].contains("/ZxSig0 Do") && texts[1].starts_with('q'));
        let doc = Document::load_mem(&out).unwrap();
        let has_mask = doc
            .objects
            .values()
            .any(|o| o.as_stream().map(|s| s.dict.has(b"SMask")).unwrap_or(false));
        assert!(has_mask);
        assert_eq!(page_count(&out).unwrap(), 2);
    }
}
