/**
 * Bilingual Subtitle Helper
 * Parse VTT, translate, and manage subtitle state
 * Supports progressive loading with background preloading
 */

/**
 * Parse VTT content into subtitle fragments
 * @param {string} vttContent - VTT file content
 * @returns {Array<{text: string, start: number, end: number, index: number}>}
 */
export function parseVTT(vttContent) {
  if (!vttContent || !vttContent.includes('WEBVTT')) {
    return []
  }

  const subtitles = []
  const lines = vttContent.split('\n')
  let i = 0
  let index = 0

  // Skip header
  while (i < lines.length && !lines[i].includes('-->')) {
    i++
  }

  while (i < lines.length) {
    const line = lines[i].trim()

    // Look for timestamp line
    if (line.includes('-->')) {
      const match = line.match(/(\d{2}:)?(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}:)?(\d{2}):(\d{2})\.(\d{3})/)

      if (match) {
        const startHours = match[1] ? parseInt(match[1]) : 0
        const startMins = parseInt(match[2])
        const startSecs = parseInt(match[3])
        const startMs = parseInt(match[4])

        const endHours = match[5] ? parseInt(match[5]) : 0
        const endMins = parseInt(match[6])
        const endSecs = parseInt(match[7])
        const endMs = parseInt(match[8])

        const start = startHours * 3600 + startMins * 60 + startSecs + startMs / 1000
        const end = endHours * 3600 + endMins * 60 + endSecs + endMs / 1000

        // Collect text lines until empty line or next timestamp
        i++
        const textLines = []
        while (i < lines.length && lines[i].trim() && !lines[i].includes('-->')) {
          // Skip cue settings (position, align, etc)
          const textLine = lines[i].trim()
          if (!textLine.match(/^(position|align|line|size):/)) {
            // Strip HTML tags
            textLines.push(textLine.replace(/<[^>]+>/g, ''))
          }
          i++
        }

        if (textLines.length > 0) {
          subtitles.push({
            index,
            text: textLines.join(' '),
            start,
            end,
            translation: null
          })
          index++
        }
      } else {
        i++
      }
    } else {
      i++
    }
  }

  return subtitles
}

/**
 * Fetch VTT content from URL
 * @param {string} url - VTT URL
 * @returns {Promise<string>}
 */
