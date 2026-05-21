import { useState, useEffect, useRef } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Props {
  sessionId: string
  onEnd: () => void
}

export default function Session({ sessionId, onEnd }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
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
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      maxWidth: 'var(--max-width)',
      margin: '0 auto',
      padding: '0 var(--space-md)'
    }}>

      {/* Header */}
      <div className="flex justify-between items-center" style={{
        padding: 'var(--space-sm) 0',
        borderBottom: '1px solid var(--grey-light)'
      }}>
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
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: 'var(--space-md) 0',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-md)'
      }}>
        {messages.length === 0 && (
          <p className="text-muted" style={{ marginTop: 'var(--space-md)' }}>
            The coach is ready. Say something.
          </p>
        )}

        {messages.map((m, i) => (
          <div key={i} style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: m.role === 'user' ? 'flex-end' : 'flex-start'
          }}>
            <span className="label" style={{ marginBottom: 4 }}>
              {m.role === 'user' ? 'you' : 'coach'}
            </span>
            <p style={{
              maxWidth: '88%',
              background: m.role === 'user' ? 'var(--grey-light)' : 'transparent',
              padding: m.role === 'user' ? '12px 16px' : '0',
              lineHeight: 1.7,
              whiteSpace: 'pre-wrap'
            }}>
              {m.content}
            </p>
          </div>
        ))}

        {sending && (
          <div>
            <span className="label" style={{ marginBottom: 4, display: 'block' }}>coach</span>
            <span className="mono text-muted" style={{ fontSize: '0.75rem' }}>…</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Safety redirect state */}
      {safetyState === 'redirected' && (
        <div style={{
          background: 'var(--black)',
          color: 'var(--white)',
          padding: 'var(--space-sm)',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.8rem',
          marginBottom: 'var(--space-sm)'
        }}>
          Session paused. Please reach out to someone you trust.
        </div>
      )}

      {/* Input */}
      <div style={{
        borderTop: '1px solid var(--grey-light)',
        padding: 'var(--space-sm) 0 var(--space-md)',
        display: 'flex',
        gap: 'var(--space-sm)',
        alignItems: 'flex-end'
      }}>
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
