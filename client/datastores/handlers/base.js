import * as db from '../index'

class Settings {
  static async find() {
    const currentLocale = await db.settings.findOneAsync({ _id: 'currentLocale' })

    // In FreeTube 0.21.3 and earlier the locales 'en-GB', 'es-AR' and 'nb-NO' had underscores instead of a hyphens
    // This is a one time migration for users that are using one of those locales
    if (currentLocale?.value.includes('_')) {
      await this.upsert('currentLocale', currentLocale.value.replace('_', '-'))
    }

    // In FreeTube 0.22.0 and earlier the external player arguments were displayed in a text box,
    // with the user manually entering `;` to separate the different arguments.
    // This is a one time migration that converts the old string to a JSON array
    const externalPlayerCustomArgs = await db.settings.findOneAsync({ _id: 'externalPlayerCustomArgs' })

    if (externalPlayerCustomArgs && !externalPlayerCustomArgs.value.startsWith('[')) {
      let newValue = '[]'

      if (externalPlayerCustomArgs.value.length > 0) {
        newValue = JSON.stringify(externalPlayerCustomArgs.value.split(';'))
      }

      await this.upsert('externalPlayerCustomArgs', newValue)
    }

    // In FreeTube 0.23.0, the "Enable Theatre Mode by Default" setting was incoporated as an option
    // of the "Default Viewing Mode" setting. This is a one time migration to preserve users'
    // Theater Mode preference through this change.
    const defaultTheatreMode = await db.settings.findOneAsync({ _id: 'defaultTheatreMode' })

    if (defaultTheatreMode) {
      if (defaultTheatreMode.value) {
        await this.upsert('defaultViewingMode', 'theatre')
      }

      await db.settings.removeAsync({ _id: 'defaultTheatreMode' })
    }

    const saveWatchedProgress = await db.settings.findOneAsync({ _id: 'saveWatchedProgress' })
    const watchedProgressSavingMode = await db.settings.findOneAsync({ _id: 'watchedProgressSavingMode' })
    if (saveWatchedProgress && !watchedProgressSavingMode) {
      if (!saveWatchedProgress.value) {
        await this.upsert('watchedProgressSavingMode', 'never')
      }

      await db.settings.removeAsync({ _id: 'saveWatchedProgress' })
    }

    return db.settings.findAsync({ _id: { $ne: 'bounds' } })
  }

  static upsert(_id, value) {
    return db.settings.updateAsync({ _id }, { _id, value }, { upsert: true })
  }

  // ******************** //
  // Unique Electron main process handlers
  static _findAppReadyRelatedSettings() {
    return db.settings.findAsync({
      _id: {
        $in: [
          'disableSmoothScrolling',
          'useProxy',
          'proxyProtocol',
          'proxyHostname',
          'proxyPort',
          'backendFallback',
          'backendPreference',
          'hideToTrayOnMinimize'
        ]
      }
    })
  }

  static _findOne(_id) {
    return db.settings.findOneAsync({ _id })
  }

  static _findSidenavSettings() {
    return {
      hideTrendingVideos: db.settings.findOneAsync({ _id: 'hideTrendingVideos' }),
      hidePopularVideos: db.settings.findOneAsync({ _id: 'hidePopularVideos' }),
      hidePlaylists: db.settings.findOneAsync({ _id: 'hidePlaylists' }),
    }
  }

  static _updateBounds(value) {
    return db.settings.updateAsync({ _id: 'bounds' }, { _id: 'bounds', value }, { upsert: true })
  }
  // ******************** //
}

class History {
  // 取得當前用戶 ID（從 localStorage 讀取 session）
  static _getCurrentUserId() {
    try {
      const session = localStorage.getItem('userSession')
      if (session) {
        const parsed = JSON.parse(session)
        return parsed.userId || null
      }
    } catch (e) {
      // ignore
    }
    return null
  }

  static find() {
    const userId = this._getCurrentUserId()
    // 如果有用戶 ID，只查詢該用戶的紀錄
    // 如果沒有（訪客模式），查詢沒有 userId 或 userId 為 null 的紀錄
    const query = userId
      ? { userId }
      : { $or: [{ userId: null }, { userId: { $exists: false } }] }
    return db.history.findAsync(query).sort({ timeWatched: -1 })
  }

  static upsert(record) {
    const userId = this._getCurrentUserId()
    // 加入 userId 到紀錄
    const recordWithUser = { ...record, userId }
    return db.history.updateAsync(
      { videoId: record.videoId, userId },
      recordWithUser,
      { upsert: true }
    )
  }

  static async overwrite(records) {
    const userId = this._getCurrentUserId()
    // 只刪除當前用戶的紀錄
    const query = userId
      ? { userId }
      : { $or: [{ userId: null }, { userId: { $exists: false } }] }
    await db.history.removeAsync(query, { multi: true })

    // 加入 userId 到所有紀錄
    const recordsWithUser = records.map(r => ({ ...r, userId }))
    await db.history.insertAsync(recordsWithUser)
  }

