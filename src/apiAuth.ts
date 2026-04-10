// Prompt Control backend auth token.
// Set VITE_PC_AUTH_TOKEN in .env.local or the environment at build/dev time.
const token = (import.meta as any).env?.VITE_PC_AUTH_TOKEN as string | undefined

export function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return headers
}
