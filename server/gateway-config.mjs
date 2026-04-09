import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

function readOpenClawConfig() {
  try {
    const configPath = path.join(os.homedir(), '.openclaw', 'openclaw.json')
    const raw = fs.readFileSync(configPath, 'utf8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function resolveGatewayBaseUrl() {
  return process.env.OPENCLAW_GATEWAY_HTTP_URL || 'http://127.0.0.1:18789'
}

export function resolveGatewayBearerSecret() {
  if (process.env.OPENCLAW_GATEWAY_TOKEN?.trim()) return process.env.OPENCLAW_GATEWAY_TOKEN.trim()
  if (process.env.OPENCLAW_GATEWAY_PASSWORD?.trim()) return process.env.OPENCLAW_GATEWAY_PASSWORD.trim()

  const cfg = readOpenClawConfig()
  const mode = cfg?.gateway?.auth?.mode
  if (mode === 'token' && typeof cfg?.gateway?.auth?.token === 'string' && cfg.gateway.auth.token.trim()) {
    return cfg.gateway.auth.token.trim()
  }
  if (mode === 'password' && typeof cfg?.gateway?.auth?.password === 'string' && cfg.gateway.auth.password.trim()) {
    return cfg.gateway.auth.password.trim()
  }
  return null
}
