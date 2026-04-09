export type PromptRefinementRequest = {
  rawPrompt: string
  mode: 'quick' | 'smart' | 'deep'
  includeWorkContext: boolean
  suggestCommands: boolean
}

export type PromptRefinementResponse = {
  refinedPrompt: string
  contextUsed: string[]
  notes: string[]
}

export type RewriteResult = PromptRefinementResponse
