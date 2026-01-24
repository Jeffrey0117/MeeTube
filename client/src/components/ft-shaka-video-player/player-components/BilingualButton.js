import shaka from 'shaka-player/dist/shaka-player.ui'

// Translate icon (Google Translate style)
const TRANSLATE_ICON = 'M480-80q-17 0-28.5-11.5T440-120v-80q0-17 11.5-28.5T480-240h80v-103q-48-10-87.5-37T408-450q-32 27-71.5 44.5T248-380q-17 3-30.5-7T200-416q0-18 12.5-29.5T243-458q42-8 75.5-28t57.5-50q-48-55-72.5-115T271-780q-2-17 9-28.5t28-11.5q17 0 28.5 12t9.5 29q7 57 32 107.5T447-580l-56 56q-11 11-11 28t11 28q11 11 28 11t28-11l76-76q35 28 76.5 47.5T693-469q17 2 29 14t12 32q0 18-13.5 29.5T690-380q-43-5-82.5-18T534-433l64-64 42 42 28-28-42-42-28 28-56 56q-26-21-46.5-47.5T460-543v-117h80q17 0 28.5-11.5T580-700q0-17-11.5-28.5T540-740H260q-17 0-28.5 11.5T220-700q0 17 11.5 28.5T260-660h120v117q-14 28-34.5 54.5T299-441L196-544q-11-11-28-11t-28 11q-11 11-11 28t11 28l103 103q-18 16-38 30t-42 26q-17 6-26 22t-3 33q6 17 22 25t33-2q42-18 79-44t69-58q27 32 59.5 56.5T467-269v129q0 17 11.5 28.5T507-100h213q17 0 28.5-11.5T760-140q0-17-11.5-28.5T720-180H560v-60h160q17 0 28.5-11.5T760-280q0-17-11.5-28.5T720-320H560v-41q66-10 124.5-45T774-480q34-39 50-89t16-106q0-17-11.5-28.5T800-715q-17 0-28.5 11.5T760-675q0 47-14 85t-40 69q-31-39-47.5-87T642-700q-2-17 9-28.5t28-11.5q17 0 29 11.5t14 28.5q8 53 30 100.5t56 84.5q-30 30-67 49.5T662-440v160q0 17 11.5 28.5T702-240h58q17 0 28.5 11.5T800-200v80q0 17-11.5 28.5T760-80H480Z'

export class BilingualButton extends shaka.ui.Element {
  /**
   * @param {boolean} bilingualEnabled
   * @param {EventTarget} events
   * @param {HTMLElement} parent
   * @param {shaka.ui.Controls} controls
   */
  constructor(bilingualEnabled, events, parent, controls) {
    super(parent, controls)

    /** @private */
    this.button_ = document.createElement('button')
    this.button_.classList.add('bilingual-button', 'shaka-tooltip')

    /** @private */
    this.icon_ = new shaka.ui.MaterialSVGIcon(this.button_, TRANSLATE_ICON)

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
    this.bilingualEnabled_ = bilingualEnabled

    /** @private */
    this.events_ = events

    // Toggle on click
    this.eventManager.listen(this.button_, 'click', (e) => {
      e.stopPropagation()
      console.log('[BILINGUAL] Button clicked')
      events.dispatchEvent(new CustomEvent('toggleBilingualMode'))
    })

    // Long press to cycle modes
    let pressTimer = null
    this.eventManager.listen(this.button_, 'mousedown', () => {
      pressTimer = setTimeout(() => {
        events.dispatchEvent(new CustomEvent('cycleBilingualDisplayMode'))
        pressTimer = null
      }, 500)
    })

    this.eventManager.listen(this.button_, 'mouseup', () => {
      if (pressTimer) {
        clearTimeout(pressTimer)
        pressTimer = null
      }
    })

    // Listen for state changes
    this.eventManager.listen(events, 'bilingualStateChanged', (/** @type {CustomEvent} */event) => {
      this.bilingualEnabled_ = event.detail.enabled
      this.updateLocalisedStrings_()
    })

    this.eventManager.listen(events, 'localeChanged', () => {
      this.updateLocalisedStrings_()
    })

    this.updateLocalisedStrings_()
  }

  /** @private */
  updateLocalisedStrings_() {
    this.currentState_.textContent = this.bilingualEnabled_ ? '開' : '關'

    const label = '雙語字幕'
    this.nameSpan_.textContent = this.button_.ariaLabel = label

    // Visual feedback when enabled
    if (this.bilingualEnabled_) {
      this.button_.classList.add('bilingual-active')
    } else {
      this.button_.classList.remove('bilingual-active')
    }
  }
}
