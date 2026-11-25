import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import {
  McpServer,
  ResourceNotFoundError,
  ResourceTemplate,
  createMcpHandler,
  type CallToolResult,
  type McpServerFactory,
} from '@modelcontextprotocol/server'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { createMcpAuthGuard } from '../auth/mcp-auth.guard.js'
import type { RuleFilters, RuleMeta, RuleSeverity, RulesRepo } from '../storage/rules.repo.js'
import type { TokensRepo } from '../storage/tokens.repo.js'

/** Compact rule projection returned by `list_rules` (never includes Markdown). */
export interface RuleSummary {
  id: string
  title: string
  category: string
  tags: string[]
  severity: RuleSeverity
  version: number
}

export interface SearchMatch extends RuleSummary {
  /** Full Markdown content, present only for rules short enough to inline. */
  content?: string
  /** Contextual excerpt, present only when the content is too long to inline. */
  snippet?: string
}

/** Content at or below this length is returned in full by `search_rules`. */
export const CONTENT_INLINE_THRESHOLD = 1200
/** Characters of context kept on each side of a search hit. */
const SNIPPET_RADIUS = 120

const listRulesInputSchema = z.object({
  category: z.string().trim().min(1).optional(),
  tag: z.string().trim().min(1).optional(),
})

const getRuleInputSchema = z.object({
  id: z.string().trim().min(1),
})

const searchRulesInputSchema = z.object({
  query: z.string().trim().min(1),
})

function toRuleSummary(meta: RuleMeta): RuleSummary {
  return {
    id: meta.id,
    title: meta.title,
    category: meta.category,
    tags: meta.tags,
    severity: meta.severity,
    version: meta.version,
  }
}

function jsonResult(value: unknown): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] }
}

function errorResult(message: string): CallToolResult {
  return { content: [{ type: 'text', text: message }], isError: true }
}

function matchesQuery(meta: RuleMeta, content: string, needle: string): boolean {
  return (
    meta.id.toLowerCase().includes(needle) ||
    meta.title.toLowerCase().includes(needle) ||
    meta.tags.some((tag) => tag.toLowerCase().includes(needle)) ||
    content.toLowerCase().includes(needle)
  )
}

/**
 * Builds an excerpt around the first occurrence of `query` in `content`, with
 * an ellipsis on whichever side was cut. Metadata-only matches fall back to the
 * beginning of the content.
 */
function buildSnippet(content: string, query: string): string {
  const index = content.toLowerCase().indexOf(query.toLowerCase())

  if (index === -1) {
    const head = content.slice(0, SNIPPET_RADIUS * 2).trimEnd()
    return head.length < content.length ? `${head}…` : head
  }

  const start = Math.max(0, index - SNIPPET_RADIUS)
  const end = Math.min(content.length, index + query.length + SNIPPET_RADIUS)
  const prefix = start > 0 ? '…' : ''
  const suffix = end < content.length ? '…' : ''
  return `${prefix}${content.slice(start, end).trim()}${suffix}`
}

