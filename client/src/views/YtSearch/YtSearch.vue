<template>
  <div class="fixed inset-0 bg-white dark:bg-[#0f0f0f] overflow-y-auto">
    <!-- Header -->
    <YtHeader @toggle-sidebar="toggleSidebar" />

    <!-- Main Content -->
    <div class="flex pt-14">
      <!-- Sidebar -->
      <YtSidebar :is-open="sidebarOpen" @close="sidebarOpen = false" />

      <!-- Search Results -->
      <main class="flex-1 overflow-y-auto p-4 lg:p-6">
        <!-- Search Info -->
        <div v-if="!isLoading && searchQuery" class="mb-4 text-gray-600 dark:text-gray-400 text-sm">
          搜尋結果：{{ searchQuery }}
        </div>

        <!-- Skeleton Loading -->
        <template v-if="isLoading && results.length === 0">
          <div v-for="i in 8" :key="'skeleton-' + i" class="mb-4 flex animate-pulse">
            <div class="w-64 min-w-[256px] aspect-video rounded-xl bg-gray-200 dark:bg-[#272727]"></div>
            <div class="ml-4 flex flex-col flex-1">
              <div class="h-5 bg-gray-200 dark:bg-[#272727] rounded w-3/4 mb-2"></div>
              <div class="h-4 bg-gray-200 dark:bg-[#272727] rounded w-1/2 mb-2"></div>
              <div class="h-3 bg-gray-200 dark:bg-[#272727] rounded w-1/4 mb-4"></div>
              <div class="h-3 bg-gray-200 dark:bg-[#272727] rounded w-full mb-1"></div>
              <div class="h-3 bg-gray-200 dark:bg-[#272727] rounded w-2/3"></div>
            </div>
          </div>
        </template>

        <!-- Search Results -->
        <template v-else>
          <div v-for="item in sortedResults" :key="item.videoId || item.id || item.playlistId" class="mb-4">
            <!-- Video Result -->
            <router-link
              v-if="item.type === 'video'"
              :to="`/yt/watch/${item.videoId}`"
              class="flex flex-col sm:flex-row"
            >
              <div class="relative w-full sm:w-64 sm:min-w-[256px] aspect-video rounded-xl overflow-hidden bg-gray-200 dark:bg-[#272727]">
                <img
                  :src="getVideoThumbnail(item)"
                  :alt="item.title"
                  class="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                  fetchpriority="low"
                />
                <!-- Watched indicator -->
                <div v-if="isWatched(item.videoId)" class="absolute top-1 left-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded flex items-center gap-1">
                  <font-awesome-icon :icon="['fas', 'check']" class="text-green-400" />
                  <span>已觀看</span>
                </div>
                <!-- Watch progress bar -->
                <div v-if="getWatchProgress(item.videoId) > 0" class="absolute bottom-0 left-0 right-0 h-1 bg-white/30">
                  <div class="h-full bg-red-600" :style="{ width: getWatchProgressPercent(item) + '%' }"></div>
                </div>
                <div v-if="item.lengthSeconds" class="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1 py-0.5 rounded">
                  {{ formatDuration(item.lengthSeconds) }}
                </div>
                <div v-if="item.liveNow" class="absolute bottom-1 right-1 bg-red-600 text-white text-xs px-1.5 py-0.5 rounded">
                  直播中
                </div>
              </div>
              <div class="mt-2 sm:mt-0 sm:ml-4 flex flex-col overflow-hidden">
                <h3 class="text-lg font-medium text-black dark:text-white line-clamp-2">{{ item.title }}</h3>
                <div class="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  <span>{{ formatViews(item.viewCount) }} 次觀看</span>
                  <span v-if="item.publishedText" class="mx-1">•</span>
                  <span>{{ formatPublishedText(item.publishedText) }}</span>
                </div>
                <div class="flex items-center mt-2">
                  <div class="h-6 w-6 rounded-full bg-gray-300 dark:bg-[#303030] overflow-hidden">
                    <img v-if="item.authorThumbnails?.length" :src="item.authorThumbnails[0].url" class="w-full h-full object-cover" />
                  </div>
                  <span class="ml-2 text-xs text-gray-600 dark:text-gray-400">{{ item.author }}</span>
                </div>
                <p v-if="item.description" class="text-xs text-gray-500 dark:text-gray-500 mt-2 line-clamp-2">
                  {{ item.description }}
                </p>
              </div>
            </router-link>

            <!-- Channel Result -->
            <router-link
              v-else-if="item.type === 'channel'"
              :to="`/yt/channel/${item.id || item.authorId}`"
              class="flex items-center p-4 rounded-xl hover:bg-gray-100 dark:hover:bg-[#272727]"
            >
              <div class="h-24 w-24 rounded-full overflow-hidden bg-gray-300 dark:bg-[#303030] flex-shrink-0">
                <img v-if="item.thumbnail || item.authorThumbnails?.length" :src="item.thumbnail || item.authorThumbnails[0].url" class="w-full h-full object-cover" />
              </div>
              <div class="ml-4">
                <h3 class="text-lg font-medium text-black dark:text-white">{{ item.name || item.author }}</h3>
                <div class="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  <span v-if="item.subscribers">{{ formatViews(item.subscribers) }} 位訂閱者</span>
                  <span v-if="item.videos" class="ml-2">{{ item.videos }} 部影片</span>
                </div>
                <p v-if="item.descriptionShort" class="text-xs text-gray-500 mt-2 line-clamp-2">{{ item.descriptionShort }}</p>
              </div>
            </router-link>

            <!-- Playlist Result -->
            <router-link
              v-else-if="item.type === 'playlist'"
              :to="`/playlist/${item.playlistId}`"
              class="flex flex-col sm:flex-row"
            >
              <div class="relative w-full sm:w-64 sm:min-w-[256px] aspect-video rounded-xl overflow-hidden bg-gray-200 dark:bg-[#272727]">
                <img :src="item.thumbnail || getPlaylistThumbnail(item)" class="w-full h-full object-cover" loading="lazy" />
                <div class="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <div class="text-white text-center">
                    <font-awesome-icon :icon="['fas', 'list']" class="text-2xl mb-1" />
                    <div class="text-sm">{{ item.videoCount }} 部影片</div>
                  </div>
                </div>
              </div>
              <div class="mt-2 sm:mt-0 sm:ml-4 flex flex-col">
                <h3 class="text-lg font-medium text-black dark:text-white line-clamp-2">{{ item.title }}</h3>
                <span class="text-xs text-gray-600 dark:text-gray-400 mt-1">{{ item.channelName || item.author }}</span>
                <span class="text-xs text-gray-500 mt-1">播放清單</span>
              </div>
            </router-link>
          </div>

          <!-- Load More -->
          <div v-if="hasMore" class="flex justify-center py-4">
            <button
              class="px-6 py-2 bg-gray-100 dark:bg-[#272727] text-black dark:text-white rounded-full hover:bg-gray-200 dark:hover:bg-[#303030]"
              :disabled="isLoadingMore"
              @click="loadMore"
            >
              <span v-if="isLoadingMore">載入中...</span>
              <span v-else>載入更多</span>
            </button>
          </div>

          <!-- No Results -->
          <div v-if="!isLoading && sortedResults.length === 0" class="text-center py-12 text-gray-500">
            找不到「{{ searchQuery }}」的搜尋結果
          </div>
        </template>
      </main>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import { YtHeader, YtSidebar } from '../../components/yt-theme'

