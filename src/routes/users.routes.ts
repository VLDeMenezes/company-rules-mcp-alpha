import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { hashPassword } from '../auth/crypto.js'
import { type SessionGuards } from '../auth/session.guard.js'
import {
  toPublicUser,
  userRoleSchema,
  type UpdateUserInput,
  type UsersRepo,
} from '../storage/users.repo.js'

const idParamsSchema = z.object({ id: z.string().min(1) })

const createUserBodySchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  githubUsername: z.string().trim().optional(),
  role: userRoleSchema,
  password: z.string().min(8),
})

const updateUserBodySchema = z
  .object({
    githubUsername: z.string().trim().optional(),
    role: userRoleSchema.optional(),
    active: z.boolean().optional(),
    password: z.string().min(8).optional(),
  })
  .refine((patch) => Object.values(patch).some((value) => value !== undefined), {
    message: 'At least one field is required',
  })

export interface UsersRoutesOptions {
  usersRepo: UsersRepo
  guards: SessionGuards
}

export const usersRoutes: FastifyPluginAsync<UsersRoutesOptions> = async (app, options) => {
  const { usersRepo, guards } = options

  app.addHook('preHandler', guards.requireSession)
  app.addHook('preHandler', guards.requireRole('admin'))

  app.get('/', async () => {
    const users = await usersRepo.list()
    return users.map(toPublicUser)
  })

  app.post('/', async (request, reply) => {
    const body = createUserBodySchema.parse(request.body)

    const user = await usersRepo.create({
      email: body.email,
      ...(body.githubUsername !== undefined ? { githubUsername: body.githubUsername } : {}),
      role: body.role,
      passwordHash: hashPassword(body.password),
    })

    return reply.code(201).send(toPublicUser(user))
  })

  app.patch('/:id', async (request) => {
    const { id } = idParamsSchema.parse(request.params)
    const body = updateUserBodySchema.parse(request.body)

    const patch: UpdateUserInput = {
      ...(body.githubUsername !== undefined ? { githubUsername: body.githubUsername } : {}),
      ...(body.role !== undefined ? { role: body.role } : {}),
      ...(body.active !== undefined ? { active: body.active } : {}),
      ...(body.password !== undefined ? { passwordHash: hashPassword(body.password) } : {}),
    }

    const user = await usersRepo.update(id, patch)
    return toPublicUser(user)
  })
}
