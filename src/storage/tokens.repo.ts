import { randomBytes } from 'node:crypto'
import path from 'node:path'
import { z } from 'zod'
import { StorageError } from './errors.js'
import { readJsonFile, writeJsonAtomic } from './fs-utils.js'

const tokenHashSchema = z
  .string()
  .regex(/^[0-9a-f]{64}$/, 'Token hash must be a lowercase SHA-256 hex string')

export const mcpTokenSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  tokenHash: tokenHashSchema,
  active: z.boolean(),
  createdAt: z.iso.datetime(),
  lastUsedAt: z.iso.datetime().nullable(),
})

export type McpToken = z.infer<typeof mcpTokenSchema>

export function tokensFilePath(dataDir: string): string {
  return path.join(dataDir, 'mcp-tokens.json')
}

const createTokenInputSchema = z.object({
  name: z.string().trim().min(1),
  tokenHash: tokenHashSchema,
})

export type CreateTokenInput = z.input<typeof createTokenInputSchema>

export interface TokensRepo {
  list(): Promise<McpToken[]>
  findById(id: string): Promise<McpToken | null>
  /** Returns the token with this hash only when it is still active. */
  findActiveByTokenHash(tokenHash: string): Promise<McpToken | null>
  create(input: CreateTokenInput): Promise<McpToken>
  revoke(id: string): Promise<McpToken>
  touchLastUsed(id: string): Promise<McpToken>
}

export function createTokensRepo(options: { dataDir: string }): TokensRepo {
  const filePath = tokensFilePath(options.dataDir)

  async function readTokens(): Promise<McpToken[]> {
    const raw = await readJsonFile<unknown>(filePath)
    if (raw === null) return []

    const parsed = z.array(mcpTokenSchema).safeParse(raw)
    if (!parsed.success) {
      throw new StorageError('CORRUPT', `Invalid tokens file: ${filePath}: ${z.prettifyError(parsed.error)}`)
    }
    return parsed.data
  }

  async function writeTokens(tokens: McpToken[]): Promise<void> {
    await writeJsonAtomic(filePath, tokens)
  }

  return {
    list: readTokens,

    async findById(id) {
      const tokens = await readTokens()
      return tokens.find((token) => token.id === id) ?? null
    },

    async findActiveByTokenHash(tokenHash) {
      const normalized = tokenHash.trim().toLowerCase()
      const tokens = await readTokens()
      return tokens.find((token) => token.active && token.tokenHash === normalized) ?? null
    },

    async create(rawInput) {
      const input = createTokenInputSchema.parse(rawInput)
      const tokens = await readTokens()

      const token: McpToken = {
        id: `tok_${randomBytes(6).toString('hex')}`,
        name: input.name,
        tokenHash: input.tokenHash,
        active: true,
        createdAt: new Date().toISOString(),
        lastUsedAt: null,
      }

      await writeTokens([...tokens, token])
      return token
    },

    async revoke(id) {
      const tokens = await readTokens()
      const index = tokens.findIndex((token) => token.id === id)

      if (index === -1) {
        throw new StorageError('NOT_FOUND', `Token ${id} not found`)
      }

      const current = tokens[index] as McpToken
      if (!current.active) return current

      const revoked: McpToken = { ...current, active: false }
      const nextTokens = [...tokens]
      nextTokens[index] = revoked
      await writeTokens(nextTokens)
      return revoked
    },

    async touchLastUsed(id) {
      const tokens = await readTokens()
      const index = tokens.findIndex((token) => token.id === id)

      if (index === -1) {
        throw new StorageError('NOT_FOUND', `Token ${id} not found`)
      }

      const current = tokens[index] as McpToken
      const touched: McpToken = { ...current, lastUsedAt: new Date().toISOString() }
      const nextTokens = [...tokens]
      nextTokens[index] = touched
      await writeTokens(nextTokens)
      return touched
    },
  }
}
