import { useState, useEffect } from 'react'
import { fetchPromptPacks, fetchSessions, fetchTaskContext, type PromptPackSummary, type SessionSummary, type TaskContextSummary } from './contextApi'
import { sendPrompt } from './sendApi'
import { optimizePromptRemotely, type PromptReturnStyle } from './optimizeApi'

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
    <div className="pc-shell">
      <div className="app-shell pc-app-shell">
        <header className="pc-hero pc-panel">
          <div className="pc-hero-overlay" />
          <div className="pc-hero-content">
            <div className="pc-product-pill">
              <span className="pc-product-pill-dot" />
              Prompt Control
            </div>
            <div className="hero-stack pc-hero-stack">
              <div className="pc-hero-copy">
                <h1 className="hero-title pc-hero-title">Prompt Control</h1>
                <p className="pc-hero-subtitle">Write naturally, refine fast, send clean.</p>
                <p className="pc-hero-description">
                  A focused writing surface for turning rough intent into clear, high-leverage prompts before they reach Zoro.
                </p>
              </div>
              <div className="pc-status-grid">
                <StatusPill label="Target session" value={selectedSessionLabel} tone="violet" />
                <StatusPill label="Delivery" value={lastDeliveryMode === 'clipboard-fallback' ? 'Clipboard' : 'Control chat'} tone="blue" />
                <StatusPill label="Optimization" value={isOptimizing ? 'Optimizing…' : optimizedPrompt ? 'Done' : 'Idle'} tone="neutral" />
                <StatusPill label="Style" value={returnStyle} tone="neutral" />
              </div>
            </div>
          </div>
        </header>

        <div className="prompt-grid pc-grid">
          <section className="pc-column">
            <Panel title="Compose" subtitle="Write naturally. The optimizer will refine structure and clarity.">
              <textarea
                value={rawPrompt}
                onChange={(e) => setRawPrompt(e.target.value)}
                rows={16}
                className="pc-textarea"
                placeholder="Tell Zoro what you actually want, in your own words..."
              />

              <div className="field-grid pc-field-grid">
                <Field label="Return style">
                  <select value={returnStyle} onChange={(e) => setReturnStyle(e.target.value as PromptReturnStyle)} className="pc-field-control">
                    <option value="clarity">Clarity</option>
                    <option value="technical">Technical</option>
                    <option value="execution">Execution</option>
                    <option value="strategic-structured">Strategic + Structured</option>
                    <option value="creative">Creative</option>
                  </select>
                </Field>
                <Field label="Send to session">
                  <select value={selectedSessionKey} onChange={(e) => setSelectedSessionKey(e.target.value)} className="pc-field-control">
                    {sessions.length === 0 ? (
                      <option value="agent:main:main">Main session (fallback)</option>
                    ) : sessions.map((session) => (
                      <option key={session.sessionKey} value={session.sessionKey}>{session.label}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="pc-actions-row">
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
                <select value={selectedPromptPackId} onChange={(e) => setSelectedPromptPackId(e.target.value)} className="pc-field-control">
                  <option value="">None</option>
                  {promptPacks.map((pack) => (
                    <option key={pack.id} value={pack.id}>{pack.index}. {pack.title}</option>
                  ))}
                </select>
              </Field>

              {selectedPromptPack ? (
                <InlineNotice tone="neutral">
                  <div className="pc-pack-title">Using prompt pack: {selectedPromptPack.title}</div>
                  <div className="pc-prewrap">{selectedPromptPack.prompt}</div>
                </InlineNotice>
              ) : (
                <InlineNotice tone="neutral">No prompt pack selected. Your prompt will be optimized on its own.</InlineNotice>
              )}
              {promptPacksError ? <InlineNotice tone="error">Prompt packs unavailable: {promptPacksError}</InlineNotice> : null}
              {sessionsError ? <InlineNotice tone="error">Session list unavailable: {sessionsError}</InlineNotice> : null}
              {contextError ? <InlineNotice tone="error">Task context unavailable: {contextError}</InlineNotice> : null}
            </Panel>
          </section>

          <aside className="pc-column">
            <Panel title="Optimized prompt" subtitle="Edit before sending. The final version is what gets delivered." featured>
              <textarea
                value={editableRefinedPrompt}
                onChange={(e) => handleEditableChange(e.target.value)}
                rows={18}
                className="pc-textarea pc-textarea-refined"
                placeholder="Your optimized prompt will appear here, and you can edit it before sending."
              />

              <div className="pc-inline-row">
                <div className={`pc-status-copy ${hasManualEdits ? 'is-accent' : ''}`}>
                  {hasManualEdits ? 'Manual edits active.' : isOptimizing ? 'Optimizing…' : optimizedPrompt ? 'Using optimized version.' : 'Click Optimize to generate a refined prompt.'}
                </div>
                <ActionButton onClick={resetRefinedPrompt} disabled={!hasManualEdits}>
                  Reset
                </ActionButton>
              </div>
            </Panel>

            <Panel title="Send" subtitle="Deliver to Zoro or copy to clipboard.">
              <div className="pc-actions-row">
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

function Panel({ title, subtitle, children, featured = false }: { title: string; subtitle: string; children: React.ReactNode; featured?: boolean }) {
  return (
    <section className={`pc-panel pc-section-panel ${featured ? 'is-featured' : ''}`}>
      <div className="pc-panel-header">
        <div className="pc-panel-title">{title}</div>
        <div className="pc-panel-subtitle">{subtitle}</div>
      </div>
      {children}
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="pc-field">
      <span className="pc-field-label">{label}</span>
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
      className={`pc-button ${primary ? 'is-primary' : 'is-secondary'}`}
    >
      {children}
    </button>
  )
}

function InlineNotice({ children, tone }: { children: React.ReactNode; tone: 'success' | 'error' | 'neutral' }) {
  return (
    <div className={`pc-notice is-${tone}`}>
      {children}
    </div>
  )
}

function StatusPill({ label, value, tone }: { label: string; value: string; tone: 'violet' | 'blue' | 'neutral' }) {
  return (
    <div className={`pc-status-pill is-${tone}`}>
      <div className="pc-status-pill-label">{label}</div>
      <div className="pc-status-pill-value">{value}</div>
    </div>
  )
}
