# ICM — Individual Coaching Model

The `icm/` folder is the coaching engine. It defines who the coach is, how sessions run, what the coach tracks, and how it updates the user's profile. This document explains how the system works so any developer or AI agent can understand and extend it.

---

## What the ICM Is

The ICM is a structured self-reflection program for solo builders in identity transition — people leaving law, finance, design, or engineering to build AI-powered tools. It runs as a Claude-powered coaching session delivered through the web app.

It is not a chatbot. It is not a productivity tool. It is a structured 6-phase coaching program where:
- The coach has a defined persona, voice, and set of non-negotiables
- Each session follows a specific sequence
- The user's profile is updated incrementally via structured output blocks
- Every session ends with one assigned action step

---

## The Portfolio Model

**The ICM coaches goals, not people.**

A person is profiled once — their background, resistance pattern, and behavioral signals are established at intake and do not change unless updated via the weekly re-interview. After that, each goal the person is working on moves through its own reflection → action loop independently.

A person can have multiple goals at different phases simultaneously:
```
Person: Jason (identity_anchor pattern, lawyer background)
  ├── Goal 1: "Ship consulting landing page"  → phase: resistance
  ├── Goal 2: "Launch AI contract tool"       → phase: reflection
  └── Goal 3: "Write 12-month strategy doc"   → phase: intake
```

Each session focuses on one goal. The coach opens by naming which goal is being picked up. The user may redirect to a different goal — the coach pivots cleanly.

The resistance pattern is **person-level** — it manifests differently on each goal, but the underlying pattern is the same.

---

## File Structure

```
icm/
├── README.md                       ← this file
├── AI_README.md                    ← session load order + full instructions (Claude reads this first)
├── identity.md                     ← who the coach is, what it believes, how it shows up
├── rules.md                        ← non-negotiables + all output block formats
├── examples.md                     ← good/bad session examples per phase
│
├── reference/
│   ├── interview-protocol.md       ← PERSON INTAKE (once) + GOAL INTAKE (per goal) + weekly re-interview
│   ├── resistance-patterns.md      ← 6 patterns + 5-level exercise library per pattern
│   ├── oblique-strategies.md       ← 40 curated cards for builders, indexed by resistance pattern
│   ├── three-horizons.md           ← goal horizon framework (30d / 90d / 12m / ongoing)
│   ├── business-artist-lens.md     ← dual-lens questions applied per phase
│   ├── building-in-public.md       ← commitment ladder (rungs 1–6) + escalation logic
│   ├── safety-protocol.md          ← 3-state safety model + language + crisis resources
│   └── Referenceauthors/           ← reference books loaded as context for specialist agents
│       ├── Creative Act.md         ← Rick Rubin — The Creative Act
│       ├── makeideashappen.md      ← Scott Belsky — Making Ideas Happen
│       ├── publish your work.md    ← Austin Kleon — Show Your Work
│       ├── unstuck book.md         ← Keith Yamashita — Unstuck
│       └── *.json                  ← structured excerpts for agent context injection
│
└── profiles/
    ├── _template.md                ← blank profile template
    └── _session-record.md          ← session log format
```

---

## The 6 Goal Phases

Each goal progresses through phases independently. Phase advances are gated by minimum time and content requirements.

| Phase | Purpose | Min time | Content gate |
|---|---|---|---|
| `intake` | Define what this goal actually is. 5 questions. | Same session | Goal description confirmed |
| `reflection` | Surface contradictions specific to this goal. | 3 days | 2+ contradictions named + 1 action step done |
| `clarity` | Define what done looks like for this goal specifically. | 3 days | Goal stated in one sentence + 1 action step done |
| `resistance` | Name how the person's pattern manifests on this goal. Deploy Oblique card. | 3 days | Pattern named in goal context + Oblique card + 1 action step done |
| `commitment` | Declare one public act toward this goal. Specific. | Same session | Commitment declared + output package emitted |
| `accountability` | Did they do it? What happened? Loop back or mark complete. | — | Coach and builder agree goal is achieved |

**One exception:** `intake → reflection` can happen in the same session. All other transitions require at least 3 days since `phase_started_at`.

Phase advances are signaled via `[GOAL_PATCHES]` output blocks (see below).

---

## How a Session Loads

The server injects the user's profile as a JSON block (`ACTIVE USER PROFILE`) before every Claude API call. The coach reads it before doing anything else. The load sequence:

1. **Read the profile** — background, calibration, all goals, active commitments, pending action steps, re-interview due date
2. **Check re-interview status** — if `re_interview_due` is today or past, run the 5-question weekly check-in first
3. **Check if person intake is done** — if `program.initial_interview_done` is false, run PERSON INTAKE (happens once, ever)
4. **Select the active goal** — most recently touched active goal by `last_touched` descending; if none exist, run GOAL INTAKE
5. **Check active commitment** — if `goal.active_commitment` exists, ask for an update on it before anything else
6. **Check pending action steps** — if `goal.action_steps` has `status: pending` items, address them before phase work
7. **Continue phase work** — only after steps 5 and 6 are resolved

