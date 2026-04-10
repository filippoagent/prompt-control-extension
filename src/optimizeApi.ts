import { authHeaders } from './apiAuth'

const API_BASE_URL = 'http://127.0.0.1:4176'
const OPTIMIZE_URL = `${API_BASE_URL}/api/optimize`

export type PromptReturnStyle = 'clarity' | 'technical' | 'execution' | 'strategic-structured' | 'creative'

export async function optimizePromptRemotely(rawPrompt: string, returnStyle: PromptReturnStyle): Promise<string> {
  const response = await fetch(OPTIMIZE_URL, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ rawPrompt, returnStyle }),
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(payload?.error || payload?.message || 'Failed to optimize prompt')
  }

  if (typeof payload?.optimizedPrompt !== 'string') {
    throw new Error('Optimization response was invalid')
  }

  return payload.optimizedPrompt
}
