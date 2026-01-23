<template>
  <YtLayout>
    <div class="yt-home">
      <!-- Video Grid -->
      <div class="yt-video-grid">
        <!-- Skeleton Loading -->
        <template v-if="isLoading">
          <div v-for="i in 12" :key="'skeleton-' + i" class="yt-skeleton">
            <div class="yt-skeleton-thumb"></div>
            <div class="yt-skeleton-info">
              <div class="yt-skeleton-avatar"></div>
              <div class="yt-skeleton-text">
                <div class="yt-skeleton-line"></div>
                <div class="yt-skeleton-line short"></div>
                <div class="yt-skeleton-line shorter"></div>
              </div>
            </div>
          </div>
        </template>

        <!-- Actual Videos -->
        <template v-else>
          <YtVideoCard
            v-for="video in videos"
            :key="video.videoId"
            :video="video"
          />
        </template>
      </div>

      <!-- Empty State -->
      <div v-if="!isLoading && videos.length === 0" class="yt-empty">
        找不到影片
      </div>
    </div>
  </YtLayout>
</template>

<script>
import { YtLayout, YtVideoCard } from '../../components/yt-theme'

export default {
  name: 'YtDemo',
  components: {
    YtLayout,
    YtVideoCard
  },
  data() {
    return {
      videos: [],
      isLoading: true
    }
  },
  async mounted() {
    await this.fetchVideos()
  },
  methods: {
    async fetchVideos() {
      this.isLoading = true
      try {
        const response = await fetch('/api/v1/popular/')
        if (response.ok) {
          const data = await response.json()
          this.videos = data.slice(0, 20)
        }
      } catch (e) {
        console.error('Failed to fetch videos:', e)
      }
      this.isLoading = false
    }
  }
}
</script>

<style scoped>
.yt-home {
  padding: 16px;
}

.yt-video-grid {
  display: grid;
  grid-template-columns: repeat(1, 1fr);
  gap: 16px;
}

@media screen and (min-width: 640px) {
  .yt-video-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media screen and (min-width: 1024px) {
  .yt-video-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media screen and (min-width: 1280px) {
  .yt-video-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

/* Skeleton Loading */
.yt-skeleton {
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.yt-skeleton-thumb {
  aspect-ratio: 16 / 9;
  border-radius: 12px;
  background-color: var(--side-nav-hover-color, #e5e5e5);
}

.yt-skeleton-info {
  display: flex;
  margin-top: 12px;
}

.yt-skeleton-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background-color: var(--side-nav-hover-color, #e5e5e5);
  flex-shrink: 0;
}

.yt-skeleton-text {
  margin-left: 12px;
  flex: 1;
}

.yt-skeleton-line {
  height: 14px;
  background-color: var(--side-nav-hover-color, #e5e5e5);
  border-radius: 4px;
  margin-bottom: 8px;
}

.yt-skeleton-line.short {
  width: 75%;
}

.yt-skeleton-line.shorter {
  width: 50%;
}

.yt-empty {
  text-align: center;
  padding: 32px;
  color: var(--tertiary-text-color, #606060);
}
</style>
