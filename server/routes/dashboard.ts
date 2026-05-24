/**
 * /api/dashboard — user profile, goals portfolio, publishing log.
 * Also handles onboarding (profile creation) and auth (login/logout).
 * Portfolio model: goals[] is the primary data structure. Phases, action steps,
 * and commitments live inside each goal.
 */

import crypto from 'crypto'
import { Router, Request, Response } from 'express'
import { requireAuth, issueSession, clearSession } from '../auth.js'
import { readProfile, writeProfile, fileExists, readFile, writeFile, findProfileByEmail } from '../storage.js'
import { sendEmail } from '../notifications.js'
import { registerUser } from '../scheduler.js'
import { v4 as uuidv4 } from 'uuid'
import { UserProfile, PublishingLogEntry, Portfolio, FirstMove } from '../types.js'

const router = Router()

// ── POST /api/auth/register ───────────────────────────────────

router.post('/auth/register', async (req: Request, res: Response) => {
  const { email, slug, display_name } = req.body

  if (!email || !slug) {
    res.status(400).json({ error: 'email and slug are required' })
    return
  }

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

    goals: [],

    calibration: {
      dominant_lens: 'split',
      resistance_pattern: '',
      tone: 'balanced',
      oblique_subset: [],
      behavioral_signals: {
        avoidance_language: [],
        engagement_triggers: [],
        excuse_structure: ''
      }
    },

    program: {
      initial_interview_done: false,
      sessions_completed: 0,
      last_session_date: ''
    },

    publishing_log: [],

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

// ── GET /api/auth/demo ────────────────────────────────────────
// Auto-logs in as the Bruce demo profile. Works in production.
// Intended for sharing a populated demo with potential users.

router.get('/auth/demo', async (req: Request, res: Response) => {
  const DEMO_SLUG = process.env.DEMO_SLUG || 'bruce'
  const profile = await readProfile(DEMO_SLUG)
  if (!profile) {
    res.status(404).json({ error: 'Demo profile not found' })
    return
  }
  issueSession(res, profile.user_id, profile.slug)
  res.json({ ok: true, slug: profile.slug, user_id: profile.user_id })
})

// ── POST /api/auth/logout ─────────────────────────────────────

router.post('/auth/logout', (req: Request, res: Response) => {
  clearSession(res)
  res.json({ ok: true })
})

// ── GET /api/dashboard ────────────────────────────────────────
// Returns everything the dashboard needs — portfolio model.

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

  const PHASE_MINIMUM_DAYS: Record<string, number> = {
    intake: 0, reflection: 3, clarity: 3, resistance: 3, commitment: 0, accountability: 0
  }

  // Build enriched goal objects with phase progress
  const goals = (profile.goals || []).map(goal => {
    const phaseStarted = goal.phase_started_at ? new Date(goal.phase_started_at) : now
    const daysElapsed = Math.floor((now.getTime() - phaseStarted.getTime()) / (1000 * 60 * 60 * 24))
    const minimumDays = PHASE_MINIMUM_DAYS[goal.phase] ?? 0
    const completedSteps = (goal.action_steps || []).filter(s => s.status === 'done').length

    const allSteps = goal.action_steps || []
    const pendingSteps = allSteps.filter(s => s.status === 'pending')
    const recentDoneSteps = allSteps
      .filter(s => s.status === 'done')
      .sort((a, b) => new Date(b.assigned_at).getTime() - new Date(a.assigned_at).getTime())
      .slice(0, 3)

    return {
      goal_id: goal.goal_id,
      title: goal.title,
      description: goal.description,
      horizon: goal.horizon,
      phase: goal.phase,
      phase_started_at: goal.phase_started_at,
      added_at: goal.added_at,
      last_touched: goal.last_touched,
      status: goal.status,
      phase_progress: {
        days_elapsed: daysElapsed,
        minimum_days: minimumDays,
        time_gate_clear: daysElapsed >= minimumDays,
        completed_action_steps: completedSteps
      },
      action_steps: {
        pending: pendingSteps,
        recent_done: recentDoneSteps
      },
      active_commitment: goal.active_commitment,
      commitment_history: (goal.commitment_history || []).slice(-5)
    }
  })

  // Publishing log — most recent first
  const publishingLog = (profile.publishing_log || [])
    .slice()
    .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())

  res.json({
    profile: {
      slug: profile.slug,
      build_name: profile.build.name,
      build_description: profile.build.description,
      build_state: profile.build.state,
      initial_interview_done: profile.program.initial_interview_done,
      sessions_completed: profile.program.sessions_completed,
      last_session_date: profile.program.last_session_date,
      re_interview_due: profile.re_interview_due,
      re_interview_overdue: reInterviewOverdue,
      dominant_lens: profile.calibration.dominant_lens,
      resistance_pattern: profile.calibration.resistance_pattern
    },
    goals,
    publishing_log: publishingLog,
    portfolio: profile.portfolio || { url: '', platform: '', status: 'none', entries_count: 0, last_updated: '' } as Portfolio,
    first_move: profile.first_move || null,
    today_prompt: profile.today_prompt || '',
    notifications: {
      channels: profile.notifications.channels,
      daily_signal_time: profile.notifications.daily_signal_time,
      timezone: profile.notifications.timezone
    }
  })
})

// ── PATCH /api/dashboard/profile ─────────────────────────────
// Update person-level fields (notifications, build info, background).

router.patch('/dashboard/profile', requireAuth, async (req: Request, res: Response) => {
  const { slug } = (req as any).user
  const profile = await readProfile(slug)
  if (!profile) {
    res.status(404).json({ error: 'Profile not found' })
    return
  }

  const allowed = ['notifications', 'build', 'background', 'portfolio', 'first_move']
  for (const key of allowed) {
    if (req.body[key]) {
      (profile as any)[key] = { ...(profile as any)[key], ...req.body[key] }
    }
  }

  await writeProfile(profile)
  res.json({ ok: true })
})

