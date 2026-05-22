import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import path from 'path'
import { startScheduler, loadUserRegistry } from './scheduler.js'
import sessionRouter from './routes/session.js'
import dashboardRouter from './routes/dashboard.js'
import communityRouter from './routes/community.js'

const app = express()
const PORT = parseInt(process.env.PORT || '3001')

// ── MIDDLEWARE ────────────────────────────────────────────────

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? (process.env.CLIENT_URL || true)   // true = reflect origin; set CLIENT_URL to restrict to one domain
    : 'http://localhost:5173',
  credentials: true
}))
app.use(express.json())
app.use(cookieParser())

// ── API ROUTES ────────────────────────────────────────────────

app.use('/api', dashboardRouter)       // auth + dashboard
app.use('/api/session', sessionRouter)
app.use('/api/community', communityRouter)

// ── HEALTH CHECK ─────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() })
})

// ── SERVE CLIENT IN PRODUCTION ────────────────────────────────

if (process.env.NODE_ENV === 'production') {
  // dist/server/index.js → ../client = dist/client
  const clientDist = path.join(__dirname, '../client')
  app.use(express.static(clientDist))
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'))
  })
}

// ── STARTUP ───────────────────────────────────────────────────

async function start() {
  // ── Env var check ─────────────────────────────────────────
  const required = ['ANTHROPIC_API_KEY', 'SESSION_SECRET']
  const optional = ['RESEND_API_KEY', 'TELEGRAM_BOT_TOKEN', 'GITHUB_TOKEN']
  for (const key of required) {
    if (!process.env[key]) console.error(`[startup] MISSING REQUIRED: ${key}`)
    else console.log(`[startup] ✓ ${key}`)
  }
  for (const key of optional) {
    if (!process.env[key]) console.warn(`[startup] optional not set: ${key}`)
    else console.log(`[startup] ✓ ${key}`)
  }

  // Storage config diagnostics
  const storageMode = process.env.STORAGE_MODE || 'local'
  console.log(`[startup] Storage mode: ${storageMode}`)
  if (storageMode === 'github') {
    console.log(`[startup] GitHub repo: ${process.env.GITHUB_OWNER || '(MISSING)'}/${process.env.GITHUB_REPO || '(MISSING)'}`)
    console.log(`[startup] GitHub branch: ${process.env.GITHUB_BRANCH || 'main'}`)
    if (!process.env.GITHUB_TOKEN) console.error('[startup] MISSING: GITHUB_TOKEN — writes will fail')
    else console.log('[startup] ✓ GITHUB_TOKEN')
    if (!process.env.GITHUB_OWNER) console.error('[startup] MISSING: GITHUB_OWNER')
    if (!process.env.GITHUB_REPO)  console.error('[startup] MISSING: GITHUB_REPO')
  } else {
    console.warn('[startup] ⚠ Storage mode is LOCAL — data will be lost on redeploy. Set STORAGE_MODE=github.')
  }

  // Load user registry for scheduler
  loadUserRegistry([])

  // Start the notification scheduler
  startScheduler()

  app.listen(PORT, () => {
    console.log(`[server] Unlabeled running on port ${PORT}`)
    console.log(`[server] Environment: ${process.env.NODE_ENV || 'development'}`)
  })
}

start().catch(console.error)
