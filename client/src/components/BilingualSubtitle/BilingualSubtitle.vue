<template>
  <div
    v-if="visible && currentSubtitle"
    ref="overlayRef"
    class="bilingual-subtitle-overlay"
    :class="{ 'mobile-mode': isMobilePortrait }"
    :style="!isMobilePortrait ? overlayStyle : {}"
  >
    <!-- Drag Handle (desktop only) -->
    <div
      v-if="!isMobilePortrait"
      class="drag-handle"
      @mousedown="onDragStart"
      @touchstart.prevent="onTouchStart"
      @mouseenter="showHandle = true"
      @mouseleave="onHandleLeave"
      :style="{ opacity: showHandle ? 1 : 0 }"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
        <path d="M8 6h8M8 12h8M8 18h8" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      </svg>
    </div>

    <!-- Subtitle Content -->
    <div class="subtitle-content" :style="contentStyle">
      <!-- Translation (above) -->
      <div
        v-if="showTranslation && displayMode !== 'originalOnly' && currentSubtitle.translation"
        class="subtitle-translation"
      >
        {{ currentSubtitle.translation }}
      </div>

      <!-- Original -->
      <div
        v-if="displayMode !== 'translationOnly'"
        class="subtitle-original"
      >
        {{ currentSubtitle.text }}
      </div>
    </div>
  </div>
</template>

<script>
import { defineComponent, ref, computed, onMounted, onBeforeUnmount } from 'vue'

export default defineComponent({
  name: 'BilingualSubtitle',
  props: {
    // Current subtitle object { text, translation, start, end }
    currentSubtitle: {
      type: Object,
      default: null
    },
    // Display mode: 'bilingual' | 'originalOnly' | 'translationOnly'
    displayMode: {
      type: String,
      default: 'bilingual'
    },
    // Whether to show subtitle
    visible: {
      type: Boolean,
      default: true
    },
    // Container element for boundary calculation
    containerRef: {
      type: Object,
      default: null
    },
    // Font size (desktop)
    fontSize: {
      type: Number,
      default: 20
    },
    // Background opacity (0-100)
    backgroundOpacity: {
      type: Number,
      default: 75
    }
  },
  setup(props) {
    const overlayRef = ref(null)
    const topPercent = ref(70)
    const showHandle = ref(false)
    const isDragging = ref(false)
    const startY = ref(0)
    const startPercent = ref(0)
    const windowWidth = ref(window.innerWidth)
    const isPortrait = ref(window.innerHeight > window.innerWidth)

    // Mobile portrait detection (< 680px width AND portrait orientation)
    const isMobilePortrait = computed(() => {
      return windowWidth.value <= 680 && isPortrait.value
    })

    // Show translation only if we have it
    const showTranslation = computed(() => {
      return props.currentSubtitle?.translation && props.displayMode !== 'originalOnly'
    })

    const overlayStyle = computed(() => ({
      top: `${topPercent.value}%`,
    }))

    const contentStyle = computed(() => ({
      backgroundColor: `rgba(0, 0, 0, ${props.backgroundOpacity / 100})`,
    }))

    // Drag handlers (mouse)
    const onDragStart = (e) => {
      if (e.button !== 0) return
      isDragging.value = true
      startY.value = e.clientY
      startPercent.value = topPercent.value
      e.preventDefault()
    }

    const onMouseMove = (e) => {
      if (!isDragging.value) return

      const boundary = props.containerRef || overlayRef.value?.parentElement
      if (!boundary) return

      const boundaryRect = boundary.getBoundingClientRect()
      const deltaPercent = ((e.clientY - startY.value) / boundaryRect.height) * 100
      const newPercent = startPercent.value + deltaPercent

      topPercent.value = Math.max(5, Math.min(85, newPercent))
    }

    const onMouseUp = () => {
      isDragging.value = false
    }

    const onHandleLeave = () => {
      if (!isDragging.value) {
        showHandle.value = false
      }
    }

    // Touch handlers (mobile)
    const onTouchStart = (e) => {
      if (e.touches.length !== 1) return
      isDragging.value = true
      startY.value = e.touches[0].clientY
      startPercent.value = topPercent.value
      showHandle.value = true
    }

    const onTouchMove = (e) => {
      if (!isDragging.value || e.touches.length !== 1) return

      const boundary = props.containerRef || overlayRef.value?.parentElement
      if (!boundary) return

      const boundaryRect = boundary.getBoundingClientRect()
      const deltaPercent = ((e.touches[0].clientY - startY.value) / boundaryRect.height) * 100
      const newPercent = startPercent.value + deltaPercent

      topPercent.value = Math.max(5, Math.min(85, newPercent))
    }

    const onTouchEnd = () => {
      isDragging.value = false
      showHandle.value = false
    }

    // Window resize handler
    const onResize = () => {
      windowWidth.value = window.innerWidth
      isPortrait.value = window.innerHeight > window.innerWidth
    }

    onMounted(() => {
      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', onMouseUp)
      window.addEventListener('touchmove', onTouchMove, { passive: true })
      window.addEventListener('touchend', onTouchEnd)
      window.addEventListener('resize', onResize)
    })

    onBeforeUnmount(() => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('resize', onResize)
    })

    return {
      overlayRef,
      topPercent,
      showHandle,
      showTranslation,
      isMobilePortrait,
      overlayStyle,
      contentStyle,
      onDragStart,
      onTouchStart,
      onHandleLeave,
    }
  }
})
</script>

