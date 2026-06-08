import shaka from 'shaka-player/dist/shaka-player.ui'

const SUBTITLE_ICON = 'M200-160q-33 0-56.5-23.5T120-240v-480q0-33 23.5-56.5T200-800h560q33 0 56.5 23.5T840-720v480q0 33-23.5 56.5T760-160H200Zm0-80h560v-480H200v480Zm80-120h120q17 0 28.5-11.5T440-400v-40h-80v20h-80v-120h80v20h80v-40q0-17-11.5-28.5T400-600H280q-17 0-28.5 11.5T240-560v160q0 17 11.5 28.5T280-360Zm240 0h120q17 0 28.5-11.5T680-400v-40h-80v20h-80v-120h80v20h80v-40q0-17-11.5-28.5T640-600H520q-17 0-28.5 11.5T480-560v160q0 17 11.5 28.5T520-360ZM200-240v-480 480Z'

const MODES = [
  { key: 'off', label: '關閉' },
  { key: 'english', label: '英文字幕' },
  { key: 'bilingual', label: '雙語字幕' },
]

export class BilingualButton extends shaka.ui.Element {
  constructor(currentMode, events, parent, controls) {
    super(parent, controls)

    this.button_ = document.createElement('button')
    this.button_.classList.add('bilingual-button', 'shaka-tooltip')

    this.icon_ = new shaka.ui.MaterialSVGIcon(this.button_, SUBTITLE_ICON)

    const label = document.createElement('label')
    label.classList.add(
      'shaka-overflow-button-label',
      'shaka-overflow-menu-only',
      'shaka-simple-overflow-button-label-inline'
    )

    this.nameSpan_ = document.createElement('span')
    label.appendChild(this.nameSpan_)

    this.currentState_ = document.createElement('span')
    this.currentState_.classList.add('shaka-current-selection-span')
    label.appendChild(this.currentState_)

    this.button_.appendChild(label)
    this.parent.appendChild(this.button_)

    this.currentMode_ = currentMode || 'off'
    this.isLoading_ = false
    this.events_ = events
    this.popup_ = null

    this.eventManager.listen(this.button_, 'click', (e) => {
      e.stopPropagation()
      if (this.isLoading_) return
      if (this.popup_) {
        this.closePopup_()
      } else {
        this.openPopup_()
      }
    })

    this.boundClosePopup_ = (e) => {
      if (this.popup_ && !this.popup_.contains(e.target) && !this.button_.contains(e.target)) {
        this.closePopup_()
      }
    }
    document.addEventListener('click', this.boundClosePopup_, true)

    this.eventManager.listen(events, 'subtitleLoadingChanged', (event) => {
      this.isLoading_ = event.detail.loading
      this.updateLoadingState_()
    })

    this.eventManager.listen(events, 'subtitleModeChanged', (event) => {
      this.currentMode_ = event.detail.mode
      this.updateLocalisedStrings_()
    })

    this.updateLocalisedStrings_()
  }

  openPopup_() {
    this.closePopup_()

    const popup = document.createElement('div')
    popup.style.cssText = `
      position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%);
      background: rgba(28,28,28,0.95); border-radius: 8px; padding: 4px 0;
      min-width: 130px; z-index: 9999; margin-bottom: 8px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.5);
    `

    for (const mode of MODES) {
      const item = document.createElement('div')
      const isActive = mode.key === this.currentMode_
      item.textContent = `${isActive ? '✓ ' : '   '}${mode.label}`
      item.style.cssText = `
        padding: 8px 16px; color: ${isActive ? '#3ea6ff' : '#fff'}; cursor: pointer;
        font-size: 13px; white-space: nowrap; font-weight: ${isActive ? '600' : '400'};
      `
      item.addEventListener('mouseenter', () => { item.style.background = 'rgba(255,255,255,0.1)' })
      item.addEventListener('mouseleave', () => { item.style.background = 'none' })
      item.addEventListener('click', (e) => {
        e.stopPropagation()
        this.closePopup_()
        if (mode.key !== this.currentMode_) {
          this.events_.dispatchEvent(new CustomEvent('setSubtitleMode', { detail: { mode: mode.key } }))
        }
      })
      popup.appendChild(item)
    }

    this.button_.style.position = 'relative'
    this.button_.appendChild(popup)
    this.popup_ = popup
  }

  closePopup_() {
    if (this.popup_) {
      this.popup_.remove()
      this.popup_ = null
    }
  }

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

  updateLocalisedStrings_() {
    const modeLabel = MODES.find(m => m.key === this.currentMode_)?.label || '關閉'
    this.currentState_.textContent = modeLabel

    this.nameSpan_.textContent = this.button_.ariaLabel = '字幕'

    if (this.currentMode_ !== 'off') {
      this.button_.classList.add('bilingual-active')
    } else {
      this.button_.classList.remove('bilingual-active')
    }
  }

  release() {
    document.removeEventListener('click', this.boundClosePopup_, true)
    this.closePopup_()
    super.release()
  }
}
