<template>
  <div
    v-if="visible && currentSubtitle"
    ref="overlayRef"
    class="bilingual-subtitle-overlay"
    :style="overlayStyle"
  >
    <!-- Drag Handle -->
    <div
      class="drag-handle"
      @mousedown="onDragStart"
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
        :style="translationStyle"
      >
        {{ currentSubtitle.translation }}
      </div>

      <!-- Original -->
      <div
        v-if="displayMode !== 'translationOnly'"
        class="subtitle-original"
        :style="originalStyle"
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
    // Font size
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

    const originalStyle = computed(() => ({
      fontSize: `${props.fontSize}px`,
    }))

    const translationStyle = computed(() => ({
      fontSize: `${props.fontSize}px`,
    }))

    // Drag handlers
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

    onMounted(() => {
      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', onMouseUp)
    })

    onBeforeUnmount(() => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    })

    return {
      overlayRef,
      topPercent,
      showHandle,
      showTranslation,
      overlayStyle,
      contentStyle,
      originalStyle,
      translationStyle,
      onDragStart,
      onHandleLeave,
    }
  }
})
</script>

<style scoped>
.bilingual-subtitle-overlay {
  position: absolute;
  left: 0;
  right: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  pointer-events: none;
  z-index: 9999;
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
}

.subtitle-translation {
  color: #ffeb3b;
  font-weight: 500;
  line-height: 1.4;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
}

/* Mobile styles */
@media only screen and (max-width: 680px) {
  .subtitle-content {
    max-width: 95%;
    padding: 6px 12px;
  }

  .subtitle-original,
  .subtitle-translation {
    font-size: 16px !important;
  }
}
</style>
