import { describe, expect, it, vi } from 'vitest'

import { isRetryableError, retryWithBackoff } from './retry'

describe('retry helpers', () => {
  it('retries with backoff until success', async () => {
    vi.useFakeTimers()
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('temporary 1'))
      .mockRejectedValueOnce(new Error('temporary 2'))
      .mockResolvedValueOnce('ok')

    const promise = retryWithBackoff(fn, {
      maxRetries: 3,
      initialDelay: 50
    })

    await vi.advanceTimersByTimeAsync(200)

    await expect(promise).resolves.toBe('ok')
    expect(fn).toHaveBeenCalledTimes(3)
    vi.useRealTimers()
  })

  it('stops immediately when shouldRetry returns false', async () => {
    const err = new Error('do not retry')
    const fn = vi.fn().mockRejectedValue(err)

    await expect(
      retryWithBackoff(fn, {
        maxRetries: 3,
        shouldRetry: () => false
      })
    ).rejects.toThrow('do not retry')

    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('detects retryable error classes', () => {
    expect(isRetryableError({ code: 'ETIMEDOUT' })).toBe(true)
    expect(isRetryableError({ message: 'upstream rate limit exceeded' })).toBe(true)
    expect(isRetryableError({ raw: { errors: [{ status: 503 }] } })).toBe(true)
    expect(isRetryableError({ code: 'P1001' })).toBe(true)
    expect(isRetryableError({ message: 'validation failure' })).toBe(false)
  })
})
