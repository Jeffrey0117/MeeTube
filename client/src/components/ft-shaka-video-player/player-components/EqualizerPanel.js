import shaka from 'shaka-player/dist/shaka-player.ui'

import { EQ_BANDS, EQ_PRESETS } from '../../../helpers/equalizer'

// 硬編碼中文字串
const LABELS = {
  equalizer: '等化器',
  reset: '重置',
  custom: '自訂',
  audioEffects: '音效處理',
  mono: '單聲道',
  stereoWidth: '立體聲寬度',
  reverb: '混響',
  narrow: '窄',
  normal: '正常',
  wide: '寬',
  presets: {
    flat: '平坦',
    acoustic: '原聲',
    bass_boost: '低音增強',
    bass_reducer: '低音減弱',
    classical: '古典',
    dance: '舞曲',
    deep: '深沉',
    electronic: '電子',
    hip_hop: '嘻哈',
    jazz: '爵士',
    latin: '拉丁',
    loudness: '響度',
    lounge: '休閒',
    piano: '鋼琴',
    pop: '流行',
    rnb: '節奏藍調',
    rock: '搖滾',
    small_speakers: '小喇叭',
    spoken_word: '口說',
    treble_boost: '高音增強',
    treble_reducer: '高音減弱',
    vocal: '人聲'
  }
}

export class EqualizerPanel extends shaka.ui.Element {
  /**
   * @param {EventTarget} events
   * @param {HTMLElement} parent
   * @param {shaka.ui.Controls} controls
   * @param {{ enabled: boolean, presetId: string, bands: number[], effects?: { mono: boolean, stereoWidth: number, reverb: number } }} initialState
   */
  constructor(events, parent, controls, initialState) {
    super(parent, controls)

    /** @private */
    this.events_ = events

    /** @private */
    this.enabled_ = initialState.enabled

    /** @private */
    this.presetId_ = initialState.presetId

    /** @private */
    this.bands_ = [...initialState.bands]

    /** @private - Audio effects state */
    this.effects_ = {
      mono: initialState.effects?.mono ?? false,
      stereoWidth: initialState.effects?.stereoWidth ?? 1,
      reverb: initialState.effects?.reverb ?? 0
    }

    /** @private */
    this.sliders_ = []

    // Create panel container
    /** @private */
    this.panel_ = document.createElement('div')
    this.panel_.classList.add('ft-equalizer-panel')
    this.panel_.style.display = 'none'

    // Create panel content
    this.createHeader_()
    this.createSliders_()
    this.createEffectsSection_()
    this.createFooter_()

    this.parent.appendChild(this.panel_)
    console.log('[EQ] Panel created and appended to', this.parent)

    // listeners
    this.eventManager.listen(events, 'toggleEqualizerPanel', () => {
      console.log('[EQ] Panel received toggleEqualizerPanel event')
      this.toggleVisibility_()
    })

    this.eventManager.listen(events, 'hideEqualizerPanel', () => {
      this.hide_()
    })

    this.eventManager.listen(events, 'localeChanged', () => {
      this.updateLocalisedStrings_()
    })

    // Close panel when clicking outside
    this.eventManager.listen(document, 'click', (e) => {
      if (this.panel_.style.display !== 'none' &&
          !this.panel_.contains(e.target) &&
          !e.target.closest('.equalizer-button')) {
        this.hide_()
      }
    })
  }

  /** @private */
  createHeader_() {
    const header = document.createElement('div')
    header.classList.add('ft-eq-header')

    // Title
    /** @private */
    this.title_ = document.createElement('span')
    this.title_.classList.add('ft-eq-title')
    this.title_.textContent = LABELS.equalizer
    header.appendChild(this.title_)

    // Toggle switch
    const toggleContainer = document.createElement('label')
    toggleContainer.classList.add('ft-eq-toggle')

    /** @private */
    this.toggleInput_ = document.createElement('input')
    this.toggleInput_.type = 'checkbox'
    this.toggleInput_.checked = this.enabled_
    toggleContainer.appendChild(this.toggleInput_)

    const toggleSlider = document.createElement('span')
    toggleSlider.classList.add('ft-eq-toggle-slider')
    toggleContainer.appendChild(toggleSlider)

    header.appendChild(toggleContainer)

    this.eventManager.listen(this.toggleInput_, 'change', () => {
      this.enabled_ = this.toggleInput_.checked
      this.updateSlidersState_()
      this.emitStateChange_()
    })

    this.panel_.appendChild(header)
  }

