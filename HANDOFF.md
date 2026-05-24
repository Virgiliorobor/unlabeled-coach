# Unlabeled — Development Handoff Document
> Last updated: May 24 2026 · Session 3 with Claude Sonnet 4.6.
> Previous session notes preserved below (§ Session 2). New work from Session 3 is in §§ A–E.

---

## SESSION 3 SUMMARY — Design System Application

This session focused entirely on applying the "Tactile OS" visual design system to the two main surfaces: the `how-it-works.html` marketing/philosophy page and the React `Dashboard.tsx`. The Stitch design mockups were the reference point throughout.

---

## A. Design System Reference

The **Tactile OS** design system is documented in `DESIGN.md` (uploaded by user, not in repo — see `icm/` for reference). Key rules:

### Palette (exact values — do not substitute)
| Token | Value | Usage |
|---|---|---|
| `--canvas` / `T.ivory` | `#F4F4F0` | All page backgrounds. Updated this session from `#F3F1EB` which had a pinkish/warm cast |
| `T.white` | `#FFFFFF` | Card faces, elevated surfaces sitting on ivory |
| `T.black` | `#111111` | All borders, structural elements, primary text |
| `T.red` | `#E03C31` | NASA red — deadlines, overdue, destructive actions only |
| `T.yellow` | `#FFF000` | Highlighter — active nav items, tape, insights |
| `T.grey` | `#888880` | Secondary text, labels, disabled states |
| `T.greyLight` | `#D8D8D4` | Dividers, ghost borders |
| `T.greyBg` | `#ECEAE5` | Recessed areas, step cards, inputs |

### Typography
| Role | Font | Usage |
|---|---|---|
| Headlines / body text | EB Garamond | Sanctuary/reflection states |
| Typewriter / inputs | Courier Prime | Drafting, sandbox |
| Labels / metadata / nav | Space Mono | System quadrant, all metadata, nav items |
| DYMO labels / CTAs | Inter 700 uppercase | Workbench, action buttons |

### Physical language (apply everywhere)
- **No CSS box-shadows with blur** — all shadows are `N px N px 0px #111111` (hard, unblurred)
- **No gradients** — flat surfaces only
- **No rounded corners** — everything is `border-radius: 0`
- **Hard shadow on hover** shrinks + element translates: `box-shadow: 1px 1px` + `transform: translate(2px,2px)`
- **NASA red corner flag** for overdue items: CSS triangle `border-top: 24px solid #E03C31; border-left: 24px solid transparent`
- **Tape borders** (CSS `::before`/`::after` pseudo-elements, `background: rgba(255,240,0,0.75)`) for workbench elements
- **DYMO label** = black bg, white uppercase Inter, inset shadow

---

## B. Files Changed This Session

### `src/index.css`
- Updated `--canvas`, `--bg`, `--white` from `#F3F1EB` → `#F4F4F0` (was causing the "pinkish" look the user flagged)
- All other design tokens already correct

### `src/pages/Dashboard.tsx` (major rewrite)
**Key structural change:** The dashboard was rebuilt from a centered max-width layout into a full-viewport left-sidebar + main-area layout, matching all four Stitch screen designs.

Current structure:
```
<div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
  <aside style={{ width: 240, borderRight: '2px solid #111' }}>
    NASA-red DYMO brand label
    Phase nav (6 items, active = yellow #FFF000 + translate + black border)
    Start Session DYMO button
    Sign out
  </aside>
  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
    <header style={{ height: 52, borderBottom: '2px solid #111' }}>
      Current phase name | resistance_pattern + slug
    </header>
    <main style={{ flex: 1, overflowY: 'auto' }}>
      ProgressMap
      Grid (1fr 300px): Goals | Tools + Agents + Publishing log
    </main>
  </div>
</div>
```

New subcomponents in Dashboard.tsx:
- `DymoBtn` — black DYMO label button with 4px hard shadow, translate on hover
- `Btn` — System rectangular button (ghost/solid/dim variants)
- `ToolCard` — flat bordered card with hover background, stacked list style
- `SectionLabel` — Space Mono uppercase label (inline/block/small variants)

Goal cards:
- White face (`#FFFFFF`) on ivory surface
- Stacked borderless rows (`border-bottom: none` on all but last)
- Black corner triangle for overdue (CSS triangle, `position: absolute, top: 0, right: 0`)
- Inline phase/horizon tags (black pill for horizon, ghost pill for phase)

### `public/how-it-works.html` (major rewrite)
The standalone marketing/philosophy page was rebuilt using the Tactile OS four-quadrant layout. It does NOT use React — it's a plain HTML file copied to `dist/client/` by Vite during build (because it lives in `public/`).

