import { useState, useEffect, useRef } from 'react'

export type AgentId = 'creative-act' | 'make-ideas-happen' | 'show-your-work' | 'unstuck'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface AgentConfig {
  id: AgentId
  name: string
  author: string
  tagline: string
  description: string
  actionLabel: string
  accentColor: string
}

export const AGENTS: AgentConfig[] = [
  {
    id: 'creative-act',
    name: 'The Creative Act',
    author: 'Rick Rubin',
    tagline: 'Access what you actually want to make.',
    description: 'When you\'ve lost the thread of why you\'re building this — or you\'re performing instead of creating — start here.',
    actionLabel: 'Before we talk again',
    accentColor: 'var(--black)',
  },
  {
    id: 'make-ideas-happen',
    name: 'Making Ideas Happen',
    author: 'Scott Belsky',
    tagline: 'Move from idea to execution.',
    description: 'When you have the idea clearly but keep failing to act on it — when planning feels like progress but nothing ships — start here.',
    actionLabel: 'Action step',
    accentColor: 'var(--black)',
  },
  {
    id: 'show-your-work',
    name: 'Show Your Work',
    author: 'Austin Kleon',
    tagline: 'Share the work before it\'s finished.',
    description: 'When you\'re hiding what you\'re building — waiting for it to be ready, avoiding the audience, staying invisible — start here.',
    actionLabel: 'Share today',
    accentColor: 'var(--black)',
  },
  {
    id: 'unstuck',
    name: 'Unstuck',
    author: 'Dr. Emily Musgrove',
    tagline: 'Name what\'s keeping you frozen.',
    description: 'When you know what you should do but can\'t make yourself do it — when avoidance has become the pattern — start here.',
    actionLabel: 'One movement today',
    accentColor: 'var(--black)',
  },
]

interface Props {
  agentId: AgentId
  onBack: () => void
}

export default function AgentChat({ agentId, onBack }: Props) {
  const agent = AGENTS.find(a => a.id === agentId)!
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Fetch opening message on mount
  useEffect(() => {
    async function open() {
      setLoading(true)
      const res = await fetch(`/api/agents/${agentId}/chat`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [] }),
      })
      if (res.ok) {
        const data = await res.json()
        setMessages([{ role: 'assistant', content: data.reply }])
      }
      setLoading(false)
      setTimeout(() => textareaRef.current?.focus(), 100)
    }
    open()
  }, [agentId])

  async function send() {
    if (!input.trim() || sending) return
    const userMessage = input.trim()
    setInput('')
    setSending(true)

    const updated: Message[] = [...messages, { role: 'user', content: userMessage }]
    setMessages(updated)

    const res = await fetch(`/api/agents/${agentId}/chat`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: updated }),
    })

    if (res.ok) {
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
    } else {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Something went wrong. Please try again.',
      }])
    }
    setSending(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  // Highlight the action mandate line at the end of assistant messages
  function renderMessage(content: string) {
    const actionPrefixes = ['Before we talk again:', 'Action step:', 'Share today:', 'One movement today:']
    const lines = content.split('\n')
    return lines.map((line, i) => {
      const isAction = actionPrefixes.some(p => line.trim().startsWith(p))
      return (
        <span key={i} style={{
          display: 'block',
          marginTop: i > 0 && isAction ? 12 : 0,
          fontWeight: isAction ? 600 : 'inherit',
          fontStyle: isAction ? 'italic' : 'inherit',
        }}>
          {line}
        </span>
      )
    })
  }

  return (
    <div className="session-layout">

      {/* Header */}
      <div className="session-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={onBack}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-mono)', fontSize: '0.65rem',
              letterSpacing: '0.1em', color: 'rgba(244,244,240,0.6)',
              padding: 0, textTransform: 'uppercase',
            }}
          >
            ← Back
          </button>
          <div>
            <span className="label" style={{ display: 'block' }}>{agent.name}</span>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: '0.55rem',
              color: 'rgba(244,244,240,0.5)', letterSpacing: '0.08em',
            }}>
              {agent.author}
            </span>
          </div>
        </div>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: '0.55rem',
          color: 'rgba(244,244,240,0.4)', letterSpacing: '0.08em',
          fontStyle: 'italic',
        }}>
          {agent.tagline}
        </span>
      </div>

      {/* Messages */}
      <div className="session-messages">
        {loading && (
          <div style={{ padding: '32px 24px', textAlign: 'center' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--grey-mid)' }}>
              …
            </span>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`message message-${m.role}`}>
            <div className="message-content">
              {m.role === 'assistant' ? renderMessage(m.content) : m.content}
            </div>
          </div>
        ))}
        {sending && (
          <div className="message message-assistant">
            <div className="message-content" style={{ color: 'var(--grey-mid)' }}>…</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="session-input-area">
        <textarea
          ref={textareaRef}
          className="session-textarea"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Reply…"
          rows={2}
          disabled={loading || sending}
        />
        <button
          className="btn btn-primary"
          onClick={send}
          disabled={loading || sending || !input.trim()}
        >
          Send
        </button>
      </div>
    </div>
  )
}
