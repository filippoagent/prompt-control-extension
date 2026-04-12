import { useState, useEffect } from 'react'
import { fetchPromptPacks, fetchSessions, fetchTaskContext, type PromptPackSummary, type SessionSummary, type TaskContextSummary } from './contextApi'
import { sendPrompt } from './sendApi'
import { optimizePromptRemotely, type PromptReturnStyle } from './optimizeApi'

const shellBackground = {
  background: `
    radial-gradient(circle at 18% 18%, rgba(168, 85, 247, 0.20), transparent 28%),
    radial-gradient(circle at 82% 0%, rgba(96, 165, 250, 0.16), transparent 24%),
    radial-gradient(circle at 50% 100%, rgba(244, 114, 182, 0.10), transparent 30%),
    linear-gradient(180deg, #131a2b 0%, #0f1726 100%)
  `,
  minHeight: '100vh',
  color: '#f8fafc',
}

const panelStyle = {
  background: 'rgba(30, 41, 59, 0.68)',
  border: '1px solid rgba(255,255,255,0.10)',
  boxShadow: '0 20px 60px rgba(15, 23, 42, 0.28)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
}

const pillBase = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  borderRadius: 999,
  padding: '8px 14px',
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.05)',
  color: '#cbd5e1',
  fontSize: 13,
}

