/**
 * Favorites Store Module
 * 管理收藏影片功能 - 支援伺服器同步
 */

const STORAGE_KEY = 'yt-favorites'

// 從 localStorage 讀取
function loadFromStorage() {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : []
  } catch (e) {
    console.error('[Favorites] Failed to load from storage:', e)
    return []
  }
}

// 儲存到 localStorage
function saveToStorage(favorites) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites))
  } catch (e) {
    console.error('[Favorites] Failed to save to storage:', e)
  }
}

const state = {
  favorites: loadFromStorage(),
  synced: false
}

const getters = {
  getFavorites: (state) => state.favorites,

  isFavorite: (state) => (videoId) => {
    return state.favorites.some(f => f.videoId === videoId)
  },

  getFavoriteCount: (state) => state.favorites.length
}

const actions = {
  /**
   * 初始化並與伺服器同步
   */
  async initFavorites({ commit, state, rootGetters }) {
    const isLoggedIn = rootGetters['user/isLoggedIn']

    if (isLoggedIn && !state.synced) {
      try {
        // 嘗試與伺服器同步
        const localFavorites = state.favorites
        const response = await fetch('/api/favorites/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ favorites: localFavorites })
        })

        if (response.ok) {
          const data = await response.json()
          if (data.success && data.favorites) {
            commit('SET_FAVORITES', data.favorites)
            saveToStorage(data.favorites)
            commit('SET_SYNCED', true)
          }
        }
      } catch (e) {
        console.error('[Favorites] Sync failed:', e)
      }
    }
  },

  async addFavorite({ commit, state, rootGetters }, video) {
    // 檢查是否已收藏
    if (state.favorites.some(f => f.videoId === video.videoId)) {
      return false
    }

    const favorite = {
      videoId: video.videoId,
      title: video.title,
      author: video.author,
      authorId: video.authorId,
      thumbnail: video.thumbnail || `https://i.ytimg.com/vi/${video.videoId}/mqdefault.jpg`,
      lengthSeconds: video.duration || video.lengthSeconds || 0,
      addedAt: Date.now()
    }

    commit('ADD_FAVORITE', favorite)
    saveToStorage(state.favorites)

    // 同步到伺服器
    const isLoggedIn = rootGetters['user/isLoggedIn']
    if (isLoggedIn) {
      try {
        await fetch('/api/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            videoId: favorite.videoId,
            title: favorite.title,
            author: favorite.author,
            authorId: favorite.authorId,
            lengthSeconds: favorite.lengthSeconds
          })
        })
      } catch (e) {
        console.error('[Favorites] Server sync failed:', e)
      }
    }

    return true
  },

  async removeFavorite({ commit, state, rootGetters }, videoId) {
    commit('REMOVE_FAVORITE', videoId)
    saveToStorage(state.favorites)

    // 同步到伺服器
    const isLoggedIn = rootGetters['user/isLoggedIn']
    if (isLoggedIn) {
      try {
        await fetch(`/api/favorites/${videoId}`, {
          method: 'DELETE',
          credentials: 'include'
        })
      } catch (e) {
        console.error('[Favorites] Server delete failed:', e)
      }
    }
  },

  toggleFavorite({ dispatch, getters }, video) {
    if (getters.isFavorite(video.videoId)) {
      dispatch('removeFavorite', video.videoId)
      return false
    } else {
      dispatch('addFavorite', video)
      return true
    }
  },

  clearAllFavorites({ commit }) {
    commit('CLEAR_FAVORITES')
    saveToStorage([])
  },

  /**
   * 從伺服器重新載入收藏
   */
  async refreshFromServer({ commit, rootGetters }) {
    const isLoggedIn = rootGetters['user/isLoggedIn']
    if (!isLoggedIn) return

    try {
      const response = await fetch('/api/favorites', {
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success && data.favorites) {
          commit('SET_FAVORITES', data.favorites)
          saveToStorage(data.favorites)
        }
      }
    } catch (e) {
      console.error('[Favorites] Refresh failed:', e)
    }
  }
}

const mutations = {
  ADD_FAVORITE(state, favorite) {
    state.favorites.unshift(favorite)
  },

  REMOVE_FAVORITE(state, videoId) {
    state.favorites = state.favorites.filter(f => f.videoId !== videoId)
  },

  CLEAR_FAVORITES(state) {
    state.favorites = []
  },

  SET_FAVORITES(state, favorites) {
    state.favorites = favorites
  },

  SET_SYNCED(state, synced) {
    state.synced = synced
  }
}

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations
}
