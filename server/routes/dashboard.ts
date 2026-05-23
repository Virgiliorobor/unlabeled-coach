/**
 * /api/dashboard — user profile, goals, commitments, session history.
 * Also handles onboarding (profile creation) and auth (login/logout).
 */

import { Router, Request, Response } from 'express'
import { requireAuth, issueSession, clearSession } from '../auth.js'
import { readProfile, writeProfile, fileExists, findProfileByEmail } from '../storage.js'
import { registerUser } from '../scheduler.js'
import { v4 as uuidv4 } from 'uuid'
import { UserProfile, PublishingLogEntry } from '../types.js'

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
  const reInterviewDue = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

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
      oblique_subset: [],
      behavioral_signals: {
        avoidance_language: [],
        engagement_triggers: [],
        excuse_structure: ''
      }
    },

    program: {
      current_phase: 'interview',
      phase_started_at: now.toISOString(),
      phase_history: [],
      sessions_completed: 0,
      last_session_date: ''
    },

    active_commitment: null,
    commitment_history: [],
    action_steps: [],
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
// Email-based login — finds profile by email and issues session.

router.post('/auth/login', async (req: Request, res: Response) => {
  const { email } = req.body
  if (!email) {
    res.status(400).json({ error: 'email is required' })
    return
  }

  const profile = await findProfileByEmail(email.trim().toLowerCase())
  if (!profile) {
    // Deliberately vague — don't reveal whether the email exists
    res.status(200).json({ ok: true, message: 'If that email is registered, you are now logged in.' })
    return
  }

  issueSession(res, profile.user_id, profile.slug)
  res.json({ ok: true, slug: profile.slug })
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

  // Phase progress — days elapsed and minimum requirements per phase
  const PHASE_MINIMUM_DAYS: Record<string, number> = {
    interview: 0, reflection: 3, clarity: 3, resistance: 3, commitment: 0, accountability: 0
  }
  const phaseStarted = profile.program.phase_started_at
    ? new Date(profile.program.phase_started_at)
    : new Date(profile.created_at)
  const daysElapsed = Math.floor((now.getTime() - phaseStarted.getTime()) / (1000 * 60 * 60 * 24))
  const minimumDays = PHASE_MINIMUM_DAYS[profile.program.current_phase] ?? 0
  const completedSteps = (profile.action_steps || []).filter(s => s.status === 'done').length

  // Action steps — all pending + last 5 completed, most recent first
  const allSteps = profile.action_steps || []
  const pendingSteps = allSteps.filter(s => s.status === 'pending')
  const recentDoneSteps = allSteps
    .filter(s => s.status === 'done')
    .sort((a, b) => new Date(b.assigned_at).getTime() - new Date(a.assigned_at).getTime())
    .slice(0, 5)

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
      current_phase: profile.program.current_phase,
      sessions_completed: profile.program.sessions_completed,
      last_session_date: profile.program.last_session_date,
      re_interview_due: profile.re_interview_due,
      re_interview_overdue: reInterviewOverdue,
      dominant_lens: profile.calibration.dominant_lens,
      resistance_pattern: profile.calibration.resistance_pattern
    },
    phase_progress: {
      current_phase: profile.program.current_phase,
      phase_started_at: profile.program.phase_started_at || profile.created_at,
      days_elapsed: daysElapsed,
      minimum_days: minimumDays,
      time_gate_clear: daysElapsed >= minimumDays,
      completed_action_steps: completedSteps
    },
    goals: profile.goals,
    active_commitment: profile.active_commitment,
    commitment_history: profile.commitment_history.slice(-10),
    action_steps: { pending: pendingSteps, recent_done: recentDoneSteps },
    publishing_log: publishingLog,
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

  const allowed = ['goals', 'notifications', 'build', 'background']
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

// ── POST /api/dashboard/action-step/:id/complete ─────────────
// Mark an action step as done with an optional completion note.

router.post('/action-step/:id/complete', requireAuth, async (req: Request, res: Response) => {
  const { slug } = (req as any).user
  const { id } = req.params
  const { completion_note } = req.body

  const profile = await readProfile(slug)
  if (!profile) { res.status(404).json({ error: 'Profile not found' }); return }

  const step = (profile.action_steps || []).find(s => s.step_id === id)
  if (!step) { res.status(404).json({ error: 'Action step not found' }); return }

  step.status = 'done'
  step.completion_note = completion_note || ''
  await writeProfile(profile)
  res.json({ ok: true, step })
})

// ── POST /api/dashboard/action-step/:id/skip ─────────────────
// Mark an action step as skipped with a required reason.

router.post('/action-step/:id/skip', requireAuth, async (req: Request, res: Response) => {
  const { slug } = (req as any).user
  const { id } = req.params
  const { reason } = req.body

  const profile = await readProfile(slug)
  if (!profile) { res.status(404).json({ error: 'Profile not found' }); return }

  const step = (profile.action_steps || []).find(s => s.step_id === id)
  if (!step) { res.status(404).json({ error: 'Action step not found' }); return }

  step.status = 'skipped'
  step.completion_note = reason || ''
  await writeProfile(profile)
  res.json({ ok: true, step })
})

// ── POST /api/dashboard/publishing-log ───────────────────────
// Manually add a publishing log entry (proof of a public act outside a session).

router.post('/publishing-log', requireAuth, async (req: Request, res: Response) => {
  const { slug } = (req as any).user
  const { url, platform, description, commitment_id } = req.body

  if (!url || !description) {
    res.status(400).json({ error: 'url and description are required' })
    return
  }

  const profile = await readProfile(slug)
  if (!profile) { res.status(404).json({ error: 'Profile not found' }); return }

  const entry: PublishingLogEntry = {
    log_id: uuidv4(),
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
