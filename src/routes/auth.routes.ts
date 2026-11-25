import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { verifyPassword } from '../auth/crypto.js'
import { getSessionUser, toSessionUser, type SessionGuards } from '../auth/session.guard.js'
import type { UsersRepo } from '../storage/users.repo.js'

const loginBodySchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(1),
})

export interface AuthRoutesOptions {
  usersRepo: UsersRepo
  guards: SessionGuards
}

export const authRoutes: FastifyPluginAsync<AuthRoutesOptions> = async (app, options) => {
  const { usersRepo, guards } = options

  app.post('/login', async (request, reply) => {
    const body = loginBodySchema.parse(request.body)
    const user = await usersRepo.findByEmail(body.email)

    if (!user || !user.active || !verifyPassword(body.password, user.passwordHash)) {
      return reply.code(401).send({
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      })
    }

    guards.setSessionCookie(reply, user.id)
    return reply.send(toSessionUser(user))
  })

  app.post('/logout', async (_request, reply) => {
    guards.clearSessionCookie(reply)
    return reply.code(204).send()
  })

  app.get('/me', { preHandler: guards.requireSession }, async (request, reply) => {
    return reply.send(toSessionUser(getSessionUser(request)))
  })
}
