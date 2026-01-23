import localforage from 'localforage'

/**
 * Simple nedb-compatible wrapper around localforage for browser use
 * Provides basic CRUD operations with query support
 */
class BrowserDatastore {
  constructor(name) {
    this.name = name
    this.store = localforage.createInstance({
      name: 'meetube',
      storeName: name
    })
    this._cache = null
  }

  async _getAll() {
    if (this._cache === null) {
      const items = []
      await this.store.iterate((value) => {
        items.push(value)
      })
      this._cache = items
    }
    return this._cache
  }

  _invalidateCache() {
    this._cache = null
  }

  _matchQuery(doc, query) {
    for (const [key, condition] of Object.entries(query)) {
      if (key === '$and') {
        if (!condition.every(q => this._matchQuery(doc, q))) return false
        continue
      }
      if (key === '$or') {
        if (!condition.some(q => this._matchQuery(doc, q))) return false
        continue
      }

      const value = doc[key]

      if (condition && typeof condition === 'object' && !Array.isArray(condition)) {
        // Handle operators
        for (const [op, opVal] of Object.entries(condition)) {
          switch (op) {
            case '$eq': if (value !== opVal) return false; break
            case '$ne': if (value === opVal) return false; break
            case '$in': if (!opVal.includes(value)) return false; break
            case '$nin': if (opVal.includes(value)) return false; break
            case '$gt': if (!(value > opVal)) return false; break
            case '$gte': if (!(value >= opVal)) return false; break
            case '$lt': if (!(value < opVal)) return false; break
            case '$lte': if (!(value <= opVal)) return false; break
            case '$exists': if ((value !== undefined) !== opVal) return false; break
          }
        }
      } else {
        // Direct equality
        if (value !== condition) return false
      }
    }
    return true
  }

  async loadDatabaseAsync() {
    // No-op for browser, localforage handles this
    return Promise.resolve()
  }

  async compactDatafileAsync() {
    // No-op for browser
    return Promise.resolve()
  }

  async findAsync(query = {}) {
    const all = await this._getAll()
    if (Object.keys(query).length === 0) {
      return [...all]
    }
    return all.filter(doc => this._matchQuery(doc, query))
  }

  async findOneAsync(query = {}) {
    const all = await this._getAll()
    return all.find(doc => this._matchQuery(doc, query)) || null
  }

  async insertAsync(doc) {
    const toInsert = Array.isArray(doc) ? doc : [doc]
    for (const item of toInsert) {
      if (!item._id) {
        item._id = crypto.randomUUID()
      }
      // Deep clone to remove Vue reactivity and ensure IndexedDB compatibility
      const plainItem = JSON.parse(JSON.stringify(item))
      await this.store.setItem(plainItem._id, plainItem)
    }
    this._invalidateCache()
    return Array.isArray(doc) ? toInsert : toInsert[0]
  }

  async updateAsync(query, update, options = {}) {
    const all = await this._getAll()
    const matches = all.filter(doc => this._matchQuery(doc, query))

    let numAffected = 0
    const multi = options.multi || false
    const upsert = options.upsert || false

    if (matches.length === 0 && upsert) {
      // Create new document
      const newDoc = { ...query, ...this._applyUpdate({}, update) }
      if (!newDoc._id) {
        newDoc._id = crypto.randomUUID()
      }
      // Deep clone to remove Vue reactivity and ensure IndexedDB compatibility
      const plainDoc = JSON.parse(JSON.stringify(newDoc))
      await this.store.setItem(plainDoc._id, plainDoc)
      this._invalidateCache()
      return { numAffected: 1, upsert: true }
    }

    const toUpdate = multi ? matches : matches.slice(0, 1)

    for (const doc of toUpdate) {
      const updated = this._applyUpdate(doc, update)
      // Deep clone to remove Vue reactivity and ensure IndexedDB compatibility
      const plainUpdated = JSON.parse(JSON.stringify(updated))
      await this.store.setItem(plainUpdated._id, plainUpdated)
      numAffected++
    }

    if (numAffected > 0) {
      this._invalidateCache()
    }

    return { numAffected }
  }

  _applyUpdate(doc, update) {
    const result = { ...doc }

    // Check if update is a replacement (no operators)
    const hasOperators = Object.keys(update).some(k => k.startsWith('$'))

    if (!hasOperators) {
      // Full replacement, keep _id
      return { ...update, _id: doc._id || update._id }
    }

    for (const [op, fields] of Object.entries(update)) {
      switch (op) {
        case '$set':
          Object.assign(result, fields)
          break
        case '$unset':
          for (const key of Object.keys(fields)) {
            delete result[key]
          }
          break
        case '$push':
          for (const [key, value] of Object.entries(fields)) {
            if (!Array.isArray(result[key])) {
              result[key] = []
            }
            if (value && typeof value === 'object' && value.$each) {
              result[key].push(...value.$each)
            } else {
              result[key].push(value)
            }
          }
          break
        case '$pull':
          for (const [key, condition] of Object.entries(fields)) {
            if (Array.isArray(result[key])) {
              if (typeof condition === 'object') {
                result[key] = result[key].filter(item => {
                  for (const [k, v] of Object.entries(condition)) {
                    if (v && typeof v === 'object' && v.$in) {
                      if (v.$in.includes(item[k])) return false
                    } else if (item[k] === v) {
                      return false
                    }
                  }
                  return true
                })
              } else {
                result[key] = result[key].filter(item => item !== condition)
              }
            }
          }
          break
        case '$inc':
          for (const [key, value] of Object.entries(fields)) {
            result[key] = (result[key] || 0) + value
          }
          break
      }
    }

    return result
  }

  async removeAsync(query = {}, options = {}) {
    const all = await this._getAll()
    const matches = all.filter(doc => this._matchQuery(doc, query))

    const multi = options.multi || false
    const toRemove = multi ? matches : matches.slice(0, 1)

    for (const doc of toRemove) {
      await this.store.removeItem(doc._id)
    }

    if (toRemove.length > 0) {
      this._invalidateCache()
    }

    return toRemove.length
  }

  // Chainable sort helper
  sort(field) {
    const self = this
    return {
      async then(resolve) {
        const results = await self._lastQuery
        const key = typeof field === 'object' ? Object.keys(field)[0] : field
        const order = typeof field === 'object' ? field[key] : 1
        results.sort((a, b) => {
          if (a[key] < b[key]) return -order
          if (a[key] > b[key]) return order
          return 0
        })
        resolve(results)
      }
    }
  }
}

// Extend findAsync to support chaining
const originalFindAsync = BrowserDatastore.prototype.findAsync
BrowserDatastore.prototype.findAsync = function(query) {
  const promise = originalFindAsync.call(this, query)
  promise.sort = (field) => {
    return promise.then(results => {
      const key = typeof field === 'object' ? Object.keys(field)[0] : field
      const order = typeof field === 'object' ? field[key] : -1
      results.sort((a, b) => {
        if (a[key] < b[key]) return order
        if (a[key] > b[key]) return -order
        return 0
      })
      return results
    })
  }
  return promise
}

function createDatastore(name) {
  return new BrowserDatastore(name)
}

export const settings = createDatastore('settings')
export const profiles = createDatastore('profiles')
export const playlists = createDatastore('playlists')
export const history = createDatastore('history')
export const searchHistory = createDatastore('search-history')
export const subscriptionCache = createDatastore('subscription-cache')
export const users = createDatastore('users')
