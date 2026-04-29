import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Provider mock ────────────────────────────────────────────────────────────
const mockProviderCall = vi.fn()

vi.mock('../providers/index.js', () => ({
  getProvider: vi.fn().mockImplementation(() => ({
    id:          'anthropic',
    baaSigned:   false,
    models:      { haiku: 'claude-haiku-4-5' },
    call:        mockProviderCall,
    healthCheck: vi.fn().mockResolvedValue(true),
  })),
}))

// Import after mock is set up
import { callLLM } from '../router.js'
import { LLMRoutingError } from '../types.js'
import type { LLMRequest, SupabaseClientLike } from '../types.js'

// ── Supabase mock ────────────────────────────────────────────────────────────
function makeMockSupabase(): SupabaseClientLike {
  const singleFn   = vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
  const gtFn       = vi.fn().mockReturnValue({ single: singleFn })
  const eqFn       = vi.fn().mockReturnValue({ gt: gtFn, select: vi.fn().mockReturnValue({ then: vi.fn(), catch: vi.fn() }) })
  const selectFn   = vi.fn().mockReturnValue({ eq: eqFn })
  const updateEqFn = vi.fn().mockReturnValue({ then: vi.fn(), catch: vi.fn() })
  const updateFn   = vi.fn().mockReturnValue({ eq: updateEqFn })
  const insertFn   = vi.fn().mockResolvedValue({ error: null })
  const upsertFn   = vi.fn().mockResolvedValue({ error: null })

  return {
    from: vi.fn().mockReturnValue({
      select: selectFn,
      update: updateFn,
      insert: insertFn,
      upsert: upsertFn,
    }),
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('callLLM', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockProviderCall.mockResolvedValue({
      content:      'Test LLM response',
      model:        'claude-haiku-4-5',
      provider:     'anthropic',
      tokensIn:     10,
      tokensOut:    25,
      tokensCached: 0,
    })
  })

  it('throws LLMRoutingError when phiClass is "full" and provider is not baaSigned', async () => {
    const req: LLMRequest = {
      task:     'clinical-reasoning',
      phiClass: 'full',
      messages: [{ role: 'user', content: 'patient has fever' }],
      supabase: makeMockSupabase(),
    }

    await expect(callLLM(req)).rejects.toThrow(LLMRoutingError)
    await expect(callLLM(req)).rejects.toThrow(/baaSigned/)
  })

  it('returns LLMResponse for phiClass "none" with a valid task', async () => {
    const req: LLMRequest = {
      task:     'documentation-help',
      phiClass: 'none',
      messages: [{ role: 'user', content: 'how do I file a supply run?' }],
      supabase: makeMockSupabase(),
    }

    const result = await callLLM(req)
    expect(result.content).toBe('Test LLM response')
    expect(result.cacheHit).toBe(false)
    expect(result.provider).toBe('anthropic')
    expect(result.model).toBe('claude-haiku-4-5')
    expect(result.latencyMs).toBeGreaterThanOrEqual(0)
  })

  it('calls the provider with the resolved model', async () => {
    const req: LLMRequest = {
      task:     'schedule-generation',
      phiClass: 'none',
      messages: [{ role: 'user', content: 'generate schedule' }],
      maxTokens: 4096,
      supabase: makeMockSupabase(),
    }

    await callLLM(req)
    expect(mockProviderCall).toHaveBeenCalledOnce()
    const callArg = mockProviderCall.mock.calls[0][0]
    expect(callArg.model).toBe('claude-haiku-4-5')
    expect(callArg.maxTokens).toBe(4096)
    expect(callArg.messages).toEqual(req.messages)
  })

  it('passes system prompt through to the provider', async () => {
    const req: LLMRequest = {
      task:     'documentation-help',
      phiClass: 'none',
      system:   'You are a helpful assistant',
      messages: [{ role: 'user', content: 'test' }],
      supabase: makeMockSupabase(),
    }

    await callLLM(req)
    const callArg = mockProviderCall.mock.calls[0][0]
    expect(callArg.system).toBe('You are a helpful assistant')
  })

  it('re-throws provider errors', async () => {
    mockProviderCall.mockRejectedValue(new Error('API unavailable'))

    const req: LLMRequest = {
      task:     'documentation-help',
      phiClass: 'none',
      messages: [{ role: 'user', content: 'test' }],
      supabase: makeMockSupabase(),
    }

    await expect(callLLM(req)).rejects.toThrow('API unavailable')
  })

  it('skips cache for schedule-generation (non-cacheable task)', async () => {
    const req: LLMRequest = {
      task:     'schedule-generation',
      phiClass: 'none',
      messages: [{ role: 'user', content: 'generate schedule' }],
      supabase: makeMockSupabase(),
    }

    const result = await callLLM(req)
    // Provider must be called — no cache possible
    expect(mockProviderCall).toHaveBeenCalledOnce()
    expect(result.cacheHit).toBe(false)
  })

  it('skips cache for full PHI regardless of task', async () => {
    // Full PHI throws before reaching cache, tested via LLMRoutingError above
    // This test verifies the provider is NOT called when routing fails
    mockProviderCall.mockClear()
    const req: LLMRequest = {
      task:     'documentation-help',
      phiClass: 'full',
      messages: [{ role: 'user', content: 'test' }],
      supabase: makeMockSupabase(),
    }

    await expect(callLLM(req)).rejects.toThrow(LLMRoutingError)
    expect(mockProviderCall).not.toHaveBeenCalled()
  })

  it('uses model override when provided', async () => {
    const req: LLMRequest = {
      task:     'documentation-help',
      phiClass: 'none',
      model:    'claude-sonnet-4-6',
      messages: [{ role: 'user', content: 'test' }],
      supabase: makeMockSupabase(),
    }

    await callLLM(req)
    const callArg = mockProviderCall.mock.calls[0][0]
    expect(callArg.model).toBe('claude-sonnet-4-6')
  })
})
