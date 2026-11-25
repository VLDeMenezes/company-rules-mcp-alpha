import assert from 'node:assert/strict'
import type { TestContext } from 'node:test'
import { test } from 'node:test'
import type { FastifyInstance } from 'fastify'
import type { RuleMeta } from '../src/storage/rules.repo.js'
import { TEST_ADMIN, createTestApp, loginAs } from './helpers.js'
import {
  callTool,
  createMcpToken,
  mcpPost,
  mcpRequest,
  toolJson,
  toolText,
  type JsonRpcResponse,
  type ToolResult,
} from './mcp-helpers.js'

const SHORT_CONTENT = '# Input validation\n\nValidate every input with Zod. Reject unknown fields.'

const LONG_CONTENT = [
  '# Secrets management',
  '',
  'Rotate credentials regularly. '.repeat(30),
  '',
  'Never commit secrets. Put them in a quarantine vault.',
  '',
  'Audit access monthly. '.repeat(30),
].join('\n')

interface RulePayload {
  id: string
  title: string
  category: string
  tags: string[]
  severity: 'mandatory' | 'recommended' | 'optional'
  content: string
}

const RULES: RulePayload[] = [
  {
    id: 'SEC-001',
    title: 'Input validation and sanitization',
    category: 'security',
    tags: ['api', 'validation'],
    severity: 'mandatory',
    content: SHORT_CONTENT,
  },
  {
    id: 'SEC-002',
    title: 'Secrets management',
    category: 'security',
    tags: ['secrets', 'operations'],
    severity: 'recommended',
    content: LONG_CONTENT,
  },
  {
    id: 'ARCH-001',
    title: 'Layered architecture',
    category: 'architecture',
    tags: ['design'],
    severity: 'optional',
    content: '# Layers\n\nKeep the domain independent from transport.',
  },
  {
    id: 'SEC-003',
    title: 'Legacy rule',
    category: 'security',
    tags: ['legacy'],
    severity: 'optional',
    content: '# Legacy\n\nThis rule is deactivated by the test.',
  },
]

async function setup(t: TestContext): Promise<{
  app: FastifyInstance
  adminCookie: string
  token: string
}> {
  const { app } = await createTestApp(t)
  const adminCookie = await loginAs(app, TEST_ADMIN.email, TEST_ADMIN.password)
  const { token } = await createMcpToken(app, adminCookie)

  for (const payload of RULES) {
    const response = await app.inject({
      method: 'POST',
      url: '/api/rules',
      headers: { cookie: adminCookie },
      payload,
    })
    assert.equal(response.statusCode, 201, `rule creation failed: ${response.body}`)
  }

  const deactivate = await app.inject({
    method: 'DELETE',
    url: '/api/rules/SEC-003',
    headers: { cookie: adminCookie },
  })
  assert.equal(deactivate.statusCode, 204)

  return { app, adminCookie, token }
}

function ruleIds(result: ToolResult): string[] {
  const body = toolJson<{ rules: Array<{ id: string }> }>(result)
  return body.rules.map((rule) => rule.id)
}

test('initialize advertises the read-only tools and resources capabilities', async (t) => {
  const { app, token } = await setup(t)

  const payload = await mcpRequest(app, token, 'initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'test-client', version: '1.0.0' },
  })

  const result = payload.result as {
    protocolVersion: string
    serverInfo: { name: string; version: string }
    capabilities: { tools?: unknown; resources?: unknown }
  }

  assert.equal(result.protocolVersion, '2025-06-18')
  assert.equal(result.serverInfo.name, 'company-rules')
  assert.ok(result.capabilities.tools, 'tools capability should be advertised')
  assert.ok(result.capabilities.resources, 'resources capability should be advertised')
})

test('tools/list announces exactly the three read-only tools', async (t) => {
  const { app, token } = await setup(t)

  const payload = await mcpRequest(app, token, 'tools/list')
  const result = payload.result as { tools: Array<{ name: string; description?: string }> }
  const names = result.tools.map((tool) => tool.name)

  assert.deepEqual([...names].sort(), ['get_rule', 'list_rules', 'search_rules'])

  for (const tool of result.tools) {
    assert.equal(typeof tool.description, 'string')
    assert.ok((tool.description ?? '').length > 0, `${tool.name} should have a description`)
  }

  const writeTools = ['create_rule', 'update_rule', 'delete_rule', 'create_user', 'delete_user', 'create_token', 'delete_token']
  for (const forbidden of writeTools) {
    assert.equal(names.includes(forbidden), false, `${forbidden} must not be exposed`)
  }
})

