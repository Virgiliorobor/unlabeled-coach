---
# ============================================================
# UNLABELED — USER PROFILE
# Version: 1.0
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

# ── GOALS — THREE HORIZONS ───────────────────────────────────
# DB table: goals (one row per goal, linked by user_id)
goals:
  thirty_days:
    text: ""
    status: ""                      # active | completed | revised
    set_at: ""                      # ISO 8601
    last_referenced: ""             # ISO 8601 — updated each session it's discussed

  ninety_days:
    text: ""
    status: ""                      # active | completed | revised
    set_at: ""
    last_referenced: ""

  twelve_months:
    text: ""
    status: ""                      # active | completed | revised
    set_at: ""
    last_referenced: ""

# ── COACH CALIBRATION ────────────────────────────────────────
# DB table: profiles
calibration:
  dominant_lens: ""                 # artist | business | split
  resistance_pattern: ""            # perfectionist | imposter | validator_seeker | scope_expander | identity_anchor | visibility_avoider
  tone: ""                          # direct | structured | balanced
  oblique_subset: []                # array of card IDs from oblique-strategies.md (e.g. ["R1","R4","R7"])

# ── PROGRAM STATE ────────────────────────────────────────────
# DB table: profiles
program:
  current_phase: ""                 # interview | reflection | clarity | resistance | commitment | accountability
  phase_history: []                 # array: [{phase: "", entered_at: "", completed_at: ""}]
  sessions_completed: 0             # integer
  last_session_date: ""             # ISO 8601

# ── ACTIVE COMMITMENT ────────────────────────────────────────
# DB table: commitments (current row where status = active)
active_commitment:
  commitment_id: ""                 # DB: commitments.id (UUID)
  text: ""                          # exact declared text
  declared_at: ""                   # ISO 8601
  due_date: ""                      # ISO 8601
  status: ""                        # active | done | missed | partial
  ladder_rung: 0                    # integer 1–6 (from building-in-public.md)
  public_platform: ""               # linkedin | twitter | skool | email | other
  share_post: ""                    # generated post text
  print_card: ""                    # generated card text
  daily_reminders:                  # DB table: reminders (7 rows linked to commitment_id)
    day_1: ""
    day_2: ""
    day_3: ""
    day_4: ""
    day_5: ""
    day_6: ""
    day_7: ""
    current_day: 0                  # integer — which reminder fires next
    started_at: ""                  # ISO 8601

# ── COMMITMENT HISTORY ───────────────────────────────────────
# DB table: commitments (rows where status != active)
commitment_history: []
# Each entry:
# - commitment_id: ""
# - text: ""
# - declared_at: ""
# - due_date: ""
# - status: ""              # done | missed | partial
# - ladder_rung: 0
# - outcome_notes: ""       # what the builder said happened
# - logged_at: ""

# ── NOTIFICATION PREFERENCES ─────────────────────────────────
# DB table: notifications
notifications:
  email: ""                         # user's email address
  telegram_chat_id: ""              # null if not configured (obtained via Telegram bot /start)
  channels: []                      # ["email"] | ["telegram"] | ["email", "telegram"]
  daily_signal_time: "08:00"        # HH:MM local time
  timezone: ""                      # IANA timezone (e.g. "America/Mexico_City")
  re_interview_reminder: true       # boolean — send reminder when re_interview_due approaches

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
