export class ApiError extends Error {
  constructor(message, { status = 0, code = 'HTTP_ERROR', silent = false } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.silent = silent
  }
}

let sessionExpiredHandler = () => {}

/** Registers the callback invoked when an authenticated request gets a 401. */
export function setSessionExpiredHandler(handler) {
  sessionExpiredHandler = handler
}

async function api(path, { method = 'GET', body, ignore401 = false } = {}) {
  let response

  try {
    response = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers:
        body === undefined
          ? { Accept: 'application/json' }
          : { Accept: 'application/json', 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
  } catch {
    throw new ApiError('No se pudo conectar con el servidor. Revisa tu conexión.', {
      code: 'NETWORK',
    })
  }

  if (response.status === 401 && path !== '/api/auth/login') {
    if (ignore401) {
      throw new ApiError('Sesión no iniciada.', {
        status: 401,
        code: 'UNAUTHORIZED',
        silent: true,
      })
    }
    sessionExpiredHandler()
    throw new ApiError('Tu sesión ha expirado.', {
      status: 401,
      code: 'UNAUTHORIZED',
      silent: true,
    })
  }

  if (response.status === 204) return null

  const contentType = response.headers.get('content-type') || ''
  let payload = null
  if (contentType.includes('application/json')) {
    payload = await response.json().catch(() => null)
  }

  if (!response.ok) {
    const code = payload?.error?.code || 'HTTP_ERROR'
    const serverMessage = payload?.error?.message || ''
    let message = serverMessage || `Error ${response.status}`

    if (response.status === 400) {
      message = serverMessage
        ? `Revisa los datos ingresados: ${serverMessage}`
        : 'Revisa los datos ingresados.'
    } else if (response.status === 401) {
      message = 'Credenciales incorrectas.'
    } else if (response.status === 403) {
      message = 'No tienes permisos para realizar esta acción (403).'
    } else if (response.status === 404) {
      message = 'No se encontró el recurso solicitado.'
    } else if (response.status === 409) {
      message = 'Ya existe un registro con ese identificador.'
    }

    throw new ApiError(message, { status: response.status, code })
  }

  return payload
}

export { api }
