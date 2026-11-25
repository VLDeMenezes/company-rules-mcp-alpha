import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { createTestApp } from './helpers.js'

const PUBLIC_DIR = new URL('../public/', import.meta.url)

async function readPublicFile(name: string): Promise<string> {
  return readFile(new URL(name, PUBLIC_DIR), 'utf8')
}

function contentType(headers: Record<string, string | string[] | number | undefined>): string {
  return String(headers['content-type'] ?? '')
}

interface ErrorBody {
  error: { code: string; message: string }
}

test('GET / serves the Spanish UI shell with its local assets', async (t) => {
  const { app } = await createTestApp(t)

  const response = await app.inject({ method: 'GET', url: '/' })

  assert.equal(response.statusCode, 200)
  assert.match(contentType(response.headers), /text\/html/i)

  const html = response.body
  assert.match(html, /<html[^>]*\blang="es"/i)
  assert.match(html, /Reglas de la empresa/)
  assert.match(html, /href="\/styles\.css"/)
  assert.match(html, /src="\/app\.js"/)
})

test('static assets are served with the right content types', async (t) => {
  const { app } = await createTestApp(t)

  const script = await app.inject({ method: 'GET', url: '/app.js' })
  assert.equal(script.statusCode, 200)
  assert.match(contentType(script.headers), /javascript/i)

  const styles = await app.inject({ method: 'GET', url: '/styles.css' })
  assert.equal(styles.statusCode, 200)
  assert.match(contentType(styles.headers), /text\/css/i)
})

test('unknown static paths return 404', async (t) => {
  const { app } = await createTestApp(t)

  const response = await app.inject({ method: 'GET', url: '/does-not-exist.txt' })

  assert.equal(response.statusCode, 404)
})

test('the static handler does not shadow the API', async (t) => {
  const { app } = await createTestApp(t)

  const response = await app.inject({ method: 'GET', url: '/api/rules' })

  assert.equal(response.statusCode, 401)
  assert.match(contentType(response.headers), /application\/json/i)

  const body = response.json() as ErrorBody
  assert.equal(body.error.code, 'UNAUTHORIZED')
})

test('index.html contains the core accessibility scaffolding', async (t) => {
  const { app } = await createTestApp(t)
  const response = await app.inject({ method: 'GET', url: '/' })
  const html = response.body

  assert.match(html, /<meta[^>]+name="viewport"/i)
  assert.match(html, /class="skip-link"[^>]*href="#contenido-principal"/i)
  assert.match(html, /<main[^>]+id="contenido-principal"/i)
  assert.match(html, /<label[^>]+for="login-email"/i)
  assert.match(html, /<label[^>]+for="login-password"/i)
  assert.match(html, /id="login-email"[^>]*required/i)
  assert.match(html, /id="login-password"[^>]*required/i)
  assert.match(html, /role="tablist"/i)
  assert.match(html, /role="tab"/i)
  assert.match(html, /role="tabpanel"/i)
})

test('static files do not reference external CDNs or assets', async () => {
  const files = await Promise.all(
    ['index.html', 'styles.css', 'app.js'].map((name) => readPublicFile(name)),
  )

  for (const content of files) {
    assert.doesNotMatch(content, /(?:src|href)\s*=\s*["']https?:\/\//i)
    assert.doesNotMatch(content, /@import\s+(?:url\()?\s*["']?https?:\/\//i)
    assert.doesNotMatch(content, /url\(\s*["']?https?:\/\//i)
  }
})
