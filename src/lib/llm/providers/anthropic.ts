import type { Provider, LLMCallParams, LLMResponse } from '../types.js'

export const anthropicProvider: Provider = {
  id: 'anthropic',
  baaSigned: false, // update to true after BAA is signed with Anthropic
  models: {
    haiku:  'claude-haiku-4-5',
    sonnet: 'claude-sonnet-4-6',
  },

  async call(params: LLMCallParams): Promise<Omit<LLMResponse, 'cacheHit' | 'latencyMs'>> {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set')

    const body: Record<string, unknown> = {
      model: params.model,
      max_tokens: params.maxTokens ?? 1024,
      messages: params.messages,
    }
    if (params.system) body.system = params.system
    if (params.temperature !== undefined) body.temperature = params.temperature

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Anthropic API error (${res.status}): ${err}`)
    }

    const data = await res.json() as {
      content: Array<{ type: string; text: string }>
      usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number }
    }

    return {
      content:       data.content?.[0]?.text ?? '',
      model:         params.model,
      provider:      'anthropic',
      tokensIn:      data.usage?.input_tokens ?? 0,
      tokensOut:     data.usage?.output_tokens ?? 0,
      tokensCached:  data.usage?.cache_read_input_tokens ?? 0,
    }
  },

  async healthCheck(): Promise<boolean> {
    return !!process.env.ANTHROPIC_API_KEY
  },
}
