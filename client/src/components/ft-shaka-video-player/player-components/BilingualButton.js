import shaka from 'shaka-player/dist/shaka-player.ui'

// Subtitle icon (CC style)
const SUBTITLE_ICON = 'M200-160q-33 0-56.5-23.5T120-240v-480q0-33 23.5-56.5T200-800h560q33 0 56.5 23.5T840-720v480q0 33-23.5 56.5T760-160H200Zm0-80h560v-480H200v480Zm80-120h120q17 0 28.5-11.5T440-400v-40h-80v20h-80v-120h80v20h80v-40q0-17-11.5-28.5T400-600H280q-17 0-28.5 11.5T240-560v160q0 17 11.5 28.5T280-360Zm240 0h120q17 0 28.5-11.5T680-400v-40h-80v20h-80v-120h80v20h80v-40q0-17-11.5-28.5T640-600H520q-17 0-28.5 11.5T480-560v160q0 17 11.5 28.5T520-360ZM200-240v-480 480Z'

// Mode labels
const MODE_LABELS = {
  off: '關閉',
  english: '英文',
  bilingual: '雙語'
}

export class BilingualButton extends shaka.ui.Element {
  /**
   * @param {string} currentMode - 'off' | 'english' | 'bilingual'
   * @param {EventTarget} events
   * @param {HTMLElement} parent
   * @param {shaka.ui.Controls} controls
   */
  constructor(currentMode, events, parent, controls) {
    super(parent, controls)

    /** @private */
    this.button_ = document.createElement('button')
    this.button_.classList.add('bilingual-button', 'shaka-tooltip')

    /** @private */
    this.icon_ = new shaka.ui.MaterialSVGIcon(this.button_, SUBTITLE_ICON)

    const label = document.createElement('label')
    label.classList.add(
      'shaka-overflow-button-label',
      'shaka-overflow-menu-only',
      'shaka-simple-overflow-button-label-inline'
    )

    /** @private */
    this.nameSpan_ = document.createElement('span')
    label.appendChild(this.nameSpan_)

    /** @private */
    this.currentState_ = document.createElement('span')
    this.currentState_.classList.add('shaka-current-selection-span')
    label.appendChild(this.currentState_)

    this.button_.appendChild(label)

    this.parent.appendChild(this.button_)

    /** @private */
    this.currentMode_ = currentMode || 'off'

    /** @private */
    this.isLoading_ = false

    /** @private */
    this.events_ = events

    // Click to cycle modes: off → english → bilingual → off
    this.eventManager.listen(this.button_, 'click', (e) => {
      e.stopPropagation()
      // Ignore clicks while loading
      if (this.isLoading_) {
        console.log('[SUBTITLE] Button click ignored - loading')
        return
      }
      console.log('[SUBTITLE] Button clicked, current mode:', this.currentMode_)
      events.dispatchEvent(new CustomEvent('cycleSubtitleMode'))
    })

    // Listen for loading state changes
    this.eventManager.listen(events, 'subtitleLoadingChanged', (/** @type {CustomEvent} */event) => {
      this.isLoading_ = event.detail.loading
      this.updateLoadingState_()
    })

    // Listen for state changes
    this.eventManager.listen(events, 'subtitleModeChanged', (/** @type {CustomEvent} */event) => {
      this.currentMode_ = event.detail.mode
      this.updateLocalisedStrings_()
    })

    this.eventManager.listen(events, 'localeChanged', () => {
      this.updateLocalisedStrings_()
    })

    this.updateLocalisedStrings_()
  }

  /** @private */
  updateLoadingState_() {
    if (this.isLoading_) {
      this.button_.classList.add('bilingual-loading')
      this.button_.style.opacity = '0.6'
      this.button_.style.pointerEvents = 'none'
    } else {
      this.button_.classList.remove('bilingual-loading')
      this.button_.style.opacity = ''
      this.button_.style.pointerEvents = ''
    }
  }

  /** @private */
  updateLocalisedStrings_() {
    this.currentState_.textContent = MODE_LABELS[this.currentMode_] || '關閉'

    const label = '字幕'
    this.nameSpan_.textContent = this.button_.ariaLabel = label

    // Visual feedback when enabled (not off)
    if (this.currentMode_ !== 'off') {
      this.button_.classList.add('bilingual-active')
    } else {
      this.button_.classList.remove('bilingual-active')
    }
  }
}
