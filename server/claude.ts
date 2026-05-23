/**
 * Claude API integration.
 * Loads ICM context + user profile on every turn.
 * Returns assistant message + any profile patches detected.
 */

import Anthropic from '@anthropic-ai/sdk'
import { readICMFile } from './storage.js'
import { UserProfile, ChatMessage } from './types.js'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-5'
const MAX_TOKENS = parseInt(process.env.ANTHROPIC_MAX_TOKENS || '8192')

// ── ICM CONTEXT BUILDER ──────────────────────────────────────
// Loads the coach's identity files once and assembles the system prompt.
// The profile is injected fresh on every turn so the coach always has
// the current state — phase, active commitment, re-interview due date.

function buildSystemPrompt(profile: UserProfile | null): string {
  const readme    = readICMFile('AI_README.md')
  const identity  = readICMFile('identity.md')
  const rules     = readICMFile('rules.md')
  const examples  = readICMFile('examples.md')

  // Reference files — loaded for context, not recited
  const oblique   = readICMFile('reference/oblique-strategies.md')
  const patterns  = readICMFile('reference/resistance-patterns.md')
  const horizons  = readICMFile('reference/three-horizons.md')
  const lens      = readICMFile('reference/business-artist-lens.md')
  const building  = readICMFile('reference/building-in-public.md')
  const safety    = readICMFile('reference/safety-protocol.md')
  const interview = readICMFile('reference/interview-protocol.md')

  const profileSection = profile
    ? `\n\n---\n## ACTIVE USER PROFILE\n\`\`\`json\n${JSON.stringify(profile, null, 2)}\n\`\`\`\n---\n`
    : `\n\n---\n## USER PROFILE\nNo profile exists yet. This is the first session. Run Phase 0 using the interview protocol.\n---\n`

  return [
    readme,
    profileSection,
    identity,
    rules,
    examples,
    '---',
    '## REFERENCE',
    interview,
    oblique,
    patterns,
    horizons,
    lens,
    building,
    safety
  ].join('\n\n')
}

// ── PROFILE PATCH DETECTION ──────────────────────────────────
// The coach may signal profile changes in its response using structured blocks.
// This extracts and parses them so the server can update the profile.

export interface ProfilePatch {
  field_path: string    // dot notation: "program.current_phase"
  value: unknown
}

export interface CommitmentOutput {
  goal_id: string
  text: string
  due_date: string
  ladder_rung: number
  public_platform: string
  share_post: string
  print_card: string
  daily_reminders: Record<string, string>
}

export interface ActionStepOutput {
  goal_id: string
  text: string
  due_date: string
  coach_reason: string
  phase_assigned: string
  exercise_level: number
}

export interface PublishingLogEntryOutput {
  goal_id: string
  url: string
  platform: string
  description: string
  commitment_id: string
}

export interface GoalOutput {
  title: string
  description: string
  horizon: 'thirty_days' | 'ninety_days' | 'twelve_months' | 'ongoing'
  phase: string
}

export interface GoalPatch {
  goal_id: string
  field: string
  value: unknown
}

export interface ClaudeResponse {
  message: string
  profile_patches: ProfilePatch[]
  goal_output: GoalOutput | null
  goal_patches: GoalPatch[]
  commitment_output: CommitmentOutput | null
  action_step_output: ActionStepOutput | null
  publishing_log_entry: PublishingLogEntryOutput | null
  safety_state: 'engaged' | 'watchful' | 'redirected'
}

function extractBlock(text: string, tag: string): string | null {
  const pattern = new RegExp(`\\[${tag}\\]([\\s\\S]*?)\\[\\/${tag}\\]`, 'i')
  const match = text.match(pattern)
  return match ? match[1].trim() : null
}

function parseProfilePatches(raw: string | null): ProfilePatch[] {
  if (!raw) return []
  try {
    return JSON.parse(raw) as ProfilePatch[]
  } catch {
    return []
  }
}

function parseCommitmentOutput(raw: string | null): CommitmentOutput | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as CommitmentOutput
  } catch {
    return null
  }
}

function parseActionStepOutput(raw: string | null): ActionStepOutput | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as ActionStepOutput
  } catch {
    return null
  }
}

function parsePublishingLogEntry(raw: string | null): PublishingLogEntryOutput | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as PublishingLogEntryOutput
  } catch {
    return null
  }
}

function parseGoalOutput(raw: string | null): GoalOutput | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as GoalOutput
  } catch {
    return null
  }
}

function parseGoalPatches(raw: string | null): GoalPatch[] {
  if (!raw) return []
  try {
    return JSON.parse(raw) as GoalPatch[]
  } catch {
    return []
  }
}

function detectSafetyState(text: string): 'engaged' | 'watchful' | 'redirected' {
  if (text.includes('[SAFETY:redirected]')) return 'redirected'
  if (text.includes('[SAFETY:watchful]')) return 'watchful'
  return 'engaged'
}

