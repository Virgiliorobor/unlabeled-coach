/**
 * Storage layer — local filesystem or GitHub Contents API.
 * Set STORAGE_MODE=github for persistence across Railway redeploys.
 * Defaults to local (filesystem) for development.
 */

import fs from 'fs'
import path from 'path'

const MODE = process.env.STORAGE_MODE || 'local'
const GITHUB_OWNER = process.env.GITHUB_OWNER || ''
const GITHUB_REPO = process.env.GITHUB_REPO || ''
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || ''
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main'
const BASE_PATH = process.env.GITHUB_BASE_PATH || ''

// ── LOCAL STORAGE ────────────────────────────────────────────

function localRead(filePath: string): string | null {
  const full = path.join(process.cwd(), filePath)
  if (!fs.existsSync(full)) return null
  return fs.readFileSync(full, 'utf8')
}

function localWrite(filePath: string, content: string): void {
  const full = path.join(process.cwd(), filePath)
  fs.mkdirSync(path.dirname(full), { recursive: true })
  fs.writeFileSync(full, content, 'utf8')
}

function localExists(filePath: string): boolean {
  return fs.existsSync(path.join(process.cwd(), filePath))
}

// ── GITHUB STORAGE ───────────────────────────────────────────

function githubPath(filePath: string): string {
  return BASE_PATH ? `${BASE_PATH}/${filePath}` : filePath
}

async function githubRead(filePath: string): Promise<string | null> {
  try {
    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${githubPath(filePath)}?ref=${GITHUB_BRANCH}`
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json'
      }
    })
    if (!res.ok) return null
    const data = await res.json() as { content: string }
    return Buffer.from(data.content, 'base64').toString('utf8')
  } catch {
    return null
  }
}

async function githubGetSha(filePath: string): Promise<string | null> {
  try {
    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${githubPath(filePath)}?ref=${GITHUB_BRANCH}`
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json'
      }
    })
    if (!res.ok) return null
    const data = await res.json() as { sha: string }
    return data.sha
  } catch {
    return null
  }
}

async function githubWrite(filePath: string, content: string, message: string): Promise<void> {
  const sha = await githubGetSha(filePath)
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${githubPath(filePath)}`
  const body: Record<string, string> = {
    message,
    content: Buffer.from(content).toString('base64'),
    branch: GITHUB_BRANCH
  }
  if (sha) body.sha = sha
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })
  if (!res.ok) {
    const errorBody = await res.text().catch(() => 'unknown')
    throw new Error(`GitHub write failed [${res.status}] for ${filePath}: ${errorBody}`)
  }
}

// ── PUBLIC API ───────────────────────────────────────────────

export async function readFile(filePath: string): Promise<string | null> {
  if (MODE === 'github') {
    const result = await githubRead(filePath)
    if (result) return result
    // Fallback to local (for ICM files committed to repo)
    return localRead(filePath)
  }
  return localRead(filePath)
}

export async function writeFile(filePath: string, content: string, commitMsg?: string): Promise<void> {
  if (MODE === 'github') {
    await githubWrite(filePath, content, commitMsg || `update ${filePath}`)
    return
  }
  localWrite(filePath, content)
}

export async function fileExists(filePath: string): Promise<boolean> {
  if (MODE === 'github') {
    const result = await githubRead(filePath)
    return result !== null
  }
  return localExists(filePath)
}

// ── USER PROFILE HELPERS ─────────────────────────────────────

import { UserProfile, SessionRecord } from './types.js'

export function userPath(slug: string): string {
  return `_database/users/${slug}.json`
}

export function sessionPath(slug: string, session_id: string): string {
  return `_database/sessions/${slug}/${session_id}.json`
}

export function communityPath(post_id: string): string {
  return `_database/community/${post_id}.json`
}

export async function readProfile(slug: string): Promise<UserProfile | null> {
  const raw = await readFile(userPath(slug))
  if (!raw) return null
  return JSON.parse(raw) as UserProfile
}

export async function writeProfile(profile: UserProfile): Promise<void> {
  profile.last_updated = new Date().toISOString()
  await writeFile(
    userPath(profile.slug),
    JSON.stringify(profile, null, 2),
    `profile update: ${profile.slug}`
  )
}

export async function readSession(slug: string, session_id: string): Promise<SessionRecord | null> {
  const raw = await readFile(sessionPath(slug, session_id))
  if (!raw) return null
  return JSON.parse(raw) as SessionRecord
}

export async function writeSession(session: SessionRecord): Promise<void> {
  await writeFile(
    sessionPath(session.user_slug, session.session_id),
    JSON.stringify(session, null, 2),
    `session: ${session.user_slug} #${session.session_number}`
  )
}

// ── DIRECTORY LISTING ────────────────────────────────────────

export async function listDirectory(dirPath: string): Promise<string[]> {
  if (MODE === 'github') {
    try {
      const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${githubPath(dirPath)}?ref=${GITHUB_BRANCH}`
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.v3+json'
        }
      })
      if (!res.ok) return []
      const data = await res.json() as Array<{ name: string; type: string }>
      return data.filter(f => f.type === 'file').map(f => f.name)
    } catch {
      return []
    }
  }
  const full = path.join(process.cwd(), dirPath)
  if (!fs.existsSync(full)) return []
  return fs.readdirSync(full)
}

// Find profile by email — scans all users (O(n), fine for MVP scale).
export async function findProfileByEmail(email: string): Promise<UserProfile | null> {
  const files = await listDirectory('_database/users')
  for (const file of files) {
    if (!file.endsWith('.json')) continue
    const profile = await readProfile(file.replace('.json', ''))
    if (profile?.notifications?.email?.toLowerCase() === email.toLowerCase()) return profile
  }
  return null
}

// ── ICM FILE LOADER ──────────────────────────────────────────
// ICM files are always read from local filesystem (committed to repo).
// They never change at runtime — they are the coach's identity.

export function readICMFile(relativePath: string): string {
  return localRead(`icm/${relativePath}`) || ''
}