export async function fetchVTT(url) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch VTT: ${response.status}`)
  }
  return response.text()
}

/**
 * Translate texts via backend API
 * @param {string[]} texts - Array of texts to translate
 * @param {string} targetLang - Target language code
 * @returns {Promise<string[]>}
 */
export async function translateBatch(texts, targetLang = 'zh-TW') {
  if (!texts || texts.length === 0) {
    return []
  }

  const response = await fetch('/api/translate/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texts, targetLang })
  })

  if (!response.ok) {
    throw new Error(`Translation failed: ${response.status}`)
  }

  const data = await response.json()
  return data.translations
}

/**
 * Translate all subtitles (legacy function for backward compatibility)
 * @param {Array} subtitles - Parsed subtitle fragments
 * @param {string} targetLang - Target language
 * @param {function} onProgress - Progress callback (current, total)
 * @returns {Promise<Array>}
 */
export async function translateSubtitles(subtitles, targetLang = 'zh-TW', onProgress = null) {
  if (!subtitles || subtitles.length === 0) {
    return subtitles
  }

  const batchSize = 10
  const results = [...subtitles]

  for (let i = 0; i < subtitles.length; i += batchSize) {
    const batch = subtitles.slice(i, i + batchSize)
    const texts = batch.map(s => s.text)

    try {
      const translations = await translateBatch(texts, targetLang)

      // Merge translations
      batch.forEach((sub, idx) => {
        const resultIdx = i + idx
        results[resultIdx] = {
          ...sub,
          translation: translations[idx] || sub.text
        }
      })
    } catch (error) {
      console.error('[TRANSLATE] Batch failed:', error)
      // Keep original text on error
      batch.forEach((sub, idx) => {
        const resultIdx = i + idx
        results[resultIdx] = { ...sub, translation: null }
      })
    }

    // Report progress
    if (onProgress) {
      onProgress(Math.min(i + batchSize, subtitles.length), subtitles.length)
    }

    // Small delay to avoid rate limiting
    if (i + batchSize < subtitles.length) {
      await new Promise(r => setTimeout(r, 100))
    }
  }

  return results
}

/**
 * Find subtitle at given time
 * @param {Array} subtitles - Subtitle fragments
 * @param {number} currentTime - Current playback time in seconds
 * @returns {Object|null}
 */
export function findSubtitleAtTime(subtitles, currentTime) {
  if (!subtitles || subtitles.length === 0) {
    return null
  }

  return subtitles.find(
    sub => sub.start <= currentTime && sub.end > currentTime
  ) || null
}

/**
 * TranslationQueue - Progressive loading with background preloading
 */
export class TranslationQueue {
  /**
   * @param {Object} options
   * @param {number} options.concurrency - Number of concurrent translation requests (default: 5)
   * @param {number} options.batchSize - Number of texts per batch (default: 10)
   * @param {number} options.preloadWindow - Seconds ahead to preload (default: 120)
   * @param {function} options.onUpdate - Callback when subtitles are updated
   * @param {function} options.onProgress - Callback for progress (translated, total)
   * @param {string} options.targetLang - Target language (default: 'zh-TW')
   */
  constructor(options = {}) {
    this.concurrency = options.concurrency || 5
    this.batchSize = options.batchSize || 10
    this.preloadWindow = options.preloadWindow || 120 // 2 minutes ahead
    this.targetLang = options.targetLang || 'zh-TW'
    this.onUpdate = options.onUpdate || (() => {})
    this.onProgress = options.onProgress || (() => {})

    this.subtitles = []
    this.translatedIndices = new Set()
    this.pendingIndices = new Set()
    this.isInitialized = false
    this.isDestroyed = false
    this.activeRequests = 0
    this.lastPreloadTime = -1
  }

  /**
   * Initialize with subtitles and translate the first N
   * @param {Array} subtitles - Parsed subtitle fragments
   * @param {number} initialCount - Number of subtitles to translate initially (default: 50)
   * @returns {Promise<void>}
   */
  async initialize(subtitles, initialCount = 50) {
    if (!subtitles || subtitles.length === 0) {
      throw new Error('No subtitles provided')
    }

    this.subtitles = subtitles.map((sub, idx) => ({
      ...sub,
      index: idx,
      translation: sub.translation || null
    }))

    console.log(`[QUEUE] Initializing with ${this.subtitles.length} subtitles, translating first ${initialCount}`)

    // Translate initial batch with high concurrency
    const toTranslate = Math.min(initialCount, this.subtitles.length)
    await this._translateRange(0, toTranslate)

    this.isInitialized = true
    console.log(`[QUEUE] Initialization complete: ${this.translatedIndices.size}/${this.subtitles.length} translated`)
  }

  /**
   * Translate a range of subtitles with concurrency control
   * @param {number} startIdx
   * @param {number} endIdx
   * @returns {Promise<void>}
   */
  async _translateRange(startIdx, endIdx) {
    const indices = []
    for (let i = startIdx; i < endIdx && i < this.subtitles.length; i++) {
      if (!this.translatedIndices.has(i) && !this.pendingIndices.has(i)) {
        indices.push(i)
      }
    }

    if (indices.length === 0) return

    // Split into batches
    const batches = []
    for (let i = 0; i < indices.length; i += this.batchSize) {
      batches.push(indices.slice(i, i + this.batchSize))
    }

    // Process batches with concurrency control
    const processBatch = async (batch) => {
      if (this.isDestroyed) return

      // Mark as pending
      batch.forEach(idx => this.pendingIndices.add(idx))

      const texts = batch.map(idx => this.subtitles[idx].text)

      try {
        const translations = await translateBatch(texts, this.targetLang)

        batch.forEach((idx, i) => {
          if (!this.isDestroyed) {
            this.subtitles[idx] = {
              ...this.subtitles[idx],
              translation: translations[i] || this.subtitles[idx].text
            }
            this.translatedIndices.add(idx)
            this.pendingIndices.delete(idx)
          }
        })

        // Notify update
        this.onUpdate(this.subtitles)
        this.onProgress(this.translatedIndices.size, this.subtitles.length)
      } catch (error) {
        console.error('[QUEUE] Batch translation failed:', error)
        batch.forEach(idx => this.pendingIndices.delete(idx))
      }
    }

    // Process with concurrency limit
    const queue = [...batches]
    const workers = []

    for (let i = 0; i < this.concurrency; i++) {
      workers.push((async () => {
        while (queue.length > 0 && !this.isDestroyed) {
          const batch = queue.shift()
          if (batch) {
            this.activeRequests++
            await processBatch(batch)
            this.activeRequests--
          }
        }
      })())
    }

    await Promise.all(workers)
  }

  /**
   * Preload subtitles for the given playback time
   * @param {number} currentTime - Current playback time in seconds
   */
  preloadForTime(currentTime) {
    if (!this.isInitialized || this.isDestroyed) return

    // Avoid too frequent preload calls
    const timeWindow = Math.floor(currentTime / 10) // 10 second intervals
    if (timeWindow === this.lastPreloadTime) return
    this.lastPreloadTime = timeWindow

    // Find subtitle indices within the preload window
    const windowEnd = currentTime + this.preloadWindow
    const startIdx = this.subtitles.findIndex(s => s.start >= currentTime)
    const endIdx = this.subtitles.findIndex(s => s.start > windowEnd)

    if (startIdx === -1) return

    const actualEndIdx = endIdx === -1 ? this.subtitles.length : endIdx

    // Check if we need to preload
    let needsPreload = false
    for (let i = startIdx; i < actualEndIdx; i++) {
      if (!this.translatedIndices.has(i) && !this.pendingIndices.has(i)) {
        needsPreload = true
        break
      }
    }

    if (needsPreload) {
      console.log(`[QUEUE] Preloading subtitles ${startIdx}-${actualEndIdx} for time ${currentTime.toFixed(1)}s`)
      this._translateRange(startIdx, actualEndIdx)
    }
  }

  /**
   * Get subtitle at given time (if translated)
   * @param {number} currentTime
   * @returns {Object|null}
   */
  getSubtitleAt(currentTime) {
    return findSubtitleAtTime(this.subtitles, currentTime)
  }

  /**
   * Get all subtitles (translated or not)
   * @returns {Array}
   */
  getAllSubtitles() {
    return this.subtitles
  }

  /**
   * Get translation progress
   * @returns {{translated: number, total: number, percent: number}}
   */
  getProgress() {
    const translated = this.translatedIndices.size
    const total = this.subtitles.length
    return {
      translated,
      total,
      percent: total > 0 ? Math.round((translated / total) * 100) : 0
    }
  }

  /**
   * Continue translating remaining subtitles in background
   * @returns {Promise<void>}
   */
  async translateRemaining() {
    if (!this.isInitialized || this.isDestroyed) return

    const remaining = this.subtitles.length - this.translatedIndices.size
    if (remaining === 0) {
      console.log('[QUEUE] All subtitles already translated')
      return
    }

    console.log(`[QUEUE] Translating remaining ${remaining} subtitles in background`)

    // Find all untranslated indices
    const untranslated = []
    for (let i = 0; i < this.subtitles.length; i++) {
      if (!this.translatedIndices.has(i)) {
        untranslated.push(i)
      }
    }

    // Process in smaller batches with delays to avoid overwhelming the API
    const chunkSize = 50
    for (let i = 0; i < untranslated.length; i += chunkSize) {
      if (this.isDestroyed) break

      const chunk = untranslated.slice(i, i + chunkSize)
      const startIdx = chunk[0]
      const endIdx = chunk[chunk.length - 1] + 1

      await this._translateRange(startIdx, endIdx)

      // Small delay between chunks
      if (i + chunkSize < untranslated.length) {
        await new Promise(r => setTimeout(r, 200))
      }
    }

    console.log(`[QUEUE] Background translation complete: ${this.translatedIndices.size}/${this.subtitles.length}`)
  }

  /**
   * Check if all subtitles are translated
   * @returns {boolean}
   */
  isComplete() {
    return this.translatedIndices.size === this.subtitles.length
  }

  /**
   * Destroy the queue and stop all operations
   */
  destroy() {
    this.isDestroyed = true
    this.subtitles = []
    this.translatedIndices.clear()
    this.pendingIndices.clear()
    console.log('[QUEUE] Destroyed')
  }
}

/**
 * Create a subtitle sync controller
 * @param {HTMLVideoElement} videoElement
 * @param {TranslationQueue|Array} queueOrSubtitles - TranslationQueue instance or subtitle array
 * @param {function} onSubtitleChange
 * @returns {Object} Controller with start/stop methods
 */
export function createSubtitleSync(videoElement, queueOrSubtitles, onSubtitleChange) {
  let intervalId = null
  let currentSubtitle = null
  const isQueue = queueOrSubtitles instanceof TranslationQueue

  const getSubtitles = () => {
    if (isQueue) {
      return queueOrSubtitles.getAllSubtitles()
    }
    return queueOrSubtitles
  }

  const update = () => {
    if (!videoElement) return

    const time = videoElement.currentTime
    const subtitles = getSubtitles()
    const newSubtitle = findSubtitleAtTime(subtitles, time)

    // Trigger preload if using queue
    if (isQueue) {
      queueOrSubtitles.preloadForTime(time)
    }

    // Only update if changed
    if (newSubtitle !== currentSubtitle) {
      currentSubtitle = newSubtitle
      onSubtitleChange(newSubtitle)
    }
  }

  const start = () => {
    if (intervalId) return

    update() // Initial update
    intervalId = setInterval(update, 100) // Poll every 100ms

    // Also listen to seek events
    videoElement?.addEventListener('seeked', update)
  }

  const stop = () => {
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
    videoElement?.removeEventListener('seeked', update)
    currentSubtitle = null
    onSubtitleChange(null)
  }

  const setSubtitles = (newSubtitles) => {
    // For backward compatibility with non-queue usage
    if (!isQueue) {
      queueOrSubtitles = newSubtitles
    }
    update()
  }

  return { start, stop, update, setSubtitles }
}