Current sections:
1. **Sanctuary** — centered, EB Garamond, vast void, philosophical opening text, two CTAs
2. **Sandbox** — 2×2 principle cards (white, hard shadow) + 3-column rotated pattern cards (rotate on hover to straighten)
3. **System** — SYSTEM_LOG header, 3×2 phase grid (hover fills black + reveals description), chat demo in split layout
4. **Workbench** — 2×2 DYMO agent cards + 2×2 tool cards, full-width NASA red CTA

Fixed sidebar (200px left column) with scroll-spy active states for all four sections.

---

## C. Stitch Design Reference (Source of Truth for Dashboard)

The user has a Stitch project at:
- **Project ID:** `14374394201114475882`
- **API key:** stored by user in Railway as `stitch_key` (not in this env — ask user to provide)
- **MCP server:** `https://stitch.googleapis.com/mcp` with header `X-Goog-Api-Key`

Five screens in the project (IDs listed for `get_screen` tool calls):
| Screen name | Screen ID |
|---|---|
| Ivory Transition State | `7cca1e6dbda74060a802fc996d198d31` |
| Clarity (System) | `a95b8f7470304bed86a6290c0e284035` |
| Commitment (Workbench) | `d32d83e35c27438aa9bdf14dd8119ec3` |
| Reflection (Sanctuary) | `c8fc69e5ece34265bdcf731848890f3d` |
| The Transition State | `aa24f643cca14cd09d452bae7afec5ec` |

**Note on access:** The `get_screen` MCP call returns metadata + download URLs (`htmlCode.downloadUrl`, `screenshot.downloadUrl`). Those download URLs require Google OAuth (browser session cookie), not the API key — they return 403 from cloud environments. To get the actual HTML/images, the user needs to export from the Stitch web UI directly, or provide OAuth tokens.

The HTML for 4 of the 5 screens was provided by the user during this session and used as design reference:
- `8615257f-code.html` — Clarity (System)
- `fd00258b-code.html` — Commitment (Workbench)
- `327550a1-code.html` — Transition State
- `f82ceebc-code.html` — Reflection (Sanctuary)

These are in the Claude uploads for session `be5ceae2-aa86-447b-bae6-9bcd65d34180` but are NOT in the repo. If you need them, ask the user to re-upload or export from Stitch.

**Key patterns extracted from Stitch screens:**
- All screens use `display: flex; height: 100vh; overflow: hidden` on the root
- Left sidebar: `width: 256px; border-right: 2px solid #000; flex-shrink: 0`
- Active nav item: `background: #FFF000; border: 1px solid #000; transform: translateX(2-3px)`
- Main area: `flex: 1; display: flex; flex-direction: column; overflow: hidden`
- Blueprint grid background (System): `background-image: linear-gradient(to right, rgba(0,0,0,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.05) 1px, transparent 1px); background-size: 24px 24px`
- Tape border (Workbench): CSS `::before` pseudo-element, `position: absolute; top: -6px; left: 50%; width: 40px; height: 12px; background: #d1d1c4`
- DYMO label class: `background: #1a1a1a; color: #fff; padding: 6px 12px; box-shadow: inset 0 -1px 2px rgba(255,255,255,0.2), 0 2px 4px rgba(0,0,0,0.4); text-transform: uppercase; letter-spacing: 0.1em; font-family: Inter; font-weight: 800`
- NASA corner flag: `clip-path: polygon(100% 0, 100% 100%, 0 0); background: #E03C31`

---

## D. What Still Needs Work (Design)

The user's feedback at end of session was that the dashboard doesn't fully look like the Stitch designs yet. The structural rebuild (left sidebar + flex layout) was the last commit. What's still missing to get closer to the Stitch reference:

### D1 — Phase-adaptive main content
The Stitch screens show dramatically different main content per phase:
- **Sanctuary/Reflection**: Centered content, minimal, `items-center justify-center`, crosshair cursor, full-page serif question with transparent textarea
- **System/Clarity**: Blueprint grid background, 12-column Bauhaus bento grid with `border-t border-l border-primary` stacking
- **Workbench/Commitment**: Dot-grid background, tape-bordered cards, 4px hard shadows throughout, OBLIGATION_MANIFEST card

Currently the dashboard renders the same layout regardless of phase. The next step is making the main content area switch based on `data-quadrant` or the current phase.

**How to implement:** In `src/App.tsx`, `phaseToQuadrant()` already maps phases to quadrant names. The `data-quadrant` attribute is set on `<html>`. The CSS in `index.css` already has `[data-quadrant="system"]`, `[data-quadrant="workbench"]`, etc. selectors. The missing piece is phase-conditional rendering in `Dashboard.tsx` main content.

