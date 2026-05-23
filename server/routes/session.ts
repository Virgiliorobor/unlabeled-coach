/**
 * /api/session — live coaching conversation.
 * Loads profile, runs a Claude turn, applies profile patches, saves session record.
 * Sessions are goal-scoped: action steps and commitments attach to specific goals.
 */

import { Router, Request, Response } from 'express'
import { requireAuth } from '../auth.js'
import { readProfile, writeProfile, readSession, writeSession } from '../storage.js'
import { runTurn, CommitmentOutput, ActionStepOutput, PublishingLogEntryOutput, GoalOutput, GoalPatch } from '../claude.js'
import { registerUser } from '../scheduler.js'
import { v4 as uuidv4 } from 'uuid'
import { ChatMessage, SessionRecord, ActiveCommitment, DailyReminders, ActionStep, PublishingLogEntry, Goal } from '../types.js'

const router = Router()

// Returns the primary active goal — most recently touched, or first active goal.
function getPrimaryGoal(profile: { goals: Goal[]; program: { initial_interview_done: boolean } }): Goal | null {
  const active = profile.goals.filter(g => g.status === 'active')
  if (active.length === 0) return null
  return active.sort((a, b) => new Date(b.last_touched).getTime() - new Date(a.last_touched).getTime())[0]
}

// Returns the primary phase for the session record (goal-level or fallback).
function getPrimaryPhase(profile: { goals: Goal[]; program: { initial_interview_done: boolean } }): string {
  if (!profile.program.initial_interview_done) return 'interview'
  const goal = getPrimaryGoal(profile)
  if (!goal) return 'intake'
  return goal.phase
}

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
  const primaryGoal = getPrimaryGoal(profile)
  const phase = getPrimaryPhase(profile)

  const session: SessionRecord = {
    session_id,
    user_id: profile.user_id,
    user_slug: slug,
    session_number: profile.program.sessions_completed + 1,
    date: now.split('T')[0],
    started_at: now,
    ended_at: '',
    duration_minutes: 0,
    active_goal_id: primaryGoal?.goal_id || '',
    phase,
    re_interview_completed: false,
    profile_updated: false,
    safety_state: 'engaged',
    safety_notes: '',
    summary: '',
    key_insights: [],
    questions_that_landed: [],
    resistance_pattern_active: false,
    resistance_notes: '',
    goals_discussed: primaryGoal ? [primaryGoal.goal_id] : [],
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

  // Generate opening message — coach speaks first
  let opening_message = ''
  try {
    const opening = await runTurn([], '[SESSION_START]', profile)
    opening_message = opening.message
    session.chat_log.push({ role: 'assistant', content: opening_message })
  } catch (err: any) {
    console.error('[session] Opening message failed:', err?.message || err)
  }

  await writeSession(session)
  res.json({ session_id, phase, opening_message })
})

