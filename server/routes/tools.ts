/**
 * /api/tools — public + authenticated tool endpoints.
 * POST /api/tools/simplify  — no auth (used by static Netlify tool)
 * POST /api/tools/clearness — requireAuth (Clearness Committee, in-app)
 */

import { Router, Request, Response } from 'express'
import Anthropic from '@anthropic-ai/sdk'
import { requireAuth } from '../auth.js'

const router = Router()
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-5'

// ── TASK SIMPLIFIER ──────────────────────────────────────────
// POST /api/tools/simplify  (no auth — used by site/tools/simplify.html)
// Body: { task: string }
// Returns: { task, steps: [{id, text, duration, why}], first_move }

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
      model: MODEL,
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

// ── CLEARNESS COMMITTEE ──────────────────────────────────────
// POST /api/tools/clearness  (requireAuth — in-app tool)
// Body: { stage: 'surface'|'medium'|'deep'|'mirror', dilemma: string, history: AnswerEntry[] }
// Returns: { items: { text: string }[] }

interface AnswerEntry {
  stage: string
  question: string
  answer: string
}

const CC_STAGE_PROMPTS: Record<string, string> = {
  surface: `You are a member of a Clearness Committee — a Quaker-derived process for helping someone find inner clarity.

THE ONE LAW: You may only ask questions. Never give advice, never share opinions, never say "you should" or "have you considered." A question is only honest if you genuinely cannot know the answer.

Generate exactly 3 surface-level questions about the FACTS of the focus person's dilemma. These should clarify the concrete situation — what is actually happening, who is involved, what has been tried, what the actual choice is. Not feelings yet. Facts first.

DILEMMA:
{dilemma}

Return valid JSON only — no markdown, no commentary:
{"items": [{"text": "..."}, {"text": "..."}, {"text": "..."}]}`,

  medium: `You are a member of a Clearness Committee.

THE ONE LAW: Questions only. No advice. No opinions. No "you should." Every question must be genuinely open — you cannot know the answer.

The focus person has answered the surface questions. Now generate exactly 3 medium-depth questions that explore the meaning, stakes, and personal weight behind the facts. Ask about values, fears, what matters, what they'd lose or gain. Not soul-level yet — context and meaning.

DILEMMA:
{dilemma}

PREVIOUS ANSWERS:
{history}

Return valid JSON only:
{"items": [{"text": "..."}, {"text": "..."}, {"text": "..."}]}`,

  deep: `You are a member of a Clearness Committee.

THE ONE LAW: Questions only. No advice. No opinions. No "you should." Every question must be genuinely open.

The focus person has answered both surface and medium questions. Now generate exactly 3 deep, soul-level questions. These questions should go beneath the dilemma to the person's inner life — identity, fear, longing, what they already know but haven't said, what the silence underneath their answers is pointing to. These questions may feel uncomfortable. That is correct.

DILEMMA:
{dilemma}

PREVIOUS ANSWERS:
{history}

Return valid JSON only:
{"items": [{"text": "..."}, {"text": "..."}, {"text": "..."}]}`,

  mirror: `You are a member of a Clearness Committee offering mirroring — the final act.

WHAT MIRRORING IS: You observe patterns in what the focus person wrote and how they wrote it. You do not analyze, judge, or advise. You simply reflect back what you noticed — in their language, their energy, what expanded and what contracted. These are observations, not interpretations.

Notice things like:
- Where their language became more energized or more flat
- What they kept returning to or circling around
- Where their answers were long and alive vs short and closed
- What they said they wanted and what their words actually suggest they fear or desire
- The gap between the stated dilemma and what the answers revealed underneath it

Generate exactly 2 mirror observations. Each should be a calm, specific reflection — not a conclusion, not advice. Format: "When you wrote about [X], [observation about language/energy/pattern]."

DILEMMA:
{dilemma}

ALL ANSWERS:
{history}

Return valid JSON only:
{"items": [{"text": "..."}, {"text": "..."}]}`
}

router.post('/clearness', requireAuth, async (req: Request, res: Response) => {
  const { stage, dilemma, history = [] } = req.body as {
    stage: keyof typeof CC_STAGE_PROMPTS
    dilemma: string
    history: AnswerEntry[]
  }

  if (!CC_STAGE_PROMPTS[stage]) {
    res.status(400).json({ error: 'Invalid stage' })
    return
  }

  if (!dilemma?.trim()) {
    res.status(400).json({ error: 'Dilemma is required' })
    return
  }

  const historyText = history.map(h =>
    `[${h.stage.toUpperCase()}] ${h.question}\nAnswer: ${h.answer}`
  ).join('\n\n')

  const prompt = CC_STAGE_PROMPTS[stage]
    .replace('{dilemma}', dilemma.trim())
    .replace('{history}', historyText || '(none yet)')

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = response.content[0].type === 'text' ? response.content[0].text : '{}'
    const parsed = JSON.parse(raw)
    res.json(parsed)
  } catch (err: unknown) {
    console.error('[tools/clearness]', err)
    const message = err instanceof Error ? err.message : 'API error'
    res.status(500).json({ error: message })
  }
})

export default router
