import assert from 'node:assert/strict'
import type { TestContext } from 'node:test'
import { test } from 'node:test'
import type { FastifyInstance } from 'fastify'
import { TEST_ADMIN, createTestApp, loginAs } from './helpers.js'
import { createMcpToken, mcpPost } from './mcp-helpers.js'

interface ErrorBody {
  error: { code: string; message: string }
}

interface TokenView {
  id: string
  lastUsedAt: string | null
}

const TOOLS_LIST = { jsonrpc: '2.0', id: 1, method: 'tools/list' } as const

async function setup(t: TestContext): Promise<{
  app: FastifyInstance
  adminCookie: string
  token: string
  tokenId: string
}> {
  const { app } = await createTestApp(t)
  const adminCookie = await loginAs(app, TEST_ADMIN.email, TEST_ADMIN.password)
  const { id, token } = await createMcpToken(app, adminCookie, 'project-payments-agent')
  return { app, adminCookie, token, tokenId: id }
}

function assertUnauthorized(status: number, body: unknown): void {
  assert.equal(status, 401)
  assert.equal((body as ErrorBody).error.code, 'UNAUTHORIZED')
  assert.equal((body as ErrorBody).error.message, 'Missing or invalid MCP bearer token')
}

test('MCP requires an Authorization header and advertises the Bearer scheme', async (t) => {
  const { app } = await createTestApp(t)

  const response = await app.inject({
    method: 'POST',
    url: '/mcp',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    payload: TOOLS_LIST,
  })

  assertUnauthorized(response.statusCode, response.json())
  assert.equal(response.headers['www-authenticate'], 'Bearer realm="company-rules"')
})

test('MCP rejects non-Bearer schemes, empty tokens and unknown tokens', async (t) => {
  const { app } = await setup(t)

  const schemes = ['Basic dXNlcjpwYXNz', 'Bearer', 'Bearer   ', 'Token abc']
  for (const authorization of schemes) {
    const response = await app.inject({
      method: 'POST',
      url: '/mcp',
      headers: {
        authorization,
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      payload: TOOLS_LIST,
    })

    assertUnauthorized(response.statusCode, response.json())
    assert.equal(response.headers['www-authenticate'], 'Bearer realm="company-rules"')
  }

  const unknown = await mcpPost(app, 'mcp_definitely-not-a-real-token', TOOLS_LIST)
  assertUnauthorized(unknown.status, unknown.payload)
})

test('a revoked MCP token is rejected', async (t) => {
  const { app, adminCookie, token, tokenId } = await setup(t)

  const revoke = await app.inject({
    method: 'DELETE',
    url: `/api/tokens/${tokenId}`,
    headers: { cookie: adminCookie },
  })
  assert.equal(revoke.statusCode, 204)

  const response = await mcpPost(app, token, TOOLS_LIST)
  assertUnauthorized(response.status, response.payload)
})

test('a valid MCP token authenticates tools/list', async (t) => {
  const { app, token } = await setup(t)

  const response = await mcpPost(app, token, TOOLS_LIST)
  assert.equal(response.status, 200)

  const payload = response.payload as {
    jsonrpc: string
    id: number
    result: { tools: Array<{ name: string }> }
  }
  assert.equal(payload.jsonrpc, '2.0')
  assert.equal(payload.id, 1)
  assert.deepEqual(
    payload.result.tools.map((tool) => tool.name).sort(),
    ['get_rule', 'list_rules', 'search_rules'],
  )

  const lowercaseScheme = await mcpPost(app, token, TOOLS_LIST, {
    authorization: `bearer ${token}`,
  })
  assert.equal(lowercaseScheme.status, 200)
})

test('an MCP token does not authenticate the REST API', async (t) => {
  const { app, token } = await setup(t)

  const response = await app.inject({
    method: 'GET',
    url: '/api/rules',
    headers: { authorization: `Bearer ${token}` },
  })

  assert.equal(response.statusCode, 401)
  assert.equal((response.json() as ErrorBody).error.code, 'UNAUTHORIZED')
})

test('a human session cookie does not authenticate the MCP endpoint', async (t) => {
  const { app, adminCookie } = await setup(t)

  const response = await app.inject({
    method: 'POST',
    url: '/mcp',
    headers: {
      cookie: adminCookie,
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
    },
    payload: TOOLS_LIST,
  })

  assertUnauthorized(response.statusCode, response.json())
})

test('a successful MCP call records lastUsedAt for the token', async (t) => {
  const { app, adminCookie, token, tokenId } = await setup(t)

  async function lastUsedAt(): Promise<string | null> {
    const response = await app.inject({
      method: 'GET',
      url: '/api/tokens',
      headers: { cookie: adminCookie },
    })
    assert.equal(response.statusCode, 200)

    const tokens = response.json() as TokenView[]
    const found = tokens.find((entry) => entry.id === tokenId)
    assert.ok(found, 'created token should be listed')
    return found.lastUsedAt
  }

  assert.equal(await lastUsedAt(), null)

  const response = await mcpPost(app, token, TOOLS_LIST)
  assert.equal(response.status, 200)

  const usedAt = await lastUsedAt()
  assert.ok(usedAt !== null, 'lastUsedAt should be set after a valid MCP call')
  assert.ok(!Number.isNaN(Date.parse(usedAt)))
})

test('GET /mcp is rejected with a JSON-RPC 405 in stateless mode', async (t) => {
  const { app, token } = await setup(t)

  const response = await app.inject({
    method: 'GET',
    url: '/mcp',
    headers: { authorization: `Bearer ${token}` },
  })

  assert.equal(response.statusCode, 405)
  const body = response.json() as { error: { code: number; message: string } }
  assert.equal(body.error.code, -32000)
  assert.equal(body.error.message, 'Method not allowed.')
})
