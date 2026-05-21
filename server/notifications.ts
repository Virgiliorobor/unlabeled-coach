/**
 * Notification service — email (Resend) + Telegram.
 * Both channels are optional. If a channel is not configured,
 * it fails silently and logs a warning.
 */

import { Resend } from 'resend'
import { DailySignalPayload } from './types.js'

const resend = new Resend(process.env.RESEND_API_KEY)
const EMAIL_FROM = process.env.EMAIL_FROM || 'onboarding@resend.dev'

// Telegram is optional — only initialised if token is set
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
let telegramBot: any = null

if (TELEGRAM_TOKEN) {
  // Dynamic import so missing token doesn't crash the server
  import('node-telegram-bot-api').then(({ default: TelegramBot }) => {
    telegramBot = new TelegramBot(TELEGRAM_TOKEN, { polling: false })
    console.log('[notifications] Telegram bot initialised')
  }).catch(() => {
    console.warn('[notifications] Telegram bot failed to initialise')
  })
}

// ── EMAIL ────────────────────────────────────────────────────

export async function sendEmail(opts: {
  to: string
  subject: string
  html: string
  text: string
}): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set — skipping email')
    return false
  }
  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text
    })
    return true
  } catch (err) {
    console.error('[email] Failed to send:', err)
    return false
  }
}

// ── TELEGRAM ─────────────────────────────────────────────────

export async function sendTelegram(chat_id: string, text: string): Promise<boolean> {
  if (!telegramBot) {
    console.warn('[telegram] Bot not initialised — skipping message')
    return false
  }
  try {
    await telegramBot.sendMessage(chat_id, text)
    return true
  } catch (err) {
    console.error('[telegram] Failed to send:', err)
    return false
  }
}

// ── DAILY SIGNAL ─────────────────────────────────────────────

export async function sendDailySignal(payload: DailySignalPayload): Promise<void> {
  const { day_number, question, commitment_text, channels, email, telegram_chat_id } = payload

  const subject = `Day ${day_number}: ${commitment_text.slice(0, 60)}${commitment_text.length > 60 ? '…' : ''}`
  const telegramText = `Day ${day_number} — ${question}`

  const emailHtml = `
    <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; padding: 40px 24px; color: #111;">
      <p style="font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: #888; margin-bottom: 32px;">
        Day ${day_number} · Unlabeled
      </p>
      <p style="font-size: 20px; line-height: 1.6; margin-bottom: 32px;">
        ${question}
      </p>
      <p style="font-size: 13px; color: #666; border-top: 1px solid #eee; padding-top: 20px;">
        Your commitment: <em>${commitment_text}</em>
      </p>
    </div>
  `

  const emailText = `Day ${day_number}\n\n${question}\n\nYour commitment: ${commitment_text}`

  const sends: Promise<boolean>[] = []

  if (channels.includes('email') && email) {
    sends.push(sendEmail({ to: email, subject, html: emailHtml, text: emailText }))
  }

  if (channels.includes('telegram') && telegram_chat_id) {
    sends.push(sendTelegram(telegram_chat_id, telegramText))
  }

  await Promise.all(sends)
}

// ── RE-INTERVIEW REMINDER ────────────────────────────────────

export async function sendReinterviewReminder(opts: {
  email?: string
  telegram_chat_id?: string | null
  channels: Array<'email' | 'telegram'>
  slug: string
}): Promise<void> {
  const subject = 'Time for your weekly check-in'
  const message = `Your weekly check-in is due. Five questions, ten minutes. Head to your session to update your profile.`

  const emailHtml = `
    <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; padding: 40px 24px; color: #111;">
      <p style="font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: #888; margin-bottom: 32px;">
        Weekly check-in · Unlabeled
      </p>
      <p style="font-size: 20px; line-height: 1.6; margin-bottom: 32px;">
        ${message}
      </p>
    </div>
  `

  const sends: Promise<boolean>[] = []

  if (opts.channels.includes('email') && opts.email) {
    sends.push(sendEmail({ to: opts.email, subject, html: emailHtml, text: message }))
  }

  if (opts.channels.includes('telegram') && opts.telegram_chat_id) {
    sends.push(sendTelegram(opts.telegram_chat_id, `Weekly check-in — ${message}`))
  }

  await Promise.all(sends)
}
