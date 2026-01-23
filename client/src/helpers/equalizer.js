/**
 * Equalizer Helper
 * 5-band EQ using Web Audio API BiquadFilterNode
 */

// EQ 頻段設定
export const EQ_BANDS = [
  { frequency: 60, type: 'lowshelf', label: 'Bass' },
  { frequency: 250, type: 'peaking', label: 'Low-Mid' },
  { frequency: 1000, type: 'peaking', label: 'Mid' },
  { frequency: 4000, type: 'peaking', label: 'High-Mid' },
  { frequency: 16000, type: 'highshelf', label: 'Treble' }
]

// 預設列表 (gains: [60Hz, 250Hz, 1kHz, 4kHz, 16kHz])
// 使用較大的增益值讓效果更明顯
export const EQ_PRESETS = {
  flat: {
    id: 'flat',
    name: 'Flat',
    gains: [0, 0, 0, 0, 0]
  },
  acoustic: {
    id: 'acoustic',
    name: 'Acoustic',
    gains: [10, 8, 6, 3, 5]
  },
  bass_boost: {
    id: 'bass_boost',
    name: 'Bass Boost',
    gains: [15, 12, 0, 0, 0]
  },
  bass_reducer: {
    id: 'bass_reducer',
    name: 'Bass Reducer',
    gains: [-15, -12, 0, 0, 0]
  },
  classical: {
    id: 'classical',
    name: 'Classical',
    gains: [10, 6, -4, 5, 8]
  },
  dance: {
    id: 'dance',
    name: 'Dance',
    gains: [12, 8, 4, 0, -4]
  },
  deep: {
    id: 'deep',
    name: 'Deep',
    gains: [12, 8, 3, -3, -6]
  },
  electronic: {
    id: 'electronic',
    name: 'Electronic',
    gains: [12, 6, 0, 6, 12]
  },
  hip_hop: {
    id: 'hip_hop',
    name: 'Hip-Hop',
    gains: [14, 10, 0, 4, -2]
  },
  jazz: {
    id: 'jazz',
    name: 'Jazz',
    gains: [8, 4, -4, 5, 10]
  },
  latin: {
    id: 'latin',
    name: 'Latin',
    gains: [8, 5, 0, 0, 8]
  },
  loudness: {
    id: 'loudness',
    name: 'Loudness',
    gains: [12, 8, 0, 0, 12]
  },
  lounge: {
    id: 'lounge',
    name: 'Lounge',
    gains: [-6, 4, 6, 2, -4]
  },
  piano: {
    id: 'piano',
    name: 'Piano',
    gains: [6, -2, 5, 8, 6]
  },
  pop: {
    id: 'pop',
    name: 'Pop',
    gains: [-2, 6, 10, 6, -2]
  },
  rnb: {
    id: 'rnb',
    name: 'R&B',
    gains: [12, 10, -2, 5, 6]
  },
  rock: {
    id: 'rock',
    name: 'Rock',
    gains: [10, 6, -2, 6, 10]
  },
  small_speakers: {
    id: 'small_speakers',
    name: 'Small Speakers',
    gains: [12, 8, 4, 0, -4]
  },
  spoken_word: {
    id: 'spoken_word',
    name: 'Spoken Word',
    gains: [-6, 0, 10, 8, 0]
  },
  treble_boost: {
    id: 'treble_boost',
    name: 'Treble Boost',
    gains: [0, 0, 0, 12, 15]
  },
  treble_reducer: {
    id: 'treble_reducer',
    name: 'Treble Reducer',
    gains: [0, 0, 0, -12, -15]
  },
  vocal: {
    id: 'vocal',
    name: 'Vocal',
    gains: [-4, 0, 12, 10, 2]
  }
}

// 儲存 EQ 狀態的 WeakMap
const equalizerMap = new WeakMap()

/**
 * 取得現有的音頻上下文資訊
 * @param {HTMLMediaElement} mediaElement
 * @returns {object | null}
 */
export function getAudioContextInfo(mediaElement) {
  return equalizerMap.get(mediaElement) || null
}

/**
 * 設定音頻上下文資訊 (供 audio-gain.js 使用)
 * @param {HTMLMediaElement} mediaElement
 * @param {object} info
 */
export function setAudioContextInfo(mediaElement, info) {
  equalizerMap.set(mediaElement, info)
}

/**
 * 創建 EQ 濾波器
 * @param {AudioContext} audioContext
 * @returns {BiquadFilterNode[]}
 */
export function createEQFilters(audioContext) {
  return EQ_BANDS.map(band => {
    const filter = audioContext.createBiquadFilter()
    filter.type = band.type
    filter.frequency.value = band.frequency
    filter.gain.value = 0
    if (band.type === 'peaking') {
      filter.Q.value = 1 // Q 值，影響頻帶寬度
    }
    return filter
  })
}

