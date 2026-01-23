<template>
  <router-link :to="`/yt/watch/${video.videoId}`" class="yt-video-card">
    <!-- Thumbnail -->
    <div class="yt-thumbnail">
      <img
        v-if="thumbnailUrl"
        :src="thumbnailUrl"
        :alt="video.title"
        loading="lazy"
      />
      <span v-if="video.lengthSeconds" class="yt-duration">
        {{ formatDuration(video.lengthSeconds) }}
      </span>
      <span v-if="video.liveNow" class="yt-live-badge">LIVE</span>
    </div>

    <!-- Info -->
    <div class="yt-info">
      <!-- Channel Avatar -->
      <div class="yt-avatar" :style="{ backgroundColor: avatarColor }">
        <img
          v-if="channelThumbnail"
          :src="channelThumbnail"
          :alt="video.author"
          @error="handleImageError"
        />
        <span v-else class="yt-avatar-text">{{ channelInitial }}</span>
      </div>

      <!-- Text Info -->
      <div class="yt-text">
        <span class="yt-title">{{ video.title }}</span>
        <span class="yt-author">
          {{ video.author }}
          <font-awesome-icon v-if="video.authorVerified" :icon="['fas', 'check-circle']" class="yt-verified" />
        </span>
        <div class="yt-meta">
          <span>{{ formatViews(video.viewCount) }} 次觀看</span>
          <span class="yt-dot">•</span>
          <span>{{ formatPublishedText(video.publishedText) || formatPublished(video.published) }}</span>
        </div>
      </div>
    </div>
  </router-link>
</template>

<script>
export default {
  name: 'YtVideoCard',
  props: {
    video: {
      type: Object,
      required: true
    }
  },
  computed: {
    thumbnailUrl() {
      if (this.video.videoThumbnails && this.video.videoThumbnails.length > 0) {
        const medium = this.video.videoThumbnails.find(t => t.quality === 'medium' || t.quality === 'mqdefault')
        return medium?.url || this.video.videoThumbnails[0].url
      }
      return ''
    },
    channelThumbnail() {
      if (this.video.authorThumbnails && this.video.authorThumbnails.length > 0) {
        let url = this.video.authorThumbnails[0].url
        if (url.startsWith('//')) {
          url = 'https:' + url
        }
        if (url.includes('yt3.ggpht.com')) {
          const path = url.replace(/https?:\/\/yt3\.ggpht\.com/, '')
          return '/ggpht' + path
        }
        if (url.includes('yt3.googleusercontent.com')) {
          const path = url.replace(/https?:\/\/yt3\.googleusercontent\.com/, '')
          return '/ggpht' + path
        }
        if (url.startsWith('http')) {
          const encoded = btoa(url).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
          return '/imgproxy?url=' + encoded
        }
        return url
      }
      return ''
    },
    channelInitial() {
      return this.video.author ? this.video.author.charAt(0).toUpperCase() : '?'
    },
    avatarColor() {
      // Generate consistent color based on author name
      const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899']
      if (!this.video.author) return colors[0]
      const index = this.video.author.charCodeAt(0) % colors.length
      return colors[index]
    }
  },
  methods: {
    handleImageError(e) {
      e.target.style.display = 'none'
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
    formatPublishedText(text) {
      if (!text) return ''
      return text
        .replace(/(\d+)\s*years?\s*ago/i, '$1 年前')
        .replace(/(\d+)\s*months?\s*ago/i, '$1 個月前')
        .replace(/(\d+)\s*weeks?\s*ago/i, '$1 週前')
        .replace(/(\d+)\s*days?\s*ago/i, '$1 天前')
        .replace(/(\d+)\s*hours?\s*ago/i, '$1 小時前')
        .replace(/(\d+)\s*minutes?\s*ago/i, '$1 分鐘前')
        .replace(/(\d+)\s*seconds?\s*ago/i, '$1 秒前')
        .replace(/just now/i, '剛剛')
        .replace(/streamed/i, '直播於')
        .replace(/premiered/i, '首播於')
    },
    formatPublished(timestamp) {
      if (!timestamp) return ''
      const now = Date.now()
      const diff = now - timestamp
      const seconds = Math.floor(diff / 1000)
      const minutes = Math.floor(seconds / 60)
      const hours = Math.floor(minutes / 60)
      const days = Math.floor(hours / 24)
      const months = Math.floor(days / 30)
      const years = Math.floor(days / 365)

      if (years > 0) return `${years} 年前`
      if (months > 0) return `${months} 個月前`
      if (days > 0) return `${days} 天前`
      if (hours > 0) return `${hours} 小時前`
      if (minutes > 0) return `${minutes} 分鐘前`
      return '剛剛'
    }
  }
}
</script>

<style scoped>
.yt-video-card {
  display: block;
  text-decoration: none;
  margin-bottom: 16px;
}

.yt-thumbnail {
  position: relative;
  aspect-ratio: 16 / 9;
  border-radius: 12px;
  overflow: hidden;
  background-color: var(--side-nav-hover-color, #e5e5e5);
}

.yt-thumbnail img {
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

.yt-live-badge {
  position: absolute;
  bottom: 4px;
  right: 4px;
  background-color: #ef4444;
  color: #fff;
  font-size: 12px;
  font-weight: 500;
  padding: 2px 6px;
  border-radius: 4px;
}

.yt-info {
  display: flex;
  flex-direction: row;
  margin-top: 12px;
}

.yt-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.yt-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.yt-avatar-text {
  color: #fff;
  font-size: 14px;
  font-weight: 600;
}

.yt-text {
  display: flex;
  flex-direction: column;
  margin-left: 12px;
  overflow: hidden;
  flex: 1;
}

.yt-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--primary-text-color, #0f0f0f);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.yt-author {
  font-size: 12px;
  color: var(--tertiary-text-color, #606060);
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.yt-verified {
  font-size: 10px;
  color: var(--tertiary-text-color, #606060);
}

.yt-meta {
  font-size: 12px;
  color: var(--tertiary-text-color, #606060);
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.yt-dot {
  margin: 0 2px;
}
</style>
