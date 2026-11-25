import assert from 'node:assert/strict'
import { test } from 'node:test'
import { hashPassword, verifyPassword } from '../src/auth/crypto.js'

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
