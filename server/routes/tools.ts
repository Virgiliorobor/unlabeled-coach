/**
 * /api/tools — Clearness Committee + Task Simplifier.
 * Stateless: client sends full history each request.
 */

import { Router, Request, Response } from 'express'
import Anthropic from '@anthropic-ai/sdk'
import { requireAuth } from '../auth.js'

const router = Router()
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-5'

// ── CLEARNESS COMMITTEE ──────────────────────────────────────
// POST /api/tools/clearness
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

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text : '{}'
  try {
    const parsed = JSON.parse(raw)
    res.json(parsed)
  } catch {
    res.status(500).json({ error: 'Failed to parse committee response', raw })
  }
})

// ── TASK SIMPLIFIER ──────────────────────────────────────────
// POST /api/tools/simplify
// Body: { task: string, context?: string }
// Returns: { simplified_task, action_steps, first_move, potential_blockers }

const SIMPLIFY_PROMPT = `You are a task simplifier working from the principles of Making Ideas Happen.

Your job: take a complex, vague, or overwhelming task and break it into concrete, executable pieces a person can actually start on today.

PRINCIPLES:
- Every action step starts with a verb and names a specific deliverable
- Each step is completable in 2 hours or less
- Sequence matters — earlier steps unblock later ones
- The first step must be doable in the next 30 minutes
- Potential blockers are real obstacles, not generic fears

TASK:
{task}

CONTEXT:
{context}

Return valid JSON only — no markdown, no commentary:
{
  "simplified_task": "one clear sentence: what this task actually is when stripped of complexity",
  "action_steps": [
    { "step": "verb + specific task", "estimated_time": "X min" },
    { "step": "...", "estimated_time": "..." }
  ],
  "first_move": "the single most concrete thing to do in the next 30 minutes",
  "potential_blockers": ["specific thing that could stop you", "specific thing that could stop you"]
}`

router.post('/simplify', requireAuth, async (req: Request, res: Response) => {
  const { task, context = '' } = req.body as { task: string; context?: string }

  if (!task?.trim()) {
    res.status(400).json({ error: 'Task is required' })
    return
  }

  const prompt = SIMPLIFY_PROMPT
    .replace('{task}', task.trim())
    .replace('{context}', context.trim() || '(none provided)')

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text : '{}'
  try {
    const parsed = JSON.parse(raw)
    res.json(parsed)
  } catch {
    res.status(500).json({ error: 'Failed to parse simplifier response', raw })
  }
})

export default router
