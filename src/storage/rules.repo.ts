import path from 'node:path'
import { z } from 'zod'
import { StorageError } from './errors.js'
import {
  ensureDir,
  listDirectories,
  pathExists,
  readJsonFile,
  readTextFile,
  removeDir,
  writeFileAtomic,
  writeJsonAtomic,
} from './fs-utils.js'

export const RULE_SEVERITIES = ['mandatory', 'recommended', 'optional'] as const

export const ruleSeveritySchema = z.enum(RULE_SEVERITIES)

/**
 * Rule ids become directory names, so they must be safe path segments:
 * alphanumeric start, then letters, digits, dots, underscores or hyphens.
 */
export const ruleIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, 'Rule id must be a safe directory name')

export const ruleMetaSchema = z.object({
  id: ruleIdSchema,
  title: z.string().min(1),
  category: z.string().min(1),
  tags: z.array(z.string().min(1)),
  severity: ruleSeveritySchema,
  version: z.number().int().positive(),
  active: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  updatedBy: z.string().min(1),
})

export type RuleMeta = z.infer<typeof ruleMetaSchema>
export type RuleSeverity = z.infer<typeof ruleSeveritySchema>

export interface Rule {
  meta: RuleMeta
  content: string
}

export interface RuleFilters {
  category?: string | undefined
  tag?: string | undefined
  active?: boolean | undefined
}

const createRuleInputSchema = z.object({
  id: ruleIdSchema,
  title: z.string().trim().min(1),
  category: z.string().trim().min(1),
  tags: z.array(z.string().trim().min(1)).default([]),
  severity: ruleSeveritySchema.default('mandatory'),
  content: z.string(),
  updatedBy: z.string().trim().min(1),
})

const updateRuleInputSchema = z.object({
  title: z.string().trim().min(1).optional(),
  category: z.string().trim().min(1).optional(),
  tags: z.array(z.string().trim().min(1)).optional(),
  severity: ruleSeveritySchema.optional(),
  active: z.boolean().optional(),
  content: z.string().optional(),
  updatedBy: z.string().trim().min(1),
})

export type CreateRuleInput = z.input<typeof createRuleInputSchema>
export type UpdateRuleInput = z.input<typeof updateRuleInputSchema>

export interface RemoveRuleOptions {
  /** Physical deletion. Logical deletion (active: false) is the default. */
  hard?: boolean | undefined
  updatedBy: string
}

export interface RulesRepo {
  list(filters?: RuleFilters): Promise<RuleMeta[]>
  getMeta(id: string): Promise<RuleMeta | null>
  get(id: string): Promise<Rule | null>
  create(input: CreateRuleInput): Promise<RuleMeta>
  update(id: string, input: UpdateRuleInput): Promise<RuleMeta>
  remove(id: string, options: RemoveRuleOptions): Promise<void>
}

export function createRulesRepo(options: { dataDir: string }): RulesRepo {
  const rulesDir = path.join(options.dataDir, 'rules')

  const ruleDir = (id: string): string => path.join(rulesDir, id)
  const metaPath = (id: string): string => path.join(ruleDir(id), 'meta.json')
  const contentPath = (id: string): string => path.join(ruleDir(id), 'content.md')

  async function getMeta(id: string): Promise<RuleMeta | null> {
    const parsedId = ruleIdSchema.safeParse(id)
    if (!parsedId.success) return null

    const raw = await readJsonFile<unknown>(metaPath(parsedId.data))
    if (raw === null) return null

    const parsed = ruleMetaSchema.safeParse(raw)
    if (!parsed.success) {
      throw new StorageError(
        'CORRUPT',
        `Invalid rule metadata at ${metaPath(parsedId.data)}: ${z.prettifyError(parsed.error)}`,
      )
    }
    if (parsed.data.id !== parsedId.data) {
      throw new StorageError(
        'CORRUPT',
        `Rule metadata id "${parsed.data.id}" does not match its directory "${parsedId.data}"`,
      )
    }
    return parsed.data
  }

  async function updateRule(id: string, rawInput: UpdateRuleInput): Promise<RuleMeta> {
    const parsedId = ruleIdSchema.parse(id)
    const input = updateRuleInputSchema.parse(rawInput)
    const current = await getMeta(parsedId)

    if (!current) {
      throw new StorageError('NOT_FOUND', `Rule ${parsedId} not found`)
    }

    const meta: RuleMeta = {
      ...current,
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.tags !== undefined ? { tags: input.tags } : {}),
      ...(input.severity !== undefined ? { severity: input.severity } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
      version: current.version + 1,
      updatedAt: new Date().toISOString(),
      updatedBy: input.updatedBy,
    }

    if (input.content !== undefined) {
      await writeFileAtomic(contentPath(parsedId), input.content)
    }
    await writeJsonAtomic(metaPath(parsedId), meta)

    return meta
  }

  async function removeRule(id: string, options: RemoveRuleOptions): Promise<void> {
    const parsedId = ruleIdSchema.parse(id)
    const current = await getMeta(parsedId)

    if (!current) {
      throw new StorageError('NOT_FOUND', `Rule ${parsedId} not found`)
    }

    if (options.hard) {
      await removeDir(ruleDir(parsedId))
      return
    }

    if (!current.active) return

    await updateRule(parsedId, { active: false, updatedBy: options.updatedBy })
  }

  return {
    async list(filters = {}) {
      const ids = await listDirectories(rulesDir)
      const metas: RuleMeta[] = []

      for (const id of ids) {
        const meta = await getMeta(id)
        if (!meta) continue
        if (filters.category !== undefined && meta.category !== filters.category) continue
        if (filters.tag !== undefined && !meta.tags.includes(filters.tag)) continue
        if (filters.active !== undefined && meta.active !== filters.active) continue
        metas.push(meta)
      }

      return metas.sort((a, b) => a.id.localeCompare(b.id))
    },

    getMeta,

    async get(id) {
      const meta = await getMeta(id)
      if (!meta) return null

      const content = await readTextFile(contentPath(meta.id))
      if (content === null) {
        throw new StorageError('CORRUPT', `Missing content.md for rule ${meta.id}`)
      }
      return { meta, content }
    },

    async create(rawInput) {
      const input = createRuleInputSchema.parse(rawInput)
      const dir = ruleDir(input.id)

      if (await pathExists(dir)) {
        throw new StorageError('CONFLICT', `Rule ${input.id} already exists`)
      }

      await ensureDir(dir)

      const timestamp = new Date().toISOString()
      const meta: RuleMeta = {
        id: input.id,
        title: input.title,
        category: input.category,
        tags: input.tags,
        severity: input.severity,
        version: 1,
        active: true,
        createdAt: timestamp,
        updatedAt: timestamp,
        updatedBy: input.updatedBy,
      }

      try {
        await writeFileAtomic(contentPath(input.id), input.content)
        await writeJsonAtomic(metaPath(input.id), meta)
      } catch (error) {
        await removeDir(dir)
        throw error
      }

      return meta
    },

    update: updateRule,
    remove: removeRule,
  }
}