<style scoped>
/* Desktop/Landscape: Overlay on video (absolute positioning) */
.bilingual-subtitle-overlay {
  position: absolute;
  left: 0;
  right: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  pointer-events: none;
  z-index: 100;
}

/* Mobile portrait mode - below video (relative positioning) */
.bilingual-subtitle-overlay.mobile-mode {
  position: relative;
  top: auto !important;
  padding: 12px 8px;
  background-color: var(--bg-color, #0f0f0f);
  min-height: 60px;
}

.drag-handle {
  margin-bottom: 4px;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: grab;
  background-color: rgba(0, 0, 0, 0.75);
  transition: opacity 0.2s;
  pointer-events: auto;
}

.drag-handle:active {
  cursor: grabbing;
}

.subtitle-content {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-width: 80%;
  padding: 8px 16px;
  border-radius: 4px;
  text-align: center;
  pointer-events: auto;
}

.subtitle-original {
  color: #ffffff;
  font-weight: 400;
  line-height: 1.4;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
  font-size: 18px;
}

.subtitle-translation {
  color: #ffeb3b;
  font-weight: 500;
  line-height: 1.4;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
  font-size: 18px;
}

/* Mobile portrait - outside video, cleaner look */
.mobile-mode .subtitle-content {
  max-width: 100%;
  padding: 8px 16px;
  border-radius: 0;
  background-color: transparent !important;
}

.mobile-mode .subtitle-original {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.8);
  text-shadow: none;
  font-weight: 400;
}

.mobile-mode .subtitle-translation {
  font-size: 16px;
  color: #ffeb3b;
  text-shadow: none;
  font-weight: 500;
}

/* Mobile landscape - overlay on video */
@media only screen and (max-width: 900px) and (orientation: landscape) {
  .subtitle-content {
    max-width: 90%;
    padding: 6px 12px;
  }

  .subtitle-original,
  .subtitle-translation {
    font-size: 16px;
  }
}

/* Tablet */
@media only screen and (min-width: 681px) and (max-width: 1024px) {
  .subtitle-original,
  .subtitle-translation {
    font-size: 17px;
  }
}

/* Desktop */
@media only screen and (min-width: 1025px) {
  .subtitle-original,
  .subtitle-translation {
    font-size: 20px;
  }
}
</style>
