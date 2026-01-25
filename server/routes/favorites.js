/**
 * Favorites Routes
 * Server-side favorites sync API
 */

import { Router } from 'express'
import {
  addToFavorites,
  removeFromFavorites,
  getFavorites,
  isFavorite
} from '../services/database.js'

const router = Router()

// Middleware to check auth
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' })
  }
  next()
}

// Get all favorites for current user
router.get('/', requireAuth, (req, res) => {
  try {
    const favorites = getFavorites(req.session.userId)

    // Transform to match client format
    const transformed = favorites.map(f => ({
      videoId: f.video_id,
      title: f.title,
      author: f.author,
      authorId: f.author_id,
      lengthSeconds: f.length_seconds,
      addedAt: f.added_at * 1000 // Convert to milliseconds
    }))

    res.json({
      success: true,
      favorites: transformed
    })
  } catch (error) {
    console.error('[FAVORITES] Get error:', error.message)
    res.status(500).json({ error: 'Failed to get favorites' })
  }
})

// Add to favorites
router.post('/', requireAuth, (req, res) => {
  try {
    const { videoId, title, author, authorId, lengthSeconds } = req.body

    if (!videoId) {
      return res.status(400).json({ error: 'videoId is required' })
    }

    addToFavorites(req.session.userId, {
      videoId,
      title,
      author,
      authorId,
      lengthSeconds
    })

    res.json({ success: true })
  } catch (error) {
    console.error('[FAVORITES] Add error:', error.message)
    res.status(500).json({ error: 'Failed to add to favorites' })
  }
})

// Remove from favorites
router.delete('/:videoId', requireAuth, (req, res) => {
  try {
    const { videoId } = req.params

    removeFromFavorites(req.session.userId, videoId)

    res.json({ success: true })
  } catch (error) {
    console.error('[FAVORITES] Remove error:', error.message)
    res.status(500).json({ error: 'Failed to remove from favorites' })
  }
})

// Check if video is favorite
router.get('/check/:videoId', requireAuth, (req, res) => {
  try {
    const { videoId } = req.params
    const favorite = isFavorite(req.session.userId, videoId)

    res.json({
      success: true,
      isFavorite: favorite
    })
  } catch (error) {
    console.error('[FAVORITES] Check error:', error.message)
    res.status(500).json({ error: 'Failed to check favorite' })
  }
})

// Sync favorites (merge client favorites with server)
router.post('/sync', requireAuth, (req, res) => {
  try {
    const { favorites: clientFavorites } = req.body

    if (!Array.isArray(clientFavorites)) {
      return res.status(400).json({ error: 'favorites must be an array' })
    }

    // Get existing server favorites
    const serverFavorites = getFavorites(req.session.userId)
    const serverVideoIds = new Set(serverFavorites.map(f => f.video_id))

    // Add client favorites that don't exist on server
    for (const fav of clientFavorites) {
      if (!serverVideoIds.has(fav.videoId)) {
        addToFavorites(req.session.userId, {
          videoId: fav.videoId,
          title: fav.title,
          author: fav.author,
          authorId: fav.authorId,
          lengthSeconds: fav.lengthSeconds
        })
      }
    }

    // Return merged list
    const mergedFavorites = getFavorites(req.session.userId)
    const transformed = mergedFavorites.map(f => ({
      videoId: f.video_id,
      title: f.title,
      author: f.author,
      authorId: f.author_id,
      lengthSeconds: f.length_seconds,
      addedAt: f.added_at * 1000
    }))

    res.json({
      success: true,
      favorites: transformed
    })
  } catch (error) {
    console.error('[FAVORITES] Sync error:', error.message)
    res.status(500).json({ error: 'Failed to sync favorites' })
  }
})

export default router
