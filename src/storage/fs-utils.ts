import { randomBytes } from 'node:crypto'
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { StorageError } from './errors.js'

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error
}

function isMissingFileError(error: unknown): boolean {
  return isErrnoException(error) && error.code === 'ENOENT'
}

/** Creates `dirPath` (and parents) if it does not exist yet. Idempotent. */
export async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true })
}

/** Returns true when the path exists. Missing paths return false; other errors propagate. */
export async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await stat(targetPath)
    return true
  } catch (error) {
    if (isMissingFileError(error)) return false
    throw error
  }
}

/**
 * Writes a file atomically: the content goes to a sibling `.tmp` file first and
 * is then moved into place with `rename()`. The temporary file is removed on failure.
 */
export async function writeFileAtomic(filePath: string, data: string | Uint8Array): Promise<void> {
  await ensureDir(path.dirname(filePath))

  const tmpPath = `${filePath}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`
  try {
    await writeFile(tmpPath, data)
    await rename(tmpPath, filePath)
  } catch (error) {
    await rm(tmpPath, { force: true })
    throw error
  }
}

/** Serializes `value` as pretty-printed JSON and writes it atomically. */
export async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  await writeFileAtomic(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

/** Reads and parses a JSON file. Returns null when the file does not exist. */
export async function readJsonFile<T>(filePath: string): Promise<T | null> {
  let raw: string
  try {
    raw = await readFile(filePath, 'utf8')
  } catch (error) {
    if (isMissingFileError(error)) return null
    throw error
  }

  try {
    return JSON.parse(raw) as T
  } catch (error) {
    throw new StorageError('CORRUPT', `Invalid JSON file: ${filePath}`, { cause: error })
  }
}

/** Reads a UTF-8 text file. Returns null when the file does not exist. */
export async function readTextFile(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, 'utf8')
  } catch (error) {
    if (isMissingFileError(error)) return null
    throw error
  }
}

/** Lists directory names directly under `dirPath`, sorted alphabetically. Missing dirs yield []. */
export async function listDirectories(dirPath: string): Promise<string[]> {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true })
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
  } catch (error) {
    if (isMissingFileError(error)) return []
    throw error
  }
}

/** Removes a directory recursively. Missing directories are ignored. */
export async function removeDir(dirPath: string): Promise<void> {
  await rm(dirPath, { recursive: true, force: true })
}
