import { randomBytes } from 'node:crypto'
import path from 'node:path'
import { z } from 'zod'
import { StorageError } from './errors.js'
import { readJsonFile, writeJsonAtomic } from './fs-utils.js'

export const USER_ROLES = ['admin', 'editor'] as const

export const userRoleSchema = z.enum(USER_ROLES)

const emailSchema = z
  .string()
  .transform((value) => value.trim().toLowerCase())
  .pipe(z.email())

export const userSchema = z.object({
  id: z.string().min(1),
  email: z.email(),
  githubUsername: z.string(),
  role: userRoleSchema,
  passwordHash: z.string().min(1),
  active: z.boolean(),
  createdAt: z.iso.datetime(),
})

export type User = z.infer<typeof userSchema>
export type UserRole = z.infer<typeof userRoleSchema>
export type PublicUser = Omit<User, 'passwordHash'>

/** Drops the password hash before a user leaves the storage layer. */
export function toPublicUser(user: User): PublicUser {
  const { passwordHash: _passwordHash, ...publicUser } = user
  return publicUser
}

export function usersFilePath(dataDir: string): string {
  return path.join(dataDir, 'users.json')
}

const createUserInputSchema = z.object({
  email: emailSchema,
  githubUsername: z.string().trim().default(''),
  role: userRoleSchema,
  passwordHash: z.string().min(1),
})

const updateUserInputSchema = z
  .object({
    githubUsername: z.string().trim().optional(),
    role: userRoleSchema.optional(),
    active: z.boolean().optional(),
    passwordHash: z.string().min(1).optional(),
  })
  .refine((patch) => Object.values(patch).some((value) => value !== undefined), {
    message: 'At least one field is required',
  })

export type CreateUserInput = z.input<typeof createUserInputSchema>
export type UpdateUserInput = z.input<typeof updateUserInputSchema>

export interface UsersRepo {
  list(): Promise<User[]>
  findById(id: string): Promise<User | null>
  findByEmail(email: string): Promise<User | null>
  create(input: CreateUserInput): Promise<User>
  update(id: string, input: UpdateUserInput): Promise<User>
}

export function createUsersRepo(options: { dataDir: string }): UsersRepo {
  const filePath = usersFilePath(options.dataDir)

  async function readUsers(): Promise<User[]> {
    const raw = await readJsonFile<unknown>(filePath)
    if (raw === null) return []

    const parsed = z.array(userSchema).safeParse(raw)
    if (!parsed.success) {
      throw new StorageError('CORRUPT', `Invalid users file: ${filePath}: ${z.prettifyError(parsed.error)}`)
    }
    return parsed.data
  }

  async function writeUsers(users: User[]): Promise<void> {
    await writeJsonAtomic(filePath, users)
  }

  return {
    list: readUsers,

    async findById(id) {
      const users = await readUsers()
      return users.find((user) => user.id === id) ?? null
    },

    async findByEmail(email) {
      const normalized = email.trim().toLowerCase()
      const users = await readUsers()
      return users.find((user) => user.email === normalized) ?? null
    },

    async create(rawInput) {
      const input = createUserInputSchema.parse(rawInput)
      const users = await readUsers()

      if (users.some((user) => user.email === input.email)) {
        throw new StorageError('CONFLICT', `User ${input.email} already exists`)
      }

      const user: User = {
        id: `usr_${randomBytes(6).toString('hex')}`,
        email: input.email,
        githubUsername: input.githubUsername,
        role: input.role,
        passwordHash: input.passwordHash,
        active: true,
        createdAt: new Date().toISOString(),
      }

      await writeUsers([...users, user])
      return user
    },

    async update(id, rawInput) {
      const input = updateUserInputSchema.parse(rawInput)
      const users = await readUsers()
      const index = users.findIndex((user) => user.id === id)

      if (index === -1) {
        throw new StorageError('NOT_FOUND', `User ${id} not found`)
      }

      const current = users[index] as User
      const updated: User = {
        ...current,
        ...(input.githubUsername !== undefined ? { githubUsername: input.githubUsername } : {}),
        ...(input.role !== undefined ? { role: input.role } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
        ...(input.passwordHash !== undefined ? { passwordHash: input.passwordHash } : {}),
      }

      const nextUsers = [...users]
      nextUsers[index] = updated
      await writeUsers(nextUsers)
      return updated
    },
  }
}