  static updateWatchProgress(videoId, watchProgress) {
    const userId = this._getCurrentUserId()
    return db.history.updateAsync(
      { videoId, userId },
      { $set: { watchProgress } },
      { upsert: true }
    )
  }

  static updateLastViewedPlaylist(videoId, lastViewedPlaylistId, lastViewedPlaylistType, lastViewedPlaylistItemId) {
    const userId = this._getCurrentUserId()
    return db.history.updateAsync(
      { videoId, userId },
      { $set: { lastViewedPlaylistId, lastViewedPlaylistType, lastViewedPlaylistItemId } },
      { upsert: true }
    )
  }

  static delete(videoId) {
    const userId = this._getCurrentUserId()
    return db.history.removeAsync({ videoId, userId })
  }

  static deleteAll() {
    const userId = this._getCurrentUserId()
    const query = userId
      ? { userId }
      : { $or: [{ userId: null }, { userId: { $exists: false } }] }
    return db.history.removeAsync(query, { multi: true })
  }
}

class Profiles {
  // 取得當前用戶 ID
  static _getCurrentUserId() {
    try {
      const session = localStorage.getItem('userSession')
      if (session) {
        const parsed = JSON.parse(session)
        return parsed.userId || null
      }
    } catch (e) {
      // ignore
    }
    return null
  }

  static _getUserQuery() {
    const userId = this._getCurrentUserId()
    return userId
      ? { userId }
      : { $or: [{ userId: null }, { userId: { $exists: false } }] }
  }

  static create(profile) {
    const userId = this._getCurrentUserId()
    return db.profiles.insertAsync({ ...profile, userId })
  }

  static find() {
    return db.profiles.findAsync(this._getUserQuery())
  }

  static upsert(profile) {
    const userId = this._getCurrentUserId()
    const profileWithUser = { ...profile, userId }
    return db.profiles.updateAsync(
      { _id: profile._id, ...this._getUserQuery() },
      profileWithUser,
      { upsert: true }
    )
  }

  static addChannelToProfiles(channel, profileIds) {
    const userQuery = this._getUserQuery()
    if (profileIds.length === 1) {
      return db.profiles.updateAsync(
        { _id: profileIds[0], ...userQuery },
        { $push: { subscriptions: channel } }
      )
    } else {
      return db.profiles.updateAsync(
        { _id: { $in: profileIds }, ...userQuery },
        { $push: { subscriptions: channel } },
        { multi: true }
      )
    }
  }

  static removeChannelFromProfiles(channelId, profileIds) {
    const userQuery = this._getUserQuery()
    if (profileIds.length === 1) {
      return db.profiles.updateAsync(
        { _id: profileIds[0], ...userQuery },
        { $pull: { subscriptions: { id: channelId } } }
      )
    } else {
      return db.profiles.updateAsync(
        { _id: { $in: profileIds }, ...userQuery },
        { $pull: { subscriptions: { id: channelId } } },
        { multi: true }
      )
    }
  }

  static delete(id) {
    return db.profiles.removeAsync({ _id: id, ...this._getUserQuery() })
  }
}

class Playlists {
  // 取得當前用戶 ID（從 localStorage 讀取 session）
  static _getCurrentUserId() {
    try {
      const session = localStorage.getItem('userSession')
      if (session) {
        const parsed = JSON.parse(session)
        return parsed.userId || null
      }
    } catch (e) {
      // ignore
    }
    return null
  }

  static _getUserQuery() {
    const userId = this._getCurrentUserId()
    return userId
      ? { userId }
      : { $or: [{ userId: null }, { userId: { $exists: false } }] }
  }

  static create(playlists) {
    const userId = this._getCurrentUserId()
    // 支援單一或多個 playlist
    if (Array.isArray(playlists)) {
      const playlistsWithUser = playlists.map(p => ({ ...p, userId }))
      return db.playlists.insertAsync(playlistsWithUser)
    }
    return db.playlists.insertAsync({ ...playlists, userId })
  }

  static find() {
    return db.playlists.findAsync(this._getUserQuery())
  }

  static upsert(playlist) {
    const userId = this._getCurrentUserId()
    const playlistWithUser = { ...playlist, userId }
    return db.playlists.updateAsync(
      { _id: playlist._id, ...this._getUserQuery() },
      { $set: playlistWithUser },
      { upsert: true }
    )
  }

  static upsertVideoByPlaylistId(_id, lastUpdatedAt, videoData) {
    return db.playlists.updateAsync(
      { _id, ...this._getUserQuery() },
      {
        $push: { videos: videoData },
        $set: { lastUpdatedAt }
      },
      { upsert: true }
    )
  }

