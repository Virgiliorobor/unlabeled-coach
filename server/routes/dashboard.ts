/**
 * /api/dashboard — user profile, goals, commitments, session history.
 * Also handles onboarding (profile creation) and auth (login/logout).
 */

import crypto from 'crypto'
import { Router, Request, Response } from 'express'
import { requireAuth, issueSession, clearSession } from '../auth.js'
import { readProfile, writeProfile, fileExists, readFile, writeFile, findProfileByEmail } from '../storage.js'
import { sendEmail } from '../notifications.js'
import { registerUser } from '../scheduler.js'
import { v4 as uuidv4 } from 'uuid'
import { UserProfile, Portfolio, FirstMove } from '../types.js'

const router = Router()

// ── POST /api/auth/register ───────────────────────────────────
// Creates a new user profile. Called after Phase 0 interview is complete.

router.post('/auth/register', async (req: Request, res: Response) => {
  const { email, slug, display_name } = req.body

  if (!email || !slug) {
    res.status(400).json({ error: 'email and slug are required' })
    return
  }

  // Sanitize slug
  const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 40)
  const profilePath = `_database/users/${cleanSlug}.json`

  if (await fileExists(profilePath)) {
    res.status(409).json({ error: 'Slug already taken' })
    return
  }

  const now = new Date()
  // 7-day clock starts only after the interview completes (phase advances past 'interview').
  // Set far future on registration so the re-interview banner doesn't fire prematurely.
  const reInterviewDue = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)

  const profile: UserProfile = {
    user_id: uuidv4(),
    slug: cleanSlug,
    created_at: now.toISOString(),
    last_updated: now.toISOString(),
    re_interview_due: reInterviewDue.toISOString(),

    background: {
      domain: '',
      domain_detail: '',
      years_experience: 0,
      transition_type: ''
    },

    build: {
      name: '',
      description: '',
      state: 'idea',
      shipped: [],
      target_user: ''
    },

    goals: {
      thirty_days: { text: '', status: 'active', set_at: now.toISOString(), last_referenced: now.toISOString() },
      ninety_days: { text: '', status: 'active', set_at: now.toISOString(), last_referenced: now.toISOString() },
      twelve_months: { text: '', status: 'active', set_at: now.toISOString(), last_referenced: now.toISOString() }
    },

    calibration: {
      dominant_lens: 'split',
      resistance_pattern: '',
      tone: 'balanced',
      oblique_subset: []
    },

    program: {
      current_phase: 'interview',
      phase_history: [],
      sessions_completed: 0,
      last_session_date: ''
    },

    active_commitment: null,
    commitment_history: [],

    portfolio: {
      url: '',
      platform: '',
      status: 'none',
      entries_count: 0,
      last_updated: ''
    },
    first_move: null,
    today_prompt: '',

    notifications: {
      email,
      telegram_chat_id: null,
      channels: ['email'],
      daily_signal_time: '08:00',
      timezone: 'America/New_York',
      re_interview_reminder: true
    },

    safety: {
      current_state: 'engaged',
      watchful_triggers: 0,
      last_state_change: now.toISOString(),
      flagged_sessions: []
    },

    coach_notes: ''
  }

  await writeProfile(profile)
  registerUser(cleanSlug)
  issueSession(res, profile.user_id, cleanSlug)

  res.json({ ok: true, slug: cleanSlug, user_id: profile.user_id })
})

// ── POST /api/auth/login ──────────────────────────────────────
// Sends a magic link to the provided email address.

