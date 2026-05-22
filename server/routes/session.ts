/**
 * /api/session — live coaching conversation.
 * Loads profile, runs a Claude turn, applies profile patches, saves session record.
 */

import { Router, Request, Response } from 'express'
import { requireAuth } from '../auth.js'
import { readProfile, writeProfile, readSession, writeSession } from '../storage.js'
import { runTurn, CommitmentOutput } from '../claude.js'
import { registerUser } from '../scheduler.js'
import { v4 as uuidv4 } from 'uuid'
import { ChatMessage, SessionRecord, ActiveCommitment, DailyReminders } from '../types.js'

const router = Router()

// ── GET /api/session/active ───────────────────────────────────
// Returns the active session ID for the current user, or creates one.

router.get('/active', requireAuth, async (req: Request, res: Response) => {
  const { slug } = (req as any).user
  const profile = await readProfile(slug)
  if (!profile) {
    res.status(404).json({ error: 'Profile not found. Complete onboarding first.' })
    return
  }

  const session_id = uuidv4()
  const now = new Date().toISOString()

  const session: SessionRecord = {
    session_id,
    user_id: profile.user_id,
    user_slug: slug,
    session_number: profile.program.sessions_completed + 1,
    date: now.split('T')[0],
    started_at: now,
    ended_at: '',
    duration_minutes: 0,
    phase: profile.program.current_phase,
    re_interview_completed: false,
    profile_updated: false,
    safety_state: 'engaged',
    safety_notes: '',
    summary: '',
    key_insights: [],
    questions_that_landed: [],
    resistance_pattern_active: false,
    resistance_notes: '',
    goals_discussed: [],
    goal_changes: [],
    oblique_card_used: '',
    oblique_card_text: '',
    commitment_declared: false,
    commitment_id: '',
    commitment_text: '',
    commitment_due_date: '',
    commitment_ladder_rung: 0,
    notification_channels: [],
    prior_commitment_resolved: false,
    prior_commitment_id: '',
    prior_commitment_outcome: '',
    prior_commitment_notes: '',
    lens_dominant_this_session: '',
    lens_notes: '',
    next_session_open_with: '',
    phase_transition: false,
    new_phase: '',
    chat_log: []
  }

  await writeSession(session)
  res.json({ session_id, phase: profile.program.current_phase })
})

// ── POST /api/session/:session_id/message ─────────────────────
// Sends a user message, gets coach response, updates session + profile.

router.post('/:session_id/message', requireAuth, async (req: Request, res: Response) => {
  const { slug, user_id } = (req as any).user
  const { session_id } = req.params
  const { message } = req.body

  if (!message?.trim()) {
    res.status(400).json({ error: 'Message is required' })
    return
  }

  const [profile, session] = await Promise.all([
    readProfile(slug),
    readSession(slug, session_id)
  ])

  if (!session) {
    res.status(404).json({ error: 'Session not found' })
    return
  }

  // Run the Claude turn
  let result
  try {
    result = await runTurn(session.chat_log, message.trim(), profile)
  } catch (err: any) {
    console.error('[session] Claude turn failed:', err?.message || err)
    res.status(500).json({ error: 'Coach unavailable', detail: err?.message || 'Unknown error' })
    return
  }

  // Append to chat log
  session.chat_log.push({ role: 'user', content: message.trim() })
  session.chat_log.push({ role: 'assistant', content: result.message })

  // Update safety state
  session.safety_state = result.safety_state

  // Apply profile patches if any
  if (profile && result.profile_patches.length > 0) {
    for (const patch of result.profile_patches) {
      applyPatch(profile, patch.field_path, patch.value)
    }
    session.profile_updated = true
    await writeProfile(profile)
  }

  // Handle commitment output if declared
  if (profile && result.commitment_output) {
    const commitment = buildCommitment(result.commitment_output)
    profile.active_commitment = commitment
    session.commitment_declared = true
    session.commitment_id = commitment.commitment_id
    session.commitment_text = commitment.text
    session.commitment_due_date = commitment.due_date
    session.commitment_ladder_rung = commitment.ladder_rung
    session.notification_channels = profile.notifications.channels
    await writeProfile(profile)
    registerUser(slug)
  }

  // Save session
  await writeSession(session)

  res.json({
    message: result.message,
    safety_state: result.safety_state,
    commitment_output: result.commitment_output,
    profile_updated: session.profile_updated
  })
})

// ── POST /api/session/:session_id/end ────────────────────────

router.post('/:session_id/end', requireAuth, async (req: Request, res: Response) => {
  const { slug } = (req as any).user
  const { session_id } = req.params
  const { summary, key_insights } = req.body

  const session = await readSession(slug, session_id)
  if (!session) {
    res.status(404).json({ error: 'Session not found' })
    return
  }

  const now = new Date()
  const started = new Date(session.started_at)
  session.ended_at = now.toISOString()
  session.duration_minutes = Math.round((now.getTime() - started.getTime()) / 60000)
  if (summary) session.summary = summary
  if (key_insights) session.key_insights = key_insights

  await writeSession(session)

  // Update session count on profile
  const profile = await readProfile(slug)
  if (profile) {
    profile.program.sessions_completed += 1
    profile.program.last_session_date = now.toISOString()
    await writeProfile(profile)
  }

  res.json({ ok: true })
})

// ── GET /api/session/:session_id ─────────────────────────────
// Returns session data including chat log.

router.get('/:session_id', requireAuth, async (req: Request, res: Response) => {
  const { slug } = (req as any).user
  const { session_id } = req.params
  const session = await readSession(slug, session_id)
  if (!session) {
    res.status(404).json({ error: 'Session not found' })
    return
  }
  res.json(session)
})

// ── HELPERS ──────────────────────────────────────────────────

function applyPatch(obj: any, path: string, value: unknown): void {
  const keys = path.split('.')
  let current = obj
  for (let i = 0; i < keys.length - 1; i++) {
    if (current[keys[i]] === undefined) current[keys[i]] = {}
    current = current[keys[i]]
  }
  current[keys[keys.length - 1]] = value
}

function buildCommitment(output: CommitmentOutput): ActiveCommitment {
  const reminders: DailyReminders = {
    day_1: output.daily_reminders.day_1 || '',
    day_2: output.daily_reminders.day_2 || '',
    day_3: output.daily_reminders.day_3 || '',
    day_4: output.daily_reminders.day_4 || '',
    day_5: output.daily_reminders.day_5 || '',
    day_6: output.daily_reminders.day_6 || '',
    day_7: output.daily_reminders.day_7 || '',
    current_day: 1,
    started_at: new Date().toISOString()
  }

  return {
    commitment_id: uuidv4(),
    text: output.text,
    declared_at: new Date().toISOString(),
    due_date: output.due_date,
    status: 'active',
    ladder_rung: output.ladder_rung,
    public_platform: output.public_platform,
    share_post: output.share_post,
    print_card: output.print_card,
    daily_reminders: reminders
  }
}

export default router
