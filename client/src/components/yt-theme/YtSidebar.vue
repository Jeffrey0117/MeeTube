<template>
  <aside class="yt-sidebar" :class="{ 'is-open': isOpen }">
    <nav class="yt-sidebar-nav">
      <!-- 首頁 -->
      <router-link to="/yt" class="yt-nav-item" :class="{ 'is-active': isActive('/yt') }" @click="handleNavClick">
        <font-awesome-icon :icon="['fas', 'home']" class="yt-nav-icon" />
        <span class="yt-nav-text">首頁</span>
      </router-link>

      <!-- 發燒影片 -->
      <router-link to="/yt/trending" class="yt-nav-item" :class="{ 'is-active': isActive('/yt/trending') }" @click="handleNavClick">
        <font-awesome-icon :icon="['fas', 'fire']" class="yt-nav-icon" />
        <span class="yt-nav-text">發燒影片</span>
      </router-link>

      <!-- 訂閱內容 -->
      <router-link to="/yt/subscriptions" class="yt-nav-item" :class="{ 'is-active': isActive('/yt/subscriptions') }" @click="handleNavClick">
        <font-awesome-icon :icon="['fas', 'users']" class="yt-nav-icon" />
        <span class="yt-nav-text">訂閱內容</span>
      </router-link>

      <hr class="yt-nav-divider" />

      <!-- 媒體庫 -->
      <div class="yt-nav-section-title">媒體庫</div>

      <!-- 觀看記錄 -->
      <router-link to="/yt/history" class="yt-nav-item" :class="{ 'is-active': isActive('/yt/history') }" @click="handleNavClick">
        <font-awesome-icon :icon="['fas', 'history']" class="yt-nav-icon" />
        <span class="yt-nav-text">觀看記錄</span>
      </router-link>

      <!-- 播放清單 -->
      <router-link to="/yt/playlists" class="yt-nav-item" :class="{ 'is-active': isActive('/yt/playlists') }" @click="handleNavClick">
        <font-awesome-icon :icon="['fas', 'list']" class="yt-nav-icon" />
        <span class="yt-nav-text">播放清單</span>
      </router-link>

      <!-- 我的收藏 -->
      <router-link to="/yt/favorites" class="yt-nav-item" :class="{ 'is-active': isActive('/yt/favorites') }" @click="handleNavClick">
        <font-awesome-icon :icon="['fas', 'heart']" class="yt-nav-icon yt-icon-red" />
        <span class="yt-nav-text">我的收藏</span>
      </router-link>

      <!-- 課程 -->
      <div class="yt-nav-section-title">課程</div>

      <router-link to="/yt/courses" class="yt-nav-item" :class="{ 'is-active': isActive('/yt/courses') }" @click="handleNavClick">
        <font-awesome-icon :icon="['fas', 'graduation-cap']" class="yt-nav-icon" />
        <span class="yt-nav-text">課程</span>
      </router-link>

      <hr class="yt-nav-divider" />

      <!-- 設定 -->
      <router-link to="/yt/settings" class="yt-nav-item" :class="{ 'is-active': isActive('/yt/settings') }" @click="handleNavClick">
        <font-awesome-icon :icon="['fas', 'cog']" class="yt-nav-icon" />
        <span class="yt-nav-text">設定</span>
      </router-link>

      <hr class="yt-nav-divider" />

      <div class="yt-nav-footer">MeeTube</div>
    </nav>
  </aside>

  <!-- Backdrop for mobile -->
  <div v-if="isOpen" class="yt-sidebar-backdrop" @click="$emit('close')" />
</template>

<script>
export default {
  name: 'YtSidebar',
  props: {
    isOpen: {
      type: Boolean,
      default: false
    }
  },
  emits: ['close'],
  methods: {
    isActive(path) {
      return this.$route.path === path
    },
    handleNavClick() {
      // Close sidebar on mobile after clicking a link
      if (window.innerWidth < 768) {
        this.$emit('close')
      }
    }
  }
}
</script>

<style scoped>
.yt-sidebar {
  width: 240px;
  height: 100%;
  overflow-y: auto;
  padding: 12px 0;
  background-color: var(--bg-color, #fff);
  position: fixed;
  left: 0;
  top: 56px;
  bottom: 0;
  z-index: 30;
  transform: translateX(-100%);
  transition: transform 0.2s ease;
}

.yt-sidebar.is-open {
  transform: translateX(0);
}

.yt-sidebar-nav {
  display: flex;
  flex-direction: column;
  padding: 0 12px;
}

.yt-nav-item {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 10px 12px;
  border-radius: 10px;
  text-decoration: none;
  color: var(--primary-text-color, #0f0f0f);
  transition: background-color 0.15s;
}

.yt-nav-item:hover {
  background-color: var(--side-nav-hover-color, #f2f2f2);
}

.yt-nav-item.is-active {
  background-color: var(--side-nav-active-color, #e5e5e5);
  font-weight: 500;
}

.yt-nav-icon {
  width: 24px;
  font-size: 18px;
  text-align: center;
  color: var(--primary-text-color, #0f0f0f);
}

.yt-nav-icon.yt-icon-red {
  color: #ef4444;
}

.yt-nav-text {
  margin-left: 24px;
  font-size: 14px;
}

.yt-nav-divider {
  border: none;
  border-top: 1px solid var(--side-nav-hover-color, #e5e5e5);
  margin: 12px 0;
}

.yt-nav-section-title {
  font-size: 12px;
  color: var(--tertiary-text-color, #606060);
  padding: 8px 12px 4px;
  font-weight: 500;
}

.yt-nav-footer {
  font-size: 12px;
  color: var(--tertiary-text-color, #606060);
  padding: 8px 12px;
}

.yt-sidebar-backdrop {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 20;
}

/* Desktop: sidebar always visible when open */
@media screen and (min-width: 768px) {
  .yt-sidebar {
    position: relative;
    top: 0;
    transform: translateX(0);
    flex-shrink: 0;
  }

  .yt-sidebar:not(.is-open) {
    width: 0;
    padding: 0;
    overflow: hidden;
  }

  .yt-sidebar-backdrop {
    display: none;
  }
}

/* Mobile */
@media screen and (max-width: 767px) {
  .yt-sidebar {
    top: 48px;
  }
}
</style>
