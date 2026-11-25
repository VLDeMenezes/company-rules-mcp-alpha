import assert from 'node:assert/strict'
import type { TestContext } from 'node:test'
import { test } from 'node:test'
import { TEST_ADMIN, createTestApp, loginAs } from './helpers.js'

interface PublicUserBody {
  id: string
  email: string
  githubUsername: string
  role: string
  active: boolean
  createdAt: string
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
    payload: { email: 'editor@company.com', githubUsername: 'editor', role: 'editor', password: 'editor-password' },
  })
  assert.equal(createResponse.statusCode, 201)

  const editorCookie = await loginAs(app, 'editor@company.com', 'editor-password')
  return { app, adminCookie, editorCookie }
}

test('user endpoints require an authenticated session', async (t) => {
  const { app } = await createTestApp(t)

  const list = await app.inject({ method: 'GET', url: '/api/users' })
  assert.equal(list.statusCode, 401)
  assert.equal((list.json() as ErrorBody).error.code, 'UNAUTHORIZED')

  const create = await app.inject({
    method: 'POST',
    url: '/api/users',
    payload: { email: 'other@company.com', role: 'editor', password: 'other-password' },
  })
  assert.equal(create.statusCode, 401)
})

test('user management rejects editors with 403', async (t) => {  const { app, editorCookie } = await setup(t)

  const list = await app.inject({
    method: 'GET',
    url: '/api/users',
    headers: { cookie: editorCookie },
  })
  assert.equal(list.statusCode, 403)
  assert.equal((list.json() as ErrorBody).error.code, 'FORBIDDEN')

  const create = await app.inject({
    method: 'POST',
    url: '/api/users',
    headers: { cookie: editorCookie },
    payload: { email: 'other@company.com', role: 'editor', password: 'other-password' },
  })
  assert.equal(create.statusCode, 403)
})

test('admin lists users without password hashes', async (t) => {
  const { app, adminCookie } = await setup(t)

  const response = await app.inject({
    method: 'GET',
    url: '/api/users',
    headers: { cookie: adminCookie },
  })
  assert.equal(response.statusCode, 200)

  const users = response.json() as PublicUserBody[]
  assert.equal(users.length, 2)
  assert.deepEqual(
    users.map((user) => user.email).sort(),
    ['admin@company.com', 'editor@company.com'],
  )

  for (const user of users) {
    assert.equal('passwordHash' in user, false)
  }
})

test('admin creates a user and duplicates return 409', async (t) => {
  const { app, adminCookie } = await setup(t)

  const response = await app.inject({
    method: 'POST',
    url: '/api/users',
    headers: { cookie: adminCookie },
    payload: {
      email: '  New.User@Company.com ',
      githubUsername: 'newbie',
      role: 'editor',
      password: 'new-user-password',
    },
  })
  assert.equal(response.statusCode, 201)

  const user = response.json() as PublicUserBody
  assert.match(user.id, /^usr_[0-9a-f]{12}$/)
  assert.equal(user.email, 'new.user@company.com')
  assert.equal(user.githubUsername, 'newbie')
  assert.equal(user.role, 'editor')
  assert.equal(user.active, true)
  assert.equal('passwordHash' in user, false)

  const duplicate = await app.inject({
    method: 'POST',
    url: '/api/users',
    headers: { cookie: adminCookie },
    payload: { email: 'NEW.USER@company.com', role: 'editor', password: 'another-password' },
  })
  assert.equal(duplicate.statusCode, 409)
  assert.equal((duplicate.json() as ErrorBody).error.code, 'CONFLICT')
})

test('admin patches role, password and active state', async (t) => {
  const { app, adminCookie } = await setup(t)

  const createResponse = await app.inject({
    method: 'POST',
    url: '/api/users',
    headers: { cookie: adminCookie },
    payload: { email: 'target@company.com', role: 'editor', password: 'original-password' },
  })
  assert.equal(createResponse.statusCode, 201)
  const target = createResponse.json() as PublicUserBody

  const promote = await app.inject({
    method: 'PATCH',
    url: `/api/users/${target.id}`,
    headers: { cookie: adminCookie },
    payload: { role: 'admin' },
  })
  assert.equal(promote.statusCode, 200)
  assert.equal((promote.json() as PublicUserBody).role, 'admin')

  const resetPassword = await app.inject({
    method: 'PATCH',
    url: `/api/users/${target.id}`,
    headers: { cookie: adminCookie },
    payload: { password: 'brand-new-password' },
  })
  assert.equal(resetPassword.statusCode, 200)
  assert.equal('passwordHash' in (resetPassword.json() as PublicUserBody), false)

  const newPasswordLogin = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'target@company.com', password: 'brand-new-password' },
  })
  assert.equal(newPasswordLogin.statusCode, 200)

  const oldPasswordLogin = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'target@company.com', password: 'original-password' },
  })
  assert.equal(oldPasswordLogin.statusCode, 401)

  const deactivate = await app.inject({
    method: 'PATCH',
    url: `/api/users/${target.id}`,
    headers: { cookie: adminCookie },
    payload: { active: false },
  })
  assert.equal(deactivate.statusCode, 200)
  assert.equal((deactivate.json() as PublicUserBody).active, false)

  const deactivatedLogin = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'target@company.com', password: 'brand-new-password' },
  })
  assert.equal(deactivatedLogin.statusCode, 401)
  assert.equal((deactivatedLogin.json() as ErrorBody).error.code, 'INVALID_CREDENTIALS')
})

test('patching a missing user returns 404', async (t) => {
  const { app, adminCookie } = await setup(t)

  const response = await app.inject({
    method: 'PATCH',
    url: '/api/users/usr_missing',
    headers: { cookie: adminCookie },
    payload: { active: false },
  })
  assert.equal(response.statusCode, 404)
  assert.equal((response.json() as ErrorBody).error.code, 'NOT_FOUND')
})

test('invalid user payloads return 400', async (t) => {
  const { app, adminCookie } = await setup(t)

  const shortPassword = await app.inject({
    method: 'POST',
    url: '/api/users',
    headers: { cookie: adminCookie },
    payload: { email: 'short@company.com', role: 'editor', password: 'short' },
  })
  assert.equal(shortPassword.statusCode, 400)
  assert.equal((shortPassword.json() as ErrorBody).error.code, 'VALIDATION')

  const invalidRole = await app.inject({
    method: 'POST',
    url: '/api/users',
    headers: { cookie: adminCookie },
    payload: { email: 'role@company.com', role: 'owner', password: 'long-enough-password' },
  })
  assert.equal(invalidRole.statusCode, 400)

  const emptyPatch = await app.inject({
    method: 'PATCH',
    url: '/api/users/usr_missing',
    headers: { cookie: adminCookie },
    payload: {},
  })
  assert.equal(emptyPatch.statusCode, 400)
})
