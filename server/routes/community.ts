/**
 * /api/community — Quaker Board async reflection.
 * Posts a prompt, collects responses (AI-seeded + human), synthesizes after 48h.
 */

import { Router, Request, Response } from 'express'
import { requireAuth } from '../auth.js'
import { readFile, writeFile } from '../storage.js'
import { generateQuakerResponses, synthesizeQuakerResponses } from '../claude.js'
import { v4 as uuidv4 } from 'uuid'
import { QuakerPost, QuakerResponse } from '../types.js'

const router = Router()

// ── GET /api/community/posts ──────────────────────────────────

router.get('/posts', requireAuth, async (_req: Request, res: Response) => {
  // In production this would scan the _database/community/ folder.
  // For MVP, return a placeholder.
  res.json({ posts: [], message: 'Community board — coming soon' })
})

// ── POST /api/community/posts ─────────────────────────────────
// Create a new Quaker Board post with AI-seeded responses.

router.post('/posts', requireAuth, async (req: Request, res: Response) => {
  const { user_id } = (req as any).user
  const { prompt } = req.body

  if (!prompt?.trim()) {
    res.status(400).json({ error: 'prompt is required' })
    return
  }

  const post_id = uuidv4()
  const now = new Date()
  const closes_at = new Date(now.getTime() + 48 * 60 * 60 * 1000)

  // Generate AI-seeded responses
  const aiResponses = await generateQuakerResponses(prompt.trim())

  const responses: QuakerResponse[] = aiResponses.map(r => ({
    response_id: uuidv4(),
    author_type: 'ai' as const,
    archetype: r.archetype,
    text: r.text,
    submitted_at: now.toISOString()
  }))

  const post: QuakerPost = {
    post_id,
    prompt: prompt.trim(),
    created_by: user_id,
    created_at: now.toISOString(),
    closes_at: closes_at.toISOString(),
    status: 'open',
    responses,
    synthesis: ''
  }

  await writeFile(
    `_database/community/${post_id}.json`,
    JSON.stringify(post, null, 2),
    `community: new post ${post_id}`
  )

  res.json({ post_id, closes_at: closes_at.toISOString(), responses_seeded: responses.length })
})

// ── POST /api/community/posts/:id/respond ────────────────────
// Add a human response to an open post.

router.post('/posts/:id/respond', requireAuth, async (req: Request, res: Response) => {
  const { user_id } = (req as any).user
  const { id } = req.params
  const { text } = req.body

  if (!text?.trim()) {
    res.status(400).json({ error: 'text is required' })
    return
  }

  const raw = await readFile(`_database/community/${id}.json`)
  if (!raw) {
    res.status(404).json({ error: 'Post not found' })
    return
  }

  const post: QuakerPost = JSON.parse(raw)

  if (post.status !== 'open') {
    res.status(400).json({ error: 'Post is closed for responses' })
    return
  }

  if (new Date() > new Date(post.closes_at)) {
    post.status = 'closed'
    await writeFile(`_database/community/${id}.json`, JSON.stringify(post, null, 2))
    res.status(400).json({ error: 'Post has closed' })
    return
  }

  // Check user hasn't already responded
  const alreadyResponded = post.responses.some(
    r => r.author_type === 'human' && r.user_id === user_id
  )
  if (alreadyResponded) {
    res.status(400).json({ error: 'You have already responded to this post' })
    return
  }

  const response: QuakerResponse = {
    response_id: uuidv4(),
    author_type: 'human',
    user_id: user_id, // stored for dedup only — never returned to client
    text: text.trim(),
    submitted_at: new Date().toISOString()
  }

  post.responses.push(response)
  await writeFile(`_database/community/${id}.json`, JSON.stringify(post, null, 2))

  res.json({ ok: true, response_count: post.responses.length })
})

// ── POST /api/community/posts/:id/synthesize ─────────────────
// Trigger synthesis (normally runs automatically after 48h).

router.post('/posts/:id/synthesize', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params

  const raw = await readFile(`_database/community/${id}.json`)
  if (!raw) {
    res.status(404).json({ error: 'Post not found' })
    return
  }

  const post: QuakerPost = JSON.parse(raw)

  if (post.status === 'synthesized') {
    res.json({ synthesis: post.synthesis })
    return
  }

  const synthesis = await synthesizeQuakerResponses(
    post.prompt,
    post.responses.map(r => ({ text: r.text }))
  )

  post.synthesis = synthesis
  post.status = 'synthesized'
  await writeFile(`_database/community/${id}.json`, JSON.stringify(post, null, 2))

  res.json({ synthesis })
})

// ── GET /api/community/posts/:id ─────────────────────────────
// Returns post with anonymized responses (no user_ids).

router.get('/posts/:id', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params

  const raw = await readFile(`_database/community/${id}.json`)
  if (!raw) {
    res.status(404).json({ error: 'Post not found' })
    return
  }

  const post: QuakerPost = JSON.parse(raw)

  // Strip user_ids from responses before returning
  const sanitized = {
    ...post,
    responses: post.responses.map((r) => {
      const { user_id: _uid, ...rest } = r
      return rest
    })
  }

  res.json(sanitized)
})

export default router