export default {
  name: 'YtSearch',
  components: {
    YtHeader,
    YtSidebar
  },
  data() {
    return {
      searchQuery: '',
      results: [],
      isLoading: false,
      isLoadingMore: false,
      hasMore: false,
      sidebarOpen: false
    }
  },
  computed: {
    ...mapGetters(['getHistoryCacheById']),
    // Sort results: watched videos first, then by original order
    sortedResults() {
      const historyById = this.getHistoryCacheById || {}
      return [...this.results].sort((a, b) => {
        const aWatched = a.videoId && historyById[a.videoId]
        const bWatched = b.videoId && historyById[b.videoId]

        // Both watched: sort by most recently watched
        if (aWatched && bWatched) {
          return (bWatched.timeWatched || 0) - (aWatched.timeWatched || 0)
        }
        // Only a is watched: a comes first
        if (aWatched && !bWatched) return -1
        // Only b is watched: b comes first
        if (!aWatched && bWatched) return 1
        // Neither watched: keep original order
        return 0
      })
    }
  },
  watch: {
    '$route.params.query': {
      handler(newQuery) {
        if (newQuery) {
          this.searchQuery = decodeURIComponent(newQuery)
          this.performSearch()
        }
      },
      immediate: true
    }
  },
  methods: {
    toggleSidebar() {
      this.sidebarOpen = !this.sidebarOpen
    },

    async performSearch() {
      this.isLoading = true
      this.results = []
      this.hasMore = false

      try {
        const response = await fetch(`/api/v1/search?q=${encodeURIComponent(this.searchQuery)}`)
        if (response.ok) {
          const data = await response.json()
          // Handle both old format (array) and new format ({ results, hasMore })
          if (Array.isArray(data)) {
            this.results = data.filter(item =>
              item.type === 'video' || item.type === 'channel' || item.type === 'playlist'
            )
            this.hasMore = false
          } else if (data.results) {
            this.results = data.results.filter(item =>
              item.type === 'video' || item.type === 'channel' || item.type === 'playlist'
            )
            this.hasMore = data.hasMore || false
          }
        }
      } catch (e) {
        console.error('Search failed:', e)
        this.results = []
      }

      this.isLoading = false
    },

    async loadMore() {
      if (this.isLoadingMore || !this.hasMore) return
      this.isLoadingMore = true

      try {
        const response = await fetch(
          `/api/v1/search?q=${encodeURIComponent(this.searchQuery)}&continuation=1`
        )
        if (response.ok) {
          const data = await response.json()
          if (data.results && data.results.length > 0) {
            const newResults = data.results.filter(item =>
              item.type === 'video' || item.type === 'channel' || item.type === 'playlist'
            )
            this.results = [...this.results, ...newResults]
            this.hasMore = data.hasMore || false
          } else {
            this.hasMore = false
          }
        }
      } catch (e) {
        console.error('Load more failed:', e)
      }

      this.isLoadingMore = false
    },

    getVideoThumbnail(video) {
      if (video.videoId) {
        return `https://i.ytimg.com/vi/${video.videoId}/mqdefault.jpg`
      }
      if (video.videoThumbnails?.length) {
        const medium = video.videoThumbnails.find(t => t.quality === 'medium')
        return medium?.url || video.videoThumbnails[0].url
      }
      return ''
    },

    getPlaylistThumbnail(playlist) {
      if (playlist.playlistThumbnail) return playlist.playlistThumbnail
      if (playlist.videos?.[0]?.videoId) {
        return `https://i.ytimg.com/vi/${playlist.videos[0].videoId}/mqdefault.jpg`
      }
      return ''
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
    },

    isWatched(videoId) {
      if (!videoId) return false
      const historyById = this.getHistoryCacheById || {}
      return !!historyById[videoId]
    },

    getWatchProgress(videoId) {
      if (!videoId) return 0
      const historyById = this.getHistoryCacheById || {}
      return historyById[videoId]?.watchProgress || 0
    },

    getWatchProgressPercent(item) {
      if (!item.videoId || !item.lengthSeconds) return 0
      const progress = this.getWatchProgress(item.videoId)
      return Math.min(100, (progress / item.lengthSeconds) * 100)
    }
  }
}
</script>
