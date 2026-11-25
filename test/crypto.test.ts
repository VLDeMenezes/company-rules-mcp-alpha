import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import {
  generateMcpToken,
  hashPassword,
  hashToken,
  verifyPassword,
} from '../src/auth/crypto.js'

test('hashPassword produces a salt:key hash that verifies the original password', () => {
  const hash = hashPassword('correct horse battery staple')

  assert.match(hash, /^[0-9a-f]{32}:[0-9a-f]{128}$/)
  assert.equal(verifyPassword('correct horse battery staple', hash), true)
  assert.equal(verifyPassword('wrong password', hash), false)
})

test('hashPassword uses a fresh salt on every call', () => {
  assert.notEqual(hashPassword('same-password'), hashPassword('same-password'))
})

test('verifyPassword rejects malformed stored hashes', () => {
  assert.equal(verifyPassword('password', ''), false)
  assert.equal(verifyPassword('password', 'no-colon'), false)
  assert.equal(verifyPassword('password', 'abcdef:abcdef'), false)
})

test('generateMcpToken returns mcp_ plus 43 base64url characters', () => {
  const token = generateMcpToken()

  assert.match(token, /^mcp_[A-Za-z0-9_-]{43}$/)
  assert.notEqual(generateMcpToken(), token)
})

test('hashToken returns a stable lowercase SHA-256 hex digest', () => {
  const token = 'mcp_example-token'
  const expected = createHash('sha256').update(token).digest('hex')

  assert.equal(hashToken(token), expected)
  assert.match(hashToken(token), /^[0-9a-f]{64}$/)
})
