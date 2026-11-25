import assert from 'node:assert/strict'
import { test } from 'node:test'
import { hashPassword, verifyPassword } from '../src/auth/crypto.js'
import { StorageError } from '../src/storage/errors.js'
import { seedInitialAdmin } from '../src/storage/seed.js'
import { createUsersRepo, toPublicUser } from '../src/storage/users.repo.js'
import { createTempDir } from './helpers.js'

const passwordHash = hashPassword('initial-password')

test('create stores a normalized user and list/find return it', async (t) => {
  const dataDir = await createTempDir(t)
  const repo = createUsersRepo({ dataDir })

  const created = await repo.create({
    email: '  Editor@Company.com ',
    githubUsername: 'octocat',
    role: 'editor',
    passwordHash,
  })

  assert.match(created.id, /^usr_[0-9a-f]{12}$/)
  assert.equal(created.email, 'editor@company.com')
  assert.equal(created.active, true)

  assert.deepEqual(await repo.list(), [created])
  assert.deepEqual(await repo.findById(created.id), created)
  assert.deepEqual(await repo.findByEmail('EDITOR@company.com'), created)
})

test('toPublicUser strips the password hash', async (t) => {
  const dataDir = await createTempDir(t)
  const repo = createUsersRepo({ dataDir })
  const user = await repo.create({ email: 'admin@company.com', role: 'admin', passwordHash })

  const publicUser = toPublicUser(user)
  assert.equal('passwordHash' in publicUser, false)
  assert.equal(publicUser.email, 'admin@company.com')
})

test('create rejects duplicated emails case-insensitively', async (t) => {
  const dataDir = await createTempDir(t)
  const repo = createUsersRepo({ dataDir })
  await repo.create({ email: 'admin@company.com', role: 'admin', passwordHash })

  await assert.rejects(
    repo.create({ email: 'ADMIN@company.com', role: 'editor', passwordHash }),
    (error: unknown) => error instanceof StorageError && error.code === 'CONFLICT',
  )
})

test('update changes role, active and password; empty patches and missing ids fail', async (t) => {
  const dataDir = await createTempDir(t)
  const repo = createUsersRepo({ dataDir })
  const user = await repo.create({ email: 'admin@company.com', role: 'admin', passwordHash })

  const updated = await repo.update(user.id, { role: 'editor', active: false })
  assert.equal(updated.role, 'editor')
  assert.equal(updated.active, false)

  const newHash = hashPassword('new-password')
  const withPassword = await repo.update(user.id, { passwordHash: newHash })
  assert.equal(verifyPassword('new-password', withPassword.passwordHash), true)

  await assert.rejects(repo.update(user.id, {}))
  await assert.rejects(
    repo.update('usr_missing', { active: true }),
    (error: unknown) => error instanceof StorageError && error.code === 'NOT_FOUND',
  )
})

test('seedInitialAdmin creates one admin only when users.json is missing', async (t) => {
  const dataDir = await createTempDir(t)
  const repo = createUsersRepo({ dataDir })

  const admin = await seedInitialAdmin({
    dataDir,
    email: 'admin@company.com',
    password: 'initial-password',
    githubUsername: 'octocat',
  })

  assert.ok(admin)
  assert.equal(admin.role, 'admin')
  assert.equal(admin.githubUsername, 'octocat')
  assert.equal(verifyPassword('initial-password', admin.passwordHash), true)

  const secondRun = await seedInitialAdmin({
    dataDir,
    email: 'other-admin@company.com',
    password: 'another-password',
  })

  assert.equal(secondRun, null)
  const users = await repo.list()
  assert.equal(users.length, 1)
  assert.equal(users[0]?.email, 'admin@company.com')
})
