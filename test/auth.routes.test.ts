import assert from 'node:assert/strict'
import { test } from 'node:test'
import cookie from '@fastify/cookie'
import { TEST_ADMIN, createTestApp, loginAs } from './helpers.js'

interface SessionBody {
  id: string
  email: string
  githubUsername: string
  role: string
}

interface ErrorBody {
  error: { code: string; message: string }
}

function firstSetCookie(setCookie: string | string[] | undefined): string {
  assert.ok(setCookie, 'expected a Set-Cookie header')
  const raw = Array.isArray(setCookie) ? setCookie[0] : setCookie
  assert.ok(raw, 'expected a Set-Cookie header')
  return raw
}

test('login normalizes the email, sets a hardened cookie and returns only session fields', async (t) => {
  const { app } = await createTestApp(t)

  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: `  ${TEST_ADMIN.email.toUpperCase()} `, password: TEST_ADMIN.password },
  })

  assert.equal(response.statusCode, 200)

  const cookie = firstSetCookie(response.headers['set-cookie'])
  assert.match(cookie, /^session=/)
  assert.match(cookie, /HttpOnly/i)
  assert.match(cookie, /SameSite=Strict/i)
  assert.match(cookie, /Path=\//i)
  assert.match(cookie, /Max-Age=28800/i)

  const body = response.json() as SessionBody
  assert.deepEqual(Object.keys(body).sort(), ['email', 'githubUsername', 'id', 'role'])
  assert.equal(body.email, TEST_ADMIN.email)
  assert.equal(body.githubUsername, TEST_ADMIN.githubUsername)
  assert.equal(body.role, 'admin')
  assert.equal('passwordHash' in body, false)
})

test('login rejects wrong passwords with a generic 401', async (t) => {
  const { app } = await createTestApp(t)

  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: TEST_ADMIN.email, password: 'wrong-password' },
  })

  assert.equal(response.statusCode, 401)
  const body = response.json() as ErrorBody
  assert.equal(body.error.code, 'INVALID_CREDENTIALS')
  assert.equal(body.error.message, 'Invalid email or password')
})

test('login rejects unknown and inactive users with the same 401', async (t) => {
  const { app } = await createTestApp(t)
  const adminCookie = await loginAs(app, TEST_ADMIN.email, TEST_ADMIN.password)

  const createResponse = await app.inject({
    method: 'POST',
    url: '/api/users',
    headers: { cookie: adminCookie },
    payload: { email: 'inactive@company.com', role: 'editor', password: 'editor-password' },
  })
  assert.equal(createResponse.statusCode, 201)
  const created = createResponse.json() as { id: string }

  const deactivateResponse = await app.inject({
    method: 'PATCH',
    url: `/api/users/${created.id}`,
    headers: { cookie: adminCookie },
    payload: { active: false },
  })
  assert.equal(deactivateResponse.statusCode, 200)

  for (const email of ['inactive@company.com', 'nobody@company.com']) {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password: 'editor-password' },
    })

    assert.equal(response.statusCode, 401)
    assert.equal((response.json() as ErrorBody).error.code, 'INVALID_CREDENTIALS')
  }
})

test('GET /me returns the session user and rejects missing or tampered cookies', async (t) => {
  const { app } = await createTestApp(t)
  const cookie = await loginAs(app, TEST_ADMIN.email, TEST_ADMIN.password)

  const authenticated = await app.inject({
    method: 'GET',
    url: '/api/auth/me',
    headers: { cookie },
  })
  assert.equal(authenticated.statusCode, 200)
  const body = authenticated.json() as SessionBody
  assert.deepEqual(Object.keys(body).sort(), ['email', 'githubUsername', 'id', 'role'])
  assert.equal(body.email, TEST_ADMIN.email)

  const missing = await app.inject({ method: 'GET', url: '/api/auth/me' })
  assert.equal(missing.statusCode, 401)
  assert.equal((missing.json() as ErrorBody).error.code, 'UNAUTHORIZED')

  const tampered = await app.inject({
    method: 'GET',
    url: '/api/auth/me',
    headers: { cookie: `${cookie}tampered` },
  })
  assert.equal(tampered.statusCode, 401)
  assert.equal((tampered.json() as ErrorBody).error.code, 'UNAUTHORIZED')
})

test('logout clears the session cookie and the cleared cookie no longer authenticates', async (t) => {
  const { app } = await createTestApp(t)
  const cookie = await loginAs(app, TEST_ADMIN.email, TEST_ADMIN.password)

  const logout = await app.inject({
    method: 'POST',
    url: '/api/auth/logout',
    headers: { cookie },
  })
  assert.equal(logout.statusCode, 204)

  const clearedCookie = firstSetCookie(logout.headers['set-cookie'])
  assert.match(clearedCookie, /^session=;/)
  assert.match(clearedCookie, /Expires=Thu, 01 Jan 1970/i)
  assert.match(clearedCookie, /HttpOnly/i)
  assert.match(clearedCookie, /SameSite=Strict/i)

  const clearedPair = clearedCookie.split(';')[0]
  assert.ok(clearedPair)

  const me = await app.inject({
    method: 'GET',
    url: '/api/auth/me',
    headers: { cookie: clearedPair },
  })
  assert.equal(me.statusCode, 401)
})

test('a signed session payload with a past expiry is rejected', async (t) => {
  const { app, config } = await createTestApp(t)

  const login = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: TEST_ADMIN.email, password: TEST_ADMIN.password },
  })
  assert.equal(login.statusCode, 200)
  const user = login.json() as SessionBody

  const signer = new cookie.Signer(config.sessionSecret)
  const expiredValue = signer.sign(`${user.id}.${Math.floor(Date.now() / 1000) - 60}`)

  const response = await app.inject({
    method: 'GET',
    url: '/api/auth/me',
    headers: { cookie: `session=${encodeURIComponent(expiredValue)}` },
  })
  assert.equal(response.statusCode, 401)
  assert.equal((response.json() as ErrorBody).error.code, 'UNAUTHORIZED')
})

test('deactivating a user invalidates their existing session immediately', async (t) => {
  const { app } = await createTestApp(t)
  const adminCookie = await loginAs(app, TEST_ADMIN.email, TEST_ADMIN.password)

  const createResponse = await app.inject({
    method: 'POST',
    url: '/api/users',
    headers: { cookie: adminCookie },
    payload: { email: 'editor@company.com', role: 'editor', password: 'editor-password' },
  })
  assert.equal(createResponse.statusCode, 201)
  const editor = createResponse.json() as { id: string }
  const editorCookie = await loginAs(app, 'editor@company.com', 'editor-password')

  const before = await app.inject({
    method: 'GET',
    url: '/api/auth/me',
    headers: { cookie: editorCookie },
  })
  assert.equal(before.statusCode, 200)

  const deactivate = await app.inject({
    method: 'PATCH',
    url: `/api/users/${editor.id}`,
    headers: { cookie: adminCookie },
    payload: { active: false },
  })
  assert.equal(deactivate.statusCode, 200)

  for (const url of ['/api/auth/me', '/api/rules']) {
    const response = await app.inject({
      method: 'GET',
      url,
      headers: { cookie: editorCookie },
    })
    assert.equal(response.statusCode, 401)
    assert.equal((response.json() as ErrorBody).error.code, 'UNAUTHORIZED')
  }
})
