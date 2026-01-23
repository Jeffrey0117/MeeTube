<template>
  <header class="yt-header">
    <!-- Left: Menu + Logo -->
    <div class="yt-header-left">
      <button class="yt-menu-btn" @click="toggleSidebar">
        <font-awesome-icon :icon="['fas', 'bars']" />
      </button>
      <router-link to="/yt" class="yt-logo">
        <span class="yt-logo-mee">Mee</span>
        <span class="yt-logo-tube">Tube</span>
      </router-link>
    </div>

    <!-- Center: Search Bar -->
    <div class="yt-search-wrapper" :class="{ 'is-focused': isSearchFocused }">
      <div class="yt-search-box">
        <div class="yt-search-icon-inside">
          <font-awesome-icon :icon="['fas', 'search']" />
        </div>
        <input
          ref="searchInput"
          v-model="searchQuery"
          type="text"
          class="yt-search-input"
          placeholder="搜尋"
          autocomplete="off"
          @input="onSearchInput"
          @keyup.enter="handleSearch"
          @keydown.down.prevent="navigateSuggestion(1)"
          @keydown.up.prevent="navigateSuggestion(-1)"
          @focus="handleFocus"
          @blur="handleBlur"
        />
      </div>
      <button class="yt-search-btn" @click="handleSearch">
        <font-awesome-icon :icon="['fas', 'search']" />
      </button>

      <!-- Search Suggestions Dropdown -->
      <div v-if="showSuggestions && suggestions.length > 0" class="yt-suggestions">
        <div
          v-for="(suggestion, index) in suggestions"
          :key="index"
          class="yt-suggestion-item"
          :class="{ 'is-selected': index === selectedIndex }"
          @mousedown.prevent="selectSuggestion(suggestion)"
        >
          <font-awesome-icon :icon="['fas', 'search']" class="yt-suggestion-icon" />
          <span>{{ suggestion }}</span>
        </div>
      </div>
    </div>

    <!-- Mobile Search Button -->
    <button class="yt-mobile-search-btn" @click="toggleMobileSearch">
      <font-awesome-icon :icon="['fas', 'search']" />
    </button>

    <!-- Right: Icons + Avatar -->
    <div class="yt-header-right">
      <router-link to="/yt/music" class="yt-icon-btn" title="音樂模式">
        <font-awesome-icon :icon="['fas', 'music']" />
      </router-link>
      <button class="yt-icon-btn yt-desktop-only">
        <font-awesome-icon :icon="['fas', 'video']" />
      </button>
      <button class="yt-icon-btn yt-desktop-only">
        <font-awesome-icon :icon="['fas', 'bell']" />
      </button>
      <div class="yt-avatar">
        <span>{{ userInitial }}</span>
      </div>
    </div>

    <!-- Mobile Search Overlay -->
    <div v-if="mobileSearchOpen" class="yt-mobile-search-overlay">
      <button class="yt-back-btn" @click="toggleMobileSearch">
        <font-awesome-icon :icon="['fas', 'arrow-left']" />
      </button>
      <input
        ref="mobileSearchInput"
        v-model="searchQuery"
        type="text"
        class="yt-mobile-search-input"
        placeholder="搜尋"
        @input="onSearchInput"
        @keyup.enter="handleMobileSearch"
      />
      <button class="yt-search-btn-mobile" @click="handleMobileSearch">
        <font-awesome-icon :icon="['fas', 'search']" />
      </button>
    </div>
  </header>
</template>

