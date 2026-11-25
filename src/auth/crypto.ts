import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const SALT_BYTES = 16
const KEY_LENGTH = 64
const TOKEN_BYTES = 32

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

/** Creates a new MCP API token. The plaintext is shown once and never stored. */
export function generateMcpToken(): string {
  return `mcp_${randomBytes(TOKEN_BYTES).toString('base64url')}`
}

/** Hashes an MCP token for storage as a lowercase SHA-256 hex digest. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
