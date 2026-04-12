import fs from 'node:fs/promises'

const SOURCE_PATH = '/Users/assistant/.openclaw/workspace/docs/god-mode-prompts.md'

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export async function loadPromptPacks() {
  const raw = await fs.readFile(SOURCE_PATH, 'utf8')
  const lines = raw.split(/\r?\n/)
  const packs = []
  let current = null
  let inPromptBlock = false
  let promptLines = []

  for (const line of lines) {
    const headingMatch = line.match(/^##\s+(\d+)\.\s+(.+)$/)
    if (headingMatch) {
      if (current) {
        current.prompt = promptLines.join('\n').trim()
        packs.push(current)
      }
      current = {
        id: slugify(headingMatch[2]),
        index: Number(headingMatch[1]),
        title: headingMatch[2].trim(),
        prompt: '',
      }
      inPromptBlock = false
      promptLines = []
      continue
    }

    if (!current) continue

    if (/^\*\*Prompt:\*\*/.test(line.trim())) {
      inPromptBlock = true
      promptLines = []
      continue
    }

    if (inPromptBlock) {
      promptLines.push(line)
    }
  }

  if (current) {
    current.prompt = promptLines.join('\n').trim()
    packs.push(current)
  }

  return packs.filter((pack) => pack.prompt)
}