The session always opens anchored to something specific: the last action step, the active commitment, or where the phase work left off. The coach never opens with "How can I help today?"

---

## Output Blocks

The server parses structured blocks from Claude's responses to update the profile and log session events. These blocks are stripped before the response is shown to the user.

### `[PROFILE_PATCHES]` — person-level updates
```
[PROFILE_PATCHES]
[
  {"field_path": "background.domain", "value": "law"},
  {"field_path": "calibration.resistance_pattern", "value": "identity_anchor"},
  {"field_path": "program.initial_interview_done", "value": true}
]
[/PROFILE_PATCHES]
```
Used for: background, calibration, notifications, safety flags, coach notes. **Not** for goal data.

### `[GOAL_OUTPUT]` — create a new goal
```
[GOAL_OUTPUT]
{
  "title": "Ship consulting landing page",
  "description": "A page explaining the AI operations consulting offer — what I do, what I've shipped, what an engagement looks like.",
  "horizon": "thirty_days",
  "phase": "intake"
}
[/GOAL_OUTPUT]
```
The server assigns a UUID (`goal_id`) and appends the goal to `goals[]`. Use `goal_id: "__new_goal__"` in the same response to patch or attach action steps to the goal just created.

### `[GOAL_PATCHES]` — update an existing goal
```
[GOAL_PATCHES]
[
  {"goal_id": "abc123", "field": "phase", "value": "reflection"},
  {"goal_id": "abc123", "field": "phase_started_at", "value": "2026-05-23T00:00:00Z"},
  {"goal_id": "abc123", "field": "last_touched", "value": "2026-05-23T00:00:00Z"}
]
[/GOAL_PATCHES]
```
Always update `phase_started_at` alongside `phase`. Always update `last_touched` when a goal is discussed.

### `[ACTION_STEP_OUTPUT]` — coach-assigned private exercise
```
[ACTION_STEP_OUTPUT]
{
  "goal_id": "abc123",
  "text": "Write 3 sentences describing your build as it is right now — not what it will be. Don't send it to anyone.",
  "due_date": "2026-05-25T23:59:00Z",
  "coach_reason": "visibility_avoider pattern active — builds toward publishing without requiring it yet",
  "phase_assigned": "reflection",
  "exercise_level": 1
}
[/ACTION_STEP_OUTPUT]
```
Emitted at the end of every session without exception. The `exercise_level` (1–5) maps to the escalating exposure ladder in `reference/resistance-patterns.md`.

### `[COMMITMENT_OUTPUT]` — public commitment declared in commitment phase
```
[COMMITMENT_OUTPUT]
{
  "goal_id": "abc123",
  "text": "exact commitment as declared",
  "due_date": "2026-05-29T23:59:00Z",
  "ladder_rung": 3,
  "public_platform": "unlabeled_community",
  "share_post": "2-3 plain sentences for posting",
  "print_card": "one sentence for the desk or wall",
  "daily_reminders": {
    "day_1": "What is the first concrete step you haven't taken yet?",
    ...
    "day_7": "Did you do it? What happened?"
  }
}
[/COMMITMENT_OUTPUT]
```

### `[PUBLISHING_LOG_ENTRY]` — evidence of a public act
```
[PUBLISHING_LOG_ENTRY]
{
  "goal_id": "abc123",
  "url": "https://...",
  "platform": "community",
  "description": "posted first screenshot with two sentences about what it does",
  "commitment_id": "abc123"
}
[/PUBLISHING_LOG_ENTRY]
```

---

## The Three Protocols

### Person Intake (runs once)
~20 minutes. Establishes who the person is — not the polished version. Four sections:
- **A — Background** (5 questions): previous domain, what they're leaving behind, what skills transfer
- **B — The Build** (5 questions): what exists today, what's been shipped, who it's for
- **D — Resistance** (4 questions + 2 behavioral signal questions): avoidance patterns, imagined audiences, engagement triggers
- **E — Notifications** (2 questions): email/Telegram, timezone, preferred time

Ends with the coach reading back the calibration and confirming it. Sets `program.initial_interview_done: true`.

