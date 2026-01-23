import { createWebURL } from '../../helpers/utils'

// replace with a Map after the Vue 3 and Pinia migrations
const state = {
  cachedPlayerLocales: {}
}

const getters = {}

const actions = {
  async cachePlayerLocale({ commit }, locale) {
    try {
      const url = createWebURL(`/shaka-player-locales/${locale}.json`)
      const response = await fetch(url)
      if (!response.ok) return // Skip if locale file doesn't exist
      const data = await response.json()
      Object.freeze(data)
      commit('addPlayerLocaleToCache', { locale, data })
    } catch {
      // Gracefully fail if locale file doesn't exist
    }
  }
}

const mutations = {
  addPlayerLocaleToCache(state, { locale, data }) {
    state.cachedPlayerLocales[locale] = data
  }
}

export default {
  state,
  getters,
  actions,
  mutations
}
