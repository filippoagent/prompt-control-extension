import { resolveGatewayBaseUrl, resolveGatewayBearerSecret } from './gateway-config.mjs'

function buildAuthHeaders() {
  const secret = resolveGatewayBearerSecret()
  return secret ? { Authorization: `Bearer ${secret}` } : {}
}

export async function sendPromptToGatewayHttp(prompt, sessionKey) {
  const text = typeof prompt === 'string' ? prompt.trim() : ''
  const resolvedSessionKey = typeof sessionKey === 'string' ? sessionKey.trim() : ''
  if (!text) throw new Error('Prompt is required')
  if (!resolvedSessionKey) throw new Error('Session key is required')

  const response = await fetch(`${resolveGatewayBaseUrl()}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...buildAuthHeaders(),
      'x-openclaw-session-key': resolvedSessionKey,
    },
    body: JSON.stringify({
      model: 'openclaw/default',
      messages: [
        {
          role: 'user',
          content: text,
        },
      ],
      stream: false,
    }),
  })

  const data = await response.json().catch(() => null)
  if (!response.ok) {
    const message = data?.error?.message || data?.message || `Gateway HTTP send failed (${response.status})`
    throw new Error(message)
  }

  return {
    ok: true,
    delivery: 'control-chat',
    message: text,
    detail: 'Prompt sent through Gateway HTTP chat completions.',
    run: {
      status: 'ok',
    },
    response: data,
  }
}
