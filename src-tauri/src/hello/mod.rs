//! Windows Hello: DPAPI protects a copy of the DEK; it is only released after a
//! `UserConsentVerifier` check. The master password always remains a fallback.

use windows::core::HSTRING;
use windows::Security::Credentials::UI::{
    UserConsentVerificationResult, UserConsentVerifier, UserConsentVerifierAvailability,
};
use windows::Win32::Foundation::{LocalFree, HLOCAL, HWND};
use windows::Win32::Security::Cryptography::{
    CryptProtectData, CryptUnprotectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
};
use windows::Win32::System::WinRT::IUserConsentVerifierInterop;
use zeroize::Zeroizing;

use crate::error::{AppError, AppResult};

const ENTROPY: &[u8] = b"0x-hub:hello:v1";

pub fn is_available() -> bool {
    UserConsentVerifier::CheckAvailabilityAsync()
        .and_then(|op| op.get())
        .map(|a| a == UserConsentVerifierAvailability::Available)
        .unwrap_or(false)
}

/// Shows the Windows Hello prompt parented to `hwnd`. Blocks until the user responds.
pub fn verify(hwnd: isize, message: &str) -> AppResult<()> {
    let interop = windows::core::factory::<UserConsentVerifier, IUserConsentVerifierInterop>()?;
    let op: windows::Foundation::IAsyncOperation<UserConsentVerificationResult> = unsafe {
        interop.RequestVerificationForWindowAsync(HWND(hwnd as _), &HSTRING::from(message))?
    };
    match op.get()? {
        UserConsentVerificationResult::Verified => Ok(()),
        UserConsentVerificationResult::Canceled => Err(AppError::HelloCancelled),
        _ => Err(AppError::HelloUnavailable),
    }
}

fn blob(data: &[u8]) -> CRYPT_INTEGER_BLOB {
    CRYPT_INTEGER_BLOB {
        cbData: data.len() as u32,
        pbData: data.as_ptr() as *mut u8,
    }
}

/// Copies the DPAPI output buffer and frees it.
unsafe fn take(out: CRYPT_INTEGER_BLOB) -> Vec<u8> {
    let v = std::slice::from_raw_parts(out.pbData, out.cbData as usize).to_vec();
    let _ = LocalFree(HLOCAL(out.pbData as _));
    v
}

pub fn protect(data: &[u8]) -> AppResult<Vec<u8>> {
    let input = blob(data);
    let entropy = blob(ENTROPY);
    let mut out = CRYPT_INTEGER_BLOB::default();
    unsafe {
        CryptProtectData(
            &input,
            &HSTRING::from("0x-hub"),
            Some(&entropy),
            None,
            None,
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut out,
        )?;
        Ok(take(out))
    }
}

pub fn unprotect(data: &[u8]) -> AppResult<Zeroizing<Vec<u8>>> {
    let input = blob(data);
    let entropy = blob(ENTROPY);
    let mut out = CRYPT_INTEGER_BLOB::default();
    unsafe {
        CryptUnprotectData(
            &input,
            None,
            Some(&entropy),
            None,
            None,
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut out,
        )
        .map_err(|_| AppError::Crypto)?;
        Ok(Zeroizing::new(take(out)))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dpapi_round_trip() {
        let secret = [7u8; 32];
        let sealed = protect(&secret).unwrap();
        assert_ne!(sealed.as_slice(), secret.as_slice());
        assert_eq!(unprotect(&sealed).unwrap().as_slice(), secret.as_slice());
    }
}
