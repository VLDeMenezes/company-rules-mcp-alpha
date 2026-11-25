import type { FastifyReply, preHandlerAsyncHookHandler } from 'fastify'
import type { TokensRepo } from '../storage/tokens.repo.js'
import { hashToken } from './crypto.js'

const WWW_AUTHENTICATE = 'Bearer realm="company-rules"'

/** Matches `Bearer <token>` with a case-insensitive scheme and trimmed token. */
const BEARER_PATTERN = /^Bearer\s+(.+)$/i

export interface McpAuthGuardOptions {
  tokensRepo: TokensRepo
}

/**
 * Extracts the bearer token from an `Authorization` header value. Returns
 * `null` for missing headers, other schemes and empty tokens.
 */
export function parseBearerToken(header: string | undefined): string | null {
  if (header === undefined) return null

  const match = BEARER_PATTERN.exec(header.trim())
  const token = match?.[1]?.trim()
  return token !== undefined && token.length > 0 ? token : null
}

/**
 * Fastify pre-handler for the read-only MCP endpoint. Only `Authorization:
 * Bearer <token>` credentials are accepted; session cookies are ignored so an
 * MCP client can never borrow a human session.
 */
export function createMcpAuthGuard(options: McpAuthGuardOptions): preHandlerAsyncHookHandler {
  const { tokensRepo } = options

  async function reject(reply: FastifyReply): Promise<void> {
    await reply
      .code(401)
      .header('www-authenticate', WWW_AUTHENTICATE)
      .send({
        error: { code: 'UNAUTHORIZED', message: 'Missing or invalid MCP bearer token' },
      })
  }

  return async (request, reply) => {
    const token = parseBearerToken(request.headers.authorization)
    if (token === null) return reject(reply)

    const record = await tokensRepo.findActiveByTokenHash(hashToken(token))
    if (!record) return reject(reply)

    await tokensRepo.touchLastUsed(record.id)
  }
}
