import assert from 'node:assert/strict'
import type { TestContext } from 'node:test'
import { test } from 'node:test'
import type { RuleMeta } from '../src/storage/rules.repo.js'
import { TEST_ADMIN, createTestApp, loginAs } from './helpers.js'

interface RulePayload {
  id: string
  title: string
  category: string
  tags?: string[]
  severity?: 'mandatory' | 'recommended' | 'optional'
  content: string
}

interface RuleBody {
  meta: RuleMeta
  content: string
}

interface ErrorBody {
  error: { code: string; message: string }
}

function rulePayload(overrides: Partial<RulePayload> = {}): RulePayload {
  return {
    id: 'SEC-001',
    title: 'Input validation and sanitization',
    category: 'security',
    tags: ['api', 'validation'],
    severity: 'mandatory',
    content: '# Rule\n\nValidate every input.',
    ...overrides,
  }
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

test('rules endpoints require an authenticated session', async (t) => {
  const { app } = await createTestApp(t)

  const list = await app.inject({ method: 'GET', url: '/api/rules' })
  assert.equal(list.statusCode, 401)
  assert.equal((list.json() as ErrorBody).error.code, 'UNAUTHORIZED')

  const create = await app.inject({
    method: 'POST',
    url: '/api/rules',
    payload: rulePayload(),
  })
  assert.equal(create.statusCode, 401)
})

test('an editor can create and read a rule', async (t) => {
  const { app, editorCookie } = await setup(t)

  const createResponse = await app.inject({
    method: 'POST',
    url: '/api/rules',
    headers: { cookie: editorCookie },
    payload: rulePayload(),
  })
  assert.equal(createResponse.statusCode, 201)

  const created = createResponse.json() as RuleBody
  assert.equal(created.meta.id, 'SEC-001')
  assert.equal(created.meta.version, 1)
  assert.equal(created.meta.active, true)
  assert.equal(created.meta.updatedBy, 'editor@company.com')
  assert.equal(created.content, '# Rule\n\nValidate every input.')

  const getResponse = await app.inject({
    method: 'GET',
    url: '/api/rules/SEC-001',
    headers: { cookie: editorCookie },
  })
  assert.equal(getResponse.statusCode, 200)
  assert.deepEqual(getResponse.json(), created)
})

test('list filters by category, tag and active state', async (t) => {
  const { app, editorCookie } = await setup(t)

  const payloads: RulePayload[] = [
    rulePayload(),
    rulePayload({ id: 'SEC-002', title: 'Secrets', tags: ['secrets'] }),
    rulePayload({ id: 'ARCH-001', title: 'Layers', category: 'architecture', tags: ['design'] }),
  ]

  for (const payload of payloads) {
    const response = await app.inject({
      method: 'POST',
      url: '/api/rules',
      headers: { cookie: editorCookie },
      payload,
    })
    assert.equal(response.statusCode, 201)
  }

  const deactivate = await app.inject({
    method: 'PUT',
    url: '/api/rules/SEC-002',
    headers: { cookie: editorCookie },
    payload: { active: false },
  })
  assert.equal(deactivate.statusCode, 200)

  async function listIds(query: string): Promise<string[]> {
    const response = await app.inject({
      method: 'GET',
      url: `/api/rules${query}`,
      headers: { cookie: editorCookie },
    })
    assert.equal(response.statusCode, 200)
    return (response.json() as RuleMeta[]).map((meta) => meta.id)
  }

  assert.deepEqual(await listIds(''), ['ARCH-001', 'SEC-001', 'SEC-002'])
  assert.deepEqual(await listIds('?category=security'), ['SEC-001', 'SEC-002'])
  assert.deepEqual(await listIds('?tag=design'), ['ARCH-001'])
  assert.deepEqual(await listIds('?active=true'), ['ARCH-001', 'SEC-001'])
  assert.deepEqual(await listIds('?active=false'), ['SEC-002'])
})

test('update increments version, records updatedBy and replaces content', async (t) => {
  const { app, editorCookie } = await setup(t)

  const createResponse = await app.inject({
    method: 'POST',
    url: '/api/rules',
    headers: { cookie: editorCookie },
    payload: rulePayload(),
  })
  const created = createResponse.json() as RuleBody

  const updateResponse = await app.inject({
    method: 'PUT',
    url: '/api/rules/SEC-001',
    headers: { cookie: editorCookie },
    payload: { title: 'Input validation', content: '# Updated' },
  })
  assert.equal(updateResponse.statusCode, 200)

  const updated = updateResponse.json() as RuleBody
  assert.equal(updated.meta.version, 2)
  assert.equal(updated.meta.title, 'Input validation')
  assert.equal(updated.meta.updatedBy, 'editor@company.com')
  assert.equal(updated.meta.createdAt, created.meta.createdAt)
  assert.equal(updated.content, '# Updated')

  const getResponse = await app.inject({
    method: 'GET',
    url: '/api/rules/SEC-001',
    headers: { cookie: editorCookie },
  })
  assert.equal((getResponse.json() as RuleBody).content, '# Updated')
})

test('delete is logical by default and records the editor', async (t) => {
  const { app, editorCookie } = await setup(t)

  await app.inject({
    method: 'POST',
    url: '/api/rules',
    headers: { cookie: editorCookie },
    payload: rulePayload(),
  })

  const deleteResponse = await app.inject({
    method: 'DELETE',
    url: '/api/rules/SEC-001',
    headers: { cookie: editorCookie },
  })
  assert.equal(deleteResponse.statusCode, 204)

  const getResponse = await app.inject({
    method: 'GET',
    url: '/api/rules/SEC-001',
    headers: { cookie: editorCookie },
  })
  assert.equal(getResponse.statusCode, 200)

  const rule = getResponse.json() as RuleBody
  assert.equal(rule.meta.active, false)
  assert.equal(rule.meta.version, 2)
  assert.equal(rule.meta.updatedBy, 'editor@company.com')
})

test('duplicate ids return 409 and missing rules return 404', async (t) => {
  const { app, editorCookie } = await setup(t)

  const first = await app.inject({
    method: 'POST',
    url: '/api/rules',
    headers: { cookie: editorCookie },
    payload: rulePayload(),
  })
  assert.equal(first.statusCode, 201)

  const duplicate = await app.inject({
    method: 'POST',
    url: '/api/rules',
    headers: { cookie: editorCookie },
    payload: rulePayload({ title: 'Another title' }),
  })
  assert.equal(duplicate.statusCode, 409)
  assert.equal((duplicate.json() as ErrorBody).error.code, 'CONFLICT')

  const missing = await app.inject({
    method: 'GET',
    url: '/api/rules/SEC-404',
    headers: { cookie: editorCookie },
  })
  assert.equal(missing.statusCode, 404)
  assert.equal((missing.json() as ErrorBody).error.code, 'NOT_FOUND')

  const updateMissing = await app.inject({
    method: 'PUT',
    url: '/api/rules/SEC-404',
    headers: { cookie: editorCookie },
    payload: { title: 'Nope' },
  })
  assert.equal(updateMissing.statusCode, 404)
})

test('only an admin can hard delete a rule', async (t) => {
  const { app, adminCookie, editorCookie } = await setup(t)

  await app.inject({
    method: 'POST',
    url: '/api/rules',
    headers: { cookie: editorCookie },
    payload: rulePayload(),
  })

  const forbidden = await app.inject({
    method: 'DELETE',
    url: '/api/rules/SEC-001?hard=true',
    headers: { cookie: editorCookie },
  })
  assert.equal(forbidden.statusCode, 403)
  assert.equal((forbidden.json() as ErrorBody).error.code, 'FORBIDDEN')

  const stillThere = await app.inject({
    method: 'GET',
    url: '/api/rules/SEC-001',
    headers: { cookie: editorCookie },
  })
  assert.equal(stillThere.statusCode, 200)

  const hardDelete = await app.inject({
    method: 'DELETE',
    url: '/api/rules/SEC-001?hard=true',
    headers: { cookie: adminCookie },
  })
  assert.equal(hardDelete.statusCode, 204)

  const gone = await app.inject({
    method: 'GET',
    url: '/api/rules/SEC-001',
    headers: { cookie: adminCookie },
  })
  assert.equal(gone.statusCode, 404)
})

test('invalid rule payloads return 400', async (t) => {
  const { app, editorCookie } = await setup(t)

  const invalidCreate = await app.inject({
    method: 'POST',
    url: '/api/rules',
    headers: { cookie: editorCookie },
    payload: { id: '../escape', title: '', category: 'security', content: '' },
  })
  assert.equal(invalidCreate.statusCode, 400)
  assert.equal((invalidCreate.json() as ErrorBody).error.code, 'VALIDATION')

  const emptyUpdate = await app.inject({
    method: 'PUT',
    url: '/api/rules/SEC-404',
    headers: { cookie: editorCookie },
    payload: {},
  })
  assert.equal(emptyUpdate.statusCode, 400)
})
