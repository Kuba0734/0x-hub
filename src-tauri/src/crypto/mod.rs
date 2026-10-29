//! Key derivation (Argon2id), AES-256-GCM encryption and DEK wrapping.
//!
//! Layout of every ciphertext: `nonce (12 bytes) || ciphertext+tag`.

mod recovery;

pub use recovery::{format_recovery_key, generate_recovery_key, parse_recovery_key};

use aes_gcm::aead::{Aead, KeyInit, Payload};
use aes_gcm::{Aes256Gcm, Key, Nonce};
use argon2::{Algorithm, Argon2, Params, Version};
use rand::rngs::OsRng;
use rand::RngCore;
use zeroize::{Zeroize, ZeroizeOnDrop, Zeroizing};

use crate::error::{AppError, AppResult};

pub const KEY_LEN: usize = 32;
pub const NONCE_LEN: usize = 12;
pub const SALT_LEN: usize = 16;

const DEK_AAD: &[u8] = b"0x-hub:dek:v1";

/// A 256-bit key that wipes itself when dropped.
#[derive(Clone, Zeroize, ZeroizeOnDrop)]
pub struct SecretKey([u8; KEY_LEN]);

impl SecretKey {
    pub fn generate() -> Self {
        SecretKey(random_bytes())
    }

    pub fn from_slice(bytes: &[u8]) -> AppResult<Self> {
        let arr: [u8; KEY_LEN] = bytes.try_into().map_err(|_| AppError::Crypto)?;
        Ok(SecretKey(arr))
    }

    pub fn as_bytes(&self) -> &[u8; KEY_LEN] {
        &self.0
    }
}

impl std::fmt::Debug for SecretKey {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("SecretKey(<redacted>)")
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct KdfParams {
    pub m_cost_kib: u32,
    pub t_cost: u32,
    pub p_cost: u32,
}

impl Default for KdfParams {
    /// m = 64 MiB, t = 3, p = 1 (see CLAUDE.md, Security).
    fn default() -> Self {
        KdfParams {
            m_cost_kib: 64 * 1024,
            t_cost: 3,
            p_cost: 1,
        }
    }
}

pub fn random_bytes<const N: usize>() -> [u8; N] {
    let mut out = [0u8; N];
    OsRng.fill_bytes(&mut out);
    out
}

/// Derives the Key Encryption Key from the master password with Argon2id.
pub fn derive_kek(password: &[u8], salt: &[u8], params: KdfParams) -> AppResult<SecretKey> {
    let p = Params::new(
        params.m_cost_kib,
        params.t_cost,
        params.p_cost,
        Some(KEY_LEN),
    )
    .map_err(|_| AppError::Crypto)?;
    let argon = Argon2::new(Algorithm::Argon2id, Version::V0x13, p);
    let mut out = Zeroizing::new([0u8; KEY_LEN]);
    argon
        .hash_password_into(password, salt, out.as_mut())
        .map_err(|_| AppError::Crypto)?;
    SecretKey::from_slice(out.as_ref())
}

pub fn encrypt(key: &SecretKey, plaintext: &[u8], aad: &[u8]) -> AppResult<Vec<u8>> {
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(key.as_bytes()));
    let nonce_bytes: [u8; NONCE_LEN] = random_bytes();
    let ct = cipher
        .encrypt(
            Nonce::from_slice(&nonce_bytes),
            Payload {
                msg: plaintext,
                aad,
            },
        )
        .map_err(|_| AppError::Crypto)?;
    let mut out = Vec::with_capacity(NONCE_LEN + ct.len());
    out.extend_from_slice(&nonce_bytes);
    out.extend_from_slice(&ct);
    Ok(out)
}

pub fn decrypt(key: &SecretKey, data: &[u8], aad: &[u8]) -> AppResult<Vec<u8>> {
    if data.len() < NONCE_LEN + 16 {
        return Err(AppError::Crypto);
    }
    let (nonce, ct) = data.split_at(NONCE_LEN);
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(key.as_bytes()));
    cipher
        .decrypt(Nonce::from_slice(nonce), Payload { msg: ct, aad })
        .map_err(|_| AppError::Crypto)
}

/// Encrypts a serializable value as JSON.
pub fn seal_json<T: serde::Serialize>(
    key: &SecretKey,
    value: &T,
    aad: &[u8],
) -> AppResult<Vec<u8>> {
    let json = Zeroizing::new(serde_json::to_vec(value)?);
    encrypt(key, &json, aad)
}

