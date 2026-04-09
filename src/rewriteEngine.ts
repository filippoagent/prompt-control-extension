import type { TaskContextSummary } from './contextApi'

export type PromptMode = 'quick' | 'smart' | 'deep'

export type RewriteResult = {
  refinedPrompt: string
  contextUsed: string[]
  notes: string[]
}

function normalizeInput(raw: string) {
  return raw.trim().replace(/\s+/g, ' ')
}

function detectIntent(text: string): string {
  const lower = text.toLowerCase()
  if (/(analyze|look at|review|evaluate|check)/.test(lower)) return 'analyze'
  if (/(build|implement|create|make)/.test(lower)) return 'implement'
  if (/(plan|design|spec|architecture)/.test(lower)) return 'plan'
  if (/(fix|debug|repair)/.test(lower)) return 'fix'
  if (/(summarize|explain|understand)/.test(lower)) return 'explain'
  return 'general'
}

function maybeTaskSplit(text: string): boolean {
  const lower = text.toLowerCase()
  return /\b(and then|also|plus|after that|than)\b/.test(lower)
}

function buildContextLine(taskContext: TaskContextSummary | null): string {
  if (!taskContext?.activeTasks?.length) return ''
  const topTask = taskContext.activeTasks[0]
  return `Current work context: active task is "${topTask.title}"${topTask.project ? ` in project "${topTask.project}"` : ''}.`
}

export function rewritePrompt(params: {
  rawPrompt: string
  mode: PromptMode
  includeWorkContext: boolean
  suggestCommands: boolean
  taskContext: TaskContextSummary | null
}): RewriteResult {
  const cleaned = normalizeInput(params.rawPrompt)
  if (!cleaned) {
    return { refinedPrompt: '', contextUsed: [], notes: [] }
  }

  const notes: string[] = []
  const contextUsed: string[] = []
  const intent = detectIntent(cleaned)
  const splitLikely = maybeTaskSplit(cleaned)

  const contextLine = params.includeWorkContext ? buildContextLine(params.taskContext) : ''
  if (contextLine) contextUsed.push('task-board')

  if (splitLikely) {
    notes.push('This prompt may contain multiple steps and could benefit from splitting.')
  }

  if (params.suggestCommands) {
    contextUsed.push('workflow-suggestions')
    if (intent === 'analyze') notes.push('Ask for findings, risks, and recommendation explicitly.')
    if (intent === 'implement') notes.push('State the exact deliverable and expected verification.')
    if (intent === 'fix') notes.push('Ask for root cause, fix, and verification result.')
  }

  if (params.mode === 'quick') {
    return {
      refinedPrompt: [cleaned, contextLine].filter(Boolean).join('\n\n'),
      contextUsed,
      notes,
    }
  }

  if (params.mode === 'smart') {
    const lines = [
      `Task: ${cleaned}`,
      contextLine,
      intent === 'implement' ? 'Output: implement the change and report the most useful verification/result.' : 'Output: respond clearly and focus on the most useful next action or answer.',
    ].filter(Boolean)

    return {
      refinedPrompt: lines.join('\n\n'),
      contextUsed,
      notes,
    }
  }

  const refined = [
    contextLine || 'Context: infer from the current work and message.',
    `Task: ${cleaned}`,
    'Constraints: keep the response aligned with current work, avoid unnecessary drift, and preserve the original intent.',
    'Output: provide a clear, actionable response in the most useful format for execution or decision-making.',
    'Success criteria: the request should be understood quickly, answered accurately, and scoped clearly enough to execute.',
  ].filter(Boolean).join('\n\n')

  return {
    refinedPrompt: refined,
    contextUsed,
    notes,
  }
}
