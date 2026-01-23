import shaka from 'shaka-player/dist/shaka-player.ui'

import i18n from '../../../i18n/index'
import { EQ_BANDS, EQ_PRESETS } from '../../../helpers/equalizer'

export class EqualizerPanel extends shaka.ui.Element {
  /**
   * @param {EventTarget} events
   * @param {HTMLElement} parent
   * @param {shaka.ui.Controls} controls
   * @param {{ enabled: boolean, presetId: string, bands: number[] }} initialState
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
    this.title_.textContent = i18n.global.t('Video.Player.Equalizer')
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
    customOption.textContent = i18n.global.t('Video.Player.EQ Presets.Custom')
    this.presetSelect_.appendChild(customOption)

    // Add preset options
    Object.values(EQ_PRESETS).forEach(preset => {
      const option = document.createElement('option')
      option.value = preset.id
      option.textContent = i18n.global.t(`Video.Player.EQ Presets.${preset.name}`)
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
    this.resetButton_.textContent = i18n.global.t('Video.Player.Reset')
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
    this.title_.textContent = i18n.global.t('Video.Player.Equalizer')
    this.resetButton_.textContent = i18n.global.t('Video.Player.Reset')

    // Update preset options
    const customOption = this.presetSelect_.querySelector('option[value="custom"]')
    if (customOption) {
      customOption.textContent = i18n.global.t('Video.Player.EQ Presets.Custom')
    }

    Object.values(EQ_PRESETS).forEach(preset => {
      const option = this.presetSelect_.querySelector(`option[value="${preset.id}"]`)
      if (option) {
        option.textContent = i18n.global.t(`Video.Player.EQ Presets.${preset.name}`)
      }
    })
  }

  /**
   * Update panel state from external source
   * @param {{ enabled: boolean, presetId: string, bands: number[] }} state
   */
  updateState(state) {
    this.enabled_ = state.enabled
    this.presetId_ = state.presetId
    this.bands_ = [...state.bands]
    this.toggleInput_.checked = this.enabled_
    this.presetSelect_.value = this.presetId_
    this.updateSliderValues_()
    this.updateSlidersState_()
  }
}