  static upsertVideosByPlaylistId(_id, lastUpdatedAt, videos) {
    return db.playlists.updateAsync(
      { _id, ...this._getUserQuery() },
      {
        $push: { videos: { $each: videos } },
        $set: { lastUpdatedAt }
      },
      { upsert: true }
    )
  }

  static delete(_id) {
    return db.playlists.removeAsync({ _id, ...this._getUserQuery(), protected: { $ne: true } })
  }

  static deleteVideoIdByPlaylistId(_id, lastUpdatedAt, videoId, playlistItemId) {
    const userQuery = this._getUserQuery()
    if (playlistItemId != null) {
      return db.playlists.updateAsync(
        { _id, ...userQuery },
        {
          $pull: { videos: { playlistItemId } },
          $set: { lastUpdatedAt }
        },
        { upsert: true }
      )
    } else if (videoId != null) {
      return db.playlists.updateAsync(
        { _id, ...userQuery },
        {
          $pull: { videos: { videoId } },
          $set: { lastUpdatedAt }
        },
        { upsert: true }
      )
    } else {
      throw new Error(`Both videoId & playlistItemId are absent, _id: ${_id}`)
    }
  }

  static deleteVideoIdsByPlaylistId(_id, lastUpdatedAt, playlistItemIds) {
    return db.playlists.updateAsync(
      { _id, ...this._getUserQuery() },
      {
        $pull: { videos: { playlistItemId: { $in: playlistItemIds } } },
        $set: { lastUpdatedAt }
      },
      { upsert: true }
    )
  }

  static deleteAllVideosByPlaylistId(_id) {
    return db.playlists.updateAsync(
      { _id, ...this._getUserQuery() },
      { $set: { videos: [] } },
      { upsert: true }
    )
  }

  static deleteMultiple(ids) {
    return db.playlists.removeAsync({ _id: { $in: ids }, ...this._getUserQuery(), protected: { $ne: true } })
  }

  static deleteAll() {
    return db.playlists.removeAsync(this._getUserQuery(), { multi: true })
  }
}

class SearchHistory {
  // 取得當前用戶 ID
  static _getCurrentUserId() {
    try {
      const session = localStorage.getItem('userSession')
      if (session) {
        const parsed = JSON.parse(session)
        return parsed.userId || null
      }
    } catch (e) {
      // ignore
    }
    return null
  }

  static _getUserQuery() {
    const userId = this._getCurrentUserId()
    return userId
      ? { userId }
      : { $or: [{ userId: null }, { userId: { $exists: false } }] }
  }

  static find() {
    return db.searchHistory.findAsync(this._getUserQuery()).sort({ lastUpdatedAt: -1 })
  }

  static upsert(searchHistoryEntry) {
    const userId = this._getCurrentUserId()
    const entryWithUser = { ...searchHistoryEntry, userId }
    return db.searchHistory.updateAsync(
      { _id: searchHistoryEntry._id, ...this._getUserQuery() },
      entryWithUser,
      { upsert: true }
    )
  }

  static async overwrite(records) {
    const userId = this._getCurrentUserId()
    await db.searchHistory.removeAsync(this._getUserQuery(), { multi: true })

    const recordsWithUser = records.map(r => ({ ...r, userId }))
    await db.searchHistory.insertAsync(recordsWithUser)
  }

  static delete(_id) {
    return db.searchHistory.removeAsync({ _id, ...this._getUserQuery() })
  }

  static deleteAll() {
    return db.searchHistory.removeAsync(this._getUserQuery(), { multi: true })
  }
}

class SubscriptionCache {
  static find() {
    return db.subscriptionCache.findAsync({})
  }

  static updateVideosByChannelId(channelId, entries, timestamp) {
    return db.subscriptionCache.updateAsync(
      { _id: channelId },
      { $set: { videos: entries, videosTimestamp: timestamp } },
      { upsert: true }
    )
  }

  static updateLiveStreamsByChannelId(channelId, entries, timestamp) {
    return db.subscriptionCache.updateAsync(
      { _id: channelId },
      { $set: { liveStreams: entries, liveStreamsTimestamp: timestamp } },
      { upsert: true }
    )
  }

  static updateShortsByChannelId(channelId, entries, timestamp) {
    return db.subscriptionCache.updateAsync(
      { _id: channelId },
      { $set: { shorts: entries, shortsTimestamp: timestamp } },
      { upsert: true }
    )
  }

