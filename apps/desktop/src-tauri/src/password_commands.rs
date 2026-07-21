use argon2::{
    password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use rand_core::OsRng;

#[tauri::command]
pub fn hash_password(password: String) -> Result<String, String> {
    if password.is_empty() {
        return Err("Password must not be empty.".to_string());
    }

    let salt = SaltString::generate(&mut OsRng);

    Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map(|hash| hash.to_string())
        .map_err(|error| format!("Password hashing failed: {error}"))
}

#[tauri::command]
pub fn verify_password(password: String, password_hash: String) -> Result<bool, String> {
    let parsed_hash = PasswordHash::new(&password_hash)
        .map_err(|error| format!("Password hash is invalid: {error}"))?;

    Ok(Argon2::default()
        .verify_password(password.as_bytes(), &parsed_hash)
        .is_ok())
}
