import type { FastifyReply, FastifyRequest, preHandlerAsyncHookHandler } from 'fastify'
import { toPublicUser, type PublicUser, type UserRole, type UsersRepo } from '../storage/users.repo.js'

export const SESSION_COOKIE_NAME = 'session'
export const SESSION_TTL_SECONDS = 8 * 60 * 60

declare module 'fastify' {
  interface FastifyRequest {
    currentUser: PublicUser | null
  }
}

/** Shape returned to clients for the authenticated human session. */
export type SessionUser = Pick<PublicUser, 'id' | 'email' | 'githubUsername' | 'role'>

export interface SessionGuardsOptions {
  usersRepo: UsersRepo
  /** Adds the `Secure` attribute to session cookies (production / HTTPS only). */
  secureCookies: boolean
}

export interface SessionGuards {
  /** Rejects requests without a valid, unexpired session for an active user. */
  requireSession: preHandlerAsyncHookHandler
  /** Rejects requests whose authenticated user lacks one of the given roles. */
  requireRole: (...roles: UserRole[]) => preHandlerAsyncHookHandler
  setSessionCookie: (reply: FastifyReply, userId: string) => void
  clearSessionCookie: (reply: FastifyReply) => void
}

interface SessionPayload {
  userId: string
  expiresAt: number
}

function parseSessionPayload(value: string): SessionPayload | null {
  const separator = value.lastIndexOf('.')
  if (separator <= 0) return null

  const userId = value.slice(0, separator)
  const expiresAt = Number(value.slice(separator + 1))

  if (userId.length === 0 || !Number.isInteger(expiresAt)) return null
  return { userId, expiresAt }
}

/** Trims a stored user down to the fields exposed by the session endpoints. */
export function toSessionUser(user: PublicUser): SessionUser {
  return {
    id: user.id,
    email: user.email,
    githubUsername: user.githubUsername,
    role: user.role,
  }
}

/**
 * Reads the user attached by `requireSession`. Throws when the guard did not run
 * (or did not authenticate the request), which would be a wiring bug.
 */
export function getSessionUser(request: FastifyRequest): PublicUser {
  if (!request.currentUser) {
    throw new Error('No session user on request: requireSession must run before this handler')
  }
  return request.currentUser
}

export function createSessionGuards(options: SessionGuardsOptions): SessionGuards {
  const { usersRepo, secureCookies } = options

  async function rejectUnauthorized(reply: FastifyReply): Promise<void> {
    await reply.code(401).send({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
    })
  }

  const requireSession: preHandlerAsyncHookHandler = async (request, reply) => {
    const cookieValue = request.cookies[SESSION_COOKIE_NAME]
    if (!cookieValue) return rejectUnauthorized(reply)

    const unsigned = request.unsignCookie(cookieValue)
    if (!unsigned.valid) return rejectUnauthorized(reply)

    const payload = parseSessionPayload(unsigned.value)
    if (!payload) return rejectUnauthorized(reply)

    if (payload.expiresAt <= Math.floor(Date.now() / 1000)) {
      return rejectUnauthorized(reply)
    }

    const user = await usersRepo.findById(payload.userId)
    if (!user || !user.active) return rejectUnauthorized(reply)

    request.currentUser = toPublicUser(user)
  }

  const requireRole =
    (...roles: UserRole[]): preHandlerAsyncHookHandler =>
    async (request, reply) => {
      const user = request.currentUser
      if (!user) return rejectUnauthorized(reply)

      if (!roles.includes(user.role)) {
        await reply.code(403).send({
          error: { code: 'FORBIDDEN', message: 'Insufficient permissions' },
        })
      }
    }

  function setSessionCookie(reply: FastifyReply, userId: string): void {
    const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
    reply.setCookie(SESSION_COOKIE_NAME, `${userId}.${expiresAt}`, {
      signed: true,
      path: '/',
      httpOnly: true,
      sameSite: 'strict',
      secure: secureCookies,
      maxAge: SESSION_TTL_SECONDS,
    })
  }

  function clearSessionCookie(reply: FastifyReply): void {
    reply.clearCookie(SESSION_COOKIE_NAME, {
      path: '/',
      httpOnly: true,
      sameSite: 'strict',
      secure: secureCookies,
    })
  }

  return { requireSession, requireRole, setSessionCookie, clearSessionCookie }
}
