<template>
  <YtLayout>
    <div class="yt-settings">
      <h1 class="yt-settings-title">設定</h1>

      <!-- 帳戶設定 -->
      <section class="yt-settings-section">
        <h2 class="yt-section-title">
          <font-awesome-icon :icon="['fas', 'user']" />
          帳戶
        </h2>
        <div class="yt-settings-card">
          <div class="yt-setting-item">
            <div class="yt-setting-info">
              <span class="yt-setting-label">目前帳戶</span>
              <span class="yt-setting-value">{{ isLoggedIn ? currentUsername : '訪客' }}</span>
            </div>
            <button v-if="isLoggedIn" class="yt-setting-btn danger" @click="handleLogout">登出</button>
            <router-link v-else to="/login" class="yt-setting-btn primary">登入</router-link>
          </div>
        </div>
      </section>

      <!-- 外觀設定 -->
      <section class="yt-settings-section">
        <h2 class="yt-section-title">
          <font-awesome-icon :icon="['fas', 'palette']" />
          外觀
        </h2>
        <div class="yt-settings-card">
          <div class="yt-setting-item">
            <div class="yt-setting-info">
              <span class="yt-setting-label">深色模式</span>
              <span class="yt-setting-desc">使用深色主題</span>
            </div>
            <label class="yt-toggle">
              <input type="checkbox" v-model="darkMode" @change="toggleDarkMode" />
              <span class="yt-toggle-slider"></span>
            </label>
          </div>
        </div>
      </section>

      <!-- 播放設定 -->
      <section class="yt-settings-section">
        <h2 class="yt-section-title">
          <font-awesome-icon :icon="['fas', 'play-circle']" />
          播放
        </h2>
        <div class="yt-settings-card">
          <div class="yt-setting-item">
            <div class="yt-setting-info">
              <span class="yt-setting-label">自動播放</span>
              <span class="yt-setting-desc">影片結束後自動播放下一個</span>
            </div>
            <label class="yt-toggle">
              <input type="checkbox" v-model="autoplay" @change="updateAutoplay" />
              <span class="yt-toggle-slider"></span>
            </label>
          </div>
          <div class="yt-setting-item">
            <div class="yt-setting-info">
              <span class="yt-setting-label">預設畫質</span>
              <span class="yt-setting-desc">選擇影片預設播放畫質</span>
            </div>
            <select v-model="defaultQuality" class="yt-select" @change="updateQuality">
              <option value="auto">自動</option>
              <option value="1080">1080p</option>
              <option value="720">720p</option>
              <option value="480">480p</option>
              <option value="360">360p</option>
            </select>
          </div>
        </div>
      </section>

      <!-- 字幕設定 -->
      <section class="yt-settings-section">
        <h2 class="yt-section-title">
          <font-awesome-icon :icon="['fas', 'closed-captioning']" />
          字幕
        </h2>
        <div class="yt-settings-card">
          <div class="yt-setting-item">
            <div class="yt-setting-info">
              <span class="yt-setting-label">自動顯示字幕</span>
              <span class="yt-setting-desc">有字幕時自動顯示</span>
            </div>
            <label class="yt-toggle">
              <input type="checkbox" v-model="autoShowSubtitles" @change="updateSubtitles" />
              <span class="yt-toggle-slider"></span>
            </label>
          </div>
        </div>
      </section>

      <!-- 資料管理 -->
      <section class="yt-settings-section">
        <h2 class="yt-section-title">
          <font-awesome-icon :icon="['fas', 'database']" />
          資料管理
        </h2>
        <div class="yt-settings-card">
          <div class="yt-setting-item">
            <div class="yt-setting-info">
              <span class="yt-setting-label">清除觀看記錄</span>
              <span class="yt-setting-desc">刪除所有觀看記錄</span>
            </div>
            <button class="yt-setting-btn danger" @click="clearHistory">清除</button>
          </div>
          <div class="yt-setting-item">
            <div class="yt-setting-info">
              <span class="yt-setting-label">清除搜尋記錄</span>
              <span class="yt-setting-desc">刪除所有搜尋記錄</span>
            </div>
            <button class="yt-setting-btn danger" @click="clearSearchHistory">清除</button>
          </div>
        </div>
      </section>

      <!-- 關於 -->
      <section class="yt-settings-section">
        <h2 class="yt-section-title">
          <font-awesome-icon :icon="['fas', 'info-circle']" />
          關於
        </h2>
        <div class="yt-settings-card">
          <div class="yt-setting-item">
            <div class="yt-setting-info">
              <span class="yt-setting-label">版本</span>
              <span class="yt-setting-value">MeeTube v1.0.0</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  </YtLayout>
</template>

<script>
import { mapGetters, mapActions } from 'vuex'
import { YtLayout } from '../../components/yt-theme'
import { showToast } from '../../helpers/utils'

