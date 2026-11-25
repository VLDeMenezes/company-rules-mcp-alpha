import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { getSessionUser, type SessionGuards } from '../auth/session.guard.js'
import { StorageError } from '../storage/errors.js'
import {
  ruleIdSchema,
  ruleSeveritySchema,
  type RuleFilters,
  type RulesRepo,
} from '../storage/rules.repo.js'

const listQuerySchema = z.object({
  category: z.string().trim().min(1).optional(),
  tag: z.string().trim().min(1).optional(),
  active: z.enum(['true', 'false']).optional(),
})

const idParamsSchema = z.object({ id: z.string().min(1) })

const createRuleBodySchema = z.object({
  id: ruleIdSchema,
  title: z.string().trim().min(1),
  category: z.string().trim().min(1),
  tags: z.array(z.string().trim().min(1)).optional(),
  severity: ruleSeveritySchema.optional(),
  content: z.string(),
})

const updateRuleBodySchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    category: z.string().trim().min(1).optional(),
    tags: z.array(z.string().trim().min(1)).optional(),
    severity: ruleSeveritySchema.optional(),
    active: z.boolean().optional(),
    content: z.string().optional(),
  })
  .refine((patch) => Object.values(patch).some((value) => value !== undefined), {
    message: 'At least one field is required',
  })

const deleteQuerySchema = z.object({
  hard: z.enum(['true', 'false']).optional(),
})

export interface RulesRoutesOptions {
  rulesRepo: RulesRepo
  guards: SessionGuards
}

export const rulesRoutes: FastifyPluginAsync<RulesRoutesOptions> = async (app, options) => {
  const { rulesRepo, guards } = options

  app.addHook('preHandler', guards.requireSession)

  app.get('/', async (request) => {
    const query = listQuerySchema.parse(request.query)

    const filters: RuleFilters = {
      ...(query.category !== undefined ? { category: query.category } : {}),
      ...(query.tag !== undefined ? { tag: query.tag } : {}),
      ...(query.active !== undefined ? { active: query.active === 'true' } : {}),
    }

    return rulesRepo.list(filters)
  })

  app.get('/:id', async (request) => {
    const { id } = idParamsSchema.parse(request.params)
    const rule = await rulesRepo.get(id)

    if (!rule) {
      throw new StorageError('NOT_FOUND', `Rule ${id} not found`)
    }
    return rule
  })

  app.post('/', async (request, reply) => {
    const body = createRuleBodySchema.parse(request.body)
    const currentUser = getSessionUser(request)

    const meta = await rulesRepo.create({ ...body, updatedBy: currentUser.email })
    return reply.code(201).send({ meta, content: body.content })
  })

  app.put('/:id', async (request) => {
    const { id } = idParamsSchema.parse(request.params)
    const patch = updateRuleBodySchema.parse(request.body)
    const currentUser = getSessionUser(request)

    const meta = await rulesRepo.update(id, { ...patch, updatedBy: currentUser.email })
    const rule = await rulesRepo.get(meta.id)

    if (!rule) {
      throw new StorageError('NOT_FOUND', `Rule ${meta.id} not found`)
    }
    return rule
  })

  app.delete('/:id', async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params)
    const query = deleteQuerySchema.parse(request.query)
    const currentUser = getSessionUser(request)
    const hard = query.hard === 'true'

    if (hard && currentUser.role !== 'admin') {
      return reply.code(403).send({
        error: { code: 'FORBIDDEN', message: 'Insufficient permissions' },
      })
    }

    await rulesRepo.remove(id, { hard, updatedBy: currentUser.email })
    return reply.code(204).send()
  })
}
