import { resolveGatewayBaseUrl, resolveGatewayBearerSecret } from './gateway-config.mjs'

function buildAuthHeaders() {
  const secret = resolveGatewayBearerSecret()
  return secret ? { Authorization: `Bearer ${secret}` } : {}
}

const QUALITY_FRAMEWORK = `Evaluate prompts across these dimensions:
- clarity: ambiguity, readability, precision
- specificity: deliverables, constraints, scope, success criteria
- structure: logical organization, grouping, step breakdown
- completeness: sufficient context, audience, purpose, background
- tone: fit for the task and audience
- constraints: explicit boundaries, formats, limits

Ratings must use one of: Poor, Fair, Good, Excellent.`

const TECHNIQUE_GUIDE = `Available optimization techniques include:
- Chain of Thought for complex reasoning
- Tree of Thoughts for exploring multiple approaches
- Least-to-Most prompting for sequential decomposition
- Decomposition for breaking large tasks into components
- Few-shot learning for format/style guidance
- Context reframing for missing background
- Knowledge injection for domain specifics
- Scenario-based framing for realistic context
- Reflection and self-correction for quality-critical tasks
- Role-play for expert perspective
- Step-by-step instructions for weak or vague requests
- Output format specification for clearer deliverables
- Success criteria and quality checkpoints for execution tasks`

function extractJsonObject(text) {
  const trimmed = text.trim()
  try {
    return JSON.parse(trimmed)
  } catch {}

  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1))
  }
  throw new Error('Optimizer returned invalid JSON')
}

function buildStyleInstruction(returnStyle) {
  if (returnStyle === 'technical') {
    return 'Bias toward engineering-grade precision, explicit constraints, implementation detail, interfaces, edge cases, and expected output.'
  }
  if (returnStyle === 'execution') {
    return 'Bias toward direct action, step-by-step execution, concrete deliverables, and immediate next actions.'
  }
  if (returnStyle === 'strategic-structured') {
    return 'Bias toward strong structure plus strategic framing. Organize the prompt cleanly, clarify tradeoffs, decision criteria, priorities, and planning logic.'
  }
  if (returnStyle === 'creative') {
    return 'Bias toward creative exploration, idea generation, flexible framing, and imaginative but still usable output.'
  }
  return 'Bias toward clarity, concision, reduced ambiguity, and a clean readable request.'
}

export async function optimizePromptViaSkill({ rawPrompt, returnStyle = 'technical' }) {
  const systemPrompt = `You are implementing the prompt-optimizer skill workflow.

${QUALITY_FRAMEWORK}

${TECHNIQUE_GUIDE}

Workflow:
1. Assess the prompt.
2. Identify the biggest weaknesses.
3. Choose the smallest set of high-impact techniques.
4. Rewrite the prompt so it becomes clearer, more technical when useful, more structured, and more execution-ready.
5. Preserve the user's actual intent. Do not bloat the result.
6. Follow this return-style preference: ${buildStyleInstruction(returnStyle)}

Return only valid JSON with this exact shape:
{
  "optimizedPrompt": "string",
  "appliedTechniques": ["string"],
  "assessment": {
    "clarity": "Poor|Fair|Good|Excellent",
    "specificity": "Poor|Fair|Good|Excellent",
    "structure": "Poor|Fair|Good|Excellent",
    "completeness": "Poor|Fair|Good|Excellent",
    "tone": "Poor|Fair|Good|Excellent",
    "constraints": "Poor|Fair|Good|Excellent"
  }
}`

  const userPrompt = `Optimize this prompt for a technical power-user who wants concise, high-signal prompts. Requested return style: ${returnStyle}.\n\n${rawPrompt.trim()}`

  try {
    const response = await fetch(`${resolveGatewayBaseUrl()}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...buildAuthHeaders(),
      },
      body: JSON.stringify({
        model: 'openclaw/default',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      }),
    })

    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      const message = payload?.error?.message || payload?.message || `Optimization failed (${response.status})`
      throw new Error(message)
    }

    const content = payload?.choices?.[0]?.message?.content
    if (typeof content !== 'string' || !content.trim()) {
      throw new Error('Optimization returned empty content')
    }

    const result = extractJsonObject(content)
    return {
      success: true,
      optimizedPrompt: typeof result.optimizedPrompt === 'string' && result.optimizedPrompt.trim()
        ? result.optimizedPrompt.trim()
        : rawPrompt,
      appliedTechniques: Array.isArray(result.appliedTechniques) ? result.appliedTechniques.slice(0, 6) : [],
      assessment: result.assessment && typeof result.assessment === 'object' ? result.assessment : null,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      optimizedPrompt: rawPrompt,
      appliedTechniques: [],
      assessment: null,
    }
  }
}
