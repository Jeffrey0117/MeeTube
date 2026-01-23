/**
 * MeeTube Server
 * A clean Express.js server extracted from FreeTube
 */

import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import session from 'express-session'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

import apiRoutes from './routes/api.js'
import proxyRoutes from './routes/proxy.js'
import authRoutes from './routes/auth.js'
import { initYouTube } from './services/youtube.js'

// Load environment variables
dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3001

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false, // Disable for video streaming
}))

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.CLIENT_URL || true
    : true,
  credentials: true,
}))

// Parse JSON bodies
app.use(express.json())

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
}))

// API routes
app.use('/api/v1', apiRoutes)
app.use('/auth', authRoutes)

// Proxy routes (thumbnails, video streaming)
app.use('/', proxyRoutes)

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '../client/dist')
  app.use(express.static(clientDist))

  // SPA fallback
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'))
  })
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message)
  res.status(500).json({ error: err.message })
})

// Initialize and start server
async function start() {
  try {
    await initYouTube()

    app.listen(PORT, '0.0.0.0', () => {
      console.log('')
      console.log('='.repeat(50))
      console.log('  MeeTube Server')
      console.log('='.repeat(50))
      console.log('')
      console.log(`  URL: http://localhost:${PORT}`)
      console.log(`  Mode: ${process.env.NODE_ENV || 'development'}`)
      console.log('')
      console.log('  API Endpoints:')
      console.log('    /api/v1/search?q=...')
      console.log('    /api/v1/videos/:id')
      console.log('    /api/v1/channels/:id')
      console.log('    /api/v1/trending')
      console.log('')
      console.log('  Auth Endpoints:')
      console.log('    /auth/register')
      console.log('    /auth/login')
      console.log('    /auth/logout')
      console.log('    /auth/me')
      console.log('')
      console.log('='.repeat(50))
      console.log('')
    })
  } catch (err) {
    console.error('Failed to start server:', err)
    process.exit(1)
  }
}

start()
