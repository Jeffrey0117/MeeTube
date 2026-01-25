/**
 * Logger Utility
 * Provides structured logging with context and environment-aware output
 * Debug logs only appear in development mode
 */

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
}

/**
 * Check if we're in development mode
 * @returns {boolean}
 */
function isDev() {
  return import.meta.env.DEV
}

/**
 * Create a logger instance with context
 * @param {string} context - The context/module name for this logger
 * @returns {Object} Logger instance with debug, info, warn, error methods
 */
export function createLogger(context) {
  const prefix = `[${context}]`

  return {
    /**
     * Log debug message (dev only)
     * @param {string} msg - Message to log
     * @param {*} [data] - Optional data to log
     */
    debug: (msg, data) => {
      if (isDev()) {
        if (data !== undefined) {
          console.log(`${prefix} ${msg}`, data)
        } else {
          console.log(`${prefix} ${msg}`)
        }
      }
    },

    /**
     * Log info message
     * @param {string} msg - Message to log
     * @param {*} [data] - Optional data to log
     */
    info: (msg, data) => {
      if (data !== undefined) {
        console.log(`${prefix} ${msg}`, data)
      } else {
        console.log(`${prefix} ${msg}`)
      }
    },

    /**
     * Log warning message
     * @param {string} msg - Message to log
     * @param {*} [data] - Optional data to log
     */
    warn: (msg, data) => {
      if (data !== undefined) {
        console.warn(`${prefix} ${msg}`, data)
      } else {
        console.warn(`${prefix} ${msg}`)
      }
    },

    /**
     * Log error message
     * @param {string} msg - Message to log
     * @param {*} [data] - Optional data to log
     */
    error: (msg, data) => {
      if (data !== undefined) {
        console.error(`${prefix} ${msg}`, data)
      } else {
        console.error(`${prefix} ${msg}`)
      }
    }
  }
}

// Pre-configured loggers for common modules
export const playerLogger = createLogger('PLAYER')
export const subtitleLogger = createLogger('SUBTITLE')
export const translateLogger = createLogger('TRANSLATE')
export const cacheLogger = createLogger('CACHE')
export const apiLogger = createLogger('API')