function firstVariable(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export interface McpServerDeps {
  rulesRepo: RulesRepo
}

/**
 * Builds the factory that `createMcpHandler` calls once per request. Every
 * instance only exposes read-only capabilities over active rules.
 */
export function createMcpServerFactory({ rulesRepo }: McpServerDeps): McpServerFactory {
  return () => {
    const server = new McpServer({ name: 'company-rules', version: '1.0.0' })

    server.registerTool(
      'list_rules',
      {
        title: 'List company rules',
        description:
          'List the company engineering rules that are currently active. Returns compact metadata only ' +
          '(id, title, category, tags, severity, version) without the rule Markdown. Optionally filter by ' +
          'category or tag. Use get_rule to fetch the full content of a specific rule.',
        inputSchema: listRulesInputSchema,
      },
      async ({ category, tag }) => {
        const filters: RuleFilters = {
          active: true,
          ...(category !== undefined ? { category } : {}),
          ...(tag !== undefined ? { tag } : {}),
        }

        const metas = await rulesRepo.list(filters)
        return jsonResult({ rules: metas.map(toRuleSummary) })
      },
    )

    server.registerTool(
      'get_rule',
      {
        title: 'Get a company rule',
        description:
          'Return the complete metadata and full Markdown content of one active company rule by id. ' +
          'Inactive or unknown rules produce an error result.',
        inputSchema: getRuleInputSchema,
      },
      async ({ id }) => {
        const rule = await rulesRepo.get(id)
        if (!rule || !rule.meta.active) {
          return errorResult(`Rule "${id}" was not found or is not active.`)
        }

        return jsonResult({ meta: rule.meta, content: rule.content })
      },
    )

    server.registerTool(
      'search_rules',
      {
        title: 'Search company rules',
        description:
          'Search active company rules by case-insensitive substring across id, title, tags and Markdown ' +
          'content. Each match includes compact metadata plus either the full content (short rules) or a ' +
          'snippet around the hit (long rules).',
        inputSchema: searchRulesInputSchema,
      },
      async ({ query }) => {
        const needle = query.toLowerCase()
        const metas = await rulesRepo.list({ active: true })
        const matches: SearchMatch[] = []

        for (const meta of metas) {
          const rule = await rulesRepo.get(meta.id)
          if (!rule || !matchesQuery(meta, rule.content, needle)) continue

          const summary = toRuleSummary(meta)
          matches.push(
            rule.content.length <= CONTENT_INLINE_THRESHOLD
              ? { ...summary, content: rule.content }
              : { ...summary, snippet: buildSnippet(rule.content, needle) },
          )
        }

        return jsonResult({ query, matches })
      },
    )

    const ruleTemplate = new ResourceTemplate('rule://{id}', {
      list: async () => {
        const metas = await rulesRepo.list({ active: true })
        return {
          resources: metas.map((meta) => ({
            uri: `rule://${meta.id}`,
            name: meta.id,
            title: meta.title,
            mimeType: 'text/markdown',
            description: `${meta.category} · ${meta.severity}`,
          })),
        }
      },
    })

    server.registerResource(
      'rule',
      ruleTemplate,
      {
        title: 'Company rule',
        description: 'Markdown content of an active company rule.',
        mimeType: 'text/markdown',
      },
      async (uri, variables) => {
        const id = firstVariable(variables.id)
        const rule = id === undefined ? null : await rulesRepo.get(id)

        if (!rule || !rule.meta.active) {
          throw new ResourceNotFoundError(uri.href, `Rule ${id ?? uri.href} not found or is not active`)
        }

        return { contents: [{ uri: uri.href, text: rule.content }] }
      },
    )

    return server
  }
}

export interface MountMcpServerOptions {
  rulesRepo: RulesRepo
  tokensRepo: TokensRepo
}

/**
 * Mounts the read-only MCP endpoint on an existing Fastify app. Fastify parses
 * the body and owns the socket, so each request is translated into a Web
 * `Request`, served by the SDK handler, and the Web `Response` is streamed
 * back (MCP 2025 responses are `text/event-stream`).
 */
export function mountMcpServer(app: FastifyInstance, options: MountMcpServerOptions): void {
  const handler = createMcpHandler(createMcpServerFactory({ rulesRepo: options.rulesRepo }))
  const guard = createMcpAuthGuard({ tokensRepo: options.tokensRepo })

  app.route({
    method: ['GET', 'POST', 'DELETE'],
    url: '/mcp',
    preHandler: guard,
    handler: async (request, reply) => {
      const headers = new Headers()
      for (const [key, value] of Object.entries(request.headers)) {
        if (value === undefined) continue
        if (key === 'content-length' || key === 'transfer-encoding') continue
        headers.set(key, Array.isArray(value) ? value.join(', ') : value)
      }

      const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`)
      const webRequest = new Request(url, { method: request.method, headers })

      // Fastify already parsed the body; handing it over keeps the SDK from
      // trying to read the (already drained) request stream again.
      const response = await handler.fetch(webRequest, { parsedBody: request.body })

      reply.hijack()
      reply.raw.statusCode = response.status
      response.headers.forEach((value, key) => reply.raw.setHeader(key, value))

      if (response.body === null) {
        reply.raw.end()
        return
      }

      await pipeline(Readable.fromWeb(response.body), reply.raw)
    },
  })

  app.addHook('onClose', async () => {
    await handler.close()
  })
}