export default {
  name: 'YtSettings',
  components: {
    YtLayout
  },
  data() {
    return {
      darkMode: true,
      autoplay: false,
      defaultQuality: 'auto',
      autoShowSubtitles: true
    }
  },
  computed: {
    ...mapGetters('user', ['isLoggedIn', 'currentUsername'])
  },
  mounted() {
    // Load settings from localStorage
    this.darkMode = localStorage.getItem('yt-dark-mode') !== 'false'
    this.autoplay = localStorage.getItem('yt-autoplay') === 'true'
    this.defaultQuality = localStorage.getItem('yt-default-quality') || 'auto'
    this.autoShowSubtitles = localStorage.getItem('yt-auto-subtitles') !== 'false'
  },
  methods: {
    ...mapActions('user', ['logout']),
    ...mapActions(['removeAllHistory', 'clearSearchHistoryEntries']),

    async handleLogout() {
      await this.logout()
      showToast('已登出')
      this.$router.push('/yt')
    },

    toggleDarkMode() {
      localStorage.setItem('yt-dark-mode', this.darkMode)
      showToast(this.darkMode ? '已啟用深色模式' : '已停用深色模式')
    },

    updateAutoplay() {
      localStorage.setItem('yt-autoplay', this.autoplay)
      showToast(this.autoplay ? '已啟用自動播放' : '已停用自動播放')
    },

    updateQuality() {
      localStorage.setItem('yt-default-quality', this.defaultQuality)
      showToast(`預設畫質已設為 ${this.defaultQuality === 'auto' ? '自動' : this.defaultQuality + 'p'}`)
    },

    updateSubtitles() {
      localStorage.setItem('yt-auto-subtitles', this.autoShowSubtitles)
      showToast(this.autoShowSubtitles ? '已啟用自動字幕' : '已停用自動字幕')
    },

    async clearHistory() {
      if (confirm('確定要清除所有觀看記錄嗎？')) {
        await this.removeAllHistory()
        showToast('觀看記錄已清除')
      }
    },

    async clearSearchHistory() {
      if (confirm('確定要清除所有搜尋記錄嗎？')) {
        await this.clearSearchHistoryEntries()
        showToast('搜尋記錄已清除')
      }
    }
  }
}
</script>

<style scoped>
.yt-settings {
  max-width: 800px;
  margin: 0 auto;
  padding: 24px;
}

.yt-settings-title {
  font-size: 24px;
  font-weight: 600;
  color: var(--primary-text-color, #fff);
  margin-bottom: 24px;
}

.yt-settings-section {
  margin-bottom: 32px;
}

.yt-section-title {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 16px;
  font-weight: 500;
  color: var(--primary-text-color, #fff);
  margin-bottom: 12px;
}

.yt-section-title svg {
  color: #3ea6ff;
}

.yt-settings-card {
  background-color: var(--card-bg-color, #212121);
  border-radius: 12px;
  overflow: hidden;
}

.yt-setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.yt-setting-item:last-child {
  border-bottom: none;
}

.yt-setting-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.yt-setting-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--primary-text-color, #fff);
}

.yt-setting-desc {
  font-size: 12px;
  color: var(--secondary-text-color, #aaa);
}

.yt-setting-value {
  font-size: 14px;
  color: var(--secondary-text-color, #aaa);
}

/* Toggle Switch */
.yt-toggle {
  position: relative;
  display: inline-block;
  width: 48px;
  height: 24px;
}

.yt-toggle input {
  opacity: 0;
  width: 0;
  height: 0;
}

.yt-toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #3f3f3f;
  transition: 0.3s;
  border-radius: 24px;
}

.yt-toggle-slider::before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: #fff;
  transition: 0.3s;
  border-radius: 50%;
}

.yt-toggle input:checked + .yt-toggle-slider {
  background-color: #3ea6ff;
}

.yt-toggle input:checked + .yt-toggle-slider::before {
  transform: translateX(24px);
}

/* Select */
.yt-select {
  padding: 8px 12px;
  border: 1px solid #3f3f3f;
  border-radius: 8px;
  background-color: #181818;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
}

.yt-select:focus {
  outline: none;
  border-color: #3ea6ff;
}

/* Buttons */
.yt-setting-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s;
  text-decoration: none;
}

.yt-setting-btn:hover {
  opacity: 0.9;
}

.yt-setting-btn.primary {
  background-color: #3ea6ff;
  color: #0f0f0f;
}

.yt-setting-btn.danger {
  background-color: #ff4444;
  color: #fff;
}

/* Mobile */
@media screen and (max-width: 639px) {
  .yt-settings {
    padding: 16px;
  }

  .yt-setting-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .yt-setting-item > *:last-child {
    align-self: flex-end;
  }
}
</style>
