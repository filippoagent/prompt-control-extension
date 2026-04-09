import type { PromptMode, RewriteResult } from './rewriteEngine'

export function composeSendPayload(params: {
  rawPrompt: string
  mode: PromptMode
  rewriteResult: RewriteResult
}): string {
  const lines = [params.rewriteResult.refinedPrompt.trim()].filter(Boolean)

  const meta: string[] = []
  if (params.mode) meta.push(`mode=${params.mode}`)
  if (params.rewriteResult.contextUsed.length) meta.push(`context=${params.rewriteResult.contextUsed.join(', ')}`)

  if (meta.length) {
    lines.push(`\n---\nPrompt Control metadata: ${meta.join(' | ')}`)
  }

  if (params.rewriteResult.notes.length) {
    lines.push(`Notes: ${params.rewriteResult.notes.join(' ; ')}`)
  }

  return lines.join('\n').trim()
}