/**
 * 連接 EQ 濾波器鏈
 * @param {BiquadFilterNode[]} filters
 * @param {AudioNode} inputNode - 輸入節點
 * @param {AudioNode} outputNode - 輸出節點
 */
export function connectEQChain(filters, inputNode, outputNode) {
  if (filters.length === 0) {
    inputNode.connect(outputNode)
    return
  }

  // 連接 input -> filter[0] -> filter[1] -> ... -> output
  inputNode.connect(filters[0])
  for (let i = 0; i < filters.length - 1; i++) {
    filters[i].connect(filters[i + 1])
  }
  filters[filters.length - 1].connect(outputNode)
}

/**
 * 更新單一頻段的增益值
 * @param {HTMLMediaElement} mediaElement
 * @param {number} bandIndex - 頻段索引 (0-4)
 * @param {number} gain - 增益值 (-12 to +12 dB)
 * @returns {boolean}
 */
export function updateEqualizerBand(mediaElement, bandIndex, gain) {
  const info = equalizerMap.get(mediaElement)
  if (!info || !info.eqFilters) {
    return false
  }

  const filter = info.eqFilters[bandIndex]
  if (!filter) {
    return false
  }

  // 限制增益範圍 (±24dB)
  const clampedGain = Math.max(-24, Math.min(24, gain))
  filter.gain.value = clampedGain

  return true
}

/**
 * 更新所有頻段的增益值
 * @param {HTMLMediaElement} mediaElement
 * @param {number[]} gains - 5 個增益值的陣列
 * @returns {boolean}
 */
export function updateEqualizerBands(mediaElement, gains) {
  const info = equalizerMap.get(mediaElement)
  if (!info || !info.eqFilters) {
    return false
  }

  gains.forEach((gain, index) => {
    if (info.eqFilters[index]) {
      const clampedGain = Math.max(-12, Math.min(12, gain))
      info.eqFilters[index].gain.value = clampedGain
    }
  })

  return true
}

/**
 * 套用預設
 * @param {HTMLMediaElement} mediaElement
 * @param {string} presetId - 預設 ID
 * @returns {number[] | null} - 套用的增益值陣列
 */
export function setEqualizerPreset(mediaElement, presetId) {
  const preset = EQ_PRESETS[presetId]
  if (!preset) {
    console.warn('[Equalizer] Unknown preset:', presetId)
    return null
  }

  const success = updateEqualizerBands(mediaElement, preset.gains)
  if (success) {
    console.log('[Equalizer] Applied preset:', preset.name)
    return preset.gains
  }
  return null
}

/**
 * 取得目前的 EQ 狀態
 * @param {HTMLMediaElement} mediaElement
 * @returns {{ enabled: boolean, bands: number[] } | null}
 */
export function getEqualizerState(mediaElement) {
  const info = equalizerMap.get(mediaElement)
  if (!info || !info.eqFilters) {
    return null
  }

  return {
    enabled: info.eqEnabled !== false,
    bands: info.eqFilters.map(filter => filter.gain.value)
  }
}

/**
 * 啟用/停用 EQ
 * @param {HTMLMediaElement} mediaElement
 * @param {boolean} enabled
 * @returns {boolean}
 */
export function setEqualizerEnabled(mediaElement, enabled) {
  const info = equalizerMap.get(mediaElement)
  if (!info || !info.eqFilters) {
    return false
  }

  if (enabled) {
    // 恢復之前的增益值
    if (info.savedGains) {
      info.eqFilters.forEach((filter, i) => {
        filter.gain.value = info.savedGains[i]
      })
    }
  } else {
    // 儲存目前的增益值並設為 0
    info.savedGains = info.eqFilters.map(filter => filter.gain.value)
    info.eqFilters.forEach(filter => {
      filter.gain.value = 0
    })
  }

  info.eqEnabled = enabled
  console.log('[Equalizer] Enabled:', enabled)
  return true
}

/**
 * 重置 EQ 到預設值 (Flat)
 * @param {HTMLMediaElement} mediaElement
 * @returns {boolean}
 */
export function resetEqualizer(mediaElement) {
  return updateEqualizerBands(mediaElement, [0, 0, 0, 0, 0])
}

/**
 * 清理 EQ 資源
 * @param {HTMLMediaElement} mediaElement
 */
export function destroyEqualizer(mediaElement) {
  const info = equalizerMap.get(mediaElement)
  if (info) {
    if (info.eqFilters) {
      info.eqFilters.forEach(filter => {
        try {
          filter.disconnect()
        } catch (e) {
          // ignore
        }
      })
    }
    equalizerMap.delete(mediaElement)
    console.log('[Equalizer] Destroyed')
  }
}
