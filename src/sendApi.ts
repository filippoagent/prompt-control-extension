export type SendPromptPayload = {
  prompt: string
  sessionKey: string
}

export type SendPromptResult = {
  ok: true
  delivery: 'control-chat' | 'clipboard-fallback'
  message: string
  detail?: string
  run?: {
    runId?: string
    status?: string
  }
}

import { authHeaders } from './apiAuth'

const API_BASE_URL = 'http://127.0.0.1:4176'
const SEND_URL = `${API_BASE_URL}/api/send`
const LEGACY_SEND_URL = `${API_BASE_URL}/send`

async function postJson(url: string, payload: SendPromptPayload) {
  return fetch(url, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  })
}

export async function sendPrompt(payload: SendPromptPayload): Promise<SendPromptResult> {
  let response = await postJson(SEND_URL, payload)
  if (response.status === 404) {
    response = await postJson(LEGACY_SEND_URL, payload)
  }

  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(data?.error || 'Failed to send prompt')
  }

  return data as SendPromptResult
}