router.post('/auth/login', async (req: Request, res: Response) => {
  const { email } = req.body
  if (!email) {
    res.status(400).json({ error: 'email is required' })
    return
  }

  const profile = await findProfileByEmail(email)

  if (profile) {
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes

    await writeFile(
      `_database/auth/${token}.json`,
      JSON.stringify({ slug: profile.slug, expires_at: expiresAt.toISOString(), used: false }),
      `auth token for ${profile.slug}`
    )

    const appUrl = process.env.CLIENT_URL || 'http://localhost:3001'
    const loginUrl = `${appUrl}/api/auth/verify?token=${token}`

    const sent = await sendEmail({
      to: email,
      subject: 'Your Unlabeled sign-in link',
      html: `
        <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; padding: 40px 24px; color: #111;">
          <p style="font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: #888; margin-bottom: 32px;">
            Unlabeled
          </p>
          <p style="font-size: 20px; line-height: 1.6; margin-bottom: 32px;">
            Here's your sign-in link. It expires in 15 minutes.
          </p>
          <p style="margin-bottom: 32px;">
            <a href="${loginUrl}" style="background: #111; color: #F4F4F0; padding: 12px 24px; text-decoration: none; font-family: 'Courier New', monospace; font-size: 0.85rem; letter-spacing: 0.05em;">
              SIGN IN →
            </a>
          </p>
          <p style="font-size: 13px; color: #666; border-top: 1px solid #eee; padding-top: 20px;">
            If you didn't request this, ignore this email.
          </p>
        </div>
      `,
      text: `Sign in to Unlabeled: ${loginUrl}\n\nThis link expires in 15 minutes. If you didn't request this, ignore this email.`
    })

    if (!sent) {
      console.warn(`[auth] Magic link generated for ${profile.slug} but email delivery failed (RESEND_API_KEY configured?)`)
    }
  }

  // Always return 200 — don't reveal whether the email is registered
  res.json({ ok: true, message: "If an account exists for that email, a sign-in link is on its way." })
})

// ── GET /api/auth/verify ──────────────────────────────────────
// Validates a magic link token and issues a session cookie.

router.get('/auth/verify', async (req: Request, res: Response) => {
  const { token } = req.query
  if (!token || typeof token !== 'string') {
    res.status(400).send('Invalid or missing token.')
    return
  }

  const raw = await readFile(`_database/auth/${token}.json`)
  if (!raw) {
    res.status(401).send('Sign-in link not found or already used.')
    return
  }

  const { slug, expires_at, used } = JSON.parse(raw)

  if (used) {
    res.status(401).send('This sign-in link has already been used.')
    return
  }

  if (new Date() > new Date(expires_at)) {
    res.status(401).send('This sign-in link has expired. Request a new one.')
    return
  }

  // Invalidate the token (single-use)
  await writeFile(
    `_database/auth/${token}.json`,
    JSON.stringify({ slug, expires_at, used: true, used_at: new Date().toISOString() }),
    `auth token used: ${slug}`
  )

  const profile = await readProfile(slug)
  if (!profile) {
    res.status(404).send('Account not found.')
    return
  }

  issueSession(res, profile.user_id, slug)

  const frontendUrl = process.env.NODE_ENV === 'production'
    ? (process.env.CLIENT_URL || '/')
    : 'http://localhost:5173'
  res.redirect(frontendUrl)
})

// ── POST /api/auth/dev-login ──────────────────────────────────
// Development only — login by slug directly.

router.post('/auth/dev-login', async (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    res.status(403).json({ error: 'Not available in production' })
    return
  }
  const { slug } = req.body
  const profile = await readProfile(slug)
  if (!profile) {
    res.status(404).json({ error: 'Profile not found' })
    return
  }
  issueSession(res, profile.user_id, slug)
  res.json({ ok: true, slug })
})

// ── POST /api/auth/logout ─────────────────────────────────────

router.post('/auth/logout', (req: Request, res: Response) => {
  clearSession(res)
  res.json({ ok: true })
})

// ── GET /api/dashboard ────────────────────────────────────────
// Returns everything the dashboard needs in one call.

