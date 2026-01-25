<template>
  <div class="yt-watch-page">
    <!-- Header -->
    <YtHeader @toggle-sidebar="toggleSidebar" />

    <!-- Sidebar -->
    <YtSidebar :is-open="sidebarOpen" @close="sidebarOpen = false" />

    <!-- Main Content -->
    <div class="yt-watch-content">
      <div class="yt-watch-container">
        <!-- Video Area -->
        <div class="yt-video-area">
          <!-- Loading -->
          <div v-if="isLoading" class="yt-video-loading">
            <div class="yt-spinner"></div>
          </div>

          <!-- Video Player -->
          <div v-else class="yt-video-player">
            <ft-shaka-video-player
              v-if="!errorMessage && manifestSrc"
              ref="player"
              :manifest-src="manifestSrc"
              :manifest-mime-type="manifestMimeType"
              :legacy-formats="legacyFormats"
              :start-time="startTimeSeconds"
              :captions="captions"
              :storyboard-src="videoStoryboardSrc"
              :format="activeFormat"
              :thumbnail="thumbnail"
              :video-id="videoId"
              :chapters="videoChapters"
              :current-chapter-index="videoCurrentChapterIndex"
              :title="videoTitle"
              :theatre-possible="false"
              :use-theatre-mode="false"
              class="w-full h-full"
              @error="handlePlayerError"
              @loaded="handleVideoLoaded"
              @timeupdate="updateCurrentChapter"
              @ended="handleVideoEnded"
            />
            <div v-else-if="errorMessage" class="yt-video-error">
              <font-awesome-icon :icon="['fas', 'exclamation-circle']" class="yt-error-icon" />
              <p>{{ errorMessage }}</p>
            </div>
            <div v-else class="yt-video-loading">
              <div class="yt-spinner"></div>
            </div>
          </div>

          <!-- Video Info -->
          <div class="yt-video-info">
            <h1 v-if="!isLoading" class="yt-video-title">{{ videoTitle }}</h1>

            <!-- Channel & Actions -->
            <div class="yt-channel-actions">
              <!-- Channel Info -->
              <div class="yt-channel-info">
                <router-link v-if="!isLoading" :to="`/yt/channel/${channelId}`" class="yt-channel-link">
                  <div class="yt-channel-avatar">
                    <img v-if="channelThumbnail" :src="channelThumbnail" :alt="channelName" />
                  </div>
                  <div class="yt-channel-details">
                    <span class="yt-channel-name">{{ channelName }}</span>
                    <span class="yt-channel-subs">{{ channelSubscriptionCountText }}</span>
                  </div>
                </router-link>
                <button
                  class="yt-subscribe-btn"
                  :class="{ 'subscribed': isChannelSubscribed }"
                  @click="toggleSubscription"
                >
                  {{ isChannelSubscribed ? '已訂閱' : '訂閱' }}
                </button>
              </div>

              <!-- Action Buttons -->
              <div class="yt-action-buttons">
                <!-- Like/Dislike Pill -->
                <div class="yt-like-pill">
                  <button class="yt-like-btn">
                    <font-awesome-icon :icon="['fas', 'thumbs-up']" />
                    <span class="yt-btn-text">{{ formatCount(videoLikeCount) }}</span>
                  </button>
                  <div class="yt-pill-divider"></div>
                  <button class="yt-dislike-btn">
                    <font-awesome-icon :icon="['fas', 'thumbs-down']" />
                  </button>
                </div>

                <!-- Share -->
                <button class="yt-action-btn" title="分享">
                  <font-awesome-icon :icon="['fas', 'share']" />
                  <span class="yt-btn-text">分享</span>
                </button>

                <!-- Download -->
                <button class="yt-action-btn" title="下載">
                  <font-awesome-icon :icon="['fas', 'download']" />
                  <span class="yt-btn-text">下載</span>
                </button>

                <!-- Favorite -->
                <button
                  class="yt-action-btn"
                  :class="{ 'yt-favorited': isFavorited }"
                  :title="isFavorited ? '已收藏' : '收藏'"
                  @click="toggleFavorite"
                >
                  <font-awesome-icon :icon="['fas', 'heart']" />
                  <span class="yt-btn-text">{{ isFavorited ? '已收藏' : '收藏' }}</span>
                </button>

                <!-- Music Mode -->
                <button class="yt-music-btn" title="音樂模式" @click="playAsMusic">
                  <font-awesome-icon :icon="['fas', 'music']" />
                  <span class="yt-btn-text">音樂模式</span>
                </button>
              </div>
            </div>

            <!-- Description Box -->
            <div v-if="!isLoading" class="yt-description-box">
              <div class="yt-video-stats">
                <span>{{ formatCount(videoViewCount) }} 次觀看</span>
                <span class="yt-dot">•</span>
                <span>{{ videoPublishedText }}</span>
              </div>
              <p class="yt-description-text">{{ videoDescription }}</p>
            </div>
          </div>
        </div>

        <!-- Related Videos -->
        <div class="yt-related-videos">
          <template v-if="!isLoading">
            <div v-for="video in relatedVideos" :key="video.videoId" class="yt-related-item">
              <router-link :to="`/yt/watch/${video.videoId}`" class="yt-related-link">
                <div class="yt-related-thumbnail">
                  <img :src="getVideoThumbnail(video)" :alt="video.title" loading="lazy" />
                  <span v-if="video.lengthSeconds" class="yt-duration">{{ formatDuration(video.lengthSeconds) }}</span>
                  <span v-if="video.liveNow" class="yt-live-badge">直播中</span>
                </div>
                <div class="yt-related-info">
                  <span class="yt-related-title">{{ video.title }}</span>
                  <span v-if="video.author" class="yt-related-author">{{ video.author }}</span>
                  <span class="yt-related-meta">
                    <template v-if="video.viewCount">{{ formatCount(video.viewCount) }} 次觀看</template>
                    <template v-if="video.viewCount && video.publishedText"> • </template>
                    <template v-if="video.publishedText">{{ formatPublishedText(video.publishedText) }}</template>
                  </span>
                </div>
              </router-link>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { YtHeader, YtSidebar } from '../../components/yt-theme'
