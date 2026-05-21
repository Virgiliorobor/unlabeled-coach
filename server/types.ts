// ── CORE USER TYPES ──────────────────────────────────────────
// These mirror the YAML profile template exactly.
// Field names are DB column contracts — do not rename.

export interface UserGoal {
  text: string
  status: 'active' | 'completed' | 'revised'
  set_at: string
  last_referenced: string
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

  // goals
  goals: {
    thirty_days: UserGoal
    ninety_days: UserGoal
    twelve_months: UserGoal
  }

  // calibration
  calibration: {
    dominant_lens: 'artist' | 'business' | 'split'
    resistance_pattern: string
    tone: 'direct' | 'structured' | 'balanced'
    oblique_subset: string[]
  }

  // program
  program: {
    current_phase: 'interview' | 'reflection' | 'clarity' | 'resistance' | 'commitment' | 'accountability'
    phase_history: PhaseHistoryEntry[]
    sessions_completed: number
    last_session_date: string
  }

  // commitment
  active_commitment: ActiveCommitment | null
  commitment_history: CommitmentHistory[]

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
  archetype?: string       // if ai: the background archetype
  user_id?: string         // if human: anonymized
  text: string
  submitted_at: string
}

export interface QuakerPost {
  post_id: string
  prompt: string
  created_by: string       // user_id of the builder who submitted
  created_at: string
  closes_at: string        // 48 hours after created_at
  status: 'open' | 'closed' | 'synthesized'
  responses: QuakerResponse[]
  synthesis: string        // coach-generated pattern summary (after close)
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
