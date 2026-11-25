import path from 'node:path'
import { z } from 'zod'

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().trim().min(1).default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATA_DIR: z.string().trim().min(1).default('./data'),
  INITIAL_ADMIN_EMAIL: z.email(),
  INITIAL_ADMIN_PASSWORD: z.string().min(8),
  INITIAL_ADMIN_GITHUB_USERNAME: z.string().trim().min(1).default('admin'),
  SESSION_SECRET: z.string().min(32),
})

export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production'
  host: string
  port: number
  /** Absolute path to the directory that holds users.json, mcp-tokens.json and rules/. */
  dataDir: string
  sessionSecret: string
  initialAdmin: {
    email: string
    password: string
    githubUsername: string
  }
}

/**
 * Loads and validates configuration from an environment object (defaults to
 * `process.env`). Throws a readable error listing every invalid variable.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = configSchema.safeParse(env)

  if (!parsed.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(parsed.error)}`)
  }

  return {
    nodeEnv: parsed.data.NODE_ENV,
    host: parsed.data.HOST,
    port: parsed.data.PORT,
    dataDir: path.resolve(parsed.data.DATA_DIR),
    sessionSecret: parsed.data.SESSION_SECRET,
    initialAdmin: {
      email: parsed.data.INITIAL_ADMIN_EMAIL.trim().toLowerCase(),
      password: parsed.data.INITIAL_ADMIN_PASSWORD,
      githubUsername: parsed.data.INITIAL_ADMIN_GITHUB_USERNAME,
    },
  }
}