test('list_rules returns active rules with compact metadata only', async (t) => {
  const { app, token } = await setup(t)

  const result = await callTool(app, token, 'list_rules')
  assert.equal(result.isError, undefined)

  const body = toolJson<{ rules: Array<Record<string, unknown>> }>(result)
  assert.deepEqual(
    body.rules.map((rule) => rule.id),
    ['ARCH-001', 'SEC-001', 'SEC-002'],
  )

  for (const rule of body.rules) {
    assert.deepEqual(Object.keys(rule).sort(), ['category', 'id', 'severity', 'tags', 'title', 'version'])
    assert.equal('content' in rule, false)
    assert.equal('updatedBy' in rule, false)
  }
})

test('list_rules filters by category and tag', async (t) => {
  const { app, token } = await setup(t)

  assert.deepEqual(ruleIds(await callTool(app, token, 'list_rules', { category: 'security' })), [
    'SEC-001',
    'SEC-002',
  ])
  assert.deepEqual(ruleIds(await callTool(app, token, 'list_rules', { tag: 'design' })), ['ARCH-001'])
  assert.deepEqual(
    ruleIds(await callTool(app, token, 'list_rules', { category: 'security', tag: 'secrets' })),
    ['SEC-002'],
  )
  // The only rule carrying this tag is inactive.
  assert.deepEqual(ruleIds(await callTool(app, token, 'list_rules', { tag: 'legacy' })), [])
})

test('get_rule returns full metadata and Markdown for an active rule', async (t) => {
  const { app, token } = await setup(t)

  const result = await callTool(app, token, 'get_rule', { id: 'SEC-001' })
  assert.equal(result.isError, undefined)

  const body = toolJson<{ meta: RuleMeta; content: string }>(result)
  assert.equal(body.meta.id, 'SEC-001')
  assert.equal(body.meta.title, 'Input validation and sanitization')
  assert.equal(body.meta.category, 'security')
  assert.deepEqual(body.meta.tags, ['api', 'validation'])
  assert.equal(body.meta.severity, 'mandatory')
  assert.equal(body.meta.version, 1)
  assert.equal(body.content, SHORT_CONTENT)
})

test('get_rule reports logically deleted and unknown rules as tool errors', async (t) => {
  const { app, token } = await setup(t)

  const deleted = await callTool(app, token, 'get_rule', { id: 'SEC-003' })
  assert.equal(deleted.isError, true)
  assert.match(toolText(deleted), /SEC-003/)

  const missing = await callTool(app, token, 'get_rule', { id: 'SEC-404' })
  assert.equal(missing.isError, true)
  assert.match(toolText(missing), /SEC-404/)
})

test('search_rules matches title, tag and content case-insensitively', async (t) => {
  const { app, token } = await setup(t)

  async function searchIds(query: string): Promise<string[]> {
    const result = await callTool(app, token, 'search_rules', { query })
    assert.equal(result.isError, undefined)
    const body = toolJson<{ matches: Array<{ id: string }> }>(result)
    return body.matches.map((match) => match.id)
  }

  assert.deepEqual(await searchIds('sanitization'), ['SEC-001'])
  assert.deepEqual(await searchIds('SANITIZATION'), ['SEC-001'])
  assert.deepEqual(await searchIds('sec-001'), ['SEC-001'])
  assert.deepEqual(await searchIds('operations'), ['SEC-002'])
  assert.deepEqual(await searchIds('quarantine'), ['SEC-002'])
  assert.deepEqual(await searchIds('kubernetes'), [])
  // "legacy" only appears in the inactive SEC-003, so it must not surface.
  assert.deepEqual(await searchIds('legacy'), [])
})