router.get('/dashboard', requireAuth, async (req: Request, res: Response) => {
  const { slug } = (req as any).user
  const profile = await readProfile(slug)
  if (!profile) {
    res.status(404).json({ error: 'Profile not found' })
    return
  }

  const now = new Date()
  const reInterviewDue = new Date(profile.re_interview_due)
  const reInterviewOverdue = now >= reInterviewDue

  const emptyPortfolio: Portfolio = { url: '', platform: '', status: 'none', entries_count: 0, last_updated: '' }

  res.json({
    profile: {
      slug: profile.slug,
      build_name: profile.build.name,
      build_state: profile.build.state,
      current_phase: profile.program.current_phase,
      sessions_completed: profile.program.sessions_completed,
      last_session_date: profile.program.last_session_date,
      re_interview_due: profile.re_interview_due,
      re_interview_overdue: reInterviewOverdue,
      dominant_lens: profile.calibration.dominant_lens,
      resistance_pattern: profile.calibration.resistance_pattern
    },
    portfolio: profile.portfolio || emptyPortfolio,
    first_move: profile.first_move || null,
    today_prompt: profile.today_prompt || '',
    goals: profile.goals,
    active_commitment: profile.active_commitment,
    commitment_history: profile.commitment_history.slice(-10),
    notifications: {
      channels: profile.notifications.channels,
      daily_signal_time: profile.notifications.daily_signal_time,
      timezone: profile.notifications.timezone
    }
  })
})

// ── PATCH /api/dashboard/profile ─────────────────────────────
// Update profile fields (goals, notifications, build info).

router.patch('/dashboard/profile', requireAuth, async (req: Request, res: Response) => {
  const { slug } = (req as any).user
  const profile = await readProfile(slug)
  if (!profile) {
    res.status(404).json({ error: 'Profile not found' })
    return
  }

  const allowed = ['goals', 'notifications', 'build', 'background', 'portfolio', 'first_move']
  for (const key of allowed) {
    if (req.body[key]) {
      (profile as any)[key] = { ...(profile as any)[key], ...req.body[key] }
    }
  }

  await writeProfile(profile)
  res.json({ ok: true })
})

// ── POST /api/dashboard/commitment/:id/resolve ───────────────
// Mark the active commitment as done, missed, or partial.

router.post('/dashboard/commitment/:id/resolve', requireAuth, async (req: Request, res: Response) => {
  const { slug } = (req as any).user
  const { id } = req.params
  const { status, outcome_notes } = req.body

  if (!['done', 'missed', 'partial'].includes(status)) {
    res.status(400).json({ error: 'status must be done | missed | partial' })
    return
  }

  const profile = await readProfile(slug)
  if (!profile) {
    res.status(404).json({ error: 'Profile not found' })
    return
  }

  if (!profile.active_commitment || profile.active_commitment.commitment_id !== id) {
    res.status(404).json({ error: 'Active commitment not found' })
    return
  }

  const resolved = {
    commitment_id: profile.active_commitment.commitment_id,
    text: profile.active_commitment.text,
    declared_at: profile.active_commitment.declared_at,
    due_date: profile.active_commitment.due_date,
    status: status as 'done' | 'missed' | 'partial',
    ladder_rung: profile.active_commitment.ladder_rung,
    outcome_notes: outcome_notes || '',
    logged_at: new Date().toISOString()
  }

  profile.commitment_history.push(resolved)
  profile.active_commitment = null
  await writeProfile(profile)

  res.json({ ok: true, resolved })
})

// ── POST /api/dashboard/first-move/resolve ────────────────────
// Mark the first move (portfolio) as done or missed.

router.post('/dashboard/first-move/resolve', requireAuth, async (req: Request, res: Response) => {
  const { slug } = (req as any).user
  const { status, url } = req.body

  if (!['done', 'missed'].includes(status)) {
    res.status(400).json({ error: 'status must be done | missed' })
    return
  }

  const profile = await readProfile(slug)
  if (!profile || !profile.first_move) {
    res.status(404).json({ error: 'First move not found' })
    return
  }

  profile.first_move.status = status as 'done' | 'missed'

  if (status === 'done') {
    profile.portfolio = {
      ...profile.portfolio,
      url: url || profile.portfolio?.url || '',
      status: 'active',
      last_updated: new Date().toISOString()
    }
  }

  await writeProfile(profile)
  res.json({ ok: true })
})

export default router
