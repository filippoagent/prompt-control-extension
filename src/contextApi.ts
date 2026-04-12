export type TaskContextSummary = {
  activeTasks: Array<{
    id: string
    title: string
    project: string | null
    assignee: string
    updatedAt: string
    tags: string[]
  }>
  blockedTasks: Array<{
    id: string
    title: string
    project: string | null
    assignee: string
    updatedAt: string
    tags: string[]
  }>
  recentDone: Array<{
    id: string
    title: string
    project: string | null
    updatedAt: string
  }>
  currentProjects: string[]
}

export type SessionSummary = {
  sessionKey: string
  label: string
}

export type PromptPackSummary = {
  id: string
  index: number
  title: string
  prompt: string
}

import { authHeaders } from './apiAuth'

const API_BASE_URL = 'http://127.0.0.1:4176'
const TASK_CONTEXT_URL = `${API_BASE_URL}/api/context/task-board`
const SESSION_LIST_URL = `${API_BASE_URL}/api/context/sessions`
const PROMPT_PACKS_URL = `${API_BASE_URL}/api/prompt-packs`

export async function fetchTaskContext(): Promise<TaskContextSummary> {
  const response = await fetch(TASK_CONTEXT_URL, { cache: 'no-store', headers: authHeaders() })
  if (!response.ok) throw new Error('Failed to load task board context')
  return response.json()
}

export async function fetchSessions(): Promise<SessionSummary[]> {
  const response = await fetch(SESSION_LIST_URL, { cache: 'no-store', headers: authHeaders() })
  if (!response.ok) throw new Error('Failed to load sessions')
  return response.json()
}

export async function fetchPromptPacks(): Promise<PromptPackSummary[]> {
  const response = await fetch(PROMPT_PACKS_URL, { cache: 'no-store', headers: authHeaders() })
  if (!response.ok) throw new Error('Failed to load prompt packs')
  return response.json()
}
