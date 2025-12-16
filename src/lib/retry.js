'use server'

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {Object} options - Retry options
 * @param {number} options.maxRetries - Maximum number of retries (default: 3)
 * @param {number} options.initialDelay - Initial delay in ms (default: 1000)
 * @param {number} options.maxDelay - Maximum delay in ms (default: 30000)
 * @param {number} options.backoffMultiplier - Backoff multiplier (default: 2)
 * @param {Function} options.shouldRetry - Function to determine if error should be retried (default: retry all)
 * @returns {Promise<any>} - Result of the function
 */
export async function retryWithBackoff(fn, options = {}) {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    backoffMultiplier = 2,
    shouldRetry = () => true
  } = options
  
  let lastError
  let delay = initialDelay
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      
      // Don't retry if we've exhausted retries or if shouldRetry returns false
      if (attempt === maxRetries || !shouldRetry(error)) {
        throw error
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay))
      
      // Calculate next delay with exponential backoff
      delay = Math.min(delay * backoffMultiplier, maxDelay)
    }
  }
  
  throw lastError
}

/**
 * Check if an error is retryable (network errors, rate limits, etc.)
 * @param {Error} error - Error to check
 * @returns {boolean} - True if error is retryable
 */
export function isRetryableError(error) {
  // Network errors
  if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
    return true
  }
  
  // Rate limit errors
  if (error.message && error.message.includes('rate limit')) {
    return true
  }
  
  // Telnyx API errors that are retryable
  if (error.raw?.errors) {
    const firstError = error.raw.errors[0]
    const retryableStatuses = [429, 500, 502, 503, 504] // Rate limit and server errors
    if (retryableStatuses.includes(firstError.status)) {
      return true
    }
  }
  
  // Database connection errors
  if (error.code === 'P1001' || error.code === 'P1017') {
    return true
  }
  
  return false
}