  /** @private */
  createSliders_() {
    const slidersContainer = document.createElement('div')
    slidersContainer.classList.add('ft-eq-sliders')

    EQ_BANDS.forEach((band, index) => {
      const sliderWrapper = document.createElement('div')
      sliderWrapper.classList.add('ft-eq-slider-wrapper')

      // Value display
      const valueDisplay = document.createElement('span')
      valueDisplay.classList.add('ft-eq-value')
      valueDisplay.textContent = this.formatGain_(this.bands_[index])
      sliderWrapper.appendChild(valueDisplay)

      // Slider (vertical)
      const slider = document.createElement('input')
      slider.type = 'range'
      slider.min = '-24'
      slider.max = '24'
      slider.step = '1'
      slider.value = this.bands_[index]
      slider.classList.add('ft-eq-slider')
      slider.orient = 'vertical' // Firefox
      sliderWrapper.appendChild(slider)

      // Frequency label
      const label = document.createElement('span')
      label.classList.add('ft-eq-label')
      label.textContent = this.formatFrequency_(band.frequency)
      sliderWrapper.appendChild(label)

      this.sliders_.push({ slider, valueDisplay, index })

      this.eventManager.listen(slider, 'input', () => {
        const value = parseInt(slider.value, 10)
        this.bands_[index] = value
        valueDisplay.textContent = this.formatGain_(value)
        this.presetId_ = 'custom'
        this.presetSelect_.value = 'custom'
        this.emitBandChange_(index, value)
      })

      slidersContainer.appendChild(sliderWrapper)
    })

    /** @private */
    this.slidersContainer_ = slidersContainer
    this.panel_.appendChild(slidersContainer)
  }

  /** @private */
  createEffectsSection_() {
    const effectsSection = document.createElement('div')
    effectsSection.classList.add('ft-eq-effects')

    // Section title
    const title = document.createElement('span')
    title.classList.add('ft-eq-effects-title')
    title.textContent = LABELS.audioEffects
    /** @private */
    this.effectsTitle_ = title
    effectsSection.appendChild(title)

    // Mono toggle row
    const monoRow = document.createElement('div')
    monoRow.classList.add('ft-eq-effect-row')

    const monoLabel = document.createElement('span')
    monoLabel.classList.add('ft-eq-effect-label')
    monoLabel.textContent = LABELS.mono
    /** @private */
    this.monoLabel_ = monoLabel
    monoRow.appendChild(monoLabel)

    const monoToggle = document.createElement('label')
    monoToggle.classList.add('ft-eq-toggle', 'ft-eq-toggle-small')

    /** @private */
    this.monoInput_ = document.createElement('input')
    this.monoInput_.type = 'checkbox'
    this.monoInput_.checked = this.effects_.mono
    monoToggle.appendChild(this.monoInput_)

    const monoSlider = document.createElement('span')
    monoSlider.classList.add('ft-eq-toggle-slider')
    monoToggle.appendChild(monoSlider)

    monoRow.appendChild(monoToggle)
    effectsSection.appendChild(monoRow)

    this.eventManager.listen(this.monoInput_, 'change', () => {
      this.effects_.mono = this.monoInput_.checked
      this.emitEffectsChange_()
    })

    // Stereo Width slider row
    const stereoRow = document.createElement('div')
    stereoRow.classList.add('ft-eq-effect-row')

    const stereoLabel = document.createElement('span')
    stereoLabel.classList.add('ft-eq-effect-label')
    stereoLabel.textContent = LABELS.stereoWidth
    /** @private */
    this.stereoLabel_ = stereoLabel
    stereoRow.appendChild(stereoLabel)

    const stereoSliderContainer = document.createElement('div')
    stereoSliderContainer.classList.add('ft-eq-effect-slider-container')

    /** @private */
    this.stereoSlider_ = document.createElement('input')
    this.stereoSlider_.type = 'range'
    this.stereoSlider_.min = '0'
    this.stereoSlider_.max = '2'
    this.stereoSlider_.step = '0.1'
    this.stereoSlider_.value = this.effects_.stereoWidth
    this.stereoSlider_.classList.add('ft-eq-effect-slider')
    stereoSliderContainer.appendChild(this.stereoSlider_)

    /** @private */
    this.stereoValue_ = document.createElement('span')
    this.stereoValue_.classList.add('ft-eq-effect-value')
    this.stereoValue_.textContent = this.formatStereoWidth_(this.effects_.stereoWidth)
    stereoSliderContainer.appendChild(this.stereoValue_)

    stereoRow.appendChild(stereoSliderContainer)
    effectsSection.appendChild(stereoRow)

    this.eventManager.listen(this.stereoSlider_, 'input', () => {
      const value = parseFloat(this.stereoSlider_.value)
      this.effects_.stereoWidth = value
      this.stereoValue_.textContent = this.formatStereoWidth_(value)
      this.emitEffectsChange_()
    })

    // Reverb slider row
    const reverbRow = document.createElement('div')
    reverbRow.classList.add('ft-eq-effect-row')

    const reverbLabel = document.createElement('span')
    reverbLabel.classList.add('ft-eq-effect-label')
    reverbLabel.textContent = LABELS.reverb
    /** @private */
    this.reverbLabel_ = reverbLabel
    reverbRow.appendChild(reverbLabel)

    const reverbSliderContainer = document.createElement('div')
    reverbSliderContainer.classList.add('ft-eq-effect-slider-container')

    /** @private */
    this.reverbSlider_ = document.createElement('input')
    this.reverbSlider_.type = 'range'
    this.reverbSlider_.min = '0'
    this.reverbSlider_.max = '1'
    this.reverbSlider_.step = '0.05'
    this.reverbSlider_.value = this.effects_.reverb
    this.reverbSlider_.classList.add('ft-eq-effect-slider')
    reverbSliderContainer.appendChild(this.reverbSlider_)

    /** @private */
    this.reverbValue_ = document.createElement('span')
    this.reverbValue_.classList.add('ft-eq-effect-value')
    this.reverbValue_.textContent = this.formatPercentage_(this.effects_.reverb)
    reverbSliderContainer.appendChild(this.reverbValue_)

    reverbRow.appendChild(reverbSliderContainer)
    effectsSection.appendChild(reverbRow)

    this.eventManager.listen(this.reverbSlider_, 'input', () => {
      const value = parseFloat(this.reverbSlider_.value)
      this.effects_.reverb = value
      this.reverbValue_.textContent = this.formatPercentage_(value)
      this.emitEffectsChange_()
    })

    /** @private */
    this.effectsSection_ = effectsSection
    this.panel_.appendChild(effectsSection)
  }

