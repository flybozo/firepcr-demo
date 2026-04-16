// Simple in-memory sliding window rate limiter for Vercel serverless
// Note: Each serverless instance has its own memory, so this is per-instance.
// For true global rate limiting, use Upstash Redis. This is a good-enough first pass.

const windows: Map<string, number[]> = new Map()

export function rateLimit(
  key: string,
  maxRequests: number = 10,
  windowMs: number = 60_000,
): { ok: boolean; remaining: number; retryAfterMs?: number } {
  const now = Date.now()
  const windowStart = now - windowMs

  let timestamps = windows.get(key) || []
  timestamps = timestamps.filter(t => t > windowStart)

  if (timestamps.length >= maxRequests) {
    const oldestInWindow = timestamps[0]
    const retryAfterMs = oldestInWindow + windowMs - now
    windows.set(key, timestamps)
    return { ok: false, remaining: 0, retryAfterMs }
  }

  timestamps.push(now)
  windows.set(key, timestamps)
  return { ok: true, remaining: maxRequests - timestamps.length }
}
