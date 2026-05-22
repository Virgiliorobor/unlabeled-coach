import { useState, useEffect, useRef } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Props {
  sessionId: string
  openingMessage: string | null
  onEnd: () => void
}

export default function Session({ sessionId, openingMessage, onEnd }: Props) {
  const [messages, setMessages] = useState<Message[]>(
    openingMessage ? [{ role: 'assistant', content: openingMessage }] : []
  )
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [safetyState, setSafetyState] = useState<'engaged' | 'watchful' | 'redirected'>('engaged')
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send() {
    if (!input.trim() || sending) return
    const userMessage = input.trim()
    setInput('')
    setSending(true)

    setMessages(prev => [...prev, { role: 'user', content: userMessage }])

    const res = await fetch(`/api/session/${sessionId}/message`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: userMessage })
    })

    setSending(false)

    if (res.ok) {
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.message }])
      if (data.safety_state) setSafetyState(data.safety_state)
    } else {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Something went wrong. Please try again.'
      }])
    }
  }

  async function handleEnd() {
    await fetch(`/api/session/${sessionId}/end`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    })
    onEnd()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="session-layout">

      {/* Header */}
      <div className="session-header">
        <span className="label">Session in progress</span>
        <div className="flex gap-sm items-center">
          {safetyState === 'watchful' && (
            <span className="mono" style={{ color: 'var(--accent)', fontSize: '0.7rem' }}>
              watchful
            </span>
          )}
          <button className="label" onClick={handleEnd} style={{ color: 'var(--grey-mid)' }}>
            End session
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="session-messages">
        {messages.length === 0 && (
          <p className="text-muted" style={{ marginTop: 'var(--space-md)' }}>
            …
          </p>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={`message-block ${m.role === 'user' ? 'user-message' : 'coach-message'}`}
          >
            <span className="message-label label">
              {m.role === 'user' ? 'you' : 'coach'}
            </span>
            <p className="message-text">
              {m.content}
            </p>
          </div>
        ))}

        {sending && (
          <div className="message-block coach-message">
            <span className="message-label label">coach</span>
            <span className="mono text-muted" style={{ fontSize: '0.75rem' }}>…</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Safety redirect state */}
      {safetyState === 'redirected' && (
        <div className="safety-banner">
          Session paused. Please reach out to someone you trust.
        </div>
      )}

      {/* Input */}
      <div className="session-input-area">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Say something…"
          disabled={sending || safetyState === 'redirected'}
          rows={3}
          style={{ flex: 1 }}
        />
        <button
          className="btn-primary"
          onClick={send}
          disabled={sending || !input.trim() || safetyState === 'redirected'}
          style={{ opacity: sending || !input.trim() ? 0.5 : 1, flexShrink: 0 }}
        >
          Send
        </button>
      </div>

    </div>
  )
}
