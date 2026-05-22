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
    ? process.env.CLIENT_URL || false
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
  const clientDist = path.join(__dirname, '../../client')
  app.use(express.static(clientDist))
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'))
  })
}

// ── STARTUP ───────────────────────────────────────────────────

async function start() {
  // Load user registry for scheduler
  // In production with GitHub storage, this would scan _database/users/
  // For now the registry builds up as users log in
  loadUserRegistry([])

  // Start the notification scheduler
  startScheduler()

  app.listen(PORT, () => {
    console.log(`[server] Unlabeled running on port ${PORT}`)
    console.log(`[server] Storage mode: ${process.env.STORAGE_MODE || 'local'}`)
    console.log(`[server] Environment: ${process.env.NODE_ENV || 'development'}`)
  })
}

start().catch(console.error)
