import { createHash } from 'crypto'
import type { LLMMessage, LLMResponse, SupabaseClientLike, TaskCategory } from './types.js'
import { isCacheable, getCacheTTL } from './routes.js'

export function computeCacheKey(
  task: string,
  model: string,
  system: string | undefined,
  messages: LLMMessage[],
  temperature: number | undefined,
): string {
  const input = [task, model, system ?? '', JSON.stringify(messages), String(temperature ?? '')].join('|')
  return createHash('sha256').update(input).digest('hex')
}

export async function getCachedResponse(
  cacheKey: string,
  supabase: SupabaseClientLike,
): Promise<LLMResponse | null> {
  const { data, error } = await supabase
    .from('llm_cache')
    .select('response, model, provider, tokens_saved, hit_count')
    .eq('cache_key', cacheKey)
    .gt('expires_at', new Date().toISOString())
    .single()

  if (error || !data) return null

  // Increment hit count — fire-and-forget, non-critical metric
  supabase
    .from('llm_cache')
    .update({ hit_count: (data.hit_count ?? 0) + 1 })
    .eq('cache_key', cacheKey)
    .then(() => {})
    .catch(() => {})

  const r = data.response as Record<string, unknown>
  return {
    content:      String(r.content ?? ''),
    model:        String(r.model ?? data.model ?? ''),
    provider:     (r.provider ?? data.provider) as LLMResponse['provider'],
    tokensIn:     0,
    tokensOut:    0,
    tokensCached: Number(data.tokens_saved ?? 0),
    cacheHit:     true,
    latencyMs:    0,
  }
}

export async function storeCachedResponse(
  cacheKey: string,
  task: TaskCategory,
  model: string,
  provider: string,
  response: LLMResponse,
  supabase: SupabaseClientLike,
  sourceContentHash?: string,
): Promise<void> {
  const ttlSeconds = getCacheTTL(task)
  const expiresAt  = new Date(Date.now() + ttlSeconds * 1000).toISOString()

  await supabase.from('llm_cache').upsert({
    cache_key:           cacheKey,
    task,
    model,
    provider,
    response,
    tokens_saved:        response.tokensIn + response.tokensOut,
    hit_count:           0,
    expires_at:          expiresAt,
    source_content_hash: sourceContentHash ?? null,
    created_at:          new Date().toISOString(),
  })
}

/**
 * Invalidate all cached responses that were built from the given content.
 * Call this when a source document (formulary, protocol) is updated.
 * Returns the number of entries removed.
 */
export async function invalidateCache(
  sourceContentHash: string,
  supabase: SupabaseClientLike,
): Promise<number> {
  const { data, error } = await supabase
    .from('llm_cache')
    .delete()
    .eq('source_content_hash', sourceContentHash)
    .select('cache_key')

  if (error) {
    console.error('[llm-cache] invalidateCache error:', error)
    return 0
  }
  return data?.length ?? 0
}

export { isCacheable }
