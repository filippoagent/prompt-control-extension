import http from 'node:http'
import { loadTaskBoardSummary } from './task-context-store.mjs'
import { sendPromptToGatewayHttp } from './gateway-http-bridge.mjs'
import { fetchGatewaySessions } from './gateway-rpc-http.mjs'
import { optimizePromptViaSkill } from './optimize-service.mjs'

function listFallbackSessions() {
  return [
    { sessionKey: 'agent:main:main', label: 'Main session (fallback)' },
  ]
}

const HOST = '127.0.0.1'
const PORT = 4176

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store'
  })
  res.end(JSON.stringify(payload))
}

async function readJsonBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString('utf8').trim()
  if (!raw) return {}
  return JSON.parse(raw)
}

async function formatSendResult(payload) {
  const prompt = typeof payload.prompt === 'string' ? payload.prompt.trim() : ''
  const sessionKey = typeof payload.sessionKey === 'string' ? payload.sessionKey.trim() : ''
  if (!prompt) throw new Error('Prompt is required')
  if (!sessionKey) throw new Error('Session key is required')

  try {
    return await sendPromptToGatewayHttp(prompt, sessionKey)
  } catch (error) {
    return {
      ok: true,
      delivery: 'clipboard-fallback',
      message: prompt,
      detail: error instanceof Error
        ? `Direct control-chat delivery failed, fallback prepared: ${error.message}`
        : 'Direct control-chat delivery failed, fallback prepared.',
    }
  }
}

function summarizeBoard(board) {
  const tasks = board.tasks ?? []
  const active = tasks.filter((task) => !task.archived && task.status === 'doing').slice(0, 5)
  const blocked = tasks.filter((task) => !task.archived && task.status === 'blocked').slice(0, 5)
  const recentDone = tasks.filter((task) => !task.archived && task.status === 'done').slice(0, 5)

  const projects = [...new Set(active.map((task) => task.project).filter(Boolean))]

  return {
    activeTasks: active.map((task) => ({
      id: task.id,
      title: task.title,
      project: task.project ?? null,
      assignee: task.assignee,
      updatedAt: task.updatedAt,
      tags: task.tags ?? []
    })),
    blockedTasks: blocked.map((task) => ({
      id: task.id,
      title: task.title,
      project: task.project ?? null,
      assignee: task.assignee,
      updatedAt: task.updatedAt,
      tags: task.tags ?? []
    })),
    recentDone: recentDone.map((task) => ({
      id: task.id,
      title: task.title,
      project: task.project ?? null,
      updatedAt: task.updatedAt
    })),
    currentProjects: projects
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      })
      return res.end()
    }

    if (req.url === '/api/context/task-board' && req.method === 'GET') {
      const board = await loadTaskBoardSummary()
      return sendJson(res, 200, summarizeBoard(board))
    }

    if (req.url === '/api/context/sessions' && req.method === 'GET') {
      try {
        const sessions = await fetchGatewaySessions()
        return sendJson(res, 200, sessions.length > 0 ? sessions : listFallbackSessions())
      } catch {
        return sendJson(res, 200, listFallbackSessions())
      }
    }

    if (req.url === '/api/optimize' && req.method === 'POST') {
      const payload = await readJsonBody(req)
      if (typeof payload.rawPrompt !== 'string' || !payload.rawPrompt.trim()) {
        return sendJson(res, 400, { error: 'rawPrompt is required' })
      }

      const result = await optimizePromptViaSkill({
        rawPrompt: payload.rawPrompt,
        returnStyle: typeof payload.returnStyle === 'string' ? payload.returnStyle : 'technical',
      })

      return sendJson(res, 200, {
        optimizedPrompt: result.optimizedPrompt,
        success: result.success,
        error: result.error || null,
        appliedTechniques: result.appliedTechniques || [],
        assessment: result.assessment || null,
      })
    }

    if ((req.url === '/api/send' || req.url === '/send') && req.method === 'POST') {
      const payload = await readJsonBody(req)
      return sendJson(res, 200, await formatSendResult(payload))
    }

    if (req.url === '/health' && req.method === 'GET') {
      return sendJson(res, 200, { ok: true })
    }

    return sendJson(res, 404, { error: 'Not found' })
  } catch (error) {
    return sendJson(res, 500, { error: error instanceof Error ? error.message : 'Unknown server error' })
  }
})

server.listen(PORT, HOST, () => {
  console.log(`Prompt Control context API listening on http://${HOST}:${PORT}`)
})
