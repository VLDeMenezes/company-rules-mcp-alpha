import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import { StorageError } from '../src/storage/errors.js'
import { createTokensRepo } from '../src/storage/tokens.repo.js'
import { createTempDir } from './helpers.js'

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

test('create stores a hashed token and findActiveByTokenHash resolves it', async (t) => {
  const dataDir = await createTempDir(t)
  const repo = createTokensRepo({ dataDir })

  const created = await repo.create({ name: 'project-payments-agent', tokenHash: sha256('plain-secret') })

  assert.match(created.id, /^tok_[0-9a-f]{12}$/)
  assert.equal(created.active, true)
  assert.equal(created.lastUsedAt, null)

  const found = await repo.findActiveByTokenHash(sha256('plain-secret').toUpperCase())
  assert.deepEqual(found, created)
  assert.equal(await repo.findActiveByTokenHash(sha256('other-secret')), null)
})

test('revoke deactivates a token and hides it from active lookups', async (t) => {
  const dataDir = await createTempDir(t)
  const repo = createTokensRepo({ dataDir })
  const created = await repo.create({ name: 'agent', tokenHash: sha256('secret') })

  const revoked = await repo.revoke(created.id)
  assert.equal(revoked.active, false)

  assert.equal(await repo.findActiveByTokenHash(sha256('secret')), null)
  assert.equal((await repo.list())[0]?.active, false)

  const revokedAgain = await repo.revoke(created.id)
  assert.equal(revokedAgain.active, false)
})

test('touchLastUsed records the current timestamp', async (t) => {
  const dataDir = await createTempDir(t)
  const repo = createTokensRepo({ dataDir })
  const created = await repo.create({ name: 'agent', tokenHash: sha256('secret') })

  const touched = await repo.touchLastUsed(created.id)

  assert.ok(touched.lastUsedAt)
  assert.ok(!Number.isNaN(Date.parse(touched.lastUsedAt)))
  assert.equal((await repo.findById(created.id))?.lastUsedAt, touched.lastUsedAt)
})

test('unknown ids fail with NOT_FOUND and invalid hashes are rejected', async (t) => {
  const dataDir = await createTempDir(t)
  const repo = createTokensRepo({ dataDir })

  await assert.rejects(
    repo.revoke('tok_missing'),
    (error: unknown) => error instanceof StorageError && error.code === 'NOT_FOUND',
  )
  await assert.rejects(repo.create({ name: 'agent', tokenHash: 'not-a-hash' }))
  await assert.rejects(repo.create({ name: '  ', tokenHash: sha256('secret') }))
})
