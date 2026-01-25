/**
 * Subtitle Cache Module
 * localStorage-based cache for translated subtitles
 */

const CACHE_KEY_PREFIX = 'bilingual_cache_'
const CACHE_VERSION = 1
const MAX_CACHE_AGE = 7 * 24 * 60 * 60 * 1000 // 7 days
const MAX_CACHE_ENTRIES = 50 // Maximum number of cached videos

/**
 * Generate cache key for a video
 * @param {string} videoId
 * @param {string} lang
 * @returns {string}
 */
function makeCacheKey(videoId, lang) {
  return `${CACHE_KEY_PREFIX}v${CACHE_VERSION}_${videoId}_${lang}`
}

/**
 * Get cached translations for a video
 * @param {string} videoId
 * @param {string} lang
 * @returns {Array|null} Cached subtitles or null if not found/expired
 */
export function getCachedTranslations(videoId, lang) {
  try {
    const key = makeCacheKey(videoId, lang)
    const cached = localStorage.getItem(key)

    if (!cached) {
      return null
    }

    const data = JSON.parse(cached)

    // Check version
    if (data.version !== CACHE_VERSION) {
      localStorage.removeItem(key)
      return null
    }

    // Check expiry
    if (Date.now() > data.expiresAt) {
      localStorage.removeItem(key)
      console.log(`[SUBTITLE-CACHE] Expired: ${videoId}`)
      return null
    }

    console.log(`[SUBTITLE-CACHE] HIT: ${videoId} (${data.subtitles.length} subtitles)`)

    // Update last accessed time
    data.lastAccessed = Date.now()
    localStorage.setItem(key, JSON.stringify(data))

    return data.subtitles
  } catch (error) {
    console.error('[SUBTITLE-CACHE] Get error:', error)
    return null
  }
}

/**
 * Save translations to cache
 * @param {string} videoId
 * @param {string} lang
 * @param {Array} subtitles - Array of subtitle objects with translations
 */
export function setCachedTranslations(videoId, lang, subtitles) {
  try {
    // Only cache if we have translated subtitles
    if (!subtitles || subtitles.length === 0) {
      return
    }

    // Check if all subtitles have translations
    const translatedCount = subtitles.filter(s => s.translation).length
    if (translatedCount < subtitles.length * 0.9) {
      // Don't cache if less than 90% translated
      console.log(`[SUBTITLE-CACHE] Not caching: only ${translatedCount}/${subtitles.length} translated`)
      return
    }

    const key = makeCacheKey(videoId, lang)
    const data = {
      version: CACHE_VERSION,
      videoId,
      lang,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      expiresAt: Date.now() + MAX_CACHE_AGE,
      subtitles
    }

    localStorage.setItem(key, JSON.stringify(data))
    console.log(`[SUBTITLE-CACHE] SET: ${videoId} (${subtitles.length} subtitles)`)

    // Clean up old entries if we have too many
    cleanupOldEntries()
  } catch (error) {
    console.error('[SUBTITLE-CACHE] Set error:', error)
    // If storage is full, try to clear old entries
    if (error.name === 'QuotaExceededError') {
      clearOldCache()
      // Try one more time
      try {
        const key = makeCacheKey(videoId, lang)
        const data = {
          version: CACHE_VERSION,
          videoId,
          lang,
          createdAt: Date.now(),
          lastAccessed: Date.now(),
          expiresAt: Date.now() + MAX_CACHE_AGE,
          subtitles
        }
        localStorage.setItem(key, JSON.stringify(data))
      } catch {
        // Give up
      }
    }
  }
}

/**
 * Clear all expired cache entries
 */
export function clearOldCache() {
  try {
    const keysToRemove = []
    const now = Date.now()

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(CACHE_KEY_PREFIX)) {
        try {
          const data = JSON.parse(localStorage.getItem(key))
          if (!data || data.expiresAt < now) {
            keysToRemove.push(key)
          }
        } catch {
          // Invalid entry, remove it
          keysToRemove.push(key)
        }
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key))

    if (keysToRemove.length > 0) {
      console.log(`[SUBTITLE-CACHE] Cleared ${keysToRemove.length} expired entries`)
    }
  } catch (error) {
    console.error('[SUBTITLE-CACHE] Clear error:', error)
  }
}

/**
 * Clean up old entries if we have too many
 */
function cleanupOldEntries() {
  try {
    const entries = []

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(CACHE_KEY_PREFIX)) {
        try {
          const data = JSON.parse(localStorage.getItem(key))
          if (data && data.lastAccessed) {
            entries.push({ key, lastAccessed: data.lastAccessed })
          }
        } catch {
          // Invalid entry
        }
      }
    }

    // If we have too many entries, remove the oldest ones
    if (entries.length > MAX_CACHE_ENTRIES) {
      entries.sort((a, b) => a.lastAccessed - b.lastAccessed)
      const toRemove = entries.slice(0, entries.length - MAX_CACHE_ENTRIES)
      toRemove.forEach(entry => localStorage.removeItem(entry.key))
      console.log(`[SUBTITLE-CACHE] Cleaned up ${toRemove.length} old entries`)
    }
  } catch (error) {
    console.error('[SUBTITLE-CACHE] Cleanup error:', error)
  }
}

/**
 * Get cache statistics
 * @returns {Object}
 */
export function getCacheStats() {
  try {
    let totalEntries = 0
    let totalSize = 0

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(CACHE_KEY_PREFIX)) {
        totalEntries++
        const item = localStorage.getItem(key)
        if (item) {
          totalSize += item.length * 2 // UTF-16 encoding
        }
      }
    }

    return {
      entries: totalEntries,
      sizeBytes: totalSize,
      sizeMB: (totalSize / (1024 * 1024)).toFixed(2)
    }
  } catch (error) {
    return { entries: 0, sizeBytes: 0, sizeMB: '0' }
  }
}
