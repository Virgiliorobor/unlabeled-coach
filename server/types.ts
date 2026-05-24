// ── CORE USER TYPES ──────────────────────────────────────────
// These mirror the YAML profile template exactly.
// Field names are DB column contracts — do not rename.

export interface GoalMilestone {
  week: number
  text: string
  status: 'pending' | 'done' | 'missed'
}

export interface UserGoal {
  text: string
  status: 'active' | 'completed' | 'revised'
  set_at: string
  last_referenced: string
  milestones?: GoalMilestone[]
}

export interface Portfolio {
  url: string
  platform: string
  status: 'none' | 'in_progress' | 'active'
  entries_count: number
  last_updated: string
}

export interface FirstMove {
  text: string
  due_date: string
  platform: string
  pattern_note: string
  status: 'pending' | 'done' | 'missed'
  created_at: string
}

export interface ActionStep {
  step_id: string
  text: string
  assigned_at: string
  due_date: string
  status: 'pending' | 'done' | 'skipped'
  coach_reason: string
  completion_note: string
  phase_assigned: string
  exercise_level: number
  goal_id: string
}

export interface PublishingLogEntry {
  log_id: string
  url: string
  platform: string
  published_at: string
  commitment_id: string
  goal_id: string
  description: string
}

export interface BehavioralSignals {
  avoidance_language: string[]
  engagement_triggers: string[]
  excuse_structure: string
}

export interface DailyReminders {
  day_1: string
  day_2: string
  day_3: string
  day_4: string
  day_5: string
  day_6: string
  day_7: string
  current_day: number
  started_at: string
}

export interface ActiveCommitment {
  commitment_id: string
  text: string
  declared_at: string
  due_date: string
  status: 'active' | 'done' | 'missed' | 'partial'
  ladder_rung: number
  public_platform: string
  share_post: string
  print_card: string
  daily_reminders: DailyReminders
}

export interface CommitmentHistory {
  commitment_id: string
  text: string
  declared_at: string
  due_date: string
  status: 'done' | 'missed' | 'partial'
  ladder_rung: number
  outcome_notes: string
  logged_at: string
}

export interface PhaseHistoryEntry {
  phase: string
  entered_at: string
  completed_at: string | null
}

export interface Goal {
  goal_id: string
  title: string
  description: string
  horizon: 'thirty_days' | 'ninety_days' | 'twelve_months' | 'ongoing'
  phase: 'intake' | 'reflection' | 'clarity' | 'resistance' | 'commitment' | 'accountability'
  phase_started_at: string
  phase_history: PhaseHistoryEntry[]
  added_at: string
  last_touched: string
  status: 'active' | 'completed' | 'paused'
  action_steps: ActionStep[]
  active_commitment: ActiveCommitment | null
  commitment_history: CommitmentHistory[]
}

export interface UserProfile {
  // identity
  user_id: string
  slug: string
  created_at: string
  last_updated: string
  re_interview_due: string

  // background
  background: {
    domain: string
    domain_detail: string
    years_experience: number
    transition_type: string
  }

  // build
  build: {
    name: string
    description: string
    state: 'idea' | 'early' | 'in_progress' | 'shipped'
    shipped: string[]
    target_user: string
  }

  // goals portfolio — each goal moves through its own phase loop
  goals: Goal[]

  // calibration — person-level, constant across goals
  calibration: {
    dominant_lens: 'artist' | 'business' | 'split'
    resistance_pattern: string
    tone: 'direct' | 'structured' | 'balanced'
    oblique_subset: string[]
    behavioral_signals: BehavioralSignals
  }

  // program
  program: {
    initial_interview_done: boolean
    sessions_completed: number
    last_session_date: string
  }

  // global publishing evidence trail (person-level, with goal_id reference)
  publishing_log: PublishingLogEntry[]

  // notifications
  notifications: {
    email: string
    telegram_chat_id: string | null
    channels: Array<'email' | 'telegram'>
    daily_signal_time: string
    timezone: string
    re_interview_reminder: boolean
  }

  // safety
  safety: {
    current_state: 'engaged' | 'watchful' | 'redirected'
    watchful_triggers: number
    last_state_change: string
    flagged_sessions: string[]
  }

  // portfolio + first move
  portfolio: Portfolio
  first_move: FirstMove | null
  today_prompt: string

  // notes
  coach_notes: string
}

// ── SESSION TYPES ────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface SessionRecord {
  session_id: string
  user_id: string
  user_slug: string
  session_number: number
  date: string
  started_at: string
  ended_at: string
  duration_minutes: number
  active_goal_id: string
  phase: string
  re_interview_completed: boolean
  profile_updated: boolean
  safety_state: 'engaged' | 'watchful' | 'redirected'
  safety_notes: string
  summary: string
  key_insights: string[]
  questions_that_landed: string[]
  resistance_pattern_active: boolean
  resistance_notes: string
  goals_discussed: string[]
  goal_changes: string[]
  oblique_card_used: string
  oblique_card_text: string
  commitment_declared: boolean
  commitment_id: string
  commitment_text: string
  commitment_due_date: string
  commitment_ladder_rung: number
  notification_channels: string[]
  prior_commitment_resolved: boolean
  prior_commitment_id: string
  prior_commitment_outcome: string
  prior_commitment_notes: string
  lens_dominant_this_session: string
  lens_notes: string
  next_session_open_with: string
  phase_transition: boolean
  new_phase: string
  chat_log: ChatMessage[]
}

// ── COMMUNITY TYPES ──────────────────────────────────────────

export interface QuakerResponse {
  response_id: string
  author_type: 'ai' | 'human'
  archetype?: string
  user_id?: string
  text: string
  submitted_at: string
}

export interface QuakerPost {
  post_id: string
  prompt: string
  created_by: string
  created_at: string
  closes_at: string
  status: 'open' | 'closed' | 'synthesized'
  responses: QuakerResponse[]
  synthesis: string
}

// ── REQUEST TYPES ────────────────────────────────────────────

export interface AuthenticatedRequest extends Express.Request {
  user?: { user_id: string; slug: string }
}

// ── NOTIFICATION TYPES ───────────────────────────────────────

export interface DailySignalPayload {
  user_id: string
  slug: string
  day_number: number
  question: string
  commitment_text: string
  channels: Array<'email' | 'telegram'>
  email?: string
  telegram_chat_id?: string | null
  timezone: string
}
