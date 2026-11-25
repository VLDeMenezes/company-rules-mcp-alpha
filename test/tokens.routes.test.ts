import assert from 'node:assert/strict'
import type { TestContext } from 'node:test'
import { test } from 'node:test'
import { TEST_ADMIN, createTestApp, loginAs } from './helpers.js'

interface TokenView {
  id: string
  name: string
  active: boolean
  createdAt: string
  lastUsedAt: string | null
}

interface CreatedToken extends TokenView {
  token: string
}

interface ErrorBody {
  error: { code: string; message: string }
}

async function setup(t: TestContext): Promise<{
  app: Awaited<ReturnType<typeof createTestApp>>['app']
  adminCookie: string
  editorCookie: string
}> {
  const { app } = await createTestApp(t)
  const adminCookie = await loginAs(app, TEST_ADMIN.email, TEST_ADMIN.password)

  const createResponse = await app.inject({
    method: 'POST',
    url: '/api/users',
    headers: { cookie: adminCookie },
    payload: { email: 'editor@company.com', role: 'editor', password: 'editor-password' },
  })
  assert.equal(createResponse.statusCode, 201)

  const editorCookie = await loginAs(app, 'editor@company.com', 'editor-password')
  return { app, adminCookie, editorCookie }
}

test('token endpoints require an authenticated session', async (t) => {
  const { app } = await createTestApp(t)

  const list = await app.inject({ method: 'GET', url: '/api/tokens' })
  assert.equal(list.statusCode, 401)
  assert.equal((list.json() as ErrorBody).error.code, 'UNAUTHORIZED')

  const create = await app.inject({
    method: 'POST',
    url: '/api/tokens',
    payload: { name: 'agent' },
  })
  assert.equal(create.statusCode, 401)
})

test('token management rejects editors with 403', async (t) => {
  const { app, editorCookie } = await setup(t)

  const list = await app.inject({
    method: 'GET',
    url: '/api/tokens',
    headers: { cookie: editorCookie },
  })
  assert.equal(list.statusCode, 403)
  assert.equal((list.json() as ErrorBody).error.code, 'FORBIDDEN')

  const create = await app.inject({
    method: 'POST',
    url: '/api/tokens',
    headers: { cookie: editorCookie },
    payload: { name: 'editor-agent' },
  })
  assert.equal(create.statusCode, 403)
})

test('admin creates a token, sees it once and lists it without the hash', async (t) => {
  const { app, adminCookie } = await setup(t)

  const createResponse = await app.inject({
    method: 'POST',
    url: '/api/tokens',
    headers: { cookie: adminCookie },
    payload: { name: 'project-payments-agent' },
  })
  assert.equal(createResponse.statusCode, 201)

  const created = createResponse.json() as CreatedToken
  assert.match(created.token, /^mcp_[A-Za-z0-9_-]{43}$/)
  assert.match(created.id, /^tok_[0-9a-f]{12}$/)
  assert.equal(created.name, 'project-payments-agent')
  assert.equal(created.active, true)
  assert.equal(created.lastUsedAt, null)
  assert.equal('tokenHash' in created, false)

  const listResponse = await app.inject({
    method: 'GET',
    url: '/api/tokens',
    headers: { cookie: adminCookie },
  })
  assert.equal(listResponse.statusCode, 200)

  const tokens = listResponse.json() as TokenView[]
  assert.equal(tokens.length, 1)
  assert.deepEqual(tokens[0], {
    id: created.id,
    name: created.name,
    active: true,
    createdAt: created.createdAt,
    lastUsedAt: null,
  })
  assert.equal('tokenHash' in (tokens[0] as TokenView), false)
  assert.equal(listResponse.body.includes('tokenHash'), false)
})

test('revoking a token sets active to false', async (t) => {
  const { app, adminCookie } = await setup(t)

  const createResponse = await app.inject({
    method: 'POST',
    url: '/api/tokens',
    headers: { cookie: adminCookie },
    payload: { name: 'agent' },
  })
  const created = createResponse.json() as CreatedToken

  const revoke = await app.inject({
    method: 'DELETE',
    url: `/api/tokens/${created.id}`,
    headers: { cookie: adminCookie },
  })
  assert.equal(revoke.statusCode, 204)

  const listResponse = await app.inject({
    method: 'GET',
    url: '/api/tokens',
    headers: { cookie: adminCookie },
  })
  const tokens = listResponse.json() as TokenView[]
  assert.equal(tokens.length, 1)
  assert.equal(tokens[0]?.active, false)
})

test('revoking a missing token returns 404', async (t) => {
  const { app, adminCookie } = await setup(t)

  const response = await app.inject({
    method: 'DELETE',
    url: '/api/tokens/tok_missing',
    headers: { cookie: adminCookie },
  })
  assert.equal(response.statusCode, 404)
  assert.equal((response.json() as ErrorBody).error.code, 'NOT_FOUND')
})