import FtShakaVideoPlayer from '../../components/ft-shaka-video-player/ft-shaka-video-player.vue'
import {
  invidiousGetVideoInformation,
  youtubeImageUrlToInvidious,
  mapInvidiousLegacyFormat
} from '../../helpers/api/invidious'

const MANIFEST_TYPE_DASH = 'application/dash+xml'
const MANIFEST_TYPE_HLS = 'application/x-mpegurl'

export default {
  name: 'YtWatch',
  components: {
    YtHeader,
    YtSidebar,
    FtShakaVideoPlayer
  },
  data() {
    return {
      isLoading: true,
      errorMessage: '',
      videoId: '',
      videoTitle: '',
      videoDescription: '',
      videoViewCount: 0,
      videoLikeCount: 0,
      videoPublished: null,
      videoPublishedText: '',
      videoDuration: 0,
      channelId: '',
      channelName: '',
      channelThumbnail: '',
      channelSubscriptionCountText: '',
      thumbnail: '',
      manifestSrc: null,
      manifestMimeType: MANIFEST_TYPE_DASH,
      legacyFormats: [],
      captions: [],
      videoStoryboardSrc: '',
      activeFormat: 'dash',
      videoChapters: [],
      videoCurrentChapterIndex: 0,
      startTimeSeconds: 0,
      relatedVideos: [],
      sidebarOpen: false,
      isLive: false,
      // History tracking
      lastSavedProgress: 0,
      historySaveTimer: null
    }
  },
  computed: {
    currentInvidiousInstanceUrl() {
      return this.$store.getters.getCurrentInvidiousInstanceUrl
    },
    isFavorited() {
      return this.$store.getters['favorites/isFavorite'](this.videoId)
    },
    isChannelSubscribed() {
      return this.$store.getters['subscriptions/isSubscribed'](this.channelId)
    },
    historyCacheById() {
      return this.$store.getters.getHistoryCacheById || {}
    }
  },
  watch: {
    '$route.params.id': {
      handler(newId) {
        if (newId) {
          this.videoId = newId
          this.loadVideo()
        }
      },
      immediate: true
    }
  },
  beforeUnmount() {
    // Save final progress before leaving
    const player = this.$refs.player
    if (player && typeof player.getCurrentTime === 'function') {
      const currentTime = player.getCurrentTime()
      if (currentTime > 0) {
        this.saveWatchProgress(currentTime)
      }
    }
  },
  methods: {
    toggleSidebar() {
      this.sidebarOpen = !this.sidebarOpen
    },

    async loadVideo() {
      this.isLoading = true
      this.errorMessage = ''
      this.manifestSrc = null
      this.relatedVideos = []
      this.lastSavedProgress = 0

      // Check for saved watch progress to resume
      const historyEntry = this.historyCacheById[this.videoId]
      if (historyEntry?.watchProgress && historyEntry.watchProgress > 10) {
        // Resume from last position (minus 5 seconds for context)
        this.startTimeSeconds = Math.max(0, historyEntry.watchProgress - 5)
        console.log('[YtWatch] Resuming from', this.startTimeSeconds, 'seconds')
      } else {
        this.startTimeSeconds = 0
      }

      try {
        console.log('Loading video (Invidious API):', this.videoId)
        const result = await invidiousGetVideoInformation(this.videoId)
        console.log('Video info loaded:', result)

        if (result.error) {
          throw new Error(result.error)
        }

        if (result.errorMessage) {
          this.errorMessage = result.errorMessage
          this.isLoading = false
          return
        }

        // Basic info
        this.videoTitle = result.title
        this.videoViewCount = result.viewCount || 0
        this.videoLikeCount = result.likeCount || 0
        this.videoDescription = result.description || ''
        this.videoPublishedText = this.formatPublishedText(result.publishedText || '')

        // Channel info
        this.channelId = result.authorId
        this.channelName = result.author
        this.channelSubscriptionCountText = result.subCountText || ''

        // Channel thumbnail
        const channelThumb = result.authorThumbnails?.[1] || result.authorThumbnails?.[0]
        if (channelThumb?.url) {
          this.channelThumbnail = channelThumb.url.includes('/ggpht') || channelThumb.url.includes('/imgproxy')
            ? channelThumb.url
            : youtubeImageUrlToInvidious(channelThumb.url, this.currentInvidiousInstanceUrl)
        }

        // Video thumbnail
        const videoThumb = result.videoThumbnails?.find(t => t.quality === 'maxres') || result.videoThumbnails?.[0]
        this.thumbnail = videoThumb?.url || `https://i.ytimg.com/vi/${this.videoId}/maxresdefault.jpg`

        // Live check
        this.isLive = !!result.liveNow

        // Duration
        this.videoDuration = result.lengthSeconds || 0

        // Streaming data
        // Legacy formats
        if (result.formatStreams?.length > 0) {
          this.legacyFormats = result.formatStreams.map(mapInvidiousLegacyFormat)
        }

        // DASH manifest - use server-provided dashUrl if available
        if (result.dashUrl) {
          // Check if it's a relative path (from local-api-server)
          if (result.dashUrl.startsWith('/')) {
            this.manifestSrc = `${window.location.origin}${result.dashUrl}`
          } else {
            this.manifestSrc = result.dashUrl
          }
          this.manifestMimeType = MANIFEST_TYPE_DASH
          this.activeFormat = 'dash'
        } else if (result.hlsUrl) {
          // For live streams
          this.manifestSrc = result.hlsUrl
          this.manifestMimeType = MANIFEST_TYPE_HLS
          this.activeFormat = 'dash'
        } else if (this.legacyFormats.length > 0) {
          // Fallback to legacy format
          this.activeFormat = 'legacy'
        } else {
          this.errorMessage = '找不到可播放的影片格式'
        }

        // Captions
        console.log('[YtWatch] result.captions:', result.captions)
        if (result.captions?.length > 0) {
          this.captions = result.captions.map(track => ({
            url: track.url,
            label: track.label,
            language: track.languageCode || track.language_code,
            mimeType: 'text/vtt'
          }))
          console.log('[YtWatch] Mapped captions:', this.captions)
        } else {
          console.log('[YtWatch] No captions available')
        }

        // Related videos
        if (result.recommendedVideos?.length > 0) {
          this.relatedVideos = result.recommendedVideos.slice(0, 20).map(video => ({
            videoId: video.videoId,
            title: video.title,
            // Handle different possible field names for author
            author: video.author || video.authorName || video.channelTitle || '',
            authorId: video.authorId || video.channelId || '',
            viewCount: video.viewCount || video.viewCountText ? parseInt(String(video.viewCountText).replace(/[^0-9]/g, '')) : 0,
            publishedText: video.publishedText || video.publishedTimeText || '',
            lengthSeconds: video.lengthSeconds || 0,
            liveNow: video.liveNow || false
          }))
          console.log('Related videos loaded:', this.relatedVideos.length, this.relatedVideos[0])
        }

      } catch (error) {
        console.error('Failed to load video:', error)
        this.errorMessage = `載入失敗: ${error.message || '未知錯誤'}`
      }

      this.isLoading = false
    },

    handlePlayerError(error) {
      console.error('Player error:', error)

      // Check if it's a recoverable error
      const errorCode = error?.code || 0

      // Network errors (1xxx) - often recoverable
      if (errorCode >= 1000 && errorCode < 2000) {
        console.log('[YtWatch] Network error, will retry...')
        // Don't show error, player should recover
        return
      }

      // Media errors (3xxx) - try fallback to legacy
      if (errorCode >= 3000 && errorCode < 4000) {
        if (this.activeFormat === 'dash' && this.legacyFormats.length > 0) {
          console.log('[YtWatch] Switching to legacy format...')
          this.activeFormat = 'legacy'
          return
        }
      }

      this.errorMessage = '播放器發生錯誤，請重試'
    },

    handleVideoLoaded() {
      console.log('Video loaded successfully')
      // Save to history when video starts playing
      this.saveToHistory()
    },

    updateCurrentChapter(currentTime) {
      // Update chapter index based on time
      // Also save watch progress periodically (every 5 seconds of progress)
      if (Math.abs(currentTime - this.lastSavedProgress) >= 5) {
        this.lastSavedProgress = currentTime
        this.saveWatchProgress(currentTime)
      }
    },

    handleVideoEnded() {
      // Save final progress
      if (this.videoDuration) {
        this.saveWatchProgress(this.videoDuration)
      }
    },

    // Save video to watch history
    saveToHistory() {
      if (!this.videoId || !this.videoTitle) return

      const historyEntry = {
        videoId: this.videoId,
        title: this.videoTitle,
        author: this.channelName,
        authorId: this.channelId,
        description: this.videoDescription?.substring(0, 200) || '',
        viewCount: this.videoViewCount,
        lengthSeconds: this.videoDuration || 0,
        timeWatched: Date.now(),
        watchProgress: 0,
        isLive: this.isLive,
        type: 'video'
      }

      // Add thumbnail
      if (this.thumbnail) {
        historyEntry.videoThumbnails = [{ url: this.thumbnail, quality: 'medium' }]
      }

      console.log('[YtWatch] Saving to history:', historyEntry.videoId)
      this.$store.dispatch('updateHistory', historyEntry)
    },

    // Update watch progress
    saveWatchProgress(currentTime) {
      if (!this.videoId) return
      this.$store.dispatch('updateWatchProgress', {
        videoId: this.videoId,
        watchProgress: Math.floor(currentTime)
      })
    },

    formatCount(count) {
      if (!count) return '0'
      if (count >= 100000000) return (count / 100000000).toFixed(1) + ' 億'
      if (count >= 10000) return (count / 10000).toFixed(1) + ' 萬'
      return count.toLocaleString()
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
        .replace(/Streamed/i, '直播於')
        .replace(/Premiered/i, '首播於')
    },

    getVideoThumbnail(video) {
      if (video.videoId) {
        return `https://i.ytimg.com/vi/${video.videoId}/mqdefault.jpg`
      }
      return ''
    },

    playAsMusic() {
      // Navigate to music player with current video
      this.$router.push(`/yt/music/play/${this.videoId}`)
    },

    toggleFavorite() {
      const video = {
        videoId: this.videoId,
        title: this.videoTitle,
        author: this.channelName,
        thumbnail: this.thumbnail,
        duration: this.videoDuration
      }
      this.$store.dispatch('favorites/toggleFavorite', video)
    },

    toggleSubscription() {
      const channel = {
        channelId: this.channelId,
        name: this.channelName,
        thumbnail: this.channelThumbnail
      }
      this.$store.dispatch('subscriptions/toggleSubscription', channel)
    }
  }
}
</script>

