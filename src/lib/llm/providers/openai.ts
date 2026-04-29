import type { Provider, LLMCallParams, LLMResponse } from '../types.js'

export const openaiProvider: Provider = {
  id: 'openai',
  baaSigned: false, // update to true after BAA is signed with OpenAI
  models: {
    gpt4o:     'gpt-4o',
    gpt4omini: 'gpt-4o-mini',
  },

  async call(params: LLMCallParams): Promise<Omit<LLMResponse, 'cacheHit' | 'latencyMs'>> {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error(
        'OPENAI_API_KEY is not set. To use the openai provider, add OPENAI_API_KEY to your ' +
        'Vercel environment variables (Settings → Environment Variables).'
      )
    }

    const messages: Array<{ role: string; content: string }> = params.system
      ? [{ role: 'system', content: params.system }, ...params.messages]
      : [...params.messages]

    const body: Record<string, unknown> = {
      model:      params.model,
      messages,
      max_tokens: params.maxTokens ?? 1024,
    }
    if (params.temperature !== undefined) body.temperature = params.temperature

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`OpenAI API error (${res.status}): ${err}`)
    }

    const data = await res.json() as {
      choices: Array<{ message: { content: string } }>
      usage: { prompt_tokens: number; completion_tokens: number }
    }

    return {
      content:      data.choices?.[0]?.message?.content ?? '',
      model:        params.model,
      provider:     'openai',
      tokensIn:     data.usage?.prompt_tokens ?? 0,
      tokensOut:    data.usage?.completion_tokens ?? 0,
      tokensCached: 0,
    }
  },

  async healthCheck(): Promise<boolean> {
    return !!process.env.OPENAI_API_KEY
  },
}
