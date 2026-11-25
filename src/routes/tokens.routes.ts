import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { generateMcpToken, hashToken } from '../auth/crypto.js'
import { type SessionGuards } from '../auth/session.guard.js'
import type { McpToken, TokensRepo } from '../storage/tokens.repo.js'

const idParamsSchema = z.object({ id: z.string().min(1) })

const createTokenBodySchema = z.object({
  name: z.string().trim().min(1),
})

export interface TokensRoutesOptions {
  tokensRepo: TokensRepo
  guards: SessionGuards
}

interface TokenView {
  id: string
  name: string
  active: boolean
  createdAt: string
  lastUsedAt: string | null
}

/** Public token representation: the hash never leaves the server. */
function toTokenView(token: McpToken): TokenView {
  return {
    id: token.id,
    name: token.name,
    active: token.active,
    createdAt: token.createdAt,
    lastUsedAt: token.lastUsedAt,
  }
}

export const tokensRoutes: FastifyPluginAsync<TokensRoutesOptions> = async (app, options) => {
  const { tokensRepo, guards } = options

  app.addHook('preHandler', guards.requireSession)
  app.addHook('preHandler', guards.requireRole('admin'))

  app.get('/', async () => {
    const tokens = await tokensRepo.list()
    return tokens.map(toTokenView)
  })

  app.post('/', async (request, reply) => {
    const body = createTokenBodySchema.parse(request.body)
    const token = generateMcpToken()
    const created = await tokensRepo.create({ name: body.name, tokenHash: hashToken(token) })

    return reply.code(201).send({ token, ...toTokenView(created) })
  })

  app.delete('/:id', async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params)
    await tokensRepo.revoke(id)
    return reply.code(204).send()
  })
}
