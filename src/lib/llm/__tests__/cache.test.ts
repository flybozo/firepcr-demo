import { describe, it, expect, vi, beforeEach } from 'vitest'
import { computeCacheKey, getCachedResponse, storeCachedResponse } from '../cache.js'
import type { LLMMessage, LLMResponse } from '../types.js'

// ── computeCacheKey ──────────────────────────────────────────────────────────

describe('computeCacheKey', () => {
  const messages: LLMMessage[] = [{ role: 'user', content: 'hello' }]

  it('returns a 64-char hex string', () => {
    const key = computeCacheKey('documentation-help', 'claude-haiku-4-5', undefined, messages, undefined)
    expect(key).toMatch(/^[0-9a-f]{64}$/)
  })

  it('returns the same key for identical inputs', () => {
    const a = computeCacheKey('documentation-help', 'claude-haiku-4-5', 'sys', messages, 0.5)
    const b = computeCacheKey('documentation-help', 'claude-haiku-4-5', 'sys', messages, 0.5)
    expect(a).toBe(b)
  })

  it('returns different keys when task differs', () => {
    const a = computeCacheKey('documentation-help', 'claude-haiku-4-5', undefined, messages, undefined)
    const b = computeCacheKey('operational',        'claude-haiku-4-5', undefined, messages, undefined)
    expect(a).not.toBe(b)
  })

  it('returns different keys when model differs', () => {
    const a = computeCacheKey('documentation-help', 'claude-haiku-4-5',   undefined, messages, undefined)
    const b = computeCacheKey('documentation-help', 'claude-sonnet-4-6', undefined, messages, undefined)
    expect(a).not.toBe(b)
  })

  it('returns different keys when system prompt differs', () => {
    const a = computeCacheKey('documentation-help', 'claude-haiku-4-5', 'sys-a', messages, undefined)
    const b = computeCacheKey('documentation-help', 'claude-haiku-4-5', 'sys-b', messages, undefined)
    expect(a).not.toBe(b)
  })

  it('returns different keys when messages differ', () => {
    const msgs2: LLMMessage[] = [{ role: 'user', content: 'world' }]
    const a = computeCacheKey('documentation-help', 'claude-haiku-4-5', undefined, messages, undefined)
    const b = computeCacheKey('documentation-help', 'claude-haiku-4-5', undefined, msgs2, undefined)
    expect(a).not.toBe(b)
  })

  it('returns different keys when temperature differs', () => {
    const a = computeCacheKey('documentation-help', 'claude-haiku-4-5', undefined, messages, 0)
    const b = computeCacheKey('documentation-help', 'claude-haiku-4-5', undefined, messages, 1)
    expect(a).not.toBe(b)
  })
})

// ── getCachedResponse ────────────────────────────────────────────────────────

function makeChainable() {
  const obj: Record<string, any> = {}
  obj.then  = vi.fn().mockReturnValue(obj)
  obj.catch = vi.fn().mockReturnValue(obj)
  return obj
}

function makeMockSupabase(rowData: Record<string, unknown> | null, err: object | null = null) {
  const singleFn     = vi.fn().mockResolvedValue({ data: rowData, error: err })
  const gtFn         = vi.fn().mockReturnValue({ single: singleFn })
  const eqFn         = vi.fn().mockReturnValue({ gt: gtFn })
  const selectFn     = vi.fn().mockReturnValue({ eq: eqFn })
  const chainable    = makeChainable()
  const updateEqFn   = vi.fn().mockReturnValue(chainable)
  const updateFn     = vi.fn().mockReturnValue({ eq: updateEqFn })
  const fromFn       = vi.fn().mockImplementation((table: string) => {
    if (table === 'llm_cache') {
      return {
        select: selectFn,
        update: updateFn,
        upsert: vi.fn().mockResolvedValue({ error: null }),
      }
    }
    return { select: selectFn, update: updateFn }
  })

  return { from: fromFn }
}

describe('getCachedResponse', () => {
  it('returns null when supabase returns no row', async () => {
    const supabase = makeMockSupabase(null)
    const result = await getCachedResponse('some-key', supabase)
    expect(result).toBeNull()
  })

  it('returns null when supabase returns an error', async () => {
    const supabase = makeMockSupabase(null, { message: 'not found' })
    const result = await getCachedResponse('some-key', supabase)
    expect(result).toBeNull()
  })

  it('returns an LLMResponse with cacheHit=true when row exists', async () => {
    const row = {
      response: {
        content:  'cached answer',
        model:    'claude-haiku-4-5',
        provider: 'anthropic',
      },
      model:        'claude-haiku-4-5',
      provider:     'anthropic',
      tokens_saved: 150,
      hit_count:    3,
    }
    const supabase = makeMockSupabase(row)
    const result = await getCachedResponse('some-key', supabase)

    expect(result).not.toBeNull()
    expect(result!.cacheHit).toBe(true)
    expect(result!.content).toBe('cached answer')
    expect(result!.model).toBe('claude-haiku-4-5')
    expect(result!.provider).toBe('anthropic')
    expect(result!.tokensCached).toBe(150)
  })
})

// ── storeCachedResponse ──────────────────────────────────────────────────────

describe('storeCachedResponse', () => {
  it('calls supabase.from("llm_cache").upsert with correct shape', async () => {
    const upsertFn = vi.fn().mockResolvedValue({ error: null })
    const supabase = { from: vi.fn().mockReturnValue({ upsert: upsertFn }) }

    const response: LLMResponse = {
      content: 'hello', model: 'claude-haiku-4-5', provider: 'anthropic',
      tokensIn: 10, tokensOut: 20, tokensCached: 0, cacheHit: false, latencyMs: 100,
    }

    await storeCachedResponse('key123', 'documentation-help', 'claude-haiku-4-5', 'anthropic', response, supabase)

    expect(supabase.from).toHaveBeenCalledWith('llm_cache')
    const upsertArg = upsertFn.mock.calls[0][0]
    expect(upsertArg.cache_key).toBe('key123')
    expect(upsertArg.task).toBe('documentation-help')
    expect(upsertArg.tokens_saved).toBe(30) // tokensIn + tokensOut
    expect(upsertArg.expires_at).toBeDefined()
  })
})