  /** @private */
  formatStereoWidth_(value) {
    if (value < 0.5) return LABELS.narrow
    if (value < 1.2) return LABELS.normal
    return LABELS.wide
  }

  /** @private */
  formatPercentage_(value) {
    return `${Math.round(value * 100)}%`
  }

  /** @private */
  emitEffectsChange_() {
    this.events_.dispatchEvent(new CustomEvent('audioEffectsChanged', {
      detail: { ...this.effects_ }
    }))
  }

  /** @private */
  createFooter_() {
    const footer = document.createElement('div')
    footer.classList.add('ft-eq-footer')

    // Preset selector
    /** @private */
    this.presetSelect_ = document.createElement('select')
    this.presetSelect_.classList.add('ft-eq-preset')

    // Add custom option
    const customOption = document.createElement('option')
    customOption.value = 'custom'
    customOption.textContent = LABELS.custom
    this.presetSelect_.appendChild(customOption)

    // Add preset options
    Object.values(EQ_PRESETS).forEach(preset => {
      const option = document.createElement('option')
      option.value = preset.id
      option.textContent = LABELS.presets[preset.id] || preset.name
      this.presetSelect_.appendChild(option)
    })

    this.presetSelect_.value = this.presetId_

    this.eventManager.listen(this.presetSelect_, 'change', () => {
      const presetId = this.presetSelect_.value
      if (presetId !== 'custom' && EQ_PRESETS[presetId]) {
        this.presetId_ = presetId
        this.bands_ = [...EQ_PRESETS[presetId].gains]
        this.updateSliderValues_()
        this.emitPresetChange_(presetId)
      }
    })

    footer.appendChild(this.presetSelect_)

    // Reset button
    /** @private */
    this.resetButton_ = document.createElement('button')
    this.resetButton_.classList.add('ft-eq-reset')
    this.resetButton_.textContent = LABELS.reset
    this.resetButton_.type = 'button'

    this.eventManager.listen(this.resetButton_, 'click', () => {
      this.reset_()
    })

    footer.appendChild(this.resetButton_)

    this.panel_.appendChild(footer)
  }

