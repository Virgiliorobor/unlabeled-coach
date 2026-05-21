import { Request, Response, NextFunction } from 'express'
import crypto from 'crypto'

const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-in-production'
const COOKIE_NAME = 'unlabeled_session'
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000 // 30 days

// ── SESSION PAYLOAD ──────────────────────────────────────────

interface SessionPayload {
  user_id: string
  slug: string
  issued_at: number
}

// ── SIGN / VERIFY ────────────────────────────────────────────

function sign(payload: SessionPayload): string {
  const data = JSON.stringify(payload)
  const encoded = Buffer.from(data).toString('base64url')
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url')
  return `${encoded}.${sig}`
}

function verify(token: string): SessionPayload | null {
  try {
    const [encoded, sig] = token.split('.')
    const expected = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url')
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
    return JSON.parse(Buffer.from(encoded, 'base64url').toString())
  } catch {
    return null
  }
}

// ── ISSUE SESSION ────────────────────────────────────────────

export function issueSession(res: Response, user_id: string, slug: string): void {
  const payload: SessionPayload = { user_id, slug, issued_at: Date.now() }
  const token = sign(payload)
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE
  })
}

// ── CLEAR SESSION ────────────────────────────────────────────

export function clearSession(res: Response): void {
  res.clearCookie(COOKIE_NAME)
}

// ── AUTH MIDDLEWARE ──────────────────────────────────────────

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.[COOKIE_NAME]
  if (!token) {
    res.status(401).json({ error: 'Not authenticated' })
    return
  }
  const payload = verify(token)
  if (!payload) {
    res.status(401).json({ error: 'Invalid session' })
    return
  }
  // Attach user to request
  ;(req as any).user = { user_id: payload.user_id, slug: payload.slug }
  next()
}

// ── OPTIONAL AUTH (for public + private routes) ──────────────

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = req.cookies?.[COOKIE_NAME]
  if (token) {
    const payload = verify(token)
    if (payload) {
      ;(req as any).user = { user_id: payload.user_id, slug: payload.slug }
    }
  }
  next()
}
