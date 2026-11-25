import { hashPassword } from '../auth/crypto.js'
import { pathExists } from './fs-utils.js'
import { createUsersRepo, usersFilePath, type User } from './users.repo.js'

export interface SeedInitialAdminOptions {
  dataDir: string
  email: string
  password: string
  githubUsername?: string | undefined
}

/**
 * Creates the first admin user when `data/users.json` does not exist yet.
 * Returns the new user, or null when the file already exists (seed is a no-op).
 */
export async function seedInitialAdmin(options: SeedInitialAdminOptions): Promise<User | null> {
  const filePath = usersFilePath(options.dataDir)
  if (await pathExists(filePath)) return null

  const repo = createUsersRepo({ dataDir: options.dataDir })

  return repo.create({
    email: options.email,
    githubUsername: options.githubUsername ?? 'admin',
    role: 'admin',
    passwordHash: hashPassword(options.password),
  })
}