<script>
export default {
  name: 'YtHeader',
  data() {
    return {
      searchQuery: '',
      suggestions: [],
      showSuggestions: false,
      selectedIndex: -1,
      debounceTimer: null,
      isSearchFocused: false,
      mobileSearchOpen: false
    }
  },
  computed: {
    userInitial() {
      return 'U'
    }
  },
  methods: {
    toggleSidebar() {
      this.$emit('toggle-sidebar')
    },

    handleFocus() {
      this.isSearchFocused = true
      this.showSuggestions = true
    },

    handleBlur() {
      this.isSearchFocused = false
      setTimeout(() => {
        this.showSuggestions = false
      }, 150)
    },

    toggleMobileSearch() {
      this.mobileSearchOpen = !this.mobileSearchOpen
      if (this.mobileSearchOpen) {
        this.$nextTick(() => {
          this.$refs.mobileSearchInput?.focus()
        })
      }
    },

    onSearchInput() {
      clearTimeout(this.debounceTimer)
      this.selectedIndex = -1

      if (!this.searchQuery.trim()) {
        this.suggestions = []
        return
      }

      this.debounceTimer = setTimeout(() => {
        this.fetchSuggestions()
      }, 200)
    },

    async fetchSuggestions() {
      try {
        const response = await fetch(`/api/v1/search/suggestions?q=${encodeURIComponent(this.searchQuery)}`)
        if (response.ok) {
          const data = await response.json()
          if (data && data.suggestions) {
            this.suggestions = data.suggestions.slice(0, 8)
          }
        }
      } catch (e) {
        console.error('Failed to fetch suggestions:', e)
        this.suggestions = []
      }
    },

    navigateSuggestion(direction) {
      if (this.suggestions.length === 0) return

      this.selectedIndex += direction
      if (this.selectedIndex < 0) {
        this.selectedIndex = this.suggestions.length - 1
      } else if (this.selectedIndex >= this.suggestions.length) {
        this.selectedIndex = 0
      }

      this.searchQuery = this.suggestions[this.selectedIndex]
    },

    selectSuggestion(suggestion) {
      this.searchQuery = suggestion
      this.showSuggestions = false
      this.handleSearch()
    },

    handleSearch() {
      if (this.searchQuery.trim()) {
        this.showSuggestions = false
        this.$router.push({
          path: '/yt/search/' + encodeURIComponent(this.searchQuery.trim())
        })
      }
    },

    handleMobileSearch() {
      if (this.searchQuery.trim()) {
        this.mobileSearchOpen = false
        this.$router.push({
          path: '/yt/search/' + encodeURIComponent(this.searchQuery.trim())
        })
      }
    }
  }
}
</script>

<style scoped>
/* ==========================================
   YtHeader - Pure CSS (No Tailwind)
   ========================================== */