// ── POST /api/session/:session_id/message ─────────────────────

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

  let result
  try {
    result = await runTurn(session.chat_log, message.trim(), profile)
  } catch (err: any) {
    console.error('[session] Claude turn failed:', err?.message || err)
    res.status(500).json({ error: 'Coach unavailable', detail: err?.message || 'Unknown error' })
    return
  }

  session.chat_log.push({ role: 'user', content: message.trim() })
  session.chat_log.push({ role: 'assistant', content: result.message })
  session.safety_state = result.safety_state

  // Apply person-level profile patches
  if (profile && result.profile_patches.length > 0) {
    for (const patch of result.profile_patches) {
      applyPatch(profile, patch.field_path, patch.value)
    }
    session.profile_updated = true
    await writeProfile(profile)
  }

  // Handle GOAL_OUTPUT — create a new goal
  let newGoalId: string | null = null
  if (profile && result.goal_output) {
    const newGoal = buildGoal(result.goal_output)
    newGoalId = newGoal.goal_id
    profile.goals.push(newGoal)
    session.profile_updated = true
    await writeProfile(profile)
  }

  // Handle GOAL_PATCHES — update fields on existing goals
  if (profile && result.goal_patches.length > 0) {
    for (const patch of result.goal_patches) {
      const targetId = patch.goal_id === '__new_goal__' ? newGoalId : patch.goal_id
      if (!targetId) continue
      const goal = profile.goals.find(g => g.goal_id === targetId)
      if (!goal) continue
      ;(goal as any)[patch.field] = patch.value
      // Track phase transitions in session record
      if (patch.field === 'phase') {
        session.phase_transition = true
        session.new_phase = patch.value as string
      }
    }
    session.profile_updated = true
    await writeProfile(profile)
  }

  // Handle COMMITMENT_OUTPUT — attach to the specified goal
  let newCommitment: ActiveCommitment | null = null
  if (profile && result.commitment_output) {
    newCommitment = buildCommitment(result.commitment_output)
    const targetId = result.commitment_output.goal_id === '__new_goal__' ? newGoalId : result.commitment_output.goal_id
    const goal = targetId ? profile.goals.find(g => g.goal_id === targetId) : getPrimaryGoal(profile)
    if (goal) {
      goal.active_commitment = newCommitment
      goal.last_touched = new Date().toISOString()
    }
    session.commitment_declared = true
    session.commitment_id = newCommitment.commitment_id
    session.commitment_text = newCommitment.text
    session.commitment_due_date = newCommitment.due_date
    session.commitment_ladder_rung = newCommitment.ladder_rung
    session.notification_channels = profile.notifications.channels
    await writeProfile(profile)
    registerUser(slug)
  }

  // Handle ACTION_STEP_OUTPUT — attach to the specified goal
  let newActionStep: ActionStep | null = null
  if (profile && result.action_step_output) {
    newActionStep = buildActionStep(result.action_step_output)
    const targetId = result.action_step_output.goal_id === '__new_goal__' ? newGoalId : result.action_step_output.goal_id
    const goal = targetId ? profile.goals.find(g => g.goal_id === targetId) : getPrimaryGoal(profile)
    if (goal) {
      if (!goal.action_steps) goal.action_steps = []
      goal.action_steps.push(newActionStep)
      goal.last_touched = new Date().toISOString()
    }
    session.profile_updated = true
    await writeProfile(profile)
  }

  // Handle PUBLISHING_LOG_ENTRY — stored at person level, with goal_id reference
  let newPublishingEntry: PublishingLogEntry | null = null
  if (profile && result.publishing_log_entry) {
    newPublishingEntry = buildPublishingLogEntry(result.publishing_log_entry)
    if (!profile.publishing_log) profile.publishing_log = []
    profile.publishing_log.push(newPublishingEntry)
    session.profile_updated = true
    await writeProfile(profile)
  }

  await writeSession(session)

  res.json({
    message: result.message,
    safety_state: result.safety_state,
    goal_created: newGoalId ? { goal_id: newGoalId } : null,
    commitment_output: result.commitment_output,
    action_step: newActionStep,
    publishing_log_entry: newPublishingEntry,
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

  const profile = await readProfile(slug)
  if (profile) {
    profile.program.sessions_completed += 1
    profile.program.last_session_date = now.toISOString()
    await writeProfile(profile)
  }

  res.json({ ok: true })
})

// ── GET /api/session/:session_id ─────────────────────────────

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

function buildGoal(output: GoalOutput): Goal {
  const now = new Date().toISOString()
  return {
    goal_id: uuidv4(),
    title: output.title || 'Untitled goal',
    description: output.description || '',
    horizon: output.horizon || 'ongoing',
    phase: (output.phase as Goal['phase']) || 'intake',
    phase_started_at: now,
    phase_history: [],
    added_at: now,
    last_touched: now,
    status: 'active',
    action_steps: [],
    active_commitment: null,
    commitment_history: []
  }
}

function buildActionStep(output: ActionStepOutput): ActionStep {
  return {
    step_id: uuidv4(),
    goal_id: output.goal_id || '',
    text: output.text,
    assigned_at: new Date().toISOString(),
    due_date: output.due_date,
    status: 'pending',
    coach_reason: output.coach_reason || '',
    completion_note: '',
    phase_assigned: output.phase_assigned || '',
    exercise_level: output.exercise_level || 1
  }
}

function buildPublishingLogEntry(output: PublishingLogEntryOutput): PublishingLogEntry {
  return {
    log_id: uuidv4(),
    goal_id: output.goal_id || '',
    url: output.url || '',
    platform: output.platform || '',
    published_at: new Date().toISOString(),
    commitment_id: output.commitment_id || '',
    description: output.description || ''
  }
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
