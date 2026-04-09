import { resolveGatewayBaseUrl, resolveGatewayBearerSecret } from './gateway-config.mjs'

function buildAuthHeaders() {
  const secret = resolveGatewayBearerSecret()
  return secret ? { Authorization: `Bearer ${secret}` } : {}
}

function extractSessionArray(payload) {
  if (Array.isArray(payload)) return payload
  if (payload && typeof payload === 'object') {
    if (Array.isArray(payload.sessions)) return payload.sessions
    if (Array.isArray(payload.items)) return payload.items
    if (Array.isArray(payload.data)) return payload.data
    if (payload.details && typeof payload.details === 'object') return extractSessionArray(payload.details)
    if (payload.result && typeof payload.result === 'object') return extractSessionArray(payload.result)
    if (payload.content && Array.isArray(payload.content)) {
      for (const item of payload.content) {
        if (item && typeof item === 'object' && typeof item.text === 'string') {
          try {
            const parsed = JSON.parse(item.text)
            const extracted = extractSessionArray(parsed)
            if (extracted.length > 0) return extracted
          } catch {
            // ignore non-JSON content items
          }
        }
      }
    }
  }
  return []
}

function formatActivityLabel(value) {
  const timestamp = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(timestamp) || timestamp <= 0) return null
  return new Date(timestamp).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function buildSessionBaseLabel(raw, sessionKey, isMain) {
  if (isMain) return 'Main session'
  if (typeof raw.label === 'string' && raw.label.trim()) return raw.label.trim()
  if (typeof raw.title === 'string' && raw.title.trim()) return raw.title.trim()
  if (typeof raw.name === 'string' && raw.name.trim()) return raw.name.trim()
  if (typeof raw.displayName === 'string' && raw.displayName.trim()) return raw.displayName.trim()
  return sessionKey
}

function normalizeSession(raw) {
  if (!raw || typeof raw !== 'object') return null

  const sessionKey = [raw.sessionKey, raw.id, raw.key]
    .find((value) => typeof value === 'string' && value.trim())

  if (!sessionKey) return null

  const isMain = raw.isMain === true
    || raw.main === true
    || raw.pinned === true
    || sessionKey === 'agent:main:main'

  const kind = typeof raw.kind === 'string' ? raw.kind : null
  const updatedAtRaw = [raw.lastActivityAt, raw.updatedAt, raw.createdAt]
    .find((value) => (typeof value === 'string' && value.trim()) || typeof value === 'number') || null
  const updatedAtMs = typeof updatedAtRaw === 'number' ? updatedAtRaw : Number(updatedAtRaw)
  const activityLabel = formatActivityLabel(updatedAtRaw)
  const parentSessionKey = typeof raw.parentSessionKey === 'string' ? raw.parentSessionKey : null
  const isSubagent = sessionKey.includes(':subagent:') || Boolean(parentSessionKey)

  const suffixParts = [
    isSubagent ? 'subagent' : null,
    !isMain && kind && kind !== 'other' ? kind : null,
    activityLabel ? `active ${activityLabel}` : null,
  ].filter(Boolean)

  return {
    sessionKey,
    label: suffixParts.length > 0
      ? `${buildSessionBaseLabel(raw, sessionKey, isMain)} (${suffixParts.join(' · ')})`
      : buildSessionBaseLabel(raw, sessionKey, isMain),
    isMain,
    isSubagent,
    updatedAtMs: Number.isFinite(updatedAtMs) ? updatedAtMs : 0,
  }
}

function sortSessions(a, b) {
  if (a.isMain && !b.isMain) return -1
  if (!a.isMain && b.isMain) return 1
  if (!a.isSubagent && b.isSubagent) return -1
  if (a.isSubagent && !b.isSubagent) return 1
  if (a.updatedAtMs !== b.updatedAtMs) return b.updatedAtMs - a.updatedAtMs
  return a.label.localeCompare(b.label)
}

export async function fetchGatewaySessions() {
  const response = await fetch(`${resolveGatewayBaseUrl()}/tools/invoke`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...buildAuthHeaders(),
    },
    body: JSON.stringify({
      tool: 'sessions_list',
      action: 'json',
      args: {},
      sessionKey: 'main',
    }),
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok || payload?.ok === false) {
    const message = payload?.error?.message || payload?.message || `Failed to fetch sessions (${response.status})`
    throw new Error(message)
  }

  const normalized = extractSessionArray(payload)
    .map(normalizeSession)
    .filter(Boolean)
    .sort(sortSessions)

  const primarySessions = normalized.filter((session) => !session.isSubagent)
  const visibleSessions = primarySessions.length > 0 ? primarySessions : normalized

  return visibleSessions.map(({ sessionKey, label }) => ({ sessionKey, label }))
}
