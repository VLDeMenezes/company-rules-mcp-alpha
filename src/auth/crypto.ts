import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const SALT_BYTES = 16
const KEY_LENGTH = 64

/**
 * Hashes a password with scrypt. The result is stored as `<salt>:<derivedKey>`,
 * both hex encoded, matching the format in SPEC.md.
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_BYTES).toString('hex')
  const derivedKey = scryptSync(password, salt, KEY_LENGTH)
  return `${salt}:${derivedKey.toString('hex')}`
}

/** Constant-time verification of a password against a stored `salt:key` hash. */
export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, keyHex] = storedHash.split(':')
  if (!salt || !keyHex) return false

  const expected = Buffer.from(keyHex, 'hex')
  if (expected.length !== KEY_LENGTH) return false

  const derivedKey = scryptSync(password, salt, KEY_LENGTH)
  return timingSafeEqual(derivedKey, expected)
}
