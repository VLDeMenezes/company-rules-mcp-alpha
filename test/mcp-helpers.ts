import assert from 'node:assert/strict'
import type { OutgoingHttpHeaders } from 'node:http'
import type { FastifyInstance } from 'fastify'

export interface JsonRpcError {
  code: number
  message: string
  data?: unknown
}

export interface JsonRpcResponse {
  jsonrpc: '2.0'
  id: string | number | null
  result?: unknown
  error?: JsonRpcError
}

export interface ToolResult {
  content: Array<{ type: string; text?: string }>
  isError?: boolean
}

export interface McpHttpResponse {
  status: number
  payload: unknown
  headers: OutgoingHttpHeaders
}

function parsePayload(raw: string, contentType: OutgoingHttpHeaders['content-type']): unknown {
  const type = Array.isArray(contentType) ? contentType[0] : contentType

  if (type?.includes('text/event-stream')) {
    const dataLines = raw
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice('data:'.length).trim())
      .filter((line) => line.length > 0)

    const last = dataLines.at(-1)
    assert.ok(last !== undefined, `SSE response has no data frames: ${raw}`)
    return JSON.parse(last) as unknown
  }

  return raw.length > 0 ? (JSON.parse(raw) as unknown) : null
}

/** Issues a token through the admin REST API and returns the plaintext once. */
export async function createMcpToken(
  app: FastifyInstance,
  adminCookie: string,
  name = 'test-agent',
): Promise<{ id: string; token: string }> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/tokens',
    headers: { cookie: adminCookie },
    payload: { name },
  })
  assert.equal(response.statusCode, 201, `token creation failed: ${response.body}`)

  const body = response.json() as { id: string; token: string }
  return { id: body.id, token: body.token }
}

/**
 * Calls the MCP endpoint with a JSON-RPC message and decodes either the SSE or
 * the plain JSON response the SDK may produce.
 */
export async function mcpPost(
  app: FastifyInstance,
  token: string,
  body: unknown,
  extraHeaders: Record<string, string> = {},
): Promise<McpHttpResponse> {
  const response = await app.inject({
    method: 'POST',
    url: '/mcp',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      ...extraHeaders,
    },
    payload: body as object,
  })

  return {
    status: response.statusCode,
    payload: parsePayload(response.body, response.headers['content-type']),
    headers: response.headers,
  }
}

/** Sends an arbitrary JSON-RPC request and asserts a 200 response. */
export async function mcpRequest(
  app: FastifyInstance,
  token: string,
  method: string,
  params?: Record<string, unknown>,
): Promise<JsonRpcResponse> {
  const response = await mcpPost(app, token, {
    jsonrpc: '2.0',
    id: 1,
    method,
    ...(params !== undefined ? { params } : {}),
  })

  assert.equal(response.status, 200, `MCP request failed: ${JSON.stringify(response.payload)}`)
  return response.payload as JsonRpcResponse
}

/** Calls a tool and returns the raw `tools/call` result (errors included). */
export async function callTool(
  app: FastifyInstance,
  token: string,
  name: string,
  args: Record<string, unknown> = {},
): Promise<ToolResult> {
  const payload = await mcpRequest(app, token, 'tools/call', { name, arguments: args })

  assert.ok(payload.result !== undefined, `tools/call returned an error: ${JSON.stringify(payload)}`)
  return payload.result as ToolResult
}

/** Reads the first text block of a tool result. */
export function toolText(result: ToolResult): string {
  const [first] = result.content
  assert.ok(first, 'tool result has no content')
  assert.equal(first.type, 'text')
  assert.ok(typeof first.text === 'string', 'tool result text block has no text')
  return first.text
}

/** Reads the first text block of a tool result and parses it as JSON. */
export function toolJson<T>(result: ToolResult): T {
  return JSON.parse(toolText(result)) as T
}