// ── POST /api/dashboard/goals ─────────────────────────────────
// Create a new goal directly (without a coaching session).

router.post('/dashboard/goals', requireAuth, async (req: Request, res: Response) => {
  const { slug } = (req as any).user
  const { title, description, horizon } = req.body

  if (!title || !horizon) {
    res.status(400).json({ error: 'title and horizon are required' })
    return
  }

  const profile = await readProfile(slug)
  if (!profile) {
    res.status(404).json({ error: 'Profile not found' })
    return
  }

  const now = new Date().toISOString()
  const goal = {
    goal_id: uuidv4(),
    title,
    description: description || '',
    horizon,
    phase: 'intake' as const,
    phase_started_at: now,
    phase_history: [],
    added_at: now,
    last_touched: now,
    status: 'active' as const,
    action_steps: [],
    active_commitment: null,
    commitment_history: []
  }

  profile.goals.push(goal)
  await writeProfile(profile)
  res.json({ ok: true, goal })
})

// ── PATCH /api/dashboard/goals/:id ───────────────────────────
// Update a goal's metadata (title, description, status, horizon).

router.patch('/dashboard/goals/:id', requireAuth, async (req: Request, res: Response) => {
  const { slug } = (req as any).user
  const { id } = req.params

  const profile = await readProfile(slug)
  if (!profile) {
    res.status(404).json({ error: 'Profile not found' })
    return
  }

  const goal = (profile.goals || []).find(g => g.goal_id === id)
  if (!goal) {
    res.status(404).json({ error: 'Goal not found' })
    return
  }

  const allowed = ['title', 'description', 'status', 'horizon']
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      (goal as any)[key] = req.body[key]
    }
  }
  goal.last_touched = new Date().toISOString()

  await writeProfile(profile)
  res.json({ ok: true, goal })
})

// ── POST /api/dashboard/commitment/:id/resolve ───────────────
// Mark the active commitment in any goal as done, missed, or partial.

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

  const goal = (profile.goals || []).find(g => g.active_commitment?.commitment_id === id)
  if (!goal || !goal.active_commitment) {
    res.status(404).json({ error: 'Active commitment not found' })
    return
  }

  const resolved = {
    commitment_id: goal.active_commitment.commitment_id,
    text: goal.active_commitment.text,
    declared_at: goal.active_commitment.declared_at,
    due_date: goal.active_commitment.due_date,
    status: status as 'done' | 'missed' | 'partial',
    ladder_rung: goal.active_commitment.ladder_rung,
    outcome_notes: outcome_notes || '',
    logged_at: new Date().toISOString()
  }

  if (!goal.commitment_history) goal.commitment_history = []
  goal.commitment_history.push(resolved)
  goal.active_commitment = null
  goal.last_touched = new Date().toISOString()

  await writeProfile(profile)
  res.json({ ok: true, resolved })
})

// ── POST /api/dashboard/action-step/:id/complete ─────────────
// Mark an action step as done (searches across all goals).

router.post('/action-step/:id/complete', requireAuth, async (req: Request, res: Response) => {
  const { slug } = (req as any).user
  const { id } = req.params
  const { completion_note } = req.body

  const profile = await readProfile(slug)
  if (!profile) { res.status(404).json({ error: 'Profile not found' }); return }

  let foundStep = null
  for (const goal of profile.goals || []) {
    const step = (goal.action_steps || []).find(s => s.step_id === id)
    if (step) {
      step.status = 'done'
      step.completion_note = completion_note || ''
      goal.last_touched = new Date().toISOString()
      foundStep = step
      break
    }
  }

  if (!foundStep) { res.status(404).json({ error: 'Action step not found' }); return }

  await writeProfile(profile)
  res.json({ ok: true, step: foundStep })
})

// ── POST /api/dashboard/action-step/:id/skip ─────────────────
// Mark an action step as skipped (searches across all goals).

router.post('/action-step/:id/skip', requireAuth, async (req: Request, res: Response) => {
  const { slug } = (req as any).user
  const { id } = req.params
  const { reason } = req.body

  const profile = await readProfile(slug)
  if (!profile) { res.status(404).json({ error: 'Profile not found' }); return }

  let foundStep = null
  for (const goal of profile.goals || []) {
    const step = (goal.action_steps || []).find(s => s.step_id === id)
    if (step) {
      step.status = 'skipped'
      step.completion_note = reason || ''
      goal.last_touched = new Date().toISOString()
      foundStep = step
      break
    }
  }

  if (!foundStep) { res.status(404).json({ error: 'Action step not found' }); return }

  await writeProfile(profile)
  res.json({ ok: true, step: foundStep })
})

// ── POST /api/dashboard/publishing-log ───────────────────────
// Manually add a publishing log entry.

router.post('/publishing-log', requireAuth, async (req: Request, res: Response) => {
  const { slug } = (req as any).user
  const { url, platform, description, commitment_id, goal_id } = req.body

  if (!url || !description) {
    res.status(400).json({ error: 'url and description are required' })
    return
  }

  const profile = await readProfile(slug)
  if (!profile) { res.status(404).json({ error: 'Profile not found' }); return }

  const entry: PublishingLogEntry = {
    log_id: uuidv4(),
    goal_id: goal_id || '',
    url,
    platform: platform || 'other',
    published_at: new Date().toISOString(),
    commitment_id: commitment_id || '',
    description
  }

  if (!profile.publishing_log) profile.publishing_log = []
  profile.publishing_log.push(entry)
  await writeProfile(profile)
  res.json({ ok: true, entry })
})

export default router
