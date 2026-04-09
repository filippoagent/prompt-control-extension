import { useEffect, useMemo, useState } from 'react'
import { fetchSessions, fetchTaskContext, type SessionSummary, type TaskContextSummary } from './contextApi'
import { composeSendPayload } from './composeSendPayload'
import { sendPrompt } from './sendApi'
import { rewritePrompt, type PromptMode } from './rewriteEngine'

export function App() {
  const [rawPrompt, setRawPrompt] = useState('')
  const [taskContext, setTaskContext] = useState<TaskContextSummary | null>(null)
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [selectedSessionKey, setSelectedSessionKey] = useState('agent:main:main')
  const [contextError, setContextError] = useState<string | null>(null)
  const [sessionsError, setSessionsError] = useState<string | null>(null)
  const [mode, setMode] = useState<PromptMode>('smart')
  const [includeWorkContext, setIncludeWorkContext] = useState(true)
  const [suggestCommands, setSuggestCommands] = useState(true)
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
  }, [])

  const rewriteResult = useMemo(
    () => rewritePrompt({
      rawPrompt,
      mode,
      includeWorkContext,
      suggestCommands,
      taskContext,
    }),
    [rawPrompt, mode, includeWorkContext, suggestCommands, taskContext]
  )

  const sendPayload = useMemo(
    () => composeSendPayload({ rawPrompt, mode, rewriteResult }),
    [rawPrompt, mode, rewriteResult]
  )

  async function tryCopyToClipboard(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      return false
    }
  }

  async function handleCopy() {
    const copied = await tryCopyToClipboard(sendPayload)
    if (copied) {
      setLastDeliveryMode('clipboard-fallback')
      setSendError(null)
      setSendStatus('Copied prompt to clipboard.')
      return
    }
    setSendStatus('Clipboard access was denied. You can still copy the prompt manually from the box below.')
    setSendError(null)
  }

  async function handleSend() {
    if (!sendPayload.trim()) return
    setIsSending(true)
    setSendStatus(null)
    setSendError(null)
    try {
      const result = await sendPrompt({
        prompt: sendPayload,
        sessionKey: selectedSessionKey,
      })
      setLastDeliveryMode(result.delivery)
      if (result.delivery === 'clipboard-fallback') {
        const copied = await tryCopyToClipboard(result.message)
        setSendStatus(
          copied
            ? (result.detail || 'Prompt prepared and copied to clipboard.')
            : `${result.detail || 'Prompt prepared.'} Clipboard access was denied, so copy it manually from the prompt box below.`
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

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', margin: '0 auto', maxWidth: 980, padding: 24 }}>
      <h1>Prompt Control Extension</h1>
      <p>Write naturally, refine with context, preview before sending to Zoro.</p>

      <div style={{ display: 'grid', gap: 16 }}>
        <label>
          <div>Raw prompt</div>
          <textarea
            value={rawPrompt}
            onChange={(e) => setRawPrompt(e.target.value)}
            rows={10}
            style={{ width: '100%', marginTop: 8 }}
            placeholder="Write naturally here..."
          />
        </label>

        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <label>
            Mode:{' '}
            <select value={mode} onChange={(e) => setMode(e.target.value as PromptMode)}>
              <option value="quick">Quick</option>
              <option value="smart">Smart</option>
              <option value="deep">Deep</option>
            </select>
          </label>

          <label>
            Session:{' '}
            <select value={selectedSessionKey} onChange={(e) => setSelectedSessionKey(e.target.value)}>
              {sessions.length === 0 ? (
                <option value="agent:main:main">Main session (fallback)</option>
              ) : sessions.map((session) => (
                <option key={session.sessionKey} value={session.sessionKey}>{session.label}</option>
              ))}
            </select>
          </label>

          <label>
            <input type="checkbox" checked={includeWorkContext} onChange={(e) => setIncludeWorkContext(e.target.checked)} /> Include current work context
          </label>

          <label>
            <input type="checkbox" checked={suggestCommands} onChange={(e) => setSuggestCommands(e.target.checked)} /> Suggest command/workflow style
          </label>
        </div>

        {sessionsError ? <div style={{ color: '#b91c1c' }}>Session list unavailable: {sessionsError}</div> : null}

        <div>
          <h2>Task board context</h2>
          <div style={{ background: '#f4f4f5', padding: 12, borderRadius: 12, marginBottom: 16 }}>
            {contextError ? (
              <div>Context unavailable: {contextError}</div>
            ) : taskContext ? (
              <>
                <div><strong>Current projects:</strong> {taskContext.currentProjects.join(', ') || 'None'}</div>
                <div><strong>Active tasks:</strong> {taskContext.activeTasks.length}</div>
                {taskContext.activeTasks.slice(0, 3).map((task) => (
                  <div key={task.id}>- {task.title}{task.project ? ` (${task.project})` : ''}</div>
                ))}
              </>
            ) : (
              <div>Loading task context...</div>
            )}
          </div>
        </div>

        <div>
          <h2>Refined prompt preview</h2>
          <pre style={{ whiteSpace: 'pre-wrap', background: '#111', color: '#eee', padding: 16, borderRadius: 12, minHeight: 180 }}>
            {rewriteResult.refinedPrompt || 'Your refined prompt preview will appear here.'}
          </pre>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => void handleSend()} disabled={isSending || !sendPayload.trim() || !selectedSessionKey}>
            {isSending ? 'Sending...' : 'Send prompt'}
          </button>
          <button onClick={() => void handleCopy()} disabled={!sendPayload.trim()}>
            Copy prompt
          </button>
          {lastDeliveryMode ? (
            <div style={{ color: '#52525b' }}>
              Delivery mode: {lastDeliveryMode === 'control-chat' ? 'control chat' : 'clipboard fallback'}
            </div>
          ) : null}
          {sendStatus ? <div style={{ color: '#166534' }}>{sendStatus}</div> : null}
          {sendError ? <div style={{ color: '#b91c1c' }}>{sendError}</div> : null}
        </div>

        <div>
          <h2>Prompt to send</h2>
          <pre style={{ whiteSpace: 'pre-wrap', background: '#f4f4f5', color: '#111', padding: 16, borderRadius: 12, minHeight: 120 }}>
            {sendPayload || 'Nothing to send yet.'}
          </pre>
        </div>

        <div>
          <h2>Helper notes</h2>
          <div style={{ background: '#f4f4f5', padding: 12, borderRadius: 12 }}>
            <div><strong>Context used:</strong> {rewriteResult.contextUsed.join(', ') || 'None'}</div>
            {rewriteResult.notes.length ? (
              <ul>
                {rewriteResult.notes.map((note) => <li key={note}>{note}</li>)}
              </ul>
            ) : (
              <div>No special notes.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
