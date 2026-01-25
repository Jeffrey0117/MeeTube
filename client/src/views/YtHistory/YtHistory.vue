<template>
  <YtLayout>
    <div class="yt-history">
      <!-- Header -->
      <div class="yt-history-header">
        <h1 class="yt-history-title">觀看記錄</h1>
        <button v-if="historyItems.length > 0" class="yt-clear-btn" @click="confirmClearAll">
          <font-awesome-icon :icon="['fas', 'trash']" />
          <span>清除所有記錄</span>
        </button>
      </div>

      <!-- Loading -->
      <div v-if="isLoading" class="yt-history-loading">
        <div v-for="i in 6" :key="'skeleton-' + i" class="yt-history-skeleton">
          <div class="yt-skeleton-thumb"></div>
          <div class="yt-skeleton-info">
            <div class="yt-skeleton-line"></div>
            <div class="yt-skeleton-line short"></div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else-if="historyItems.length === 0" class="yt-history-empty">
        <font-awesome-icon :icon="['fas', 'history']" class="yt-empty-icon" />
        <p>沒有觀看記錄</p>
        <router-link to="/yt" class="yt-browse-btn">瀏覽影片</router-link>
      </div>

      <!-- History List -->
      <div v-else class="yt-history-list">
        <div
          v-for="item in historyItems"
          :key="item.videoId"
          class="yt-history-item"
        >
          <router-link :to="`/yt/watch/${item.videoId}`" class="yt-history-link">
            <!-- Thumbnail -->
            <div class="yt-history-thumb">
              <img
                :src="getThumbnail(item)"
                :alt="item.title"
                loading="lazy"
              />
              <span v-if="item.lengthSeconds" class="yt-duration">
                {{ formatDuration(item.lengthSeconds) }}
              </span>
              <!-- Watch Progress Bar -->
              <div v-if="item.watchProgress > 0" class="yt-progress-bar">
                <div class="yt-progress-fill" :style="{ width: getProgressPercent(item) + '%' }"></div>
              </div>
            </div>

            <!-- Info -->
            <div class="yt-history-info">
              <span class="yt-history-item-title">{{ item.title }}</span>
              <span class="yt-history-author">{{ item.author }}</span>
              <span class="yt-history-meta">
                <template v-if="item.viewCount">{{ formatViews(item.viewCount) }} 次觀看</template>
                <template v-if="item.timeWatched"> · {{ formatTimeWatched(item.timeWatched) }}</template>
              </span>
            </div>
          </router-link>

          <!-- Delete Button -->
          <button class="yt-delete-btn" @click.prevent="removeItem(item.videoId)" title="移除">
            <font-awesome-icon :icon="['fas', 'times']" />
          </button>
        </div>
      </div>

      <!-- Confirm Dialog -->
      <div v-if="showConfirmDialog" class="yt-confirm-overlay" @click="showConfirmDialog = false">
        <div class="yt-confirm-dialog" @click.stop>
          <h3>確認清除</h3>
          <p>確定要清除所有觀看記錄嗎？此操作無法復原。</p>
          <div class="yt-confirm-actions">
            <button class="yt-cancel-btn" @click="showConfirmDialog = false">取消</button>
            <button class="yt-confirm-btn" @click="clearAllHistory">確認清除</button>
          </div>
        </div>
      </div>
    </div>
  </YtLayout>
</template>

<script>
import { mapActions, mapGetters } from 'vuex'
import { YtLayout } from '../../components/yt-theme'

export default {
  name: 'YtHistory',
  components: {
    YtLayout
  },
  data() {
    return {
      isLoading: true,
      showConfirmDialog: false
    }
  },
  computed: {
    ...mapGetters(['getHistoryCacheSorted']),
    historyItems() {
      return this.getHistoryCacheSorted || []
    }
  },
  async mounted() {
    await this.loadHistory()
  },
  methods: {
    ...mapActions(['grabHistory', 'removeFromHistory', 'removeAllHistory']),

    async loadHistory() {
      this.isLoading = true
      try {
        await this.grabHistory()
      } catch (e) {
        console.error('Failed to load history:', e)
      }
      this.isLoading = false
    },

    getThumbnail(item) {
      if (item.videoThumbnails && item.videoThumbnails.length > 0) {
        const preferred = item.videoThumbnails.find(t =>
          t.quality === 'medium' || t.quality === 'mqdefault'
        )
        return preferred?.url || item.videoThumbnails[0].url
      }
      return `/vi/${item.videoId}/mqdefault.jpg`
    },

    getProgressPercent(item) {
      if (!item.watchProgress || !item.lengthSeconds) return 0
      return Math.min(100, (item.watchProgress / item.lengthSeconds) * 100)
    },

    formatDuration(seconds) {
      if (!seconds) return ''
      const h = Math.floor(seconds / 3600)
      const m = Math.floor((seconds % 3600) / 60)
      const s = seconds % 60
      if (h > 0) {
        return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
      }
      return `${m}:${s.toString().padStart(2, '0')}`
    },

    formatViews(count) {
      if (!count) return '0'
      if (count >= 100000000) return (count / 100000000).toFixed(1) + ' 億'
      if (count >= 10000) return (count / 10000).toFixed(1) + ' 萬'
      return count.toLocaleString()
    },

    formatTimeWatched(timestamp) {
      if (!timestamp) return ''
      const now = Date.now()
      const diff = now - timestamp
      const seconds = Math.floor(diff / 1000)
      const minutes = Math.floor(seconds / 60)
      const hours = Math.floor(minutes / 60)
      const days = Math.floor(hours / 24)

      if (days > 0) return `${days} 天前`
      if (hours > 0) return `${hours} 小時前`
      if (minutes > 0) return `${minutes} 分鐘前`
      return '剛剛'
    },

    async removeItem(videoId) {
      try {
        await this.removeFromHistory(videoId)
      } catch (e) {
        console.error('Failed to remove history item:', e)
      }
    },

    confirmClearAll() {
      this.showConfirmDialog = true
    },

    async clearAllHistory() {
      try {
        await this.removeAllHistory()
        this.showConfirmDialog = false
      } catch (e) {
        console.error('Failed to clear history:', e)
      }
    }
  }
}
</script>

