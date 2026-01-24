<template>
  <div
    v-if="visible && currentSubtitle"
    ref="overlayRef"
    class="bilingual-subtitle-overlay"
    :class="{ 'mobile-mode': isMobile }"
    :style="overlayStyle"
  >
    <!-- Drag Handle -->
    <div
      class="drag-handle"
      @mousedown="onDragStart"
      @touchstart.prevent="onTouchStart"
      @mouseenter="showHandle = true"
      @mouseleave="onHandleLeave"
      :class="{ 'handle-visible': showHandle || isDragging }"
    >
      <svg width="20" height="8" viewBox="0 0 20 8" fill="currentColor">
        <rect x="0" y="0" width="20" height="2" rx="1" />
        <rect x="0" y="6" width="20" height="2" rx="1" />
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
    const topPercent = ref(75) // Position at 75% from top (near bottom)
    const showHandle = ref(false)
    const isDragging = ref(false)
    const startY = ref(0)
    const startPercent = ref(0)
    const windowWidth = ref(window.innerWidth)

    // Mobile detection (< 680px width)
    const isMobile = computed(() => {
      return windowWidth.value <= 680
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
      isDragging,
      showTranslation,
      isMobile,
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
/* Always overlay on video */
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

/* Drag Handle */
.drag-handle {
  padding: 6px 12px;
  margin-bottom: 4px;
  border-radius: 4px;
  cursor: grab;
  color: rgba(255, 255, 255, 0.3);
  background-color: transparent;
  transition: all 0.2s ease;
  pointer-events: auto;
  opacity: 0;
}

.drag-handle:hover,
.drag-handle.handle-visible {
  opacity: 1;
  color: rgba(255, 255, 255, 0.8);
  background-color: rgba(0, 0, 0, 0.5);
}

.drag-handle:active {
  cursor: grabbing;
  color: #ffeb3b;
}

.subtitle-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: 90%;
  padding: 6px 12px;
  border-radius: 4px;
  text-align: center;
}

.subtitle-original {
  color: #ffffff;
  font-weight: 400;
  line-height: 1.3;
  text-shadow:
    1px 1px 2px rgba(0, 0, 0, 0.9),
    -1px -1px 2px rgba(0, 0, 0, 0.9);
}

.subtitle-translation {
  color: #ffeb3b;
  font-weight: 500;
  line-height: 1.3;
  text-shadow:
    1px 1px 2px rgba(0, 0, 0, 0.9),
    -1px -1px 2px rgba(0, 0, 0, 0.9);
}

/* Desktop: larger text */
.subtitle-original {
  font-size: 18px;
}

.subtitle-translation {
  font-size: 18px;
}

/* Mobile: smaller, compact text */
.mobile-mode .subtitle-content {
  max-width: 95%;
  padding: 4px 8px;
  gap: 2px;
}

.mobile-mode .subtitle-original {
  font-size: 13px;
}

.mobile-mode .subtitle-translation {
  font-size: 14px;
}

/* Mobile: always show drag handle for touch */
.mobile-mode .drag-handle {
  opacity: 0.6;
  padding: 8px 16px;
}

/* Tablet */
@media only screen and (min-width: 681px) and (max-width: 1024px) {
  .subtitle-original,
  .subtitle-translation {
    font-size: 16px;
  }
}
</style>
