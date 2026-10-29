//! Recovery key: 256 random bits shown to the user as Base32 groups (`ABCD-EFGH-...`).
//! It is used directly as a second key-encryption key for the DEK.

use super::{SecretKey, KEY_LEN};
use crate::error::{AppError, AppResult};
use zeroize::Zeroizing;

const ALPHABET: &[u8; 32] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

pub fn generate_recovery_key() -> SecretKey {
    SecretKey::generate()
}

pub fn format_recovery_key(key: &SecretKey) -> Zeroizing<String> {
    let mut out = Zeroizing::new(String::with_capacity(64));
    let mut buffer: u32 = 0;
    let mut bits = 0;
    let mut chars = 0;
    for &b in key.as_bytes() {
        buffer = (buffer << 8) | b as u32;
        bits += 8;
        while bits >= 5 {
            bits -= 5;
            push_char(
                &mut out,
                ALPHABET[((buffer >> bits) & 31) as usize],
                &mut chars,
            );
        }
    }
    if bits > 0 {
        push_char(
            &mut out,
            ALPHABET[((buffer << (5 - bits)) & 31) as usize],
            &mut chars,
        );
    }
    out
}

fn push_char(out: &mut String, c: u8, chars: &mut usize) {
    if *chars > 0 && *chars % 4 == 0 {
        out.push('-');
    }
    out.push(c as char);
    *chars += 1;
}

pub fn parse_recovery_key(input: &str) -> AppResult<SecretKey> {
    let mut bytes = Zeroizing::new(Vec::with_capacity(KEY_LEN + 1));
    let mut buffer: u32 = 0;
    let mut bits = 0;
    for c in input.chars().filter(|c| !c.is_whitespace() && *c != '-') {
        let up = c.to_ascii_uppercase() as u8;
        let v = ALPHABET.iter().position(|&a| a == up).ok_or_else(|| {
            AppError::Invalid("The recovery key contains invalid characters".into())
        })?;
        buffer = (buffer << 5) | v as u32;
        bits += 5;
        if bits >= 8 {
            bits -= 8;
            bytes.push(((buffer >> bits) & 0xFF) as u8);
        }
    }
    if bytes.len() != KEY_LEN {
        return Err(AppError::Invalid(
            "The recovery key has the wrong length".into(),
        ));
    }
    SecretKey::from_slice(&bytes)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn recovery_key_round_trip() {
        let key = generate_recovery_key();
        let text = format_recovery_key(&key);
        // 52 Base32 chars in 13 groups of 4, joined by 12 dashes.
        assert_eq!(text.len(), 64);
        let parsed = parse_recovery_key(&text).unwrap();
        assert_eq!(parsed.as_bytes(), key.as_bytes());
        let messy = text.to_lowercase().replace('-', " ");
        assert_eq!(
            parse_recovery_key(&messy).unwrap().as_bytes(),
            key.as_bytes()
        );
    }

    #[test]
    fn rejects_garbage() {
        assert!(parse_recovery_key("not-a-key-1!").is_err());
        assert!(parse_recovery_key("ABCD").is_err());
    }
}
