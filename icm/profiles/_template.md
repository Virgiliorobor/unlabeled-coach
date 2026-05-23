---
# ============================================================
# UNLABELED — USER PROFILE
# Version: 2.0 — Portfolio coaching model
# Stage 2 DB mapping: users + profiles + goals + commitments + notifications tables
# IMPORTANT: Do not rename YAML fields — they are database column contracts.
# ============================================================

user_id: ""                         # DB: users.id (UUID)
slug: ""                            # DB: users.slug (url-safe name, e.g. "jaime-m")
created_at: ""                      # DB: profiles.created_at (ISO 8601)
last_updated: ""                    # DB: profiles.last_updated (ISO 8601)
re_interview_due: ""                # DB: profiles.re_interview_due (ISO 8601, today + 7 days)

# ── BACKGROUND ───────────────────────────────────────────────
# DB table: profiles
background:
  domain: ""                        # law | finance | design | engineering | healthcare | trade | other
  domain_detail: ""                 # specific role (e.g. "corporate attorney", "UX lead at agency")
  years_experience: 0               # integer
  transition_type: ""               # left_field | parallel_build | discovered_ai | freelance_pivot

# ── CURRENT BUILD ────────────────────────────────────────────
# DB table: profiles
build:
  name: ""                          # what they call it
  description: ""                   # honest description — not pitch, not positioning
  state: ""                         # idea | early | in_progress | shipped
  shipped: []                       # array of strings — things that exist outside their head
  target_user: ""                   # one specific person, not a persona

# ── GOALS PORTFOLIO ──────────────────────────────────────────
# DB table: goals (one row per goal, linked by user_id)
# Goals are the primary unit of the coaching program.
# Each goal moves through its own phase loop independently.
# The person's resistance_pattern (calibration section) applies to all goals.
goals: []
# Each entry:
# - goal_id: ""              # UUID — assigned by server on creation
# - title: ""                # short label e.g. "Ship consulting landing page" (3-6 words)
# - description: ""          # what the goal actually is (1-2 sentences, honest not aspirational)
# - horizon: ""              # thirty_days | ninety_days | twelve_months | ongoing
# - phase: ""                # intake | reflection | clarity | resistance | commitment | accountability
# - phase_started_at: ""     # ISO 8601 — when current phase began (used for time-gating)
# - phase_history: []        # [{phase: "", entered_at: "", completed_at: ""}]
# - added_at: ""             # ISO 8601 — when this goal was created
# - last_touched: ""         # ISO 8601 — updated each session the goal is discussed
# - status: ""               # active | completed | paused
#
# - action_steps: []         # coach-prescribed exercises for THIS goal (private, not public)
#   Each action step:
#   - step_id: ""            # UUID
#   - goal_id: ""            # matches parent goal_id
#   - text: ""               # exact instruction — specific enough to do without clarification
#   - assigned_at: ""        # ISO 8601
#   - due_date: ""           # ISO 8601 (typically 24-48 hours from assigned)
#   - status: ""             # pending | done | skipped
#   - coach_reason: ""       # why assigned: links to resistance pattern or contradiction
#   - completion_note: ""    # what the builder reported when completed (or why skipped)
#   - phase_assigned: ""     # which phase it was assigned in
#   - exercise_level: 0      # 1-5 escalating exposure level (from resistance-patterns.md)
#
# - active_commitment: null  # current public commitment for this goal, or null
#   Active commitment fields:
#   - commitment_id: ""      # UUID
#   - text: ""               # exact declared text
#   - declared_at: ""        # ISO 8601
#   - due_date: ""           # ISO 8601
#   - status: ""             # active | done | missed | partial
#   - ladder_rung: 0         # integer 1-6 (from building-in-public.md)
#   - public_platform: ""    # linkedin | twitter | substack | community | email | other
#   - share_post: ""         # generated post text
#   - print_card: ""         # generated card text
#   - daily_reminders:       # 7-question sequence
#       day_1: ""
#       day_2: ""
#       day_3: ""
#       day_4: ""
#       day_5: ""
#       day_6: ""
#       day_7: ""
#       current_day: 0
#       started_at: ""
#
# - commitment_history: []   # resolved commitments for this goal
#   Each entry:
#   - commitment_id: ""
#   - text: ""
#   - declared_at: ""
#   - due_date: ""
#   - status: ""             # done | missed | partial
#   - ladder_rung: 0
#   - outcome_notes: ""      # what the builder said happened
#   - logged_at: ""

# ── COACH CALIBRATION ────────────────────────────────────────
# DB table: profiles
# Person-level calibration — constant across all goals.
# The resistance_pattern manifests differently per goal but the underlying pattern is the same.
calibration:
  dominant_lens: ""                 # artist | business | split
  resistance_pattern: ""            # perfectionist | imposter | validator_seeker | scope_expander | identity_anchor | visibility_avoider
  tone: ""                          # direct | structured | balanced
  oblique_subset: []                # array of card IDs from oblique-strategies.md (e.g. ["R1","R4","R7"])
  behavioral_signals:
    avoidance_language: []          # exact phrases they use when resisting
    engagement_triggers: []         # what made them visibly energized in session
    excuse_structure: ""            # needs_more_info | not_ready_yet | wrong_time | waiting_for_external | scope_first

# ── PROGRAM STATE ────────────────────────────────────────────
# DB table: profiles
# Phases are now goal-level. Program tracks person-level state only.
program:
  initial_interview_done: false     # boolean — true after person intake (Part 1) completes
  sessions_completed: 0             # integer
  last_session_date: ""             # ISO 8601

# ── PUBLISHING LOG ───────────────────────────────────────────
# DB table: publishing_log (one row per published item)
# Person-level evidence trail of what the builder has actually shipped publicly.
# Each entry references the goal it belongs to via goal_id.
publishing_log: []
# Each entry:
# - log_id: ""              # UUID
# - goal_id: ""             # which goal this publishing act was for
# - url: ""                 # link to published item (required)
# - platform: ""            # linkedin | twitter | substack | community | email | blog | other
# - published_at: ""        # ISO 8601
# - commitment_id: ""       # which commitment this fulfills (empty if spontaneous)
# - description: ""         # what was published — 1-2 sentences in the builder's words

# ── NOTIFICATION PREFERENCES ─────────────────────────────────
# DB table: notifications
notifications:
  email: ""                         # user's email address
  telegram_chat_id: ""              # null if not configured
  channels: []                      # ["email"] | ["telegram"] | ["email", "telegram"]
  daily_signal_time: "08:00"        # HH:MM local time
  timezone: ""                      # IANA timezone (e.g. "America/Mexico_City")
  re_interview_reminder: true       # boolean

# ── SAFETY STATE ─────────────────────────────────────────────
# DB table: profiles
safety:
  current_state: "engaged"          # engaged | watchful | redirected
  watchful_triggers: 0              # consecutive low-affect exchanges (resets to 0 on re-engagement)
  last_state_change: ""             # ISO 8601
  flagged_sessions: []              # array of session_ids where safety state was watchful or redirected

# ── COACH NOTES ──────────────────────────────────────────────
# DB table: profiles (text field, appended not replaced)
coach_notes: ""
# Running observations across sessions. Appended with date on each update.
# Format: "[DATE]: [observation]"
# Example: "2026-05-21: Builder mentioned previous career unprompted three times. Identity anchor pattern confirmed."
---

# Profile Notes
> Human-readable coach observations go below this line. Everything above is structured data.
> This section is for the coach's running narrative — not logged to Stage 2 DB, used only in Claude sessions.
