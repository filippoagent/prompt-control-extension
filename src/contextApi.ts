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

const API_BASE_URL = 'http://127.0.0.1:4176'
const TASK_CONTEXT_URL = `${API_BASE_URL}/api/context/task-board`
const SESSION_LIST_URL = `${API_BASE_URL}/api/context/sessions`

export async function fetchTaskContext(): Promise<TaskContextSummary> {
  const response = await fetch(TASK_CONTEXT_URL, { cache: 'no-store' })
  if (!response.ok) throw new Error('Failed to load task board context')
  return response.json()
}

export async function fetchSessions(): Promise<SessionSummary[]> {
  const response = await fetch(SESSION_LIST_URL, { cache: 'no-store' })
  if (!response.ok) throw new Error('Failed to load sessions')
  return response.json()
}