### D2 — Blueprint grid on System quadrant
When `phase === 'resistance'` (System quadrant), the main content area background should show the grid:
```css
background-image: linear-gradient(to right, rgba(0,0,0,0.05) 1px, transparent 1px),
                  linear-gradient(to bottom, rgba(0,0,0,0.05) 1px, transparent 1px);
background-size: 24px 24px;
```

### D3 — Bento grid for goals (System phase)
In the Clarity/System Stitch screen, goals/content is displayed as a 12-column strict-border bento grid:
```
<div class="grid grid-cols-12 gap-0 border-t border-l border-primary">
  <div class="col-span-8 border-r border-b border-primary p-6 bg-white">...primary card...</div>
  <div class="col-span-4 border-r border-b border-primary">...metrics...</div>
  ...
</div>
```

### D4 — Sanctuary layout for Reflection phase
When in reflection phase, the main area should become centered/minimal like the Reflection Stitch screen:
- `display: flex; flex-direction: column; align-items: center; justify-content: center`
- Large EB Garamond italic question
- Transparent textarea "type into the void"
- Fade-in animation on load

### D5 — Commitment/Workbench tape treatment
The goal cards in commitment phase should get the tape-border treatment from the Workbench Stitch screen (the `.tape-border::before` pseudo-element). Currently the tape border CSS exists in `index.css` as `.tape-border` class but isn't applied in the new Dashboard.

---

## E. Deployment State

- **Branch:** `main`
- **Netlify:** auto-deploys from `main`, serves `dist/client/` (built by `npm run build:client`)
- **Railway:** auto-deploys from `main`, serves the full Express app
- **netlify.toml:** routes `/how-it-works` → `/how-it-works.html`, then `/*` → `/index.html` (SPA catch-all)
- **Last commit on main:** `316f7c0` — Rebuild Dashboard with Stitch left-sidebar layout

---

---

# SESSION 2 NOTES (May 22 2026) — preserved below

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
├── public/
│   └── how-it-works.html       # Standalone marketing/philosophy page (Tactile OS)
│
├── railpack.json               # Railway build config
├── netlify.toml                # Netlify routing
├── package.json
├── tsconfig.server.json        # CommonJS target for server
└── vite.config.ts
```

---

## 3. Environment Variables (Railway)

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
| `RESEND_API_KEY` | Optional | For email delivery. Lazy-initialized |
| `TELEGRAM_BOT_TOKEN` | Optional | For Telegram notifications. Lazy-initialized |
| `CLIENT_URL` | Optional | Full URL of deployed app. Used for CORS. |
| `stitch_key` | Design reference | Google API key for Stitch MCP. Used for design work only — not needed for app runtime |

---

## 4. How the Coaching System Works

(See Session 2 notes — unchanged.)

Phase names (must match exactly in code):
```
interview → reflection → clarity → resistance → commitment → accountability
```

Phase → Quadrant mapping in `src/App.tsx`:
- `interview` → sanctuary
- `reflection`, `clarity` → sandbox
- `resistance` → system
- `commitment`, `accountability` → workbench

---

## 5. Known Issues / Next Work Items

### P0 — Dashboard doesn't fully match Stitch designs (D1–D5 above)
Phase-adaptive content is the most impactful remaining design work.

### P1 — Magic link login not implemented
`POST /api/auth/login` returns 501.

### P2 — Session length / stopping points
Interview is too long in one sitting. Add "section complete" logic to `icm/AI_README.md` (no code changes needed).

### P3 — User registry not seeded on startup
`loadUserRegistry([])` in `server/index.ts` should scan `_database/users/` on boot.

### P4 — Dashboard empty for early-phase users
No conditional rendering for users in `interview` / `reflection` phase. ProgressMap and goals grid are empty.

### P5 — Re-interview timer resets on registration
Should only start after Phase 0 (`interview`) is complete.

---

## 6. How to Run Locally

```bash
# Install dependencies
npm install

# .env minimum:
# ANTHROPIC_API_KEY=sk-ant-...
# SESSION_SECRET=any-random-32-char-string
# STORAGE_MODE=local

# Dev (Express :3001, Vite :5173 — proxies /api/* to :3001)
npm run dev

# Production build
npm run build
node dist/server/index.js
```

---

## 7. Deployment

**Railway** — auto-deploys from `main`. Config: `railpack.json`.  
**Netlify** — auto-deploys from `main`. Serves React SPA + `/how-it-works` static page. Config: `netlify.toml`.

After Railway deploy, check logs for `[startup] ✓` lines. Any `MISSING` = broken feature.

---

*Session 3 additions: May 24 2026*  
*Session 2 original: May 22 2026*  
*Repo: https://github.com/Virgiliorobor/unlabeled-coach.git*