function stripControlBlocks(text: string): string {
  return text
    .replace(/\[PROFILE_PATCHES\][\s\S]*?\[\/PROFILE_PATCHES\]/gi, '')
    .replace(/\[GOAL_OUTPUT\][\s\S]*?\[\/GOAL_OUTPUT\]/gi, '')
    .replace(/\[GOAL_PATCHES\][\s\S]*?\[\/GOAL_PATCHES\]/gi, '')
    .replace(/\[COMMITMENT_OUTPUT\][\s\S]*?\[\/COMMITMENT_OUTPUT\]/gi, '')
    .replace(/\[ACTION_STEP_OUTPUT\][\s\S]*?\[\/ACTION_STEP_OUTPUT\]/gi, '')
    .replace(/\[PUBLISHING_LOG_ENTRY\][\s\S]*?\[\/PUBLISHING_LOG_ENTRY\]/gi, '')
    .replace(/\[SAFETY:[^\]]+\]/gi, '')
    .trim()
}

// ── MAIN TURN FUNCTION ───────────────────────────────────────

export async function runTurn(
  history: ChatMessage[],
  userMessage: string,
  profile: UserProfile | null
): Promise<ClaudeResponse> {
  const systemPrompt = buildSystemPrompt(profile)

  // Build messages for Claude — history + new user message
  const messages: Anthropic.MessageParam[] = [
    ...history.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content
    })),
    { role: 'user', content: userMessage }
  ]

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    messages
  })

  const rawText = response.content
    .filter(b => b.type === 'text')
    .map(b => (b as Anthropic.TextBlock).text)
    .join('')

  const safetyState = detectSafetyState(rawText)
  const patchesRaw = extractBlock(rawText, 'PROFILE_PATCHES')
  const goalOutputRaw = extractBlock(rawText, 'GOAL_OUTPUT')
  const goalPatchesRaw = extractBlock(rawText, 'GOAL_PATCHES')
  const commitmentRaw = extractBlock(rawText, 'COMMITMENT_OUTPUT')
  const actionStepRaw = extractBlock(rawText, 'ACTION_STEP_OUTPUT')
  const publishingRaw = extractBlock(rawText, 'PUBLISHING_LOG_ENTRY')

  return {
    message: stripControlBlocks(rawText),
    profile_patches: parseProfilePatches(patchesRaw),
    goal_output: parseGoalOutput(goalOutputRaw),
    goal_patches: parseGoalPatches(goalPatchesRaw),
    commitment_output: parseCommitmentOutput(commitmentRaw),
    action_step_output: parseActionStepOutput(actionStepRaw),
    publishing_log_entry: parsePublishingLogEntry(publishingRaw),
    safety_state: safetyState
  }
}

// ── QUAKER AI PARTICIPANTS ───────────────────────────────────
// Generates AI-seeded Quaker Board responses.
// Each voice responds from a different builder archetype.

const ARCHETYPES = [
  { label: 'came from law', domain: 'law', pattern: 'perfectionist' },
  { label: 'came from finance', domain: 'finance', pattern: 'validator_seeker' },
  { label: 'came from design', domain: 'design', pattern: 'imposter' },
  { label: 'came from engineering', domain: 'engineering', pattern: 'scope_expander' },
  { label: 'came from healthcare', domain: 'healthcare', pattern: 'identity_anchor' }
]

export async function generateQuakerResponses(prompt: string): Promise<Array<{
  archetype: string
  text: string
}>> {
  const results = []

  for (const archetype of ARCHETYPES) {
    const systemPrompt = `You are a solo builder who came from ${archetype.domain}.
You are participating in a Quaker-style group reflection. You respond authentically from your experience —
including your blind spots, resistance patterns, and the specific way your background shapes how you see this question.
You are honest, not inspirational. You do not perform positivity. You write 3–5 sentences.
Do not address others. Do not use your background as a label. Just respond to the prompt as yourself.`

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 300,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }]
    })

    const text = response.content
      .filter(b => b.type === 'text')
      .map(b => (b as Anthropic.TextBlock).text)
      .join('')

    results.push({ archetype: archetype.label, text })
  }

  return results
}

// ── QUAKER SYNTHESIS ─────────────────────────────────────────

export async function synthesizeQuakerResponses(
  prompt: string,
  responses: Array<{ text: string }>
): Promise<string> {
  const responseBlock = responses.map(r => `— "${r.text}"`).join('\n\n')

  const systemPrompt = `You are the Unlabeled coach. You have just read a set of anonymous responses to a group reflection prompt.
Your job is to surface 2–3 patterns you noticed across the responses — without attributing any pattern to a specific response.
Be specific about the patterns. Not "people feel stuck" — name what the stuckness looks like across the responses.
Write in 3–5 sentences total. No headings, no bullets. Plain prose.`

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 400,
    system: systemPrompt,
    messages: [{
      role: 'user',
      content: `The prompt was: "${prompt}"\n\nThe responses were:\n\n${responseBlock}`
    }]
  })

  return response.content
    .filter(b => b.type === 'text')
    .map(b => (b as Anthropic.TextBlock).text)
    .join('')
}
