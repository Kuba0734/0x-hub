//! PDF tools: page edits and signature stamps (lopdf), image → PDF, and flattened
//! redaction (pages rendered with `Windows.Data.Pdf`). Everything happens in memory.

pub mod build;
pub mod edit;
pub mod geometry;
pub mod redact;
mod render;

use crate::error::AppError;

pub(crate) fn pdf_err(e: lopdf::Error) -> AppError {
    AppError::Invalid(format!("This PDF can't be edited ({e})"))
}