test('search_rules inlines short content and snippets long content', async (t) => {
  const { app, token } = await setup(t)

  const shortResult = await callTool(app, token, 'search_rules', { query: 'Zod' })
  const shortMatch = toolJson<{
    query: string
    matches: Array<{ id: string; content?: string; snippet?: string }>
  }>(shortResult)

  assert.equal(shortMatch.query, 'Zod')
  assert.equal(shortMatch.matches.length, 1)
  assert.equal(shortMatch.matches[0]?.id, 'SEC-001')
  assert.equal(shortMatch.matches[0]?.content, SHORT_CONTENT)
  assert.equal(shortMatch.matches[0]?.snippet, undefined)

  const longResult = await callTool(app, token, 'search_rules', { query: 'quarantine' })
  const longMatch = toolJson<{
    matches: Array<{ id: string; content?: string; snippet?: string }>
  }>(longResult)

  assert.equal(longMatch.matches.length, 1)
  const match = longMatch.matches[0]
  assert.ok(match)
  assert.equal(match.id, 'SEC-002')
  assert.equal(match.content, undefined)
  assert.ok(typeof match.snippet === 'string')
  assert.ok(match.snippet.includes('quarantine'))
  assert.ok(match.snippet.startsWith('…'))
  assert.ok(match.snippet.endsWith('…'))
  assert.ok(match.snippet.length < LONG_CONTENT.length)
})

test('search_rules returns an empty match list when nothing matches', async (t) => {
  const { app, token } = await setup(t)

  const result = await callTool(app, token, 'search_rules', { query: 'nonexistent-term' })
  const body = toolJson<{ query: string; matches: unknown[] }>(result)

  assert.equal(body.query, 'nonexistent-term')
  assert.deepEqual(body.matches, [])
})

test('invalid tool arguments produce tool errors without breaking the server', async (t) => {
  const { app, token } = await setup(t)

  const missingId = await callTool(app, token, 'get_rule', { text: 42 })
  assert.equal(missingId.isError, true)

  const blankQuery = await callTool(app, token, 'search_rules', { query: '   ' })
  assert.equal(blankQuery.isError, true)

  const wrongType = await callTool(app, token, 'list_rules', { category: 42 })
  assert.equal(wrongType.isError, true)

  // The endpoint still serves valid requests afterwards.
  const payload = await mcpRequest(app, token, 'tools/list')
  assert.ok(Array.isArray((payload.result as { tools: unknown[] }).tools))
})

test('resources/list exposes active rules only', async (t) => {
  const { app, token } = await setup(t)

  const payload = await mcpRequest(app, token, 'resources/list')
  const result = payload.result as {
    resources: Array<{ uri: string; name: string; title?: string; mimeType?: string }>
  }

  const uris = result.resources.map((resource) => resource.uri)
  assert.deepEqual(uris.sort(), ['rule://ARCH-001', 'rule://SEC-001', 'rule://SEC-002'])

  const sec001 = result.resources.find((resource) => resource.uri === 'rule://SEC-001')
  assert.ok(sec001)
  assert.equal(sec001.name, 'SEC-001')
  assert.equal(sec001.title, 'Input validation and sanitization')
  assert.equal(sec001.mimeType, 'text/markdown')
})

test('resources/read returns the Markdown of an active rule', async (t) => {
  const { app, token } = await setup(t)

  const payload = await mcpRequest(app, token, 'resources/read', { uri: 'rule://SEC-001' })
  const result = payload.result as {
    contents: Array<{ uri: string; text: string; mimeType?: string }>
  }

  assert.equal(result.contents.length, 1)
  assert.equal(result.contents[0]?.uri, 'rule://SEC-001')
  assert.equal(result.contents[0]?.text, SHORT_CONTENT)
})

test('resources/read fails for inactive and unknown rules', async (t) => {
  const { app, token } = await setup(t)

  for (const uri of ['rule://SEC-003', 'rule://SEC-404']) {
    const response = await mcpPost(app, token, {
      jsonrpc: '2.0',
      id: 7,
      method: 'resources/read',
      params: { uri },
    })

    assert.equal(response.status, 200)
    const payload = response.payload as JsonRpcResponse
    assert.equal(payload.result, undefined)
    assert.ok(payload.error, `expected a JSON-RPC error for ${uri}`)
  }
})
