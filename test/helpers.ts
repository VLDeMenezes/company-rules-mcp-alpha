import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { TestContext } from 'node:test'

/** Creates a unique temp directory and removes it when the test finishes. */
export async function createTempDir(t: TestContext): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'company-rules-'))
  t.after(async () => {
    await rm(dir, { recursive: true, force: true })
  })
  return dir
}
