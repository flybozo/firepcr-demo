import { createClient } from '@supabase/supabase-js'
import type { LLMRequest, LLMResponse, SupabaseClientLike } from './types.js'
import { LLMRoutingError } from './types.js'
import { ROUTES, isCacheable } from './routes.js'
import { getProvider } from './providers/index.js'
import { computeCacheKey, getCachedResponse, storeCachedResponse } from './cache.js'
import { logAudit } from './audit.js'

function makeServiceClient(): SupabaseClientLike {
  const url = process.env.SUPABASE_URL
    || process.env.VITE_SUPABASE_URL
    || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) throw new Error('SUPABASE_URL is not set — cannot initialize LLM audit/cache client')
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set — cannot initialize LLM audit/cache client')

  return createClient(url, key)
}

/**
 * Central LLM entrypoint. Routes by (task, phiClass), enforces BAA requirements,
 * checks/stores the cache, calls the provider, and writes an audit log entry.
 *
 * Pass req.supabase to reuse an existing service-role client from the route handler.
 * If omitted, one is created from environment variables.
 *
 * Throws LLMRoutingError when:
 * - phiClass is "full" and no BAA-signed provider is available for the task
 */
export async function callLLM(req: LLMRequest): Promise<LLMResponse> {
  const supabase: SupabaseClientLike = req.supabase ?? makeServiceClient()
  const start = Date.now()

  const route = ROUTES[req.task]
  if (!route) {
    throw new LLMRoutingError(`No route configured for task "${req.task}"`)
  }

  const provider = getProvider(route.provider)
  const model    = req.model ?? provider.models[route.modelKey] ?? Object.values(provider.models)[0]

  // ── PHI enforcement ──────────────────────────────────────────────────────────
  if (req.phiClass === 'full' && !provider.baaSigned) {
    const errMsg =
      `PHI class "full" requires a BAA-signed provider, but "${provider.id}" is not marked baaSigned. ` +
      `To enable full-PHI routing: (1) sign a BAA with the provider, ` +
      `(2) set baaSigned: true in src/lib/llm/providers/${provider.id}.ts, ` +
      `(3) ensure routes.ts maps "${req.task}" to that provider.`

    await logAudit(
      { task: req.task, phiClass: req.phiClass, provider: provider.id, model, tokensIn: 0,
        tokensOut: 0, tokensCached: 0, cacheHit: false, latencyMs: 0,
        userId: req.userId, routeEndpoint: req.routeEndpoint, error: errMsg },
      supabase,
    ).catch(() => {})

    throw new LLMRoutingError(errMsg)
  }

  if (req.phiClass === 'limited' && !provider.baaSigned) {
    console.warn(
      `[llm-router] WARNING: PHI class "limited" routed to non-BAA provider "${provider.id}". ` +
      `This may not be HIPAA-compliant. Review your provider configuration before use with real patient data.`
    )
  }

  // ── Cache check ──────────────────────────────────────────────────────────────
  const canCache = isCacheable(req.task, req.phiClass, req.allowCache)
  let cacheKey: string | undefined

  if (canCache) {
    cacheKey = computeCacheKey(req.task, model, req.system, req.messages, req.temperature)
    try {
      const cached = await getCachedResponse(cacheKey, supabase)
      if (cached) {
        await logAudit(
          { task: req.task, phiClass: req.phiClass, provider: cached.provider, model: cached.model,
            tokensIn: 0, tokensOut: 0, tokensCached: cached.tokensCached, cacheHit: true,
            latencyMs: Date.now() - start, userId: req.userId, routeEndpoint: req.routeEndpoint },
          supabase,
        ).catch(() => {})
        return cached
      }
    } catch (cacheErr) {
      console.error('[llm-cache] Cache check failed (continuing without cache):', cacheErr)
    }
  }

  // ── Provider call ────────────────────────────────────────────────────────────
  let result: Omit<LLMResponse, 'cacheHit' | 'latencyMs'>

  try {
    result = await provider.call({
      model,
      messages:    req.messages,
      system:      req.system,
      maxTokens:   req.maxTokens,
      temperature: req.temperature,
    })
  } catch (err: any) {
    const callError = err?.message ?? String(err)
    await logAudit(
      { task: req.task, phiClass: req.phiClass, provider: provider.id, model,
        tokensIn: 0, tokensOut: 0, tokensCached: 0, cacheHit: false,
        latencyMs: Date.now() - start, userId: req.userId, routeEndpoint: req.routeEndpoint,
        error: callError },
      supabase,
    ).catch(() => {})
    throw err
  }

  const latencyMs = Date.now() - start
  const response: LLMResponse = { ...result, cacheHit: false, latencyMs }

  // ── Store cache (fire-and-forget) ────────────────────────────────────────────
  if (canCache && cacheKey) {
    storeCachedResponse(cacheKey, req.task, model, provider.id, response, supabase)
      .catch((e) => console.error('[llm-cache] Store failed:', e))
  }

  // ── Audit log ────────────────────────────────────────────────────────────────
  await logAudit(
    { task: req.task, phiClass: req.phiClass, provider: provider.id, model,
      tokensIn: response.tokensIn, tokensOut: response.tokensOut, tokensCached: response.tokensCached,
      cacheHit: false, latencyMs, userId: req.userId, routeEndpoint: req.routeEndpoint },
    supabase,
  ).catch(() => {})

  return response
}
