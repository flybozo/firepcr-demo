import type { SupabaseClientLike } from './types.js'

export interface AuditEntry {
  task: string
  phiClass: string
  provider: string
  model: string
  tokensIn: number
  tokensOut: number
  tokensCached: number
  cacheHit: boolean
  latencyMs: number
  userId?: string
  routeEndpoint?: string
  error?: string
}

/** Write one row to llm_audit. Errors are logged but never thrown. */
export async function logAudit(
  entry: AuditEntry,
  supabase: SupabaseClientLike,
): Promise<void> {
  const { error } = await supabase.from('llm_audit').insert({
    task:           entry.task,
    phi_class:      entry.phiClass,
    provider:       entry.provider,
    model:          entry.model,
    tokens_in:      entry.tokensIn,
    tokens_out:     entry.tokensOut,
    tokens_cached:  entry.tokensCached,
    cache_hit:      entry.cacheHit,
    latency_ms:     entry.latencyMs,
    user_id:        entry.userId ?? null,
    route_endpoint: entry.routeEndpoint ?? null,
    error:          entry.error ?? null,
  })

  if (error) {
    console.error('[llm-audit] Failed to write audit log:', error)
  }
}
