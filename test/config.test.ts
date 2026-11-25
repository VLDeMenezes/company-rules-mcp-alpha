import assert from 'node:assert/strict'
import path from 'node:path'
import { test } from 'node:test'
import { loadConfig } from '../src/config.js'

const validEnv = {
  INITIAL_ADMIN_EMAIL: 'Admin@Company.com',
  INITIAL_ADMIN_PASSWORD: 'super-secret',
  SESSION_SECRET: 'x'.repeat(32),
}

test('loadConfig applies defaults and normalizes the admin email', () => {
  const config = loadConfig({ ...validEnv, DATA_DIR: './data' })

  assert.equal(config.nodeEnv, 'development')
  assert.equal(config.host, '127.0.0.1')
  assert.equal(config.port, 3000)
  assert.equal(config.dataDir, path.resolve('./data'))
  assert.equal(config.initialAdmin.email, 'admin@company.com')
  assert.equal(config.initialAdmin.githubUsername, 'admin')
})

test('loadConfig parses PORT and respects explicit values', () => {
  const config = loadConfig({
    ...validEnv,
    NODE_ENV: 'test',
    PORT: '8080',
    DATA_DIR: '/tmp/rules-data',
  })

  assert.equal(config.nodeEnv, 'test')
  assert.equal(config.port, 8080)
  assert.equal(config.dataDir, '/tmp/rules-data')
})

test('loadConfig reports missing required variables', () => {
  assert.throws(() => loadConfig({}), /Invalid environment configuration/)
})

test('loadConfig rejects invalid values', () => {
  assert.throws(() => loadConfig({ ...validEnv, INITIAL_ADMIN_EMAIL: 'not-an-email' }), /INITIAL_ADMIN_EMAIL/)
  assert.throws(() => loadConfig({ ...validEnv, INITIAL_ADMIN_PASSWORD: 'short' }), /INITIAL_ADMIN_PASSWORD/)
  assert.throws(() => loadConfig({ ...validEnv, SESSION_SECRET: 'too-short' }), /SESSION_SECRET/)
  assert.throws(() => loadConfig({ ...validEnv, PORT: '99999' }), /PORT/)
})
