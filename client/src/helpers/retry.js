/**
 * Retry Helper
 * Provides retry mechanism with exponential backoff for network requests
 */

import { createLogger } from './logger'

const logger = createLogger('RETRY')

/**
 * Default retry configuration
 */
const DEFAULT_OPTIONS = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  shouldRetry: () => true,
  onRetry: null
}

/**
 * Calculate delay with exponential backoff and jitter
 * @param {number} attempt - Current attempt number (0-indexed)
 * @param {number} baseDelay - Base delay in ms
 * @param {number} maxDelay - Maximum delay in ms
 * @returns {number} Delay in ms
 */
function calculateDelay(attempt, baseDelay, maxDelay) {
  // Exponential backoff: baseDelay * 2^attempt
  const exponentialDelay = baseDelay * Math.pow(2, attempt)
  // Add jitter (±25%)
  const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1)
  const delay = Math.min(exponentialDelay + jitter, maxDelay)
  return Math.round(delay)
}

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Check if error is a network error
 * @param {Error} error - The error to check
 * @returns {boolean}
 */
export function isNetworkError(error) {
  if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
    return true
  }
  if (error.name === 'TimeoutError' || error.name === 'AbortError') {
    return true
  }
  if (error.message?.includes('network') || error.message?.includes('Network')) {
    return true
  }
  return false
}

/**
 * Check if error is retryable based on HTTP status
 * @param {Response|Error} errorOrResponse - Response or error
 * @returns {boolean}
 */
export function isRetryableError(errorOrResponse) {
  // Network errors are retryable
  if (errorOrResponse instanceof Error) {
    return isNetworkError(errorOrResponse)
  }

  // Check HTTP status codes
  if (errorOrResponse.status) {
    const status = errorOrResponse.status
    // 5xx server errors are retryable
    if (status >= 500 && status < 600) return true
    // 429 Too Many Requests is retryable
    if (status === 429) return true
    // 408 Request Timeout is retryable
    if (status === 408) return true
  }

  return false
}

/**
 * Execute a function with retry logic and exponential backoff
 * @param {Function} fn - Async function to execute
 * @param {Object} [options] - Retry options
 * @param {number} [options.maxRetries=3] - Maximum retry attempts
 * @param {number} [options.baseDelay=1000] - Base delay in ms
 * @param {number} [options.maxDelay=10000] - Maximum delay in ms
 * @param {Function} [options.shouldRetry] - Function to determine if should retry (receives error)
 * @param {Function} [options.onRetry] - Callback on retry (receives attempt, error, delay)
 * @returns {Promise<*>} Result of the function
 * @throws {Error} Last error if all retries failed
 */
export async function withRetry(fn, options = {}) {
  const config = { ...DEFAULT_OPTIONS, ...options }
  let lastError

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      // Check if we should retry
      const shouldRetry = attempt < config.maxRetries && config.shouldRetry(error)

      if (!shouldRetry) {
        throw error
      }

      // Calculate delay
      const delay = calculateDelay(attempt, config.baseDelay, config.maxDelay)

      logger.debug(`Retry attempt ${attempt + 1}/${config.maxRetries} after ${delay}ms`, error.message)

      // Call onRetry callback if provided
      if (config.onRetry) {
        config.onRetry(attempt + 1, error, delay)
      }

      // Wait before retrying
      await sleep(delay)
    }
  }

  throw lastError
}

/**
 * Create a fetch wrapper with retry logic
 * @param {Object} [defaultOptions] - Default retry options
 * @returns {Function} Fetch function with retry
 */
export function createRetryFetch(defaultOptions = {}) {
  const config = { ...DEFAULT_OPTIONS, ...defaultOptions }

  /**
   * Fetch with retry
   * @param {string|URL} url - URL to fetch
   * @param {RequestInit} [fetchOptions] - Fetch options
   * @param {Object} [retryOptions] - Override retry options
   * @returns {Promise<Response>}
   */
  return async function retryFetch(url, fetchOptions = {}, retryOptions = {}) {
    const options = { ...config, ...retryOptions }

    return withRetry(async () => {
      const response = await fetch(url, fetchOptions)

      // Check if response indicates a retryable error
      if (!response.ok && isRetryableError(response)) {
        const error = new Error(`HTTP ${response.status}: ${response.statusText}`)
        error.status = response.status
        error.response = response
        throw error
      }

      return response
    }, {
      ...options,
      shouldRetry: (error) => {
        // Always check if it's a retryable error type
        if (isRetryableError(error)) return true
        // Then check custom shouldRetry
        return options.shouldRetry ? options.shouldRetry(error) : false
      }
    })
  }
}

/**
 * Pre-configured retry fetch for API calls
 */
export const retryFetch = createRetryFetch({
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  shouldRetry: isRetryableError
})
