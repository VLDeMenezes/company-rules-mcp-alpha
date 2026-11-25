import { existsSync } from 'node:fs'
import { buildApp } from './app.js'
import { loadConfig } from './config.js'
import { ensureDir } from './storage/fs-utils.js'
import { seedInitialAdmin } from './storage/seed.js'

// Load .env when present. Node's loadEnvFile does not override variables that
// are already set in the environment.
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

const app = await buildApp({ config })

try {
  await app.listen({ host: config.host, port: config.port })
} catch (error) {
  app.log.error(error)
  await app.close()
  process.exit(1)
}

app.log.info(`Company Rules server listening at http://${config.host}:${config.port}`)

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  app.log.info(`Received ${signal}, shutting down`)
  await app.close()
  process.exit(0)
}

process.once('SIGINT', () => {
  void shutdown('SIGINT')
})
process.once('SIGTERM', () => {
  void shutdown('SIGTERM')
})
