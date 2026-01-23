import shaka from 'shaka-player/dist/shaka-player.ui'

import i18n from '../../../i18n/index'
import { PlayerIcons } from '../../../../constants'

export class EqualizerButton extends shaka.ui.Element {
  /**
   * @param {boolean} equalizerEnabled
   * @param {EventTarget} events
   * @param {HTMLElement} parent
   * @param {shaka.ui.Controls} controls
   */
  constructor(equalizerEnabled, events, parent, controls) {
    super(parent, controls)

    /** @private */
    this.button_ = document.createElement('button')
    this.button_.classList.add('equalizer-button', 'shaka-tooltip')

    /** @private */
    this.icon_ = new shaka.ui.MaterialSVGIcon(this.button_, PlayerIcons.TUNE_FILLED)

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
    this.equalizerEnabled_ = equalizerEnabled

    // listeners

    this.eventManager.listen(this.button_, 'click', (e) => {
      e.stopPropagation()
      console.log('[EQ] Button clicked, dispatching toggleEqualizerPanel')
      events.dispatchEvent(new CustomEvent('toggleEqualizerPanel'))
    })

    this.eventManager.listen(events, 'equalizerStateChanged', (/** @type {CustomEvent} */event) => {
      this.equalizerEnabled_ = event.detail.enabled
      this.updateLocalisedStrings_()
    })

    this.eventManager.listen(events, 'localeChanged', () => {
      this.updateLocalisedStrings_()
    })

    this.updateLocalisedStrings_()
  }

  /** @private */
  updateLocalisedStrings_() {
    this.currentState_.textContent = this.localization.resolve(this.equalizerEnabled_ ? 'ON' : 'OFF')

    const label = i18n.global.t('Video.Player.Equalizer')
    this.nameSpan_.textContent = this.button_.ariaLabel = label
  }
}
