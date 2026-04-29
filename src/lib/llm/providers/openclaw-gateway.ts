import type { Provider, LLMCallParams, LLMResponse } from '../types.js'

const GATEWAY_URL = process.env.IMAC_GATEWAY_URL || 'https://aarons-imac-2.tailebc17f.ts.net'

export const openclawGatewayProvider: Provider = {
  id: 'openclaw-gateway',
  baaSigned: false,
  models: {
    default: 'openclaw/default',
  },

  async call(params: LLMCallParams): Promise<Omit<LLMResponse, 'cacheHit' | 'latencyMs'>> {
    const gatewayToken = process.env.IMAC_GATEWAY_TOKEN
    if (!gatewayToken) {
      throw new Error(
        'IMAC_GATEWAY_TOKEN is not set. The openclaw-gateway provider requires this token. ' +
        'Add IMAC_GATEWAY_TOKEN to your Vercel environment variables.'
      )
    }

    const messages: Array<{ role: string; content: string }> = params.system
      ? [{ role: 'system', content: params.system }, ...params.messages]
      : [...params.messages]

    const body: Record<string, unknown> = {
      model:      params.model,
      max_tokens: params.maxTokens ?? 1024,
      messages,
    }
    if (params.temperature !== undefined) body.temperature = params.temperature

    const res = await fetch(`${GATEWAY_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${gatewayToken}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(115_000),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`OpenClaw gateway error (${res.status}): ${err}`)
    }

    const data = await res.json() as {
      choices: Array<{ message: { content: string } }>
      usage?: { prompt_tokens?: number; completion_tokens?: number }
    }

    return {
      content:      data.choices?.[0]?.message?.content ?? '',
      model:        params.model,
      provider:     'openclaw-gateway',
      tokensIn:     data.usage?.prompt_tokens ?? 0,
      tokensOut:    data.usage?.completion_tokens ?? 0,
      tokensCached: 0,
    }
  },

  async healthCheck(): Promise<boolean> {
    return !!(process.env.IMAC_GATEWAY_URL && process.env.IMAC_GATEWAY_TOKEN)
  },
}
