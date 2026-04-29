import type { TaskCategory, PHIClass, ProviderID } from './types.js'

export interface RouteConfig {
  provider: ProviderID
  /** Key into provider.models */
  modelKey: string
}

/**
 * Declarative routing table: every TaskCategory maps to a default provider + model.
 * To add a new route: add a key here and ensure the provider is registered in providers/index.ts.
 */
export const ROUTES: Record<TaskCategory, RouteConfig> = {
  // future: swap to openevidence provider when available
  'clinical-evidence':   { provider: 'anthropic',         modelKey: 'haiku' },
  'clinical-extraction': { provider: 'anthropic',         modelKey: 'haiku' },
  'clinical-summary':    { provider: 'anthropic',         modelKey: 'haiku' },
  // clinical-reasoning is locked to BAA-covered providers only via PHI enforcement
  'clinical-reasoning':  { provider: 'anthropic',         modelKey: 'haiku' },
  'operational':         { provider: 'openclaw-gateway',  modelKey: 'default' },
  'documentation-help':  { provider: 'anthropic',         modelKey: 'haiku' },
  'schedule-generation': { provider: 'anthropic',         modelKey: 'haiku' },
}

/** Tasks where caching is permitted (subject to PHI class check) */
const CACHEABLE_TASKS = new Set<TaskCategory>([
  'documentation-help',
  'clinical-evidence',
  'clinical-summary',
  'operational',
])

/** Cache TTL in seconds, keyed by task. Tasks not listed use DEFAULT_TTL. */
const CACHE_TTL: Partial<Record<TaskCategory, number>> = {
  'documentation-help': 24 * 60 * 60,
  'clinical-evidence':  24 * 60 * 60,
}
const DEFAULT_TTL = 60 * 60 // 1 hour

export function getCacheTTL(task: TaskCategory): number {
  return CACHE_TTL[task] ?? DEFAULT_TTL
}

/**
 * Returns true if a response for this (task, phiClass) combination may be cached.
 * - full PHI → never
 * - limited PHI → never unless allowCache is explicitly true
 * - none PHI + non-cacheable task → never
 */
export function isCacheable(task: TaskCategory, phiClass: PHIClass, allowCache?: boolean): boolean {
  if (phiClass === 'full') return false
  if (phiClass === 'limited' && !allowCache) return false
  return CACHEABLE_TASKS.has(task)
}
