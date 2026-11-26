import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createTestApp } from './helpers.js'

interface OpenApiDocument {
  openapi: string
  info: { title: string; version: string }
  paths: Record<string, Record<string, unknown>>
  components: {
    securitySchemes: Record<string, { type: string; in?: string; name?: string; scheme?: string }>
    schemas: Record<string, unknown>
  }
}

test('GET /docs/ serves the Swagger UI', async (t) => {
  const { app } = await createTestApp(t)

  const response = await app.inject({ method: 'GET', url: '/docs/' })

  assert.equal(response.statusCode, 200)
  assert.match(String(response.headers['content-type']), /text\/html/i)
  assert.match(response.body, /Swagger UI/i)
})

test('GET /docs/json serves the OpenAPI document', async (t) => {
  const { app } = await createTestApp(t)

  const response = await app.inject({ method: 'GET', url: '/docs/json' })

  assert.equal(response.statusCode, 200)
  assert.match(String(response.headers['content-type']), /application\/json/i)

  const document = response.json() as OpenApiDocument
  assert.equal(document.openapi, '3.0.3')
  assert.equal(document.info.title, 'Company Rules API')
  assert.equal(document.info.version, '1.0.0')

  const expectedPaths = [
    '/api/auth/login',
    '/api/auth/logout',
    '/api/auth/me',
    '/api/rules',
    '/api/rules/{id}',
    '/api/users',
    '/api/users/{id}',
    '/api/tokens',
    '/api/tokens/{id}',
    '/mcp',
  ]

  assert.deepEqual(Object.keys(document.paths).sort(), expectedPaths.sort())

  const httpMethods = new Set(['get', 'post', 'put', 'patch', 'delete'])
  const operations = Object.values(document.paths).flatMap((path) =>
    Object.entries(path)
      .filter(([method]) => httpMethods.has(method))
      .map(([, operation]) => operation as { operationId?: unknown }),
  )
  for (const operation of operations) {
    assert.equal(typeof operation.operationId, 'string')
  }

  assert.deepEqual(Object.keys(document.components.securitySchemes).sort(), [
    'mcpBearer',
    'sessionCookie',
  ])
  assert.equal(document.components.securitySchemes.mcpBearer?.type, 'http')
  assert.equal(document.components.securitySchemes.mcpBearer?.scheme, 'bearer')
  assert.equal(document.components.securitySchemes.sessionCookie?.in, 'cookie')
  assert.equal(document.components.securitySchemes.sessionCookie?.name, 'session')
})

test('the Swagger UI does not shadow the API or the static panel', async (t) => {
  const { app } = await createTestApp(t)

  const api = await app.inject({ method: 'GET', url: '/api/rules' })
  assert.equal(api.statusCode, 401)

  const panel = await app.inject({ method: 'GET', url: '/' })
  assert.equal(panel.statusCode, 200)
  assert.match(String(panel.headers['content-type']), /text\/html/i)
})
