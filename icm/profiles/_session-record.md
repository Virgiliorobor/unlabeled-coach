---
# ============================================================
# UNLABELED — SESSION RECORD
# Version: 1.0
# Stage 2 DB mapping: sessions table
# File naming convention: sessions/[user_slug]_[YYYY-MM-DD]_[session_number].md
# IMPORTANT: Do not rename YAML fields — they are database column contracts.
# ============================================================

session_id: ""                      # DB: sessions.id (UUID)
user_id: ""                         # DB: sessions.user_id (FK to users.id)
user_slug: ""                       # for file naming and human reference
session_number: 0                   # integer — sequential per user

# ── SESSION METADATA ─────────────────────────────────────────
date: ""                            # ISO 8601 date
started_at: ""                      # ISO 8601 datetime
ended_at: ""                        # ISO 8601 datetime
duration_minutes: 0                 # integer

# ── PROGRAM STATE AT SESSION ─────────────────────────────────
phase: ""                           # interview | reflection | clarity | resistance | commitment | accountability
re_interview_completed: false       # boolean — was this a re-interview session?
profile_updated: false              # boolean — were any profile fields changed?

# ── SAFETY ───────────────────────────────────────────────────
safety_state: "engaged"             # engaged | watchful | redirected
safety_notes: ""                    # what was observed if state != engaged

# ── SESSION CONTENT ──────────────────────────────────────────
summary: ""                         # 2–4 sentence summary of what happened
key_insights: []                    # array of strings — what surfaced in this session
questions_that_landed: []           # array of strings — questions that produced real movement
resistance_pattern_active: false    # boolean — did the pattern surface in this session?
resistance_notes: ""                # if true, what specifically happened

# ── GOALS REFERENCED ─────────────────────────────────────────
goals_discussed: []                 # array: ["thirty_days", "ninety_days", "twelve_months"]
goal_changes: []                    # array of strings — any goals revised in this session

# ── OBLIQUE CARD ─────────────────────────────────────────────
oblique_card_used: ""               # card ID (e.g. "R9") or "" if none deployed
oblique_card_text: ""               # the card text as delivered

# ── COMMITMENT ───────────────────────────────────────────────
commitment_declared: false          # boolean
commitment_id: ""                   # UUID if declared, "" if not
commitment_text: ""                 # exact text if declared
commitment_due_date: ""             # ISO 8601 if declared
commitment_ladder_rung: 0           # integer 1–6 if declared
notification_channels: []           # ["email"] | ["telegram"] | ["email","telegram"]

# Prior commitment update (if this was a Phase 5 session)
prior_commitment_resolved: false    # boolean
prior_commitment_id: ""             # UUID of the commitment being evaluated
prior_commitment_outcome: ""        # done | missed | partial
prior_commitment_notes: ""          # what the builder said happened

# ── LENS BALANCE ─────────────────────────────────────────────
lens_dominant_this_session: ""      # artist | business | balanced
lens_notes: ""                      # brief observation about how the lens played out

# ── NEXT SESSION PREP ────────────────────────────────────────
next_session_open_with: ""          # what to ask or address at the start of next session
phase_transition: false             # boolean — did phase change this session?
new_phase: ""                       # if true, which phase is next
---

# Session Notes
> Narrative coach observations go below this line. Not logged to Stage 2 DB.
> Use this section for things that don't fit the structured fields — texture, tone, observations that matter but don't categorize cleanly.
