import { describe, it, expect } from 'vitest'
import { isCacheable, getCacheTTL, ROUTES } from '../routes.js'
import type { TaskCategory, PHIClass } from '../types.js'

const ALL_TASKS: TaskCategory[] = [
  'clinical-evidence',
  'clinical-extraction',
  'clinical-summary',
  'clinical-reasoning',
  'operational',
  'documentation-help',
  'schedule-generation',
]

describe('ROUTES', () => {
  it('has a route config for every TaskCategory', () => {
    for (const task of ALL_TASKS) {
      expect(ROUTES[task], `missing route for ${task}`).toBeDefined()
      expect(typeof ROUTES[task].provider).toBe('string')
      expect(typeof ROUTES[task].modelKey).toBe('string')
    }
  })
})

describe('isCacheable', () => {
  it('returns false for ALL tasks when phiClass is "full"', () => {
    for (const task of ALL_TASKS) {
      expect(isCacheable(task, 'full'), `${task}/full should not be cacheable`).toBe(false)
    }
  })

  it('returns false for ALL tasks when phiClass is "limited" without override', () => {
    for (const task of ALL_TASKS) {
      expect(isCacheable(task, 'limited'), `${task}/limited should not cache by default`).toBe(false)
    }
  })

  it('still returns false for full PHI even with allowCache override', () => {
    expect(isCacheable('documentation-help', 'full', true)).toBe(false)
  })

  it('allows limited PHI if allowCache is explicitly true', () => {
    // Only for tasks that are otherwise cacheable
    expect(isCacheable('documentation-help', 'limited', true)).toBe(true)
  })

  it('returns true for documentation-help + phiClass none', () => {
    expect(isCacheable('documentation-help', 'none')).toBe(true)
  })

  it('returns true for operational + phiClass none', () => {
    expect(isCacheable('operational', 'none')).toBe(true)
  })

  it('returns true for clinical-evidence + phiClass none', () => {
    expect(isCacheable('clinical-evidence', 'none')).toBe(true)
  })

  it('returns true for clinical-summary + phiClass none', () => {
    expect(isCacheable('clinical-summary', 'none')).toBe(true)
  })

  it('returns false for clinical-reasoning (never cached)', () => {
    expect(isCacheable('clinical-reasoning', 'none')).toBe(false)
  })

  it('returns false for clinical-extraction (never cached)', () => {
    expect(isCacheable('clinical-extraction', 'none')).toBe(false)
  })

  it('returns false for schedule-generation (never cached)', () => {
    expect(isCacheable('schedule-generation', 'none')).toBe(false)
  })
})

describe('getCacheTTL', () => {
  it('returns 86400 (24h) for documentation-help', () => {
    expect(getCacheTTL('documentation-help')).toBe(86_400)
  })

  it('returns 86400 (24h) for clinical-evidence', () => {
    expect(getCacheTTL('clinical-evidence')).toBe(86_400)
  })

  it('returns 3600 (1h) for schedule-generation', () => {
    expect(getCacheTTL('schedule-generation')).toBe(3_600)
  })

  it('returns 3600 (1h) for clinical-reasoning', () => {
    expect(getCacheTTL('clinical-reasoning')).toBe(3_600)
  })

  it('returns 3600 (1h) for operational', () => {
    expect(getCacheTTL('operational')).toBe(3_600)
  })
})

describe('PHI routing enforcement contracts', () => {
  it('every PHI=full call with a non-BAA provider must throw — verified by router', () => {
    // This contract is enforced in router.ts; here we just verify the routing table
    // has providers we can inspect
    for (const task of ALL_TASKS) {
      const route = ROUTES[task]
      expect(['anthropic', 'openai', 'openclaw-gateway']).toContain(route.provider)
    }
  })
})
