import assert from 'node:assert/strict'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { test } from 'node:test'
import { StorageError } from '../src/storage/errors.js'
import {
  ensureDir,
  listDirectories,
  pathExists,
  readJsonFile,
  readTextFile,
  writeFileAtomic,
  writeJsonAtomic,
} from '../src/storage/fs-utils.js'
import { createTempDir } from './helpers.js'

test('writeFileAtomic creates parent directories and leaves no temp file behind', async (t) => {
  const dataDir = await createTempDir(t)
  const target = path.join(dataDir, 'nested', 'dir', 'content.md')

  await writeFileAtomic(target, '# Hello')

  assert.equal(await readFile(target, 'utf8'), '# Hello')
  const entries = await readdir(path.dirname(target))
  assert.deepEqual(entries, ['content.md'])
})

test('writeJsonAtomic and readJsonFile round-trip a value', async (t) => {
  const dataDir = await createTempDir(t)
  const target = path.join(dataDir, 'users.json')

  await writeJsonAtomic(target, [{ id: 'usr_01', active: true }])

  assert.deepEqual(await readJsonFile(target), [{ id: 'usr_01', active: true }])
  assert.equal(await readTextFile(target), '[\n  {\n    "id": "usr_01",\n    "active": true\n  }\n]\n')
})

test('readJsonFile returns null for a missing file and fails on corrupt JSON', async (t) => {
  const dataDir = await createTempDir(t)
  const missing = path.join(dataDir, 'missing.json')
  const corrupt = path.join(dataDir, 'corrupt.json')

  assert.equal(await readJsonFile(missing), null)
  await writeFile(corrupt, '{ not json')

  await assert.rejects(
    readJsonFile(corrupt),
    (error: unknown) => error instanceof StorageError && error.code === 'CORRUPT',
  )
})

test('pathExists distinguishes files, directories and missing paths', async (t) => {
  const dataDir = await createTempDir(t)
  const dir = path.join(dataDir, 'rules')
  const file = path.join(dataDir, 'file.txt')
  await ensureDir(dir)
  await writeFile(file, 'x')

  assert.equal(await pathExists(dir), true)
  assert.equal(await pathExists(file), true)
  assert.equal(await pathExists(path.join(dataDir, 'nope')), false)
})

test('listDirectories returns sorted directory names only', async (t) => {
  const dataDir = await createTempDir(t)
  await ensureDir(path.join(dataDir, 'SEC-002'))
  await ensureDir(path.join(dataDir, 'SEC-001'))
  await writeFile(path.join(dataDir, 'meta.json'), '{}')

  assert.deepEqual(await listDirectories(dataDir), ['SEC-001', 'SEC-002'])
  assert.deepEqual(await listDirectories(path.join(dataDir, 'missing')), [])
})