export function App() {
  const [rawPrompt, setRawPrompt] = useState('')
  const [taskContext, setTaskContext] = useState<TaskContextSummary | null>(null)
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [promptPacks, setPromptPacks] = useState<PromptPackSummary[]>([])
  const [selectedPromptPackId, setSelectedPromptPackId] = useState('')
  const [selectedSessionKey, setSelectedSessionKey] = useState('agent:main:main')
  const [contextError, setContextError] = useState<string | null>(null)
  const [sessionsError, setSessionsError] = useState<string | null>(null)
  const [promptPacksError, setPromptPacksError] = useState<string | null>(null)
  const [editableRefinedPrompt, setEditableRefinedPrompt] = useState('')
  const [optimizedPrompt, setOptimizedPrompt] = useState('')
  const [returnStyle, setReturnStyle] = useState<PromptReturnStyle>('technical')
  const [hasManualEdits, setHasManualEdits] = useState(false)
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [sendStatus, setSendStatus] = useState<string | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  const [lastDeliveryMode, setLastDeliveryMode] = useState<'control-chat' | 'clipboard-fallback' | null>(null)
  const [isSending, setIsSending] = useState(false)

  useEffect(() => {
    void fetchTaskContext()
      .then((data) => {
        setTaskContext(data)
        setContextError(null)
      })
      .catch((error) => {
        setContextError(error instanceof Error ? error.message : 'Failed to load task context')
      })

    void fetchSessions()
      .then((data) => {
        setSessions(data)
        setSessionsError(null)
        if (data.length === 0) {
          setSelectedSessionKey('agent:main:main')
          return
        }

        setSelectedSessionKey((current) => {
          const preferredMain = data.find((session) => session.sessionKey === 'agent:main:main')
          if (preferredMain) {
            if (current === 'agent:main:main') return current
            if (!data.some((session) => session.sessionKey === current)) return preferredMain.sessionKey
            return current
          }
          if (data.some((session) => session.sessionKey === current)) return current
          return data[0].sessionKey
        })
      })
      .catch((error) => {
        setSessionsError(error instanceof Error ? error.message : 'Failed to load sessions')
      })

    void fetchPromptPacks()
      .then((data) => {
        setPromptPacks(data)
        setPromptPacksError(null)
      })
      .catch((error) => {
        setPromptPacksError(error instanceof Error ? error.message : 'Failed to load prompt packs')
      })
  }, [])

  useEffect(() => {
    if (!rawPrompt.trim()) {
      setOptimizedPrompt('')
      setEditableRefinedPrompt('')
      setHasManualEdits(false)
    }
  }, [rawPrompt])

  const finalPrompt = editableRefinedPrompt

  const selectedSessionLabel = sessions.find((session) => session.sessionKey === selectedSessionKey)?.label ?? 'Main session'
  const selectedPromptPack = promptPacks.find((pack) => pack.id === selectedPromptPackId) ?? null

  async function tryCopyToClipboard(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      return false
    }
  }

  async function handleCopy() {
    const copied = await tryCopyToClipboard(finalPrompt)
    if (copied) {
      setLastDeliveryMode('clipboard-fallback')
      setSendError(null)
      setSendStatus('Copied refined prompt to clipboard.')
      return
    }
    setSendStatus('Clipboard access was denied. You can still copy the refined prompt manually.')
    setSendError(null)
  }

  async function handleSend() {
    if (!finalPrompt.trim()) return
    setIsSending(true)
    setSendStatus(null)
    setSendError(null)
    try {
      const result = await sendPrompt({
        prompt: finalPrompt,
        sessionKey: selectedSessionKey,
      })
      setLastDeliveryMode(result.delivery)
      if (result.delivery === 'clipboard-fallback') {
        const copied = await tryCopyToClipboard(result.message)
        setSendStatus(
          copied
            ? (result.detail || 'Prompt prepared and copied to clipboard.')
            : `${result.detail || 'Prompt prepared.'} Clipboard access was denied, so copy the refined prompt manually.`
        )
      } else {
        setSendStatus(result.detail || 'Prompt sent to Zoro.')
        setSendError(null)
      }
    } catch (error) {
      setSendStatus(null)
      setSendError(error instanceof Error ? error.message : 'Failed to send prompt')
    } finally {
      setIsSending(false)
    }
  }

  function handleEditableChange(next: string) {
    setEditableRefinedPrompt(next)
    setHasManualEdits(true)
  }

  async function handleOptimize() {
    if (!rawPrompt.trim()) return
    setIsOptimizing(true)
    setSendStatus(null)
    setSendError(null)
    try {
      const composedPrompt = selectedPromptPack
        ? `${selectedPromptPack.prompt}\n\nUser request:\n${rawPrompt.trim()}`
        : rawPrompt

      const result = await optimizePromptRemotely(composedPrompt, returnStyle)
      setOptimizedPrompt(result)
      setEditableRefinedPrompt(result)
      setHasManualEdits(false)
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'Failed to optimize prompt')
    } finally {
      setIsOptimizing(false)
    }
  }

  function resetRefinedPrompt() {
    setEditableRefinedPrompt(optimizedPrompt)
    setHasManualEdits(false)
  }

  return (
    <div style={shellBackground}>
      <div className="app-shell" style={{ margin: '0 auto', maxWidth: 1360, padding: '24px 20px 40px' }}>
        <header style={{ ...panelStyle, borderRadius: 22, padding: 14, marginBottom: 14, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(124,58,237,0.10), transparent 45%, rgba(59,130,246,0.08))', pointerEvents: 'none' }} />
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ ...pillBase, width: 'fit-content', padding: '6px 10px', fontSize: 11, background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(167,139,250,0.22)', color: '#ddd6fe' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#a78bfa', boxShadow: '0 0 12px rgba(167,139,250,0.6)' }} />
              Prompt Control
            </div>
            <div className="hero-stack" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <div style={{ maxWidth: 520 }}>
                <h1 className="hero-title" style={{ margin: 0, fontSize: '1.6rem', lineHeight: 1.06, letterSpacing: '-0.02em' }}>Prompt Control</h1>
                <p style={{ margin: '4px 0 0', color: '#dbe4f0', fontSize: 13, lineHeight: 1.45 }}>
                  Write naturally, refine fast, send clean.
                </p>
              </div>
              <div style={{ display: 'grid', gap: 8, minWidth: 220, alignContent: 'start' }}>
                <StatusPill label="Target session" value={selectedSessionLabel} tone="violet" />
                <StatusPill label="Delivery" value={lastDeliveryMode === 'clipboard-fallback' ? 'Clipboard' : 'Control chat'} tone="blue" />
                <StatusPill label="Optimization" value={isOptimizing ? 'Optimizing…' : optimizedPrompt ? 'Done' : 'Idle'} tone="neutral" />
                <StatusPill label="Style" value={returnStyle} tone="neutral" />
              </div>
            </div>
          </div>
        </header>

        <div className="prompt-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.05fr) minmax(360px, 0.95fr)', gap: 18, alignItems: 'start' }}>
          <section style={{ display: 'grid', gap: 24 }}>
            <Panel title="Compose" subtitle="Write naturally. The optimizer will refine structure and clarity.">
              <textarea
                value={rawPrompt}
                onChange={(e) => setRawPrompt(e.target.value)}
                rows={16}
                style={textAreaStyle}
                placeholder="Tell Zoro what you actually want, in your own words..."
              />

              <div className="field-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14, marginTop: 18 }}>
                <Field label="Return style">
                  <select value={returnStyle} onChange={(e) => setReturnStyle(e.target.value as PromptReturnStyle)} style={fieldStyle}>
                    <option value="clarity">Clarity</option>
                    <option value="technical">Technical</option>
                    <option value="execution">Execution</option>
                    <option value="strategic-structured">Strategic + Structured</option>
                    <option value="creative">Creative</option>
                  </select>
                </Field>
                <Field label="Send to session">
                  <select value={selectedSessionKey} onChange={(e) => setSelectedSessionKey(e.target.value)} style={fieldStyle}>
                    {sessions.length === 0 ? (
                      <option value="agent:main:main">Main session (fallback)</option>
                    ) : sessions.map((session) => (
                      <option key={session.sessionKey} value={session.sessionKey}>{session.label}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 18 }}>
                <ActionButton onClick={() => void handleOptimize()} disabled={isOptimizing || !rawPrompt.trim()} primary>
                  {isOptimizing ? 'Optimizing…' : 'Optimize'}
                </ActionButton>
              </div>

              {promptPacksError ? <InlineNotice tone="error">Prompt packs unavailable: {promptPacksError}</InlineNotice> : null}
              {sessionsError ? <InlineNotice tone="error">Session list unavailable: {sessionsError}</InlineNotice> : null}
              {contextError ? <InlineNotice tone="error">Task context unavailable: {contextError}</InlineNotice> : null}
            </Panel>

            <Panel title="Prompt pack" subtitle="Choose a God Mode framework to shape how your request gets optimized.">
              <Field label="Selected pack">
                <select value={selectedPromptPackId} onChange={(e) => setSelectedPromptPackId(e.target.value)} style={fieldStyle}>
                  <option value="">None</option>
                  {promptPacks.map((pack) => (
                    <option key={pack.id} value={pack.id}>{pack.index}. {pack.title}</option>
                  ))}
                </select>
              </Field>

              {selectedPromptPack ? (
                <InlineNotice tone="neutral">
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>Using prompt pack: {selectedPromptPack.title}</div>
                  <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{selectedPromptPack.prompt}</div>
                </InlineNotice>
              ) : (
                <InlineNotice tone="neutral">No prompt pack selected. Your prompt will be optimized on its own.</InlineNotice>
              )}
              {promptPacksError ? <InlineNotice tone="error">Prompt packs unavailable: {promptPacksError}</InlineNotice> : null}
              {sessionsError ? <InlineNotice tone="error">Session list unavailable: {sessionsError}</InlineNotice> : null}
              {contextError ? <InlineNotice tone="error">Task context unavailable: {contextError}</InlineNotice> : null}
            </Panel>
          </section>

          <aside style={{ display: 'grid', gap: 24 }}>
            <Panel title="Optimized prompt" subtitle="Edit before sending. The final version is what gets delivered.">
              <textarea
                value={editableRefinedPrompt}
                onChange={(e) => handleEditableChange(e.target.value)}
                rows={18}
                style={refinedTextAreaStyle}
                placeholder="Your optimized prompt will appear here, and you can edit it before sending."
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
                <div style={{ color: hasManualEdits ? '#ddd6fe' : '#94a3b8', fontSize: 13 }}>
                  {hasManualEdits ? 'Manual edits active.' : isOptimizing ? 'Optimizing…' : optimizedPrompt ? 'Using optimized version.' : 'Click Optimize to generate a refined prompt.'}
                </div>
                <ActionButton onClick={resetRefinedPrompt} disabled={!hasManualEdits}>
                  Reset
                </ActionButton>
              </div>
            </Panel>

            <Panel title="Send" subtitle="Deliver to Zoro or copy to clipboard.">
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <ActionButton onClick={() => void handleSend()} disabled={isSending || !finalPrompt.trim() || !selectedSessionKey} primary>
                  {isSending ? 'Sending…' : 'Send to Zoro'}
                </ActionButton>
                <ActionButton onClick={() => void handleCopy()} disabled={!finalPrompt.trim()}>
                  Copy
                </ActionButton>
              </div>

              {sendStatus ? <InlineNotice tone="success">{sendStatus}</InlineNotice> : null}
              {sendError ? <InlineNotice tone="error">{sendError}</InlineNotice> : null}
            </Panel>
          </aside>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// UI Components
// ============================================================================

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section style={{ ...panelStyle, borderRadius: 24, padding: 20 }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#a5b4c7' }}>{title}</div>
        <div style={{ marginTop: 6, color: '#d7e1ee', lineHeight: 1.6, fontSize: 14 }}>{subtitle}</div>
      </div>
      {children}
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'grid', gap: 8 }}>
      <span style={{ fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#94a3b8' }}>{label}</span>
      {children}
    </label>
  )
}

function ActionButton({ children, onClick, disabled, primary = false }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        borderRadius: 999,
        padding: '12px 18px',
        letterSpacing: '0.01em',
        border: primary ? '1px solid rgba(167,139,250,0.35)' : '1px solid rgba(255,255,255,0.1)',
        background: disabled
          ? 'rgba(255,255,255,0.06)'
          : primary
            ? 'linear-gradient(135deg, rgba(124,58,237,0.38), rgba(59,130,246,0.22))'
            : 'rgba(255,255,255,0.06)',
        color: disabled ? '#64748b' : '#f8fafc',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontWeight: 600,
        boxShadow: primary && !disabled ? '0 18px 36px rgba(76, 29, 149, 0.25)' : 'none',
      }}
    >
      {children}
    </button>
  )
}