  static async updateShortsWithChannelPageShortsByChannelId(channelId, entries) {
    const doc = await db.subscriptionCache.findOneAsync({ _id: channelId }, { shorts: 1 })

    if (!Array.isArray(doc?.shorts)) {
      return
    }

    let hasUpdates = false

    doc.shorts.forEach(cachedVideo => {
      const channelVideo = entries.find(short => cachedVideo.videoId === short.videoId)
      if (!channelVideo) { return }

      hasUpdates = true

      // authorId probably never changes, so we don't need to update that
      cachedVideo.title = channelVideo.title
      cachedVideo.author = channelVideo.author

      // as the channel shorts page only has compact view counts for numbers above 1000 e.g. 12k
      // and the RSS feeds include an exact value, we only want to overwrite it when the number is larger than the cached value
      // 12345 vs 12000 => 12345
      // 12345 vs 15000 => 15000
      if (channelVideo.viewCount > cachedVideo.viewCount) {
        cachedVideo.viewCount = channelVideo.viewCount
      }
    })

    if (hasUpdates) {
      await db.subscriptionCache.updateAsync(
        { _id: channelId },
        { $set: { shorts: doc.shorts } }
      )
    }
  }

  static updateCommunityPostsByChannelId(channelId, entries, timestamp) {
    return db.subscriptionCache.updateAsync(
      { _id: channelId },
      { $set: { communityPosts: entries, communityPostsTimestamp: timestamp } },
      { upsert: true }
    )
  }

  static deleteMultipleChannels(channelIds) {
    return db.subscriptionCache.removeAsync({ _id: { $in: channelIds } }, { multi: true })
  }

  static deleteAll() {
    return db.subscriptionCache.removeAsync({}, { multi: true })
  }
}

function loadDatastores() {
  return Promise.allSettled([
    db.settings.loadDatabaseAsync(),
    db.history.loadDatabaseAsync(),
    db.profiles.loadDatabaseAsync(),
    db.playlists.loadDatabaseAsync(),
    db.searchHistory.loadDatabaseAsync(),
    db.subscriptionCache.loadDatabaseAsync(),
    db.users.loadDatabaseAsync(),
  ])
}

function compactAllDatastores() {
  return Promise.allSettled([
    db.settings.compactDatafileAsync(),
    db.history.compactDatafileAsync(),
    db.profiles.compactDatafileAsync(),
    db.playlists.compactDatafileAsync(),
    db.searchHistory.compactDatafileAsync(),
    db.subscriptionCache.compactDatafileAsync(),
    db.users.compactDatafileAsync(),
  ])
}

// 用戶類別 - 會員系統資料處理
class Users {
  /**
   * 取得所有用戶
   * @returns {Promise<Array>} 用戶列表
   */
  static find() {
    return db.users.findAsync({}).sort({ createdAt: -1 })
  }

  /**
   * 按 ID 查詢用戶
   * @param {string} id - 用戶 ID
   * @returns {Promise<Object|null>} 用戶資料
   */
  static findById(id) {
    return db.users.findOneAsync({ _id: id })
  }

  /**
   * 按用戶名查詢用戶
   * @param {string} username - 用戶名
   * @returns {Promise<Object|null>} 用戶資料
   */
  static findByUsername(username) {
    return db.users.findOneAsync({ username: username.toLowerCase() })
  }

  /**
   * 建立新用戶
   * @param {Object} user - 用戶資料
   * @returns {Promise<Object>} 新建立的用戶
   */
  static create(user) {
    return db.users.insertAsync(user)
  }

  /**
   * 更新用戶資料（若不存在則建立）
   * @param {Object} user - 用戶資料
   * @returns {Promise<Object>} 更新結果
   */
  static upsert(user) {
    return db.users.updateAsync({ _id: user._id }, user, { upsert: true })
  }

  /**
   * 刪除用戶
   * @param {string} id - 用戶 ID
   * @returns {Promise<number>} 刪除的文件數量
   */
  static delete(id) {
    return db.users.removeAsync({ _id: id })
  }

  /**
   * 更新最後登入時間
   * @param {string} id - 用戶 ID
   * @returns {Promise<Object>} 更新結果
   */
  static updateLastLogin(id) {
    return db.users.updateAsync(
      { _id: id },
      { $set: { lastLoginAt: Date.now() } }
    )
  }

  /**
   * 更新用戶統計數據
   * @param {string} id - 用戶 ID
   * @param {Object} stats - 統計數據物件
   * @returns {Promise<Object>} 更新結果
   */
  static updateStats(id, stats) {
    const updateFields = {}
    for (const [key, value] of Object.entries(stats)) {
      updateFields[`stats.${key}`] = value
    }
    return db.users.updateAsync(
      { _id: id },
      { $set: updateFields }
    )
  }

  /**
   * 刪除所有用戶（用於測試或重置）
   * @returns {Promise<number>} 刪除的文件數量
   */
  static deleteAll() {
    return db.users.removeAsync({}, { multi: true })
  }
}

export {
  Settings as settings,
  History as history,
  Profiles as profiles,
  Playlists as playlists,
  SearchHistory as searchHistory,
  SubscriptionCache as subscriptionCache,
  Users as users,

  loadDatastores,
  compactAllDatastores,
}
