/**
 * /api/tools — public tool endpoints (no auth required).
 * Currently: POST /api/tools/simplify
 */

import { Router, Request, Response } from 'express'
import Anthropic from '@anthropic-ai/sdk'

const router = Router()
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SIMPLIFY_SYSTEM = `You are a task simplification coach for solo builders.
When given a task or goal, you break it down into the smallest possible concrete steps
that remove decision paralysis and make starting trivial.

Rules:
- Return ONLY valid JSON, no markdown fences, no extra text
- Each step must be completable in under 30 minutes
- Steps must be concrete actions, not vague directions
- Maximum 7 steps; aim for 3–5
- The first step must be something the person can do in the next 10 minutes
- If the task is already tiny, return 1–2 steps

JSON schema:
{
  "task": "cleaned-up version of the original task",
  "steps": [
    { "id": 1, "text": "...", "duration": "5 min", "why": "one sentence on why this unlocks the rest" },
    ...
  ],
  "first_move": "one sentence — the single most important first action"
}`

// POST /api/tools/simplify
router.post('/simplify', async (req: Request, res: Response) => {
  const { task } = req.body

  if (!task || typeof task !== 'string' || task.trim().length < 3) {
    res.status(400).json({ error: 'task is required' })
    return
  }

  if (task.length > 1000) {
    res.status(400).json({ error: 'task too long (max 1000 chars)' })
    return
  }

  try {
    const response = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-opus-4-5',
      max_tokens: 1024,
      system: SIMPLIFY_SYSTEM,
      messages: [{ role: 'user', content: `Break down this task: ${task.trim()}` }],
    })

    const text = (response.content as Anthropic.TextBlock[])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('')

    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      res.status(502).json({ error: 'Model returned invalid JSON', raw: text })
      return
    }

    res.json(parsed)
  } catch (err: unknown) {
    console.error('[tools/simplify]', err)
    const message = err instanceof Error ? err.message : 'API error'
    res.status(500).json({ error: message })
  }
})

export default router
