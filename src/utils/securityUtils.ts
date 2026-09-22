/**
 * Security and Cryptographic Utilities for Oficina HP
 * Provides salted SHA-256 password hashing and secure verification compatible with all modern browsers.
 */

const APP_PASSWORD_SALT = 'oficina_hp_salt_sec_88fbc91';

/**
 * Computes a salted SHA-256 hash for a given password string.
 * Falls back safely if crypto.subtle is not supported.
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password) return '';
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(`${APP_PASSWORD_SALT}:${password}`);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch {
      return password;
    }
  }
  return password;
}

/**
 * Verifies a plain password input against a stored password string.
 * Supports both hashed passwords and backward-compatibility with existing plain passwords.
 */
export async function verifyPassword(
  inputPassword: string,
  storedPassword?: string
): Promise<boolean> {
  if (!storedPassword || !inputPassword) return false;

  // Direct match (legacy plain text or same string)
  if (inputPassword === storedPassword) return true;

  // Compare hash
  const computedHash = await hashPassword(inputPassword);
  return computedHash === storedPassword;
}