  /** @private */
  formatGain_(value) {
    return value > 0 ? `+${value}` : `${value}`
  }

  /** @private */
  formatFrequency_(freq) {
    if (freq >= 1000) {
      return `${freq / 1000}k`
    }
    return `${freq}`
  }

  /** @private */
  toggleVisibility_() {
    if (this.panel_.style.display === 'none') {
      this.show_()
    } else {
      this.hide_()
    }
  }

  /** @private */
  show_() {
    this.panel_.style.display = 'flex'
  }

  /** @private */
  hide_() {
    this.panel_.style.display = 'none'
  }

  /** @private */
  updateSliderValues_() {
    this.sliders_.forEach(({ slider, valueDisplay, index }) => {
      slider.value = this.bands_[index]
      valueDisplay.textContent = this.formatGain_(this.bands_[index])
    })
  }

  /** @private */
  updateSlidersState_() {
    this.slidersContainer_.style.opacity = this.enabled_ ? '1' : '0.5'
    this.sliders_.forEach(({ slider }) => {
      slider.disabled = !this.enabled_
    })
  }

  /** @private */
  reset_() {
    this.presetId_ = 'flat'
    this.bands_ = [0, 0, 0, 0, 0]
    this.presetSelect_.value = 'flat'
    this.updateSliderValues_()
    this.emitPresetChange_('flat')
  }

  /** @private */
  emitStateChange_() {
    this.events_.dispatchEvent(new CustomEvent('equalizerStateChanged', {
      detail: {
        enabled: this.enabled_,
        presetId: this.presetId_,
        bands: [...this.bands_]
      }
    }))
  }

  /** @private */
  emitBandChange_(bandIndex, value) {
    this.events_.dispatchEvent(new CustomEvent('equalizerBandChanged', {
      detail: { bandIndex, value, bands: [...this.bands_] }
    }))
    this.emitStateChange_()
  }

  /** @private */
  emitPresetChange_(presetId) {
    this.events_.dispatchEvent(new CustomEvent('equalizerPresetChanged', {
      detail: { presetId, bands: [...this.bands_] }
    }))
    this.emitStateChange_()
  }

  /** @private */
  updateLocalisedStrings_() {
    this.title_.textContent = LABELS.equalizer
    this.resetButton_.textContent = LABELS.reset

    // Update preset options
    const customOption = this.presetSelect_.querySelector('option[value="custom"]')
    if (customOption) {
      customOption.textContent = LABELS.custom
    }

    Object.values(EQ_PRESETS).forEach(preset => {
      const option = this.presetSelect_.querySelector(`option[value="${preset.id}"]`)
      if (option) {
        option.textContent = LABELS.presets[preset.id] || preset.name
      }
    })

    // Update audio effects labels
    if (this.effectsTitle_) {
      this.effectsTitle_.textContent = LABELS.audioEffects
    }
    if (this.monoLabel_) {
      this.monoLabel_.textContent = LABELS.mono
    }
    if (this.stereoLabel_) {
      this.stereoLabel_.textContent = LABELS.stereoWidth
    }
    if (this.reverbLabel_) {
      this.reverbLabel_.textContent = LABELS.reverb
    }
    // Update stereo width value display
    if (this.stereoValue_) {
      this.stereoValue_.textContent = this.formatStereoWidth_(this.effects_.stereoWidth)
    }
  }

  /**
   * Update panel state from external source
   * @param {{ enabled: boolean, presetId: string, bands: number[], effects?: { mono: boolean, stereoWidth: number, reverb: number } }} state
   */
  updateState(state) {
    this.enabled_ = state.enabled
    this.presetId_ = state.presetId
    this.bands_ = [...state.bands]
    this.toggleInput_.checked = this.enabled_
    this.presetSelect_.value = this.presetId_
    this.updateSliderValues_()
    this.updateSlidersState_()

    // Update effects state if provided
    if (state.effects) {
      this.effects_ = { ...state.effects }
      if (this.monoInput_) {
        this.monoInput_.checked = this.effects_.mono
      }
      if (this.stereoSlider_) {
        this.stereoSlider_.value = this.effects_.stereoWidth
        this.stereoValue_.textContent = this.formatStereoWidth_(this.effects_.stereoWidth)
      }
      if (this.reverbSlider_) {
        this.reverbSlider_.value = this.effects_.reverb
        this.reverbValue_.textContent = this.formatPercentage_(this.effects_.reverb)
      }
    }
  }
}