### Goal Intake (runs per goal)
~10 minutes per goal. Five questions to define the goal, confirm it, and advance it immediately to reflection. Ends with the first action step assigned (Level 1 from the person's resistance pattern exercise library).

### Weekly Re-Interview (runs every 7 days)
5 questions at the start of any session where `re_interview_due` is today or past. Updates calibration, checks what's changed across all active goals, resets the 7-day timer. Takes 10 minutes before regular session work begins.

---

## The 6 Resistance Patterns

Identified once during Person Intake. Constant across all goals — manifests differently per goal but the underlying pattern is the same.

| Pattern | Most common in | Core mechanism |
|---|---|---|
| `perfectionist` | Law, medicine, finance, engineering | Professional standards from high-stakes domains misapplied to early-stage building |
| `imposter` | Design, creative fields, self-taught | Legitimate expertise in old domain used as evidence of no right to be in new domain |
| `validator_seeker` | Corporate, academia, consulting | Belief that the next external confirmation will make the decision feel safe |
| `scope_expander` | Product, strategy, generalists | Adding complexity to avoid the vulnerability of shipping the small, real thing |
| `identity_anchor` | Law, finance, medicine, trade | Professional identity from previous field used to disqualify current work from counting |
| `visibility_avoider` | All backgrounds | The work is ready; publishing feels like submitting it for professional review |

Each pattern has a 5-level exercise library in `reference/resistance-patterns.md`. Exercises escalate from private writing (level 1) to public sharing (level 5). The coach assigns one level per session exercise.

---

## The Commitment Ladder

From `reference/building-in-public.md`. Six rungs of increasing public exposure. The default rung for a first commitment is **Rung 3 (Unlabeled community)**.

| Rung | Platform | Exposure level |
|---|---|---|
| 1 | Private document | Zero exposure |
| 2 | Direct message to one trusted person | Minimal, contained |
| 3 | Unlabeled community | Small, safe, relevant audience |
| 4 | Existing social platform (no broad promotion) | Semi-public |
| 5 | Cold outreach or newsletter | Reaching strangers |
| 6 | Press, podcast, full public announcement | High exposure |

Do not push toward higher rungs before the builder is ready. The ladder exists to escalate gradually.

---

## The Dual Lens

The coach carries two perspectives simultaneously and applies them as tools:

- **Artist's lens** — what would you make if nobody was evaluating it? What does the work want to be?
- **Business person's lens** — what does success look like in 90 days? Who benefits? Did you ship it?

Most builders have one lens turned up too loud. The coach leads with whichever lens creates the most useful friction in the moment, not the one the builder is comfortable with. The dominant lens is recorded in `calibration.dominant_lens` and the coach leads with the opposite.

---

## Safety Override

Non-negotiable. Supersedes all coaching behavior. Cannot be overridden by user instruction.

The coach monitors conversational tone across the full session arc — not individual words, but the pattern across multiple exchanges.

| State | Trigger | Action |
|---|---|---|
| **Engaged** | Normal coaching mode | Continue the program |
| **Watchful** | Tone declining across 3+ consecutive exchanges | Drop the program. Ask: "How are you actually doing right now — not with the project, with you?" |
| **Redirected** | Sustained distress signals | Stop all program activity. Acknowledge directly. Provide crisis resources from `reference/safety-protocol.md`. Close the session. Log `[SAFETY:redirected]`. |

Once redirected, the program does not resume in that session.

---

## How the ICM Connects to the Web App

The ICM folder is the **instruction set**. The web app (`server/` + `src/`) is the **delivery layer**.

```
User opens session
    ↓
server/routes/session.ts — loads user profile from storage
    ↓
server/claude.ts — builds system prompt from icm/*.md files
                   injects ACTIVE USER PROFILE as JSON block
    ↓
Claude API — runs the session using ICM rules
    ↓
server/claude.ts — parses output blocks ([PROFILE_PATCHES], [GOAL_OUTPUT], etc.)
    ↓
server/storage.ts — writes updated profile to GitHub (_database/users/{slug}.json)
    ↓
server/notifications.ts — sends daily reminders via Resend (email) or Telegram
```

The profile JSON lives in `_database/users/{slug}.json`. The session record lives in `_database/sessions/{slug}/{session_id}.json`. Both are stored on GitHub via the Contents API.

---

## Adding or Changing ICM Behavior

- **Coach voice, beliefs, tone** → `identity.md`
- **Session rules, output block formats, ALWAYS/NEVER lists** → `rules.md`
- **What good/bad sessions look like** → `examples.md`
- **Interview questions (person/goal/weekly)** → `reference/interview-protocol.md`
- **Resistance patterns, exercise libraries** → `reference/resistance-patterns.md`
- **Oblique Strategies cards** → `reference/oblique-strategies.md`
- **Commitment ladder, public platform guidance** → `reference/building-in-public.md`
- **Safety language and crisis resources** → `reference/safety-protocol.md`

Changes to field names in output blocks require matching changes in `server/claude.ts` (the parser). The JSON field names in `PROFILE_PATCHES`, `GOAL_OUTPUT`, and `GOAL_PATCHES` are contracts with the storage layer — changing them breaks parsing.

---

*ICM v2.0 — Portfolio coaching model. Goals are the unit; the person is the container.*