<style scoped>
.yt-history {
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
}

.yt-history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.yt-history-title {
  font-size: 24px;
  font-weight: 600;
  color: var(--primary-text-color, #0f0f0f);
}

.yt-clear-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border: none;
  border-radius: 18px;
  background-color: transparent;
  color: var(--tertiary-text-color, #606060);
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.yt-clear-btn:hover {
  background-color: var(--side-nav-hover-color, rgba(0, 0, 0, 0.1));
}

/* Loading Skeleton */
.yt-history-loading {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.yt-history-skeleton {
  display: flex;
  gap: 16px;
}

.yt-skeleton-thumb {
  width: 168px;
  height: 94px;
  border-radius: 8px;
  background-color: var(--side-nav-hover-color, #e5e5e5);
  animation: pulse 1.5s infinite;
}

.yt-skeleton-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.yt-skeleton-line {
  height: 16px;
  background-color: var(--side-nav-hover-color, #e5e5e5);
  border-radius: 4px;
  animation: pulse 1.5s infinite;
}

.yt-skeleton-line.short {
  width: 60%;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* Empty State */
.yt-history-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 24px;
  text-align: center;
}

.yt-empty-icon {
  font-size: 64px;
  color: var(--tertiary-text-color, #909090);
  margin-bottom: 16px;
}

.yt-history-empty p {
  font-size: 16px;
  color: var(--secondary-text-color, #606060);
  margin-bottom: 24px;
}

.yt-browse-btn {
  padding: 10px 24px;
  background-color: var(--primary-color, #065fd4);
  color: #fff;
  border-radius: 18px;
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
}

.yt-browse-btn:hover {
  background-color: var(--primary-color-hover, #0550b3);
}

/* History List */
.yt-history-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.yt-history-item {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  position: relative;
}

.yt-history-link {
  display: flex;
  gap: 16px;
  flex: 1;
  text-decoration: none;
}

.yt-history-thumb {
  position: relative;
  width: 168px;
  min-width: 168px;
  aspect-ratio: 16 / 9;
  border-radius: 8px;
  overflow: hidden;
  background-color: var(--side-nav-hover-color, #e5e5e5);
}

.yt-history-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.yt-duration {
  position: absolute;
  bottom: 4px;
  right: 4px;
  background-color: rgba(0, 0, 0, 0.8);
  color: #fff;
  font-size: 12px;
  font-weight: 500;
  padding: 2px 4px;
  border-radius: 4px;
}

.yt-progress-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  background-color: rgba(255, 255, 255, 0.3);
}

.yt-progress-fill {
  height: 100%;
  background-color: #ff0000;
}

.yt-history-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.yt-history-item-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--primary-text-color, #0f0f0f);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.yt-history-author {
  font-size: 12px;
  color: var(--tertiary-text-color, #606060);
}

.yt-history-meta {
  font-size: 12px;
  color: var(--tertiary-text-color, #606060);
}

.yt-delete-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--tertiary-text-color, #606060);
  font-size: 14px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s, background-color 0.15s;
}

.yt-history-item:hover .yt-delete-btn {
  opacity: 1;
}

.yt-delete-btn:hover {
  background-color: var(--side-nav-hover-color, rgba(0, 0, 0, 0.1));
}

/* Confirm Dialog */
.yt-confirm-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.yt-confirm-dialog {
  background-color: var(--bg-color, #fff);
  border-radius: 12px;
  padding: 24px;
  max-width: 400px;
  width: 90%;
}

.yt-confirm-dialog h3 {
  font-size: 18px;
  font-weight: 600;
  color: var(--primary-text-color, #0f0f0f);
  margin-bottom: 12px;
}

.yt-confirm-dialog p {
  font-size: 14px;
  color: var(--secondary-text-color, #606060);
  margin-bottom: 24px;
}

.yt-confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.yt-cancel-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 18px;
  background: transparent;
  color: var(--primary-text-color, #0f0f0f);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.yt-cancel-btn:hover {
  background-color: var(--side-nav-hover-color, rgba(0, 0, 0, 0.1));
}

.yt-confirm-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 18px;
  background-color: #065fd4;
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.yt-confirm-btn:hover {
  background-color: #0550b3;
}

/* Mobile */
@media screen and (max-width: 639px) {
  .yt-history {
    padding: 16px;
  }

  .yt-history-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .yt-history-title {
    font-size: 20px;
  }

  .yt-history-item {
    gap: 12px;
  }

  .yt-history-thumb {
    width: 120px;
    min-width: 120px;
  }

  .yt-skeleton-thumb {
    width: 120px;
    height: 68px;
  }

  .yt-delete-btn {
    opacity: 1;
    width: 32px;
    height: 32px;
  }
}
</style>
