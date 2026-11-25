import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { test } from 'node:test'
import { StorageError } from '../src/storage/errors.js'
import { pathExists } from '../src/storage/fs-utils.js'
import { createRulesRepo, type CreateRuleInput } from '../src/storage/rules.repo.js'
import { createTempDir } from './helpers.js'

function ruleInput(overrides: Partial<CreateRuleInput> = {}): CreateRuleInput {
  return {
    id: 'SEC-001',
    title: 'Input validation and sanitization',
    category: 'security',
    tags: ['api', 'validation'],
    severity: 'mandatory',
    content: '# Rule\n\nValidate every input.',
    updatedBy: 'admin@company.com',
    ...overrides,
  }
}

test('create stores meta.json plus content.md and get returns both', async (t) => {
  const dataDir = await createTempDir(t)
  const repo = createRulesRepo({ dataDir })

  const meta = await repo.create(ruleInput())

  assert.equal(meta.version, 1)
  assert.equal(meta.active, true)
  assert.equal(meta.severity, 'mandatory')

  const rule = await repo.get('SEC-001')
  assert.ok(rule)
  assert.deepEqual(rule.meta, meta)
  assert.equal(rule.content, '# Rule\n\nValidate every input.')

  assert.equal(await pathExists(path.join(dataDir, 'rules', 'SEC-001', 'meta.json')), true)
  assert.equal(await pathExists(path.join(dataDir, 'rules', 'SEC-001', 'content.md')), true)
})

test('create applies defaults for tags and severity', async (t) => {
  const dataDir = await createTempDir(t)
  const repo = createRulesRepo({ dataDir })

  const meta = await repo.create({ id: 'ARCH-001', title: 'Layers', category: 'architecture', content: '', updatedBy: 'admin@company.com' })

  assert.deepEqual(meta.tags, [])
  assert.equal(meta.severity, 'mandatory')
})

test('create rejects a duplicated id with CONFLICT', async (t) => {
  const dataDir = await createTempDir(t)
  const repo = createRulesRepo({ dataDir })
  await repo.create(ruleInput())

  await assert.rejects(
    repo.create(ruleInput({ title: 'Another title' })),
    (error: unknown) => error instanceof StorageError && error.code === 'CONFLICT',
  )
})

test('create rejects unsafe ids and unknown rules return null', async (t) => {
  const dataDir = await createTempDir(t)
  const repo = createRulesRepo({ dataDir })

  await assert.rejects(repo.create(ruleInput({ id: '../escape' })))
  assert.equal(await repo.get('../../etc/passwd'), null)
  assert.equal(await repo.get('SEC-404'), null)
})

test('list filters by category, tag and active state', async (t) => {
  const dataDir = await createTempDir(t)
  const repo = createRulesRepo({ dataDir })

  await repo.create(ruleInput())
  await repo.create(ruleInput({ id: 'SEC-002', title: 'Secrets', tags: ['secrets'] }))
  await repo.create(ruleInput({ id: 'ARCH-001', title: 'Layers', category: 'architecture', tags: ['design'] }))
  await repo.update('SEC-002', { active: false, updatedBy: 'admin@company.com' })

  assert.deepEqual(
    (await repo.list()).map((meta) => meta.id),
    ['ARCH-001', 'SEC-001', 'SEC-002'],
  )
  assert.deepEqual(
    (await repo.list({ category: 'security' })).map((meta) => meta.id),
    ['SEC-001', 'SEC-002'],
  )
  assert.deepEqual(
    (await repo.list({ tag: 'design' })).map((meta) => meta.id),
    ['ARCH-001'],
  )
  assert.deepEqual(
    (await repo.list({ active: true })).map((meta) => meta.id),
    ['ARCH-001', 'SEC-001'],
  )
})

test('update increments version, changes content and records the editor', async (t) => {
  const dataDir = await createTempDir(t)
  const repo = createRulesRepo({ dataDir })
  const created = await repo.create(ruleInput())

  const updated = await repo.update('SEC-001', {
    title: 'Input validation',
    content: '# Updated',
    updatedBy: 'editor@company.com',
  })

  assert.equal(updated.version, 2)
  assert.equal(updated.title, 'Input validation')
  assert.equal(updated.updatedBy, 'editor@company.com')
  assert.equal(updated.createdAt, created.createdAt)

  const rule = await repo.get('SEC-001')
  assert.equal(rule?.content, '# Updated')
})

test('update of a missing rule fails with NOT_FOUND', async (t) => {
  const dataDir = await createTempDir(t)
  const repo = createRulesRepo({ dataDir })

  await assert.rejects(
    repo.update('SEC-404', { title: 'Nope', updatedBy: 'admin@company.com' }),
    (error: unknown) => error instanceof StorageError && error.code === 'NOT_FOUND',
  )
})

test('remove deactivates logically and can hard delete', async (t) => {
  const dataDir = await createTempDir(t)
  const repo = createRulesRepo({ dataDir })
  await repo.create(ruleInput())

  await repo.remove('SEC-001', { updatedBy: 'admin@company.com' })
  const softDeleted = await repo.get('SEC-001')
  assert.equal(softDeleted?.meta.active, false)
  assert.equal(softDeleted?.meta.version, 2)
  assert.deepEqual(await repo.list({ active: true }), [])

  await repo.remove('SEC-001', { hard: true, updatedBy: 'admin@company.com' })
  assert.equal(await repo.get('SEC-001'), null)
  assert.equal(await pathExists(path.join(dataDir, 'rules', 'SEC-001')), false)
})

test('list fails loudly when an on-disk rule is corrupt', async (t) => {
  const dataDir = await createTempDir(t)
  const repo = createRulesRepo({ dataDir })
  const brokenDir = path.join(dataDir, 'rules', 'BROKEN-001')
  await mkdir(brokenDir, { recursive: true })
  await writeFile(path.join(brokenDir, 'meta.json'), '{ "id": "BROKEN-001" }')

  await assert.rejects(
    repo.list(),
    (error: unknown) => error instanceof StorageError && error.code === 'CORRUPT',
  )
})

test('a meta.json id that does not match its directory is reported as corrupt', async (t) => {
  const dataDir = await createTempDir(t)
  const repo = createRulesRepo({ dataDir })
  await repo.create(ruleInput())

  const mismatchedDir = path.join(dataDir, 'rules', 'SEC-999')
  await mkdir(mismatchedDir, { recursive: true })
  await writeFile(
    path.join(mismatchedDir, 'meta.json'),
    JSON.stringify((await repo.getMeta('SEC-001'))),
  )

  await assert.rejects(
    repo.get('SEC-999'),
    (error: unknown) => error instanceof StorageError && error.code === 'CORRUPT',
  )
})
