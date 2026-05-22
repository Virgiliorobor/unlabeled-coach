/**
 * Scheduler — daily signal cron + re-interview reminders.
 * Runs every hour, checks which users need a signal sent at their local time,
 * then dispatches. Avoids duplicate sends by tracking current_day in the profile.
 */

import cron from 'node-cron'
import { readProfile, writeProfile } from './storage.js'
import { sendDailySignal, sendReinterviewReminder } from './notifications.js'

// We store slugs in a registry for the scheduler to iterate.
// In a real DB this would be a table scan. For file storage, we maintain a list.
let userRegistry: string[] = []

export function registerUser(slug: string): void {
  if (!userRegistry.includes(slug)) {
    userRegistry.push(slug)
  }
}

export function loadUserRegistry(slugs: string[]): void {
  userRegistry = slugs
}

// ── IS IT SIGNAL TIME? ───────────────────────────────────────
// Check if the current time in the user's timezone matches their daily_signal_time.
// We fire within a 60-minute window to account for the hourly cron.

function isSignalTime(timezone: string, targetTime: string): boolean {
  try {
    const now = new Date()
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
    const localTime = formatter.format(now)
    const [localH] = localTime.split(':').map(Number)
    const [targetH] = targetTime.split(':').map(Number)
    return localH === targetH
  } catch {
    return false
  }
}

// ── PROCESS ONE USER ─────────────────────────────────────────

async function processUser(slug: string): Promise<void> {
  const profile = await readProfile(slug)
  if (!profile) return

  const { notifications, active_commitment } = profile

  // ── Daily signal ──────────────────────────────────────────
  if (
    active_commitment &&
    active_commitment.status === 'active' &&
    isSignalTime(notifications.timezone, notifications.daily_signal_time)
  ) {
    const { daily_reminders } = active_commitment
    const day = daily_reminders.current_day

    if (day >= 1 && day <= 7) {
      const question = daily_reminders[`day_${day}` as keyof typeof daily_reminders] as string

      await sendDailySignal({
        user_id: profile.user_id,
        slug: profile.slug,
        day_number: day,
        question,
        commitment_text: active_commitment.text,
        channels: notifications.channels,
        email: notifications.email || undefined,
        telegram_chat_id: notifications.telegram_chat_id,
        timezone: notifications.timezone
      })

      // Advance the day counter
      active_commitment.daily_reminders.current_day = day + 1

      // Auto-flag as missed if day 7 passed with no update
      if (day === 7) {
        const dueDate = new Date(active_commitment.due_date)
        if (new Date() > dueDate && active_commitment.status === 'active') {
          active_commitment.status = 'missed'
          // Move to history
          profile.commitment_history.push({
            commitment_id: active_commitment.commitment_id,
            text: active_commitment.text,
            declared_at: active_commitment.declared_at,
            due_date: active_commitment.due_date,
            status: 'missed',
            ladder_rung: active_commitment.ladder_rung,
            outcome_notes: 'Auto-flagged as missed — no update received after day 7',
            logged_at: new Date().toISOString()
          })
          profile.active_commitment = null
        }
      }

      profile.active_commitment = active_commitment
      await writeProfile(profile)
    }
  }

  // ── Re-interview reminder ─────────────────────────────────
  if (
    notifications.re_interview_reminder &&
    isSignalTime(notifications.timezone, notifications.daily_signal_time)
  ) {
    const due = new Date(profile.re_interview_due)
    const now = new Date()
    const hoursUntilDue = (due.getTime() - now.getTime()) / (1000 * 60 * 60)

    // Send reminder when due date is within 2 hours or already past
    if (hoursUntilDue <= 2) {
      await sendReinterviewReminder({
        email: notifications.email || undefined,
        telegram_chat_id: notifications.telegram_chat_id,
        channels: notifications.channels,
        slug: profile.slug
      })
    }
  }
}

// ── START THE CRON ───────────────────────────────────────────

export function startScheduler(): void {
  // Runs every hour at :00
  cron.schedule('0 * * * *', async () => {
    console.log(`[scheduler] Running — ${new Date().toISOString()} — ${userRegistry.length} users`)
    for (const slug of userRegistry) {
      try {
        await processUser(slug)
      } catch (err) {
        console.error(`[scheduler] Error processing ${slug}:`, err)
      }
    }
  })

  console.log('[scheduler] Started — running hourly')
}
