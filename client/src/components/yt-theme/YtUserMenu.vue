<template>
  <div class="yt-user-menu" ref="menuRef">
    <!-- Avatar Button -->
    <button class="yt-avatar-btn" @click.stop="toggleMenu">
      <span v-if="!userAvatar" class="yt-avatar-initial">{{ userInitial }}</span>
      <img v-else :src="userAvatar" :alt="username" class="yt-avatar-img" />
    </button>

    <!-- Dropdown Menu -->
    <transition name="fade">
      <div v-if="isOpen" class="yt-menu-dropdown" @click.stop>
        <!-- User Info Header -->
        <div class="yt-menu-header">
          <div class="yt-menu-avatar">
            <span v-if="!userAvatar" class="yt-avatar-initial-lg">{{ userInitial }}</span>
            <img v-else :src="userAvatar" :alt="username" class="yt-avatar-img-lg" />
          </div>
          <div class="yt-menu-info">
            <span class="yt-menu-name">{{ displayName }}</span>
            <span class="yt-menu-username">@{{ username }}</span>
          </div>
        </div>

        <div class="yt-menu-divider"></div>

        <!-- Menu Items -->
        <div class="yt-menu-items">
          <router-link to="/yt/favorites" class="yt-menu-item" @click="closeMenu">
            <font-awesome-icon :icon="['fas', 'heart']" />
            <span>我的收藏</span>
          </router-link>

          <router-link to="/yt/history" class="yt-menu-item" @click="closeMenu">
            <font-awesome-icon :icon="['fas', 'history']" />
            <span>觀看記錄</span>
          </router-link>

          <router-link to="/yt/courses" class="yt-menu-item" @click="closeMenu">
            <font-awesome-icon :icon="['fas', 'graduation-cap']" />
            <span>我的課程</span>
          </router-link>
        </div>

        <div class="yt-menu-divider"></div>

        <!-- Settings & Account -->
        <div class="yt-menu-items">
          <button class="yt-menu-item" @click="openSettings">
            <font-awesome-icon :icon="['fas', 'cog']" />
            <span>設定</span>
          </button>

          <button v-if="isLoggedIn" class="yt-menu-item" @click="handleLogout">
            <font-awesome-icon :icon="['fas', 'sign-out-alt']" />
            <span>登出</span>
          </button>

          <router-link v-else to="/login" class="yt-menu-item" @click="closeMenu">
            <font-awesome-icon :icon="['fas', 'sign-in-alt']" />
            <span>登入</span>
          </router-link>
        </div>

        <!-- Version Info -->
        <div class="yt-menu-footer">
          <span>MeeTube v1.0.0</span>
        </div>
      </div>
    </transition>
  </div>
</template>

<script>
import { mapGetters, mapActions } from 'vuex'

export default {
  name: 'YtUserMenu',
  data() {
    return {
      isOpen: false
    }
  },
  computed: {
    ...mapGetters('user', ['isLoggedIn', 'currentUser', 'currentUsername', 'currentDisplayName', 'currentUserAvatar']),
    username() {
      return this.currentUsername || 'guest'
    },
    displayName() {
      return this.currentDisplayName || '訪客'
    },
    userInitial() {
      return (this.displayName || this.username || 'U').charAt(0).toUpperCase()
    },
    userAvatar() {
      const avatar = this.currentUserAvatar
      if (!avatar || avatar === 'default') return null
      return avatar
    }
  },
  mounted() {
    document.addEventListener('click', this.handleClickOutside)
  },
  beforeUnmount() {
    document.removeEventListener('click', this.handleClickOutside)
  },
  methods: {
    ...mapActions('user', ['logout']),
    toggleMenu() {
      this.isOpen = !this.isOpen
    },
    closeMenu() {
      this.isOpen = false
    },
    handleClickOutside(event) {
      if (this.$refs.menuRef && !this.$refs.menuRef.contains(event.target)) {
        this.isOpen = false
      }
    },
    openSettings() {
      this.closeMenu()
      this.$router.push('/yt/settings')
    },
    async handleLogout() {
      await this.logout()
      this.closeMenu()
      this.$router.push('/yt')
    }
  }
}
</script>

<style scoped>
.yt-user-menu {
  position: relative;
}

.yt-avatar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  background-color: #3b82f6;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  overflow: hidden;
  transition: opacity 0.15s;
}

.yt-avatar-btn:hover {
  opacity: 0.9;
}

.yt-avatar-initial {
  line-height: 1;
}

.yt-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Dropdown */
.yt-menu-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 280px;
  background-color: var(--bg-color, #fff);
  border: 1px solid var(--side-nav-hover-color, rgba(0, 0, 0, 0.1));
  border-radius: 12px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  z-index: 1000;
}

/* Header */
.yt-menu-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
}

.yt-menu-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background-color: #3b82f6;
  color: #fff;
  font-size: 20px;
  font-weight: 600;
  overflow: hidden;
  flex-shrink: 0;
}

.yt-avatar-initial-lg {
  line-height: 1;
}

.yt-avatar-img-lg {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.yt-menu-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.yt-menu-name {
  font-size: 16px;
  font-weight: 500;
  color: var(--primary-text-color, #0f0f0f);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.yt-menu-username {
  font-size: 13px;
  color: var(--tertiary-text-color, #606060);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Divider */
.yt-menu-divider {
  height: 1px;
  background-color: var(--side-nav-hover-color, rgba(0, 0, 0, 0.1));
  margin: 0;
}

/* Menu Items */
.yt-menu-items {
  padding: 8px 0;
}

.yt-menu-item {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
  padding: 10px 16px;
  border: none;
  background: transparent;
  color: var(--primary-text-color, #0f0f0f);
  font-size: 14px;
  text-decoration: none;
  cursor: pointer;
  transition: background-color 0.15s;
  text-align: left;
}

.yt-menu-item:hover {
  background-color: var(--side-nav-hover-color, rgba(0, 0, 0, 0.05));
}

.yt-menu-item svg {
  width: 20px;
  color: var(--tertiary-text-color, #606060);
}

/* Footer */
.yt-menu-footer {
  padding: 12px 16px;
  font-size: 12px;
  color: var(--tertiary-text-color, #909090);
  text-align: center;
  border-top: 1px solid var(--side-nav-hover-color, rgba(0, 0, 0, 0.1));
}

/* Transition */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* Mobile */
@media screen and (max-width: 639px) {
  .yt-avatar-btn {
    width: 28px;
    height: 28px;
    font-size: 12px;
  }

  .yt-menu-dropdown {
    width: 260px;
    right: -8px;
  }
}
</style>
