/**
 * Database Service
 * SQLite database for user data
 */

import Database from 'better-sqlite3'
import bcrypt from 'bcrypt'
import { v4 as uuidv4 } from 'uuid'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let db = null

// Initialize database
export function initDatabase() {
  const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../data/meetube.db')
  const dbDir = path.dirname(dbPath)

  // Ensure directory exists
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true })
  }

  db = new Database(dbPath)

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      user_id TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT,
      PRIMARY KEY (user_id, key),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS history (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      video_id TEXT NOT NULL,
      title TEXT,
      author TEXT,
      author_id TEXT,
      length_seconds INTEGER,
      watch_progress INTEGER DEFAULT 0,
      watched_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_history_user ON history(user_id);
    CREATE INDEX IF NOT EXISTS idx_history_video ON history(user_id, video_id);

    CREATE TABLE IF NOT EXISTS favorites (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      video_id TEXT NOT NULL,
      title TEXT,
      author TEXT,
      author_id TEXT,
      length_seconds INTEGER,
      added_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      UNIQUE(user_id, video_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);

    CREATE TABLE IF NOT EXISTS playlists (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS playlist_items (
      id TEXT PRIMARY KEY,
      playlist_id TEXT NOT NULL,
      video_id TEXT NOT NULL,
      title TEXT,
      author TEXT,
      author_id TEXT,
      length_seconds INTEGER,
      position INTEGER NOT NULL DEFAULT 0,
      added_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_playlist_items ON playlist_items(playlist_id);

    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      channel_name TEXT,
      channel_thumbnail TEXT,
      subscribed_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      UNIQUE(user_id, channel_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);

    CREATE TABLE IF NOT EXISTS courses (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      playlist_id TEXT NOT NULL,
      playlist_title TEXT,
      channel_name TEXT,
      channel_id TEXT,
      total_videos INTEGER DEFAULT 0,
      completed_videos INTEGER DEFAULT 0,
      current_video_index INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      UNIQUE(user_id, playlist_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_courses_user ON courses(user_id);
  `)

  console.log('[DATABASE] Initialized:', dbPath)
  return db
}

export function getDatabase() {
  if (!db) {
    initDatabase()
  }
  return db
}

// User functions
export async function createUser(username, password) {
  const db = getDatabase()
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username)
  if (existing) {
    throw new Error('Username already exists')
  }

  const id = uuidv4()
  const passwordHash = await bcrypt.hash(password, 10)

  db.prepare('INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)')
    .run(id, username, passwordHash)

  return { id, username }
}

export async function getUserByUsername(username) {
  const db = getDatabase()
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username)
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash)
}

// Settings functions
export function getUserSettings(userId) {
  const db = getDatabase()
  const rows = db.prepare('SELECT key, value FROM settings WHERE user_id = ?').all(userId)
  const settings = {}
  for (const row of rows) {
    try {
      settings[row.key] = JSON.parse(row.value)
    } catch {
      settings[row.key] = row.value
    }
  }
  return settings
}

export function setUserSetting(userId, key, value) {
  const db = getDatabase()
  const valueStr = typeof value === 'string' ? value : JSON.stringify(value)
  db.prepare('INSERT OR REPLACE INTO settings (user_id, key, value) VALUES (?, ?, ?)')
    .run(userId, key, valueStr)
}

// History functions
export function addToHistory(userId, video) {
  const db = getDatabase()
  const id = uuidv4()
  db.prepare(`
    INSERT INTO history (id, user_id, video_id, title, author, author_id, length_seconds, watch_progress)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, userId, video.videoId, video.title, video.author, video.authorId, video.lengthSeconds, video.watchProgress || 0)
  return { id }
}

export function getHistory(userId, limit = 100) {
  const db = getDatabase()
  return db.prepare(`
    SELECT * FROM history WHERE user_id = ? ORDER BY watched_at DESC LIMIT ?
  `).all(userId, limit)
}

// Favorites functions
export function addToFavorites(userId, video) {
  const db = getDatabase()
  const id = uuidv4()
  db.prepare(`
    INSERT OR REPLACE INTO favorites (id, user_id, video_id, title, author, author_id, length_seconds)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, userId, video.videoId, video.title, video.author, video.authorId, video.lengthSeconds)
  return { id }
}

export function removeFromFavorites(userId, videoId) {
  const db = getDatabase()
  db.prepare('DELETE FROM favorites WHERE user_id = ? AND video_id = ?').run(userId, videoId)
}

export function getFavorites(userId) {
  const db = getDatabase()
  return db.prepare('SELECT * FROM favorites WHERE user_id = ? ORDER BY added_at DESC').all(userId)
}

export function isFavorite(userId, videoId) {
  const db = getDatabase()
  const row = db.prepare('SELECT id FROM favorites WHERE user_id = ? AND video_id = ?').get(userId, videoId)
  return !!row
}

// Subscription functions
export function subscribe(userId, channel) {
  const db = getDatabase()
  const id = uuidv4()
  db.prepare(`
    INSERT OR REPLACE INTO subscriptions (id, user_id, channel_id, channel_name, channel_thumbnail)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, userId, channel.channelId, channel.channelName, channel.channelThumbnail)
  return { id }
}

export function unsubscribe(userId, channelId) {
  const db = getDatabase()
  db.prepare('DELETE FROM subscriptions WHERE user_id = ? AND channel_id = ?').run(userId, channelId)
}

export function getSubscriptions(userId) {
  const db = getDatabase()
  return db.prepare('SELECT * FROM subscriptions WHERE user_id = ? ORDER BY subscribed_at DESC').all(userId)
}

export function isSubscribed(userId, channelId) {
  const db = getDatabase()
  const row = db.prepare('SELECT id FROM subscriptions WHERE user_id = ? AND channel_id = ?').get(userId, channelId)
  return !!row
}

// Initialize on import
initDatabase()
