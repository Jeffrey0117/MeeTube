<template>
  <div class="yt-layout">
    <!-- Header -->
    <YtHeader @toggle-sidebar="toggleSidebar" />

    <!-- Main Content -->
    <div class="yt-layout-body">
      <!-- Sidebar -->
      <YtSidebar :is-open="sidebarOpen" @close="closeSidebar" />

      <!-- Content Area -->
      <main class="yt-layout-content">
        <slot />
      </main>
    </div>
  </div>
</template>

<script>
import YtHeader from './YtHeader.vue'
import YtSidebar from './YtSidebar.vue'

export default {
  name: 'YtLayout',
  components: {
    YtHeader,
    YtSidebar
  },
  data() {
    return {
      sidebarOpen: false // Default closed on mobile
    }
  },
  computed: {
    isMobile() {
      return window.innerWidth < 768
    }
  },
  watch: {
    // Close sidebar on route change (mobile)
    '$route'() {
      if (window.innerWidth < 768) {
        this.sidebarOpen = false
      }
    }
  },
  mounted() {
    // Open sidebar by default on desktop only
    if (window.innerWidth >= 768) {
      this.sidebarOpen = true
    }
  },
  methods: {
    toggleSidebar() {
      this.sidebarOpen = !this.sidebarOpen
    },
    closeSidebar() {
      this.sidebarOpen = false
    }
  }
}
</script>

<style scoped>
.yt-layout {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-color, #fff);
}

.yt-layout-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.yt-layout-content {
  flex: 1;
  overflow-y: auto;
  background-color: var(--bg-color, #fff);
}
</style>
