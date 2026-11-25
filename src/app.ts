import cookie from '@fastify/cookie'
import Fastify, { type FastifyInstance } from 'fastify'
import { ZodError } from 'zod'
import { createSessionGuards } from './auth/session.guard.js'
import type { AppConfig } from './config.js'
import { authRoutes } from './routes/auth.routes.js'
import { rulesRoutes } from './routes/rules.routes.js'
import { tokensRoutes } from './routes/tokens.routes.js'
import { usersRoutes } from './routes/users.routes.js'
import { StorageError } from './storage/errors.js'
import { createRulesRepo, type RulesRepo } from './storage/rules.repo.js'
import { createTokensRepo, type TokensRepo } from './storage/tokens.repo.js'
import { createUsersRepo, type UsersRepo } from './storage/users.repo.js'

export interface BuildAppOptions {
  config: AppConfig
  usersRepo?: UsersRepo
  rulesRepo?: RulesRepo
  tokensRepo?: TokensRepo
  logger?: boolean
}

function errorStatusCode(error: unknown): number | null {
  if (typeof error !== 'object' || error === null || !('statusCode' in error)) return null

  const statusCode = (error as { statusCode?: unknown }).statusCode
  return typeof statusCode === 'number' ? statusCode : null
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Bad request'
}

function formatZodError(error: ZodError): string {
  return error.issues
    .map((issue) =>
      issue.path.length > 0 ? `${issue.path.join('.')}: ${issue.message}` : issue.message,
    )
    .join('; ')
}

export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const { config } = options

  const usersRepo = options.usersRepo ?? createUsersRepo({ dataDir: config.dataDir })
  const rulesRepo = options.rulesRepo ?? createRulesRepo({ dataDir: config.dataDir })
  const tokensRepo = options.tokensRepo ?? createTokensRepo({ dataDir: config.dataDir })

  const app = Fastify({ logger: options.logger ?? true })

  await app.register(cookie, { secret: config.sessionSecret })
  app.decorateRequest('currentUser', null)

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof StorageError) {
      if (error.code === 'NOT_FOUND') {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: error.message } })
      }
      if (error.code === 'CONFLICT') {
        return reply.code(409).send({ error: { code: 'CONFLICT', message: error.message } })
      }

      request.log.error(error)
      return reply
        .code(500)
        .send({ error: { code: 'INTERNAL', message: 'Internal server error' } })
    }

    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: { code: 'VALIDATION', message: formatZodError(error) },
      })
    }

    const statusCode = errorStatusCode(error)
    if (statusCode !== null && statusCode >= 400 && statusCode < 500) {
      return reply.code(statusCode).send({
        error: { code: 'BAD_REQUEST', message: errorMessage(error) },
      })
    }

    request.log.error(error)
    return reply
      .code(500)
      .send({ error: { code: 'INTERNAL', message: 'Internal server error' } })
  })

  const guards = createSessionGuards({
    usersRepo,
    secureCookies: config.nodeEnv === 'production',
  })

  await app.register(authRoutes, { prefix: '/api/auth', usersRepo, guards })
  await app.register(rulesRoutes, { prefix: '/api/rules', rulesRepo, guards })
  await app.register(usersRoutes, { prefix: '/api/users', usersRepo, guards })
  await app.register(tokensRoutes, { prefix: '/api/tokens', tokensRepo, guards })

  return app
}