.yt-header {
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  height: 56px;
  padding: 0 16px;
  background-color: var(--bg-color, #fff);
  border-bottom: 1px solid var(--side-nav-hover-color, rgba(0, 0, 0, 0.1));
}

/* Left Section */
.yt-header-left {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 16px;
  flex-shrink: 0;
}

.yt-menu-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--primary-text-color, #0f0f0f);
  font-size: 18px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.yt-menu-btn:hover {
  background-color: var(--side-nav-hover-color, rgba(0, 0, 0, 0.1));
}

.yt-logo {
  display: flex;
  flex-direction: row;
  align-items: center;
  text-decoration: none;
}

.yt-logo-mee {
  font-size: 20px;
  font-weight: 700;
  color: #ef4444;
}

.yt-logo-tube {
  font-size: 20px;
  font-weight: 700;
  color: var(--primary-text-color, #0f0f0f);
}

/* Search Section */
.yt-search-wrapper {
  display: none;
  position: relative;
  flex-direction: row;
  align-items: center;
  flex: 1;
  max-width: 640px;
  margin: 0 40px;
}

.yt-search-box {
  display: flex;
  flex-direction: row;
  align-items: center;
  flex: 1;
  height: 40px;
  border: 1px solid var(--tertiary-text-color, #ccc);
  border-right: none;
  border-radius: 20px 0 0 20px;
  background-color: transparent;
  padding-left: 16px;
  transition: border-color 0.15s;
}

.yt-search-wrapper.is-focused .yt-search-box {
  border-color: #3ea6ff;
  padding-left: 0;
}

.yt-search-icon-inside {
  display: none;
  align-items: center;
  justify-content: center;
  width: 40px;
  color: var(--primary-text-color, #0f0f0f);
  font-size: 14px;
}

.yt-search-wrapper.is-focused .yt-search-icon-inside {
  display: flex;
}

.yt-search-input {
  flex: 1;
  height: 100%;
  border: none;
  background: transparent;
  color: var(--primary-text-color, #0f0f0f);
  font-size: 16px;
  outline: none;
  padding-right: 16px;
}

.yt-search-input::placeholder {
  color: var(--tertiary-text-color, #606060);
}

.yt-search-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 40px;
  border: 1px solid var(--tertiary-text-color, #ccc);
  border-radius: 0 20px 20px 0;
  background-color: var(--side-nav-hover-color, #f8f8f8);
  color: var(--primary-text-color, #0f0f0f);
  font-size: 16px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.yt-search-btn:hover {
  background-color: var(--side-nav-active-color, #e5e5e5);
}

/* Mobile Search Button */
.yt-mobile-search-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--primary-text-color, #0f0f0f);
  font-size: 18px;
  cursor: pointer;
}

/* Suggestions */
.yt-suggestions {
  position: absolute;
  top: 100%;
  left: 0;
  right: 64px;
  margin-top: 4px;
  background-color: var(--bg-color, #fff);
  border: 1px solid var(--side-nav-hover-color, rgba(0, 0, 0, 0.1));
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  z-index: 200;
}

.yt-suggestion-item {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  color: var(--primary-text-color, #0f0f0f);
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.1s;
}

.yt-suggestion-item:hover,
.yt-suggestion-item.is-selected {
  background-color: var(--side-nav-hover-color, #f2f2f2);
}

.yt-suggestion-icon {
  color: var(--tertiary-text-color, #606060);
  font-size: 14px;
}

/* Right Section */
.yt-header-right {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.yt-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--primary-text-color, #0f0f0f);
  font-size: 18px;
  cursor: pointer;
  text-decoration: none;
  transition: background-color 0.15s;
}

.yt-icon-btn:hover {
  background-color: var(--side-nav-hover-color, rgba(0, 0, 0, 0.1));
}

.yt-desktop-only {
  display: none;
}

.yt-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background-color: #3b82f6;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  margin-left: 8px;
}

/* Mobile Search Overlay */
.yt-mobile-search-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 200;
  display: flex;
  flex-direction: row;
  align-items: center;
  height: 56px;
  padding: 0 8px;
  background-color: var(--bg-color, #fff);
  gap: 8px;
}

.yt-back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--primary-text-color, #0f0f0f);
  font-size: 18px;
  cursor: pointer;
}

.yt-mobile-search-input {
  flex: 1;
  height: 40px;
  border: 1px solid var(--tertiary-text-color, #ccc);
  border-radius: 20px;
  padding: 0 16px;
  background: transparent;
  color: var(--primary-text-color, #0f0f0f);
  font-size: 16px;
  outline: none;
}

.yt-search-btn-mobile {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  background-color: var(--side-nav-hover-color, #f2f2f2);
  color: var(--primary-text-color, #0f0f0f);
  font-size: 16px;
  cursor: pointer;
}

/* ==========================================
   RESPONSIVE - Tablet+ (>=640px)
   ========================================== */
@media screen and (min-width: 640px) {
  .yt-search-wrapper {
    display: flex;
  }

  .yt-mobile-search-btn {
    display: none;
  }

  .yt-desktop-only {
    display: flex;
  }
}

/* ==========================================
   RESPONSIVE - Mobile (<640px)
   ========================================== */
@media screen and (max-width: 639px) {
  .yt-header {
    height: 48px;
    padding: 0 8px;
  }

  .yt-header-left {
    gap: 8px;
  }

  .yt-menu-btn {
    width: 36px;
    height: 36px;
    font-size: 16px;
  }

  .yt-logo-mee,
  .yt-logo-tube {
    font-size: 18px;
  }

  .yt-header-right {
    gap: 4px;
  }

  .yt-icon-btn {
    width: 36px;
    height: 36px;
    font-size: 16px;
  }

  .yt-avatar {
    width: 28px;
    height: 28px;
    font-size: 12px;
  }
}
</style>
