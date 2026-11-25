import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { TestContext } from 'node:test'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../src/app.js'
import { loadConfig, type AppConfig } from '../src/config.js'
import { ensureDir } from '../src/storage/fs-utils.js'
import { seedInitialAdmin } from '../src/storage/seed.js'

export const TEST_ADMIN = {
  email: 'admin@company.com',
  password: 'admin-password',
  githubUsername: 'admin',
} as const

const TEST_SESSION_SECRET = 'test-session-secret-0123456789abcdef'

export interface TestAppContext {
  app: FastifyInstance
  config: AppConfig
  dataDir: string
}

/** Creates a unique temp directory and removes it when the test finishes. */
export async function createTempDir(t: TestContext): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'company-rules-'))
  t.after(async () => {
    await rm(dir, { recursive: true, force: true })
  })
  return dir
}

/**
 * Boots a fully wired Fastify app against a fresh temp data directory with the
 * initial admin seeded. The app is closed automatically when the test finishes.
 */
export async function createTestApp(t: TestContext): Promise<TestAppContext> {
  const dataDir = await createTempDir(t)

  const config = loadConfig({
    NODE_ENV: 'test',
    DATA_DIR: dataDir,
    INITIAL_ADMIN_EMAIL: TEST_ADMIN.email,
    INITIAL_ADMIN_PASSWORD: TEST_ADMIN.password,
    INITIAL_ADMIN_GITHUB_USERNAME: TEST_ADMIN.githubUsername,
    SESSION_SECRET: TEST_SESSION_SECRET,
  })

  await ensureDir(dataDir)
  await seedInitialAdmin({
    dataDir,
    email: config.initialAdmin.email,
    password: config.initialAdmin.password,
    githubUsername: config.initialAdmin.githubUsername,
  })

  const app = await buildApp({ config, logger: false })
  t.after(async () => {
    await app.close()
  })

  return { app, config, dataDir }
}

/** Logs in and returns the `name=value` cookie header value to replay on requests. */
export async function loginAs(
  app: FastifyInstance,
  email: string,
  password: string,
): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, password },
  })

  assert.equal(response.statusCode, 200, `login failed: ${response.body}`)

  const setCookie = response.headers['set-cookie']
  assert.ok(setCookie, 'login response should set a cookie')

  const rawCookie = Array.isArray(setCookie) ? setCookie[0] : setCookie
  assert.ok(rawCookie, 'login response should set a cookie')

  const cookiePair = rawCookie.split(';')[0]
  assert.ok(cookiePair, 'cookie header should start with name=value')

  return cookiePair
}
