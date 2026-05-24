import { useState } from 'react'

type CCStage = 'intro' | 'surface' | 'medium' | 'deep' | 'mirror'

interface CCItem { text: string }
interface AnswerEntry { stage: string; question: string; answer: string }

interface Props {
  onBack: () => void
}

const STAGE_LABELS: Record<CCStage, string> = {
  intro:  'Bring your dilemma',
  surface: 'Surface questions',
  medium:  'Deeper questions',
  deep:    'Soul-level questions',
  mirror:  'What the committee noticed',
}

const STAGE_INTROS: Partial<Record<CCStage, string>> = {
  surface: 'The committee begins with the facts. Answer each question honestly. There is no right answer — only your answer.',
  medium:  'The committee goes deeper. Take your time. You do not need to answer quickly.',
  deep:    'Soul-level questions. Let them sit before you answer. What comes up first is usually true.',
  mirror:  'The committee offers two observations — not judgments, not advice. Simply what was noticed in what you wrote and how you wrote it.',
}

export default function ClearnessCommittee({ onBack }: Props) {
  const [stage, setStage] = useState<CCStage>('intro')
  const [loading, setLoading] = useState(false)
  const [dilemma, setDilemma] = useState('')
  const [questions, setQuestions] = useState<CCItem[]>([])
  const [currentAnswers, setCurrentAnswers] = useState<string[]>(['', '', ''])
  const [history, setHistory] = useState<AnswerEntry[]>([])
  const [observations, setObservations] = useState<CCItem[]>([])

  const STAGES: CCStage[] = ['surface', 'medium', 'deep', 'mirror']
  const stageIndex = STAGES.indexOf(stage)

  async function fetchStage(nextStage: CCStage, updatedHistory: AnswerEntry[]) {
    setLoading(true)
    setStage(nextStage)
    setCurrentAnswers(['', '', ''])
    const res = await fetch('/api/tools/clearness', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: nextStage, dilemma, history: updatedHistory }),
    })
    if (res.ok) {
      const data = await res.json()
      if (nextStage === 'mirror') {
        setObservations(data.items || [])
      } else {
        setQuestions(data.items || [])
      }
    }
    setLoading(false)
  }

  function handleBegin() {
    if (!dilemma.trim()) return
    fetchStage('surface', [])
  }

  function handleContinue(nextStage: CCStage | 'mirror') {
    const updatedHistory: AnswerEntry[] = [
      ...history,
      ...questions.map((q, i) => ({
        stage,
        question: q.text,
        answer: currentAnswers[i] || '',
      }))
    ]
    setHistory(updatedHistory)
    fetchStage(nextStage as CCStage, updatedHistory)
  }

  function updateAnswer(i: number, val: string) {
    setCurrentAnswers(prev => {
      const next = [...prev]
      next[i] = val
      return next
    })
  }

  const answersComplete = questions.length > 0 &&
    currentAnswers.slice(0, questions.length).every(a => a.trim().length > 0)

  // ── INTRO ────────────────────────────────────────────────────
  if (stage === 'intro') {
    return (
      <div className="session-layout">
        <div className="session-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button onClick={onBack} style={backBtnStyle}>← Back</button>
            <span className="label">Clearness Committee</span>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: 'rgba(244,244,240,0.4)', fontStyle: 'italic' }}>
            9 questions · 2 observations · no advice given
          </span>
        </div>

        <div style={{ padding: '32px 24px', maxWidth: 560, margin: '0 auto' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--grey-mid)', lineHeight: 1.7, marginBottom: 24 }}>
            The committee will ask you nine questions — surface, medium, and deep — then offer two observations about what they noticed in your answers. The committee gives no advice. Only questions. Your answers are the work.
          </p>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--grey-mid)', lineHeight: 1.7, marginBottom: 32 }}>
            Describe the dilemma you are bringing. Be specific. What is the actual decision, situation, or tension you need clarity on?
          </p>

          <textarea
            value={dilemma}
            onChange={e => setDilemma(e.target.value)}
            placeholder="Describe your dilemma…"
            rows={6}
            style={textareaStyle}
            autoFocus
          />

          <div style={{ textAlign: 'right', marginTop: 12 }}>
            <button
              className="btn btn-primary"
              onClick={handleBegin}
              disabled={!dilemma.trim()}
            >
              Bring this to the committee →
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── MIRROR ───────────────────────────────────────────────────
  if (stage === 'mirror') {
    return (
      <div className="session-layout">
        <div className="session-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button onClick={onBack} style={backBtnStyle}>← Back</button>
            <span className="label">Clearness Committee</span>
          </div>
          <span style={stagePillStyle}>Mirroring</span>
        </div>

        <div style={{ padding: '32px 24px', maxWidth: 560, margin: '0 auto' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--grey-mid)', lineHeight: 1.7, marginBottom: 28 }}>
            {STAGE_INTROS.mirror}
          </p>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 32 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--grey-mid)' }}>The committee is reflecting…</span>
            </div>
          ) : (
            <div>
              {observations.map((obs, i) => (
                <div key={i} style={{
                  border: '2px solid var(--black)',
                  boxShadow: '3px 3px 0 var(--black)',
                  padding: '16px 18px',
                  marginBottom: 16,
                  background: 'var(--bg)',
                }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.5rem', color: 'var(--grey-mid)', letterSpacing: '0.1em', marginBottom: 8, textTransform: 'uppercase' }}>
                    Observation {i + 1}
                  </div>
                  <p style={{ fontSize: '0.8rem', lineHeight: 1.6, margin: 0, fontStyle: 'italic' }}>{obs.text}</p>
                </div>
              ))}

              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--grey-mid)', lineHeight: 1.7, marginTop: 24 }}>
                The committee is now closed. The clarity you seek may arrive in the hours and days that follow — not necessarily right now.
              </p>

              <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
                <button className="btn" onClick={() => { setStage('intro'); setDilemma(''); setHistory([]); setObservations([]) }}>
                  New dilemma
                </button>
                <button className="btn" onClick={onBack}>Return to dashboard</button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── QUESTION STAGES (surface / medium / deep) ────────────────
  const nextStageMap: Record<string, CCStage | 'mirror'> = {
    surface: 'medium',
    medium: 'deep',
    deep: 'mirror',
  }

  return (
    <div className="session-layout">
      <div className="session-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={onBack} style={backBtnStyle}>← Back</button>
          <span className="label">Clearness Committee</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {STAGES.slice(0, 3).map((s, i) => (
            <div key={s} style={{
              width: 8, height: 8,
              background: stageIndex >= i ? 'rgba(244,244,240,0.8)' : 'rgba(244,244,240,0.2)',
              border: '1px solid rgba(244,244,240,0.4)',
            }} />
          ))}
        </div>
      </div>

      <div style={{ padding: '32px 24px', maxWidth: 560, margin: '0 auto' }}>
        <div style={{ marginBottom: 20 }}>
          <span style={stagePillStyle}>{STAGE_LABELS[stage]}</span>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--grey-mid)', lineHeight: 1.7, marginTop: 10, marginBottom: 0 }}>
            {STAGE_INTROS[stage]}
          </p>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--grey-mid)' }}>The committee is listening…</span>
          </div>
        ) : (
          <div>
            {questions.map((q, i) => (
              <div key={i} style={{ marginBottom: 28 }}>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: '0.5rem',
                  color: 'var(--grey-mid)', letterSpacing: '0.1em',
                  textTransform: 'uppercase', marginBottom: 6,
                }}>
                  Question {i + 1}
                </div>
                <p style={{ fontSize: '0.8rem', lineHeight: 1.6, marginBottom: 10, fontStyle: 'italic' }}>
                  {q.text}
                </p>
                <textarea
                  value={currentAnswers[i] || ''}
                  onChange={e => updateAnswer(i, e.target.value)}
                  placeholder="Your answer…"
                  rows={3}
                  style={textareaStyle}
                />
              </div>
            ))}

            {questions.length > 0 && (
              <div style={{ textAlign: 'right', marginTop: 8 }}>
                <button
                  className="btn btn-primary"
                  onClick={() => handleContinue(nextStageMap[stage] as CCStage)}
                  disabled={!answersComplete}
                >
                  {nextStageMap[stage] === 'mirror' ? 'Request mirroring →' : 'Continue →'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const backBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  fontFamily: 'var(--font-mono)', fontSize: '0.65rem',
  letterSpacing: '0.1em', color: 'rgba(244,244,240,0.6)',
  padding: 0, textTransform: 'uppercase',
}

const stagePillStyle: React.CSSProperties = {
  display: 'inline-block',
  fontFamily: 'var(--font-mono)', fontSize: '0.5rem',
  letterSpacing: '0.12em', textTransform: 'uppercase',
  color: 'rgba(244,244,240,0.7)',
}

const textareaStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  fontFamily: 'var(--font-mono)', fontSize: '0.75rem',
  lineHeight: 1.6, padding: '10px 12px',
  border: '1.5px solid var(--grey-mid)',
  background: 'var(--bg)', color: 'var(--black)',
  resize: 'vertical', outline: 'none',
}