<style scoped>
/* ==========================================
   YtWatch Page - Complete CSS (No Tailwind)
   ========================================== */

/* Page Layout */
.yt-watch-page {
  position: fixed;
  inset: 0;
  background-color: var(--bg-color, #fff);
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE/Edge */
}

.yt-watch-page::-webkit-scrollbar {
  display: none; /* Chrome/Safari */
}

.yt-watch-content {
  display: flex;
  justify-content: center;
  padding-top: 56px;
  padding-left: 16px;
  padding-right: 16px;
}

.yt-watch-container {
  width: 100%;
  max-width: 1800px;
  display: flex;
  flex-direction: column;
}

/* Video Area */
.yt-video-area {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.yt-video-player {
  aspect-ratio: 16 / 9;
  background-color: #000;
  border-radius: 12px;
  overflow: hidden;
}

.yt-video-loading {
  aspect-ratio: 16 / 9;
  background-color: #000;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
}

.yt-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid transparent;
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.yt-video-error {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #fff;
}

.yt-error-icon {
  font-size: 40px;
  margin-bottom: 8px;
}

/* Video Info */
.yt-video-info {
  margin-top: 12px;
}

.yt-video-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--primary-text-color, #0f0f0f);
  margin: 0 0 12px 0;
  line-height: 1.4;
}

/* Channel & Actions Row */
.yt-channel-actions {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.yt-channel-info {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.yt-channel-link {
  display: flex;
  flex-direction: row;
  align-items: center;
  text-decoration: none;
  gap: 12px;
}

.yt-channel-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  overflow: hidden;
  background-color: var(--side-nav-hover-color, #e5e5e5);
  flex-shrink: 0;
}

.yt-channel-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.yt-channel-details {
  display: flex;
  flex-direction: column;
}

.yt-channel-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--primary-text-color, #0f0f0f);
}

.yt-channel-subs {
  font-size: 12px;
  color: var(--tertiary-text-color, #606060);
}

.yt-subscribe-btn {
  padding: 0 16px;
  height: 36px;
  border: none;
  border-radius: 18px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  background-color: #0f0f0f;
  color: #fff;
  transition: opacity 0.15s;
}

.yt-subscribe-btn:hover {
  opacity: 0.85;
}

.yt-subscribe-btn.subscribed {
  background-color: var(--side-nav-hover-color, #e5e5e5);
  color: var(--primary-text-color, #0f0f0f);
}

/* Action Buttons */
.yt-action-buttons {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
}

.yt-like-pill {
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  background-color: var(--side-nav-hover-color, #f2f2f2);
  border-radius: 18px;
  height: 36px;
  overflow: hidden;
}

.yt-like-btn,
.yt-dislike-btn {
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  gap: 6px;
  padding: 0 16px;
  height: 100%;
  background: transparent;
  border: none;
  color: var(--primary-text-color, #0f0f0f);
  font-size: 14px;
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 0.15s;
}

.yt-like-btn:hover,
.yt-dislike-btn:hover {
  background-color: var(--side-nav-active-color, #e5e5e5);
}

.yt-pill-divider {
  width: 1px;
  height: 24px;
  background-color: var(--tertiary-text-color, #ccc);
  opacity: 0.3;
}

.yt-action-btn {
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  gap: 6px;
  padding: 0 16px;
  height: 36px;
  background-color: var(--side-nav-hover-color, #f2f2f2);
  border: none;
  border-radius: 18px;
  color: var(--primary-text-color, #0f0f0f);
  font-size: 14px;
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 0.15s;
}

.yt-action-btn:hover {
  background-color: var(--side-nav-active-color, #e5e5e5);
}

.yt-action-btn.yt-favorited {
  background-color: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}

.yt-music-btn {
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  gap: 6px;
  padding: 0 16px;
  height: 36px;
  background-color: #ef4444;
  border: none;
  border-radius: 18px;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 0.15s;
}

.yt-music-btn:hover {
  background-color: #dc2626;
}

/* Description Box */
.yt-description-box {
  margin-top: 12px;
  padding: 12px;
  background-color: var(--side-nav-hover-color, #f2f2f2);
  border-radius: 12px;
}

.yt-video-stats {
  font-size: 14px;
  font-weight: 500;
  color: var(--primary-text-color, #0f0f0f);
  margin-bottom: 8px;
}

.yt-dot {
  margin: 0 8px;
}

.yt-description-text {
  font-size: 14px;
  color: var(--primary-text-color, #0f0f0f);
  white-space: pre-wrap;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  margin: 0;
}

/* Related Videos */
.yt-related-videos {
  margin-top: 16px;
  padding-bottom: 24px;
}

.yt-related-item {
  margin-bottom: 8px;
}

.yt-related-link {
  display: flex;
  flex-direction: row;
  gap: 8px;
  text-decoration: none;
}

.yt-related-thumbnail {
  position: relative;
  width: 160px;
  min-width: 160px;
  aspect-ratio: 16 / 9;
  border-radius: 8px;
  overflow: hidden;
  background-color: var(--side-nav-hover-color, #e5e5e5);
}

.yt-related-thumbnail img {
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
  padding: 2px 4px;
  border-radius: 4px;
}

.yt-related-info {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex: 1;
}

.yt-related-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--primary-text-color, #0f0f0f);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.yt-related-author {
  font-size: 12px;
  color: var(--tertiary-text-color, #606060);
  margin-top: 4px;
}

.yt-related-meta {
  font-size: 12px;
  color: var(--tertiary-text-color, #606060);
}

/* ==========================================
   RESPONSIVE - Mobile (<640px)
   ========================================== */
@media screen and (max-width: 639px) {
  .yt-watch-content {
    padding-left: 0;
    padding-right: 0;
    padding-top: 48px; /* Match mobile header height */
  }

  .yt-video-player,
  .yt-video-loading {
    width: 100% !important;
    height: 50vh !important;
    min-height: 220px !important;
    border-radius: 0 !important;
    aspect-ratio: unset !important;
  }

  .yt-video-player :deep(.ftVideoPlayer),
  .yt-video-player :deep(.ftVideoPlayer.sixteenByNine),
  .yt-video-player :deep(.shaka-video-container) {
    width: 100% !important;
    height: 50vh !important;
    min-height: 220px !important;
    aspect-ratio: unset !important;
    max-width: 100% !important;
  }

  .yt-video-player :deep(video.player) {
    width: 100% !important;
    height: 100% !important;
    object-fit: contain !important; /* contain to prevent cropping */
  }

  .yt-video-info {
    padding: 0 12px;
  }

  .yt-video-title {
    font-size: 15px;
  }

  .yt-channel-actions {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .yt-action-buttons {
    width: 100%;
    justify-content: flex-start;
    gap: 6px;
  }

  /* Icon only on mobile */
  .yt-btn-text {
    display: none;
  }

  .yt-action-btn,
  .yt-music-btn {
    padding: 0;
    width: 36px;
    justify-content: center;
  }

  .yt-like-btn,
  .yt-dislike-btn {
    padding: 0 10px;
  }

  .yt-description-box {
    margin: 12px;
    border-radius: 8px;
  }

  .yt-related-videos {
    padding: 0 12px 24px;
  }

  .yt-related-thumbnail {
    width: 120px;
    min-width: 120px;
  }

  .yt-related-title {
    font-size: 13px;
  }
}

/* ==========================================
   RESPONSIVE - Desktop (>1024px)
   ========================================== */
@media screen and (min-width: 1024px) {
  .yt-watch-container {
    flex-direction: row;
  }

  .yt-video-area {
    flex: 1;
    min-width: 0;
  }

  .yt-related-videos {
    width: 400px;
    min-width: 400px;
    margin-top: 0;
    margin-left: 24px;
  }
}
</style>
