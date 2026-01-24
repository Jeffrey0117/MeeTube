/**
 * Bilingual Subtitle Helper
 * Parse VTT, translate, and manage subtitle state
 */

/**
 * Parse VTT content into subtitle fragments
 * @param {string} vttContent - VTT file content
 * @returns {Array<{text: string, start: number, end: number}>}
 */
export function parseVTT(vttContent) {
  if (!vttContent || !vttContent.includes('WEBVTT')) {
    return []
  }

  const subtitles = []
  const lines = vttContent.split('\n')
  let i = 0

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
            text: textLines.join(' '),
            start,
            end,
            translation: null
          })
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
 * Translate all subtitles
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
 * Create a subtitle sync controller
 * @param {HTMLVideoElement} videoElement
 * @param {Array} subtitles
 * @param {function} onSubtitleChange
 * @returns {Object} Controller with start/stop methods
 */
export function createSubtitleSync(videoElement, subtitles, onSubtitleChange) {
  let intervalId = null
  let currentSubtitle = null

  const update = () => {
    if (!videoElement) return

    const time = videoElement.currentTime
    const newSubtitle = findSubtitleAtTime(subtitles, time)

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
    subtitles = newSubtitles
    update()
  }

  return { start, stop, update, setSubtitles }
}
