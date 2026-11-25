import { existsSync } from 'node:fs'
import { loadConfig } from './config.js'
import { ensureDir } from './storage/fs-utils.js'
import { seedInitialAdmin } from './storage/seed.js'

// Load .env when present. Values already in the environment take precedence?
// Node's loadEnvFile does not override existing variables.
if (existsSync('.env')) {
  process.loadEnvFile('.env')
}

const config = loadConfig()

await ensureDir(config.dataDir)

const admin = await seedInitialAdmin({
  dataDir: config.dataDir,
  email: config.initialAdmin.email,
  password: config.initialAdmin.password,
  githubUsername: config.initialAdmin.githubUsername,
})

if (admin) {
  console.log(`Seeded initial admin user ${admin.email}`)
} else {
  console.log('Users file already exists, skipping admin seed')
}

console.log(`Storage ready at ${config.dataDir} (phase 1: HTTP server starts in phase 2)`)
