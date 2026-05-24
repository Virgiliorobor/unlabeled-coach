# Unlabeled — Development Handoff Document
> Written at end of Session 2 with Claude (May 22 2026). Pass this to the next agent to continue.

---

## 1. What This Project Is

**Unlabeled** is a self-reflection coaching platform for solo builders in identity transition — people leaving law, finance, design, engineering to build AI-powered tools and services. It is not a productivity app. It's a structured coaching program that mirrors working with a human coach.

**Live URL:** Deployed on Railway (connect to user's Railway account to see URL and logs)  
**GitHub repo:** `https://github.com/Virgiliorobor/unlabeled-coach.git`  
**Local path:** `C:\Users\jaime\OneDrive\dev\unlabeled\`  
**Stack:** Express + TypeScript (server) · Vite + React + TypeScript (client) · Railway (hosting) · GitHub Contents API (storage)

---

## 2. Architecture Overview

### Two layers

**Layer 1 — ICM Coaching Engine** (`/icm/` folder)
A folder-based single-agent coaching system. The coach persona, rules, and all reference material live as markdown files. These are loaded into the system prompt on every API call to Claude. The coach is a single agent (not multi-agent) — continuity is the value.

**Layer 2 — Web App** (`/server/` + `/src/`)
Express API + React frontend wrapping the coaching engine. Handles auth, session management, profile storage, dashboard, commitment tracking, and notification delivery.

### File structure
```
unlabeled/
├── icm/                        # Coach identity — never changes at runtime
│   ├── AI_README.md            # Session load order + WHERE TO PICK UP decision tree
│   ├── identity.md             # Coach persona
│   ├── rules.md                # Non-negotiables + PROFILE_PATCHES format (critical)
│   ├── examples.md             # Good/bad session examples per phase
│   └── reference/
│       ├── interview-protocol.md
│       ├── oblique-strategies.md
│       ├── resistance-patterns.md
│       ├── three-horizons.md
│       ├── business-artist-lens.md
│       ├── building-in-public.md
│       └── safety-protocol.md
│
├── server/
│   ├── index.ts                # Express app + startup diagnostics
│   ├── auth.ts                 # HMAC-SHA256 signed session cookies
│   ├── storage.ts              # Dual-mode: local FS or GitHub Contents API
│   ├── claude.ts               # Claude API integration + patch parser
│   ├── notifications.ts        # Resend (email) + Telegram
│   ├── scheduler.ts            # node-cron hourly job for daily signals
│   ├── types.ts                # All TypeScript interfaces
│   └── routes/
│       ├── dashboard.ts        # Auth + dashboard + profile + commitment resolve
│       ├── session.ts          # Live coaching session (message send/receive)
│       └── community.ts        # Quaker Board (async group reflection)
│
├── src/                        # React frontend
│   ├── App.tsx                 # Auth check + view state + quadrant switching
│   ├── index.css               # Full Tactile OS design system
│   └── pages/
│       ├── Onboarding.tsx      # Registration (sanctuary quadrant)
│       ├── Dashboard.tsx       # Main dashboard (workbench quadrant)
│       └── Session.tsx         # Live coaching session
│
├── _database/                  # Runtime data (synced to GitHub)
│   ├── users/                  # {slug}.json — one file per user
│   ├── sessions/               # {slug}/{session_id}.json
│   └── community/              # {post_id}.json
│
├── railpack.json               # Railway build config
├── package.json
├── tsconfig.server.json        # CommonJS target for server
└── vite.config.ts
```

---

## 3. Environment Variables (Railway)

Set all of these in the Railway project settings:

| Variable | Required | Value/Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ Required | Claude API key |
| `SESSION_SECRET` | ✅ Required | Random 32+ char string for cookie signing |
| `STORAGE_MODE` | ✅ Required | Set to `github` — without this, data is lost on every redeploy |
| `GITHUB_OWNER` | ✅ Required | `Virgiliorobor` |
| `GITHUB_REPO` | ✅ Required | `unlabeled-coach` |
| `GITHUB_TOKEN` | ✅ Required | Personal access token with `repo` scope (read + write) |
| `GITHUB_BRANCH` | Optional | Defaults to `main` |
| `GITHUB_BASE_PATH` | Optional | Leave empty unless storing data in a subfolder |
| `RESEND_API_KEY` | Optional | For email delivery. Lazy-initialized — app starts fine without it |
| `TELEGRAM_BOT_TOKEN` | Optional | For Telegram notifications. Lazy-initialized |
| `CLIENT_URL` | Optional | Full URL of deployed app (e.g. `https://your-app.up.railway.app`). Used for CORS restriction. If not set, CORS reflects origin (permissive but fine for MVP) |
| `NODE_ENV` | Set by Railway | Railway sets this to `production` automatically |
| `ANTHROPIC_MODEL` | Optional | Defaults to `claude-opus-4-5` |
| `ANTHROPIC_MAX_TOKENS` | Optional | Defaults to `8192` |

**Startup diagnostics:** On boot, the server logs the status of every env var. Check Railway logs immediately after deploy — any MISSING lines need to be fixed before the app works.

---

## 4. How the Coaching System Works

### Session flow
1. User registers → profile created in `_database/users/{slug}.json` on GitHub
2. User starts session → `GET /api/session/active` creates a session record and generates an opening message by calling Claude
3. User types → `POST /api/session/:id/message` sends message + full chat history + all ICM files + profile to Claude
4. Claude responds with: message text + optional `[PROFILE_PATCHES]` JSON block + optional `[COMMITMENT_OUTPUT]` JSON block + safety state signal
5. Server strips the control blocks before showing the message to the user, applies any patches to the profile, writes everything to GitHub

### Profile patches — how the coach updates the profile
The coach signals profile updates by embedding a structured block in its response:
```
[PROFILE_PATCHES]
[
  {"field_path": "background.domain", "value": "finance"},
  {"field_path": "program.current_phase", "value": "reflection"}
]
[/PROFILE_PATCHES]
```
The server parses this, applies each patch using dot-notation path walking, and writes the updated profile to GitHub. **This was broken in early sessions (ICM files never told the coach about this format) and was fixed in this session.**

### Commitment output format
When a commitment is declared in Phase 4:
```
[COMMITMENT_OUTPUT]
{
  "text": "exact commitment text",
  "due_date": "2026-05-29T23:59:00.000Z",
  "ladder_rung": 3,
  "public_platform": "unlabeled_community",
  "share_post": "2-3 plain sentences for posting",
  "print_card": "one sentence for the desk",
  "daily_reminders": {
    "day_1": "...", "day_2": "...", ... "day_7": "..."
  }
}
[/COMMITMENT_OUTPUT]
```

### Phase names (important — must match exactly)
Profile stores phases as strings. These are the only valid values:
```
interview → reflection → clarity → resistance → commitment → accountability
```
The frontend maps these to visual quadrants (in `src/App.tsx`):
- `interview` → sanctuary (EB Garamond, vast space, Rubin aesthetic)
- `reflection`, `clarity` → sandbox (Courier Prime, skewed elements, Kleon aesthetic)
- `resistance` → system (Space Mono, strict grid, Bauhaus aesthetic)
- `commitment`, `accountability` → workbench (Dymo labels, tape borders, Sachs aesthetic)

### Safety system
Three states: `engaged` → `watchful` → `redirected`  
Coach signals via `[SAFETY:watchful]` or `[SAFETY:redirected]` in response text.  
If redirected, the input area is disabled and a banner appears.

---

## 5. Bugs Fixed in This Session

### Bug 1 — Coach never wrote profile patches (CRITICAL, fixed)
**Problem:** `icm/rules.md` told the coach what fields to fill but never explained the `[PROFILE_PATCHES]` format. The coach did the interview correctly but had no way to send the answers back to the server. Profile stayed blank across all sessions.  
**Fix:** Added a full "HOW TO SIGNAL PROFILE UPDATES" section at the top of `icm/rules.md` with the exact JSON format, a field-path reference table, and instructions to emit incrementally (not just at end of interview).

### Bug 2 — COMMITMENT_OUTPUT format mismatch (fixed)
**Problem:** `rules.md` defined commitment output as a plain-text YAML block, but `claude.ts` parser expected JSON inside `[COMMITMENT_OUTPUT]...[/COMMITMENT_OUTPUT]` tags. They never matched.  
**Fix:** Replaced the text format in `rules.md` with the correct JSON format and bracket tags.

### Bug 3 — Coach restarted from scratch every session (fixed)
**Problem:** `icm/AI_README.md` had generic "check the phase" instructions but no decision tree for where to resume. The coach would read an empty profile and start Section A even if some sections were already filled.  
**Fix:** Added a "WHERE TO PICK UP — DECISION TREE" section to `AI_README.md` mapping every `current_phase` value to specific opening behavior. If Section A fields are filled, skip to Section B. Never ask questions you already have answers for.

### Bug 4 — GitHub writes failed silently (CRITICAL, fixed)
**Problem:** `server/storage.ts` `githubWrite()` never checked the HTTP response status. A 401/409/422 from the GitHub API would be swallowed — the server returned 200 to the client, messages appeared in the UI, but nothing was actually saved.  
**Fix:** Added response status check + throw on failure. Now the error propagates to the route handler and returns a 500 with the actual GitHub error message.

### Bug 5 — Wrong phase string names in frontend (fixed)
**Problem:** `src/App.tsx` `phaseToQuadrant()` mapped `phase_0`, `phase_1`, etc. but the profile actually stores `interview`, `reflection`, `clarity`, etc. Every user hit the default case and got sanctuary quadrant regardless of actual phase.  
**Fix:** Updated switch cases to match actual profile phase strings.

### Bug 6 — CORS misconfiguration (fixed)
**Problem:** In production, if `CLIENT_URL` env var was not set, `origin: false` disabled CORS headers entirely for cross-origin requests.  
**Fix:** Changed to `origin: true` (reflect origin) as the safe default when `CLIENT_URL` is not configured.

---

## 6. Design System — The Tactile OS

Four visual quadrants defined in `src/index.css`. Switched via `document.documentElement.dataset.quadrant` which is set in `App.tsx` based on current phase.

| Quadrant | Phase | Fonts | Visual character |
|---|---|---|---|
| sanctuary | interview | EB Garamond | Vast margins, no borders, italic coach messages, text links instead of buttons |
| sandbox | reflection, clarity | Courier Prime + Permanent Marker | 0.5deg rotation on messages, yellow tape note cards, typewriter feel |
| system | resistance | Space Mono | Strict grid, thick borders, 4px box shadows, uppercase labels, Bauhaus |
| workbench | commitment, accountability | Space Mono + Dymo labels | Black/white label chips, yellow drafting tape borders, NASA red for deadlines, strikethrough for done items |

**Snap animation:** When phase transitions from `sandbox` → `system` (reflection/clarity → resistance), a CSS animation fires on `.is-snapping` class added to `<html>`. Skewed elements animate into a rigid grid.

**Global rules (never violate):**
- Background is always `#F4F4F0` (never pure white)
- Shadows are always `4px 4px 0px #111` (unblurred, physical)
- NASA red `#E03C31` for deadlines/destructive only
- Highlighter yellow `#FFF000` for tape, insights, active selections only

---

## 7. Current Test User Profile

**Slug:** `test-gmao-com`  
**GitHub path:** `_database/users/test-gmao-com.json`  
**Current phase:** `clarity` (Phase 2)  
**Sessions completed:** 4 (+ session 5 and 6 in progress at time of writing)  

Profile was manually seeded from the Phase 0 + Phase 1 session HTML transcript after those sessions failed to save due to Bug 1 + Bug 4. Key data:
- Finance background, 15 years, parallel builder
- Resistance pattern: `visibility_avoider`
- Dominant lens: `business`
- Goals set across three horizons
- Email: `jaime.rob@gmail.com`, timezone: `America/Chicago`

Session 5 and 6 are currently running (or recently completed). The `c985dfc profile update: test-gmao-com` commit in git log confirms patches ARE now being written correctly post-fix.

---

## 8. Known Remaining Issues / Next Work Items

### Issue A — User experience: sessions are too long
**Problem:** The interview + Phase 1 took the test user 2+ hours in a single sitting. The system was designed for weekly coaching sessions but is being used as a self-service product. Users see no dashboard value until Phases 2-4 are complete.

**Proposed solution (do not implement yet, needs design discussion):**

**Phase 0 — Split into 3 micro-sessions (~10 min each)**
- Part A (5 questions): Background only → immediately shows domain + years on dashboard
- Part B (9 questions): Build + Goals → Three Horizons grid populates on dashboard
- Part C (6 questions): Resistance + Notifications → pattern named, daily signals configured

The coach already checks which profile fields are filled and skips them (AI_README.md pickup fix). Stopping mid-interview is safe — partial data is saved. The only change needed is telling the coach to recognize "end of a section" as a valid stopping point and invite the user back.

**Phase 1-2 — Async daily questions instead of full sessions**
Instead of dedicated reflection sessions, the coach sends one question per day via email. User answers in 2 minutes. After 3-5 answers the coach has enough to name the contradiction and advance the phase. Session UI becomes optional (for depth), not required (for progression).

**Dashboard — Progressive state rendering**
Every profile field should have three display states: `empty` → `in_progress` → `active`  
- Background shows as soon as Part A is done  
- Goals show with a "refining..." label before they're finalized  
- Resistance pattern shows as "?" until confirmed, then full explanation  
- Phase progress indicator (e.g. "Phase 2 of 6 — Clarity")

**Session ending — explicit "good stopping point" logic**
Coach should recognize when a section of the interview or a phase unit is complete and offer to stop: "That's a good place to pause. Your profile has been updated — we'll pick up with [X] next time." Currently the coach never offers to stop.

### Issue B — Dashboard incomplete for early phases
The current dashboard shows Three Horizons grid and Active Commitment. For a user in `interview` or `reflection` phase, both sections are mostly empty. Need:
- Phase-appropriate dashboard content (interview phase shows "next: complete your profile")
- Progress indicator showing where user is in the program
- Partial goal display (even rough/unconfirmed goals are better than "Not set yet")

### Issue C — Magic link login not implemented
`POST /api/auth/login` returns 501. Currently the only way to log in (aside from registration) is the dev-login endpoint. Needs proper email-based magic link auth for production.

### Issue D — User registry not seeded on startup
`loadUserRegistry([])` is called with an empty array. If Railway restarts, the scheduler doesn't know about existing users until they start a new session. Needs to scan `_database/users/` on startup.

### Issue E — Re-interview timer resets on registration
`re_interview_due` is set to `created_at + 7 days`. This means every new registration triggers a re-interview reminder 7 days later even if no real interview happened yet. Should only start the 7-day clock after Phase 0 is actually complete (i.e., after `current_phase` advances past `interview`).

---

## 9. How to Run Locally

```bash
cd C:\Users\jaime\OneDrive\dev\unlabeled

# Install dependencies
npm install

# Create .env file (copy from Railway env vars)
# Minimum for local:
# ANTHROPIC_API_KEY=sk-ant-...
# SESSION_SECRET=any-random-string-32-chars
# STORAGE_MODE=local   (use local FS for dev, not github)

# Run dev server (Express on :3001, Vite on :5173)
npm run dev
```

The Vite dev server proxies `/api/*` to `:3001`. Both run concurrently via `concurrently`.

For production build:
```bash
npm run build          # builds client to dist/client, server to dist/server
node dist/server/index.js
```

---

## 10. Deployment (Railway)

Railway auto-deploys from `main` branch on push. Config is in `railpack.json`:
```json
{ "install": "npm install", "build": "npm run build", "start": "node dist/server/index.js" }
```

After every deploy, check Railway logs for:
- `[startup] ✓ ANTHROPIC_API_KEY` — coach works
- `[startup] ✓ GITHUB_TOKEN` — storage works  
- `[startup] Storage mode: github` — data persists
- Any `MISSING` lines = that feature is broken

**Critical:** If `STORAGE_MODE` is not `github`, all data is lost on every redeploy. This caused multiple lost sessions during testing.

---

## 11. The ICM Files — What They Do

The `/icm/` folder is the coach's brain. These files are loaded into the Claude system prompt on every API call. They never change at runtime.

**Load order in system prompt** (defined in `server/claude.ts`):
1. `AI_README.md` — system briefing, session load order, WHERE TO PICK UP decision tree
2. User profile JSON (injected fresh every turn)
3. `identity.md` — coach persona
4. `rules.md` — non-negotiables + PROFILE_PATCHES format + COMMITMENT_OUTPUT format
5. `examples.md` — good/bad examples per phase
6. All reference files (interview protocol, oblique strategies, resistance patterns, three horizons, business-artist lens, building in public, safety protocol)

**Important:** When editing ICM files, the changes take effect immediately on the next Railway deploy (files are read from local FS on server). No code changes required to update coach behavior — only ICM file changes.

---

## 12. Key Code Locations for Each Feature

| Feature | File | Key function/line |
|---|---|---|
| Opening message generation | `server/routes/session.ts` | `GET /active` → `runTurn([], '[SESSION_START]', profile)` |
| Profile patch application | `server/routes/session.ts` | `applyPatch()` function at bottom of file |
| Claude system prompt assembly | `server/claude.ts` | `buildSystemPrompt()` |
| Patch + commitment parsing | `server/claude.ts` | `extractBlock()`, `parseProfilePatches()`, `parseCommitmentOutput()` |
| GitHub storage | `server/storage.ts` | `githubRead()`, `githubWrite()` |
| Auth cookies | `server/auth.ts` | `sign()`, `verify()`, `requireAuth` middleware |
| Quadrant switching | `src/App.tsx` | `phaseToQuadrant()` + `useEffect` that sets `document.documentElement.dataset.quadrant` |
| Snap animation trigger | `src/App.tsx` | `prevQuadrantRef` + `is-snapping` class |
| Daily notification scheduler | `server/scheduler.ts` | `startScheduler()` — runs hourly cron |
| Commitment resolve | `server/routes/dashboard.ts` | `POST /dashboard/commitment/:id/resolve` |
| Quaker Board | `server/routes/community.ts` | AI-seeded responses via `generateQuakerResponses()` |

---

## 13. Netlify Static Tools — Site Directory

A companion static site lives in `/site/` and is deployed to Netlify from the `claude/handoff-md-review-2DikD` branch (Netlify configured to deploy from this branch).

### Landing page
`site/index.html` — Sanctuary aesthetic. EB Garamond wordmark + headline, CTA link to Railway app, tool list below.

### Tools catalog

| Tool | File | Quadrant | Description |
|---|---|---|---|
| Oblique Card | `site/tools/card.html` | Sanctuary | 40 curated cards for stuck builders. Date-keyed daily card (same card for all users that day). Fade transition between cards. Text-link controls, no buttons. |
| Blackout | `site/tools/blackout.html` | Workbench | Paste any text (or choose from 8 catalog texts). Algorithm redacts stop words + probabilistic substantive words, leaving a found-poem. Three density modes: Dense / Balanced / Sparse. Dymo labels for section headers. |
| Grow | `site/tools/grow.html` | Sandbox | Full-screen canvas drawing tool. Draw lines + plant color seeds → Transform fires 4-phase mandala animation: shake/fade → seed connectors → N-fold rotational folds fan in → ribs grow. Handwritten reveal prompt after transform. |
| Simplify | `site/tools/simplify.html` | System | Calls `POST /api/tools/simplify` on Railway. Claude returns 3–7 steps with duration + why, plus a first_move sentence. System UI: mono throughout, yellow first-move banner, Dymo chip durations, bordered step list. |

### Design quadrant rules (applied to tools)
Derived from the Tactile OS used in the main app (`src/index.css`):

| Quadrant | Fonts | Key markers |
|---|---|---|
| Sanctuary | EB Garamond | No borders on interactive elements, text links not buttons, vast spacing, italic everything |
| Workbench | Space Mono + Courier Prime | Dymo label chips (black bg), yellow tape borders, inset box-shadow on inputs |
| Sandbox | Courier Prime + Permanent Marker | 0.5–1.5deg rotations, yellow (#FFF000) as active highlight, handwritten scrawl feel |
| System | Space Mono | Strict grid, thick 2px borders, 4px unblurred box-shadows, uppercase mono labels, zebra rows |

### API endpoint for Simplify
`POST /api/tools/simplify` (no auth required)  
Body: `{ "task": "string, max 1000 chars" }`  
Returns: `{ "task": "cleaned", "steps": [...], "first_move": "one sentence" }`  
File: `server/routes/tools.ts`

---

## 14. What the Next Agent Should Focus On

Priority order based on user feedback and system state:

**P0 — Verify fixes are stable** ✓ (confirmed in Session 3)
- Profile patches write correctly post-fix
- Coach opens in correct phase based on profile state

**P1 — Dashboard for early-phase users** ✓ (implemented in Session 3)
- Phase progress indicator (6 pips) added to Dashboard.tsx
- First Move block shown when user has no active commitment
- Portfolio block visible from Phase 0
- Today's prompt + Oblique Card signal row added

**P2 — Netlify static tools** ✓ (implemented in Session 3)
See Section 13 for full catalog. Four tools live, quadrant-styled.

**P3 — Magic link login (Issue C)** — not yet done
`POST /api/auth/login` in `server/routes/dashboard.ts` returns 501. Need to:
- Generate a 1-time token, store it (in `_database/auth/{token}.json`)
- Send login link via Resend
- `GET /api/auth/verify?token=X` validates and issues session cookie

**P4 — User registry seeding on startup (Issue D)** — not yet done
In `server/index.ts`, replace `loadUserRegistry([])` with a function that scans `_database/users/` and loads all slugs into the scheduler.

**P5 — Define remaining product areas** — next design session
User wants to map out other parts of the build beyond the coach + tools:
- What other pages/sections does the site need?
- Community features beyond Quaker Board
- Monetization / program structure (what does "entering the program" mean?)
- Any missing ICM work

---

*Document written: May 22 2026 · Session 2 with Claude Sonnet 4.6*  
*Updated: May 23 2026 · Session 3 — dashboard overhaul, Netlify tools, style pass*  
*Repo: https://github.com/Virgiliorobor/unlabeled-coach.git*  
*Local: C:\Users\jaime\OneDrive\dev\unlabeled\*
