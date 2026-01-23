/**
 * Auth Routes
 * User authentication endpoints
 */

import { Router } from 'express'
import { getDatabase, createUser, getUserByUsername, verifyPassword } from '../services/database.js'

const router = Router()

// Register
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' })
    }

    if (username.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' })
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' })
    }

    const user = await createUser(username, password)

    // Auto login after register
    req.session.userId = user.id
    req.session.username = user.username

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
      }
    })
  } catch (error) {
    if (error.message === 'Username already exists') {
      return res.status(409).json({ error: error.message })
    }
    console.error('[AUTH] Register error:', error.message)
    res.status(500).json({ error: 'Registration failed' })
  }
})

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' })
    }

    const user = await getUserByUsername(username)
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const valid = await verifyPassword(password, user.password_hash)
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    req.session.userId = user.id
    req.session.username = user.username

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
      }
    })
  } catch (error) {
    console.error('[AUTH] Login error:', error.message)
    res.status(500).json({ error: 'Login failed' })
  }
})

// Logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('[AUTH] Logout error:', err.message)
      return res.status(500).json({ error: 'Logout failed' })
    }
    res.json({ success: true })
  })
})

// Get current user
router.get('/me', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  res.json({
    user: {
      id: req.session.userId,
      username: req.session.username,
    }
  })
})

export default router