function InlineNotice({ children, tone }: { children: React.ReactNode; tone: 'success' | 'error' | 'neutral' }) {
  const palette = tone === 'success'
    ? { color: '#bbf7d0', border: 'rgba(34,197,94,0.2)', background: 'rgba(34,197,94,0.10)' }
    : tone === 'error'
      ? { color: '#fecaca', border: 'rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.10)' }
      : { color: '#cbd5e1', border: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)' }

  return (
    <div style={{ marginTop: 16, borderRadius: 18, padding: '12px 14px', border: `1px solid ${palette.border}`, background: palette.background, color: palette.color }}>
      {children}
    </div>
  )
}

function StatusPill({ label, value, tone }: { label: string; value: string; tone: 'violet' | 'blue' | 'neutral' }) {
  const palette = tone === 'violet'
    ? { background: 'rgba(124,58,237,0.16)', border: 'rgba(167,139,250,0.25)', color: '#ede9fe' }
    : tone === 'blue'
      ? { background: 'rgba(59,130,246,0.14)', border: 'rgba(125,211,252,0.22)', color: '#dbeafe' }
      : { background: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.08)', color: '#e2e8f0' }

  return (
    <div style={{ borderRadius: 16, padding: '8px 10px', border: `1px solid ${palette.border}`, background: palette.background }}>
      <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#94a3b8' }}>{label}</div>
      <div style={{ marginTop: 4, color: palette.color, fontWeight: 600, fontSize: 13, lineHeight: 1.3 }}>{value}</div>
    </div>
  )
}

// ============================================================================
// Styles
// ============================================================================

const fieldStyle: React.CSSProperties = {
  width: '100%',
  borderRadius: 16,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.08)',
  color: '#f8fafc',
  padding: '13px 15px',
  outline: 'none',
  fontSize: 15,
}

const textAreaStyle: React.CSSProperties = {
  width: '100%',
  borderRadius: 20,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.07)',
  color: '#f8fafc',
  padding: 18,
  outline: 'none',
  resize: 'vertical',
  lineHeight: 1.75,
  fontSize: 17,
  boxSizing: 'border-box',
}

const refinedTextAreaStyle: React.CSSProperties = {
  width: '100%',
  borderRadius: 20,
  border: '1px solid rgba(192, 132, 252, 0.20)',
  background: 'rgba(15, 23, 42, 0.78)',
  color: '#edf2f7',
  padding: 18,
  outline: 'none',
  resize: 'vertical',
  lineHeight: 1.8,
  fontSize: 16,
  minHeight: 320,
  boxSizing: 'border-box',
}