pub fn open_json<T: serde::de::DeserializeOwned>(
    key: &SecretKey,
    data: &[u8],
    aad: &[u8],
) -> AppResult<T> {
    let json = Zeroizing::new(decrypt(key, data, aad)?);
    Ok(serde_json::from_slice(&json)?)
}

pub fn wrap_key(kek: &SecretKey, dek: &SecretKey) -> AppResult<Vec<u8>> {
    encrypt(kek, dek.as_bytes(), DEK_AAD)
}

pub fn unwrap_key(kek: &SecretKey, wrapped: &[u8]) -> AppResult<SecretKey> {
    let raw = Zeroizing::new(decrypt(kek, wrapped, DEK_AAD)?);
    SecretKey::from_slice(&raw)
}

#[cfg(test)]
pub(crate) fn test_params() -> KdfParams {
    KdfParams {
        m_cost_kib: 256,
        t_cost: 1,
        p_cost: 1,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encrypt_decrypt_round_trip() {
        let key = SecretKey::generate();
        let ct = encrypt(&key, b"hello vault", b"aad").unwrap();
        assert_ne!(&ct[NONCE_LEN..], b"hello vault");
        assert_eq!(decrypt(&key, &ct, b"aad").unwrap(), b"hello vault");
    }

    #[test]
    fn nonces_are_unique() {
        let key = SecretKey::generate();
        let a = encrypt(&key, b"same", b"").unwrap();
        let b = encrypt(&key, b"same", b"").unwrap();
        assert_ne!(a[..NONCE_LEN], b[..NONCE_LEN]);
        assert_ne!(a, b);
    }

    #[test]
    fn wrong_key_or_aad_fails() {
        let key = SecretKey::generate();
        let other = SecretKey::generate();
        let ct = encrypt(&key, b"secret", b"ctx").unwrap();
        assert!(decrypt(&other, &ct, b"ctx").is_err());
        assert!(decrypt(&key, &ct, b"other-ctx").is_err());
    }

    #[test]
    fn tampering_is_detected() {
        let key = SecretKey::generate();
        let mut ct = encrypt(&key, b"secret", b"").unwrap();
        let last = ct.len() - 1;
        ct[last] ^= 0x01;
        assert!(decrypt(&key, &ct, b"").is_err());
        assert!(decrypt(&key, &[0u8; 5], b"").is_err());
    }

    #[test]
    fn kdf_is_deterministic_per_salt() {
        let salt: [u8; SALT_LEN] = random_bytes();
        let a = derive_kek(b"correct horse", &salt, test_params()).unwrap();
        let b = derive_kek(b"correct horse", &salt, test_params()).unwrap();
        let c = derive_kek(b"wrong horse", &salt, test_params()).unwrap();
        let other_salt: [u8; SALT_LEN] = random_bytes();
        let d = derive_kek(b"correct horse", &other_salt, test_params()).unwrap();
        assert_eq!(a.as_bytes(), b.as_bytes());
        assert_ne!(a.as_bytes(), c.as_bytes());
        assert_ne!(a.as_bytes(), d.as_bytes());
    }

    #[test]
    fn default_kdf_params_match_spec() {
        let p = KdfParams::default();
        assert_eq!((p.m_cost_kib, p.t_cost, p.p_cost), (65536, 3, 1));
    }

    #[test]
    fn dek_wrap_unwrap_and_rewrap() {
        let salt: [u8; SALT_LEN] = random_bytes();
        let kek = derive_kek(b"pw1", &salt, test_params()).unwrap();
        let dek = SecretKey::generate();
        let wrapped = wrap_key(&kek, &dek).unwrap();
        let unwrapped = unwrap_key(&kek, &wrapped).unwrap();
        assert_eq!(dek.as_bytes(), unwrapped.as_bytes());

        // Password change: only the wrapping changes, the DEK stays the same.
        let new_kek = derive_kek(b"pw2", &salt, test_params()).unwrap();
        let rewrapped = wrap_key(&new_kek, &unwrapped).unwrap();
        assert!(unwrap_key(&kek, &rewrapped).is_err());
        assert_eq!(
            unwrap_key(&new_kek, &rewrapped).unwrap().as_bytes(),
            dek.as_bytes()
        );
    }

    #[test]
    fn json_helpers_round_trip() {
        let key = SecretKey::generate();
        let ct = seal_json(&key, &vec!["Pässe", "Verträge"], b"f").unwrap();
        let back: Vec<String> = open_json(&key, &ct, b"f").unwrap();
        assert_eq!(back, vec!["Pässe", "Verträge"]);
    }

    #[test]
    fn debug_does_not_leak() {
        let key = SecretKey::generate();
        assert_eq!(format!("{key:?}"), "SecretKey(<redacted>)");
    }
}
