/**
 * API Routes
 * YouTube API endpoints
 */

import { Router } from 'express'
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import {
  getInnertube,
  getInnertubeAndroid,
  convertSearchResults,
  convertVideoInfo,
  convertChannelVideos,
  createAuthorThumbnails,
  toGgphtProxyUrl,
  toProxyUrl,
} from '../services/youtube.js'

const execAsync = promisify(exec)

// ============================================
// Caption Cache (LRU with TTL)
// ============================================
class CaptionCache {
  constructor(maxSize = 500, ttlMs = 24 * 60 * 60 * 1000) {
    this.maxSize = maxSize
    this.ttlMs = ttlMs
    this.cache = new Map()
  }

  _makeKey(videoId, lang) {
    return `${videoId}_${lang}`
  }

  get(videoId, lang) {
    const key = this._makeKey(videoId, lang)
    const entry = this.cache.get(key)

    if (!entry) {
      return null
    }

    // Check TTL
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      console.log(`[CAPTION-CACHE] Expired: ${key}`)
      return null
    }

    // Move to end (most recently used)
    this.cache.delete(key)
    this.cache.set(key, entry)

    console.log(`[CAPTION-CACHE] HIT: ${key} (${entry.data.length} bytes)`)
    return entry.data
  }

  set(videoId, lang, data) {
    const key = this._makeKey(videoId, lang)

    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value
      this.cache.delete(oldestKey)
      console.log(`[CAPTION-CACHE] Evicted: ${oldestKey}`)
    }

    this.cache.set(key, {
      data,
      expiresAt: Date.now() + this.ttlMs
    })

    console.log(`[CAPTION-CACHE] SET: ${key} (${data.length} bytes, cache size: ${this.cache.size})`)
  }

  has(videoId, lang) {
    const key = this._makeKey(videoId, lang)
    const entry = this.cache.get(key)
    return entry && Date.now() <= entry.expiresAt
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttlMs: this.ttlMs
    }
  }
}

// Global caption cache instance
const captionCache = new CaptionCache()

/**
 * Prefetch caption in background (non-blocking)
 * @param {string} videoId
 * @param {string} langCode
 * @param {string|null} baseUrl - Caption URL if available
 */
async function prefetchCaption(videoId, langCode, baseUrl = null) {
  // Skip if already cached
  if (captionCache.has(videoId, langCode)) {
    console.log(`[CAPTION-PREFETCH] Already cached: ${videoId}_${langCode}`)
    return
  }

  console.log(`[CAPTION-PREFETCH] Starting prefetch for ${videoId}_${langCode}`)

  try {
    let captionUrl = baseUrl

    // If no URL provided, we need to get it from the API
    if (!captionUrl) {
      const innertube = getInnertube()
      const info = await innertube.getInfo(videoId)
      const tracks = info.captions?.caption_tracks || []
      const track = tracks.find(t => t.language_code === langCode || t.language_code.startsWith(langCode))
      if (!track?.base_url) {
        console.log(`[CAPTION-PREFETCH] No ${langCode} track found for ${videoId}`)
        return
      }
      captionUrl = track.base_url
    }

    // Fetch the caption
    const url = new URL(captionUrl)
    url.searchParams.set('fmt', 'vtt')

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/vtt,*/*',
      'Referer': 'https://www.youtube.com/',
    }

    const response = await fetch(url.toString(), { headers })
    if (!response.ok) {
      throw new Error(`Fetch failed: ${response.status}`)
    }

    let text = await response.text()

    // Ensure valid VTT
    if (text.length > 0 && !text.startsWith('WEBVTT')) {
      text = 'WEBVTT\n\n' + text
    }

    if (text.length > 0) {
      captionCache.set(videoId, langCode, text)
      console.log(`[CAPTION-PREFETCH] Success: ${videoId}_${langCode} (${text.length} bytes)`)
    }
  } catch (error) {
    console.log(`[CAPTION-PREFETCH] Failed for ${videoId}_${langCode}: ${error.message}`)
  }
}

const router = Router()

// Search
router.get('/search', async (req, res) => {
  try {
    const q = req.query.q || ''
    const innertube = getInnertube()
    const results = await innertube.search(q)
    const converted = convertSearchResults(results.results || [])
    res.json(converted)
  } catch (error) {
    console.error('[SEARCH]', error.message)
    res.status(500).json({ error: error.message })
  }
})

// Search suggestions
router.get('/search/suggestions', async (req, res) => {
  try {
    const q = req.query.q || ''
    const innertube = getInnertube()
    const suggestions = await innertube.getSearchSuggestions(q)
    res.json({ query: q, suggestions })
  } catch (error) {
    console.error('[SUGGESTIONS]', error.message)
    res.status(500).json({ error: error.message })
  }
})

// Video info
router.get('/videos/:id', async (req, res) => {
  try {
    const videoId = req.params.id
    console.log(`[VIDEO] Fetching: ${videoId}`)

    const innertubeAndroid = getInnertubeAndroid()
    const innertube = getInnertube()

    // Use Android client for streams
    const info = await innertubeAndroid.getBasicInfo(videoId)

    // Use regular client for related videos and captions
    let relatedVideos = []
    let channelAvatar = null
    let captions = null

    try {
      const fullInfo = await innertube.getInfo(videoId)
      relatedVideos = fullInfo.watch_next_feed || []
      console.log(`[VIDEO] Found ${relatedVideos.length} related videos`)

      // Get captions from regular client (Android client doesn't include captions)
      captions = fullInfo.captions
      console.log(`[VIDEO] Found ${captions?.caption_tracks?.length || 0} caption tracks`)
      if (captions?.caption_tracks?.length > 0) {
        console.log(`[VIDEO] Caption tracks:`, captions.caption_tracks.map(t => ({
          lang: t.language_code,
          name: t.name?.text,
          baseUrl: t.base_url?.substring(0, 80) + '...'
        })))
      }

      const secondaryInfo = fullInfo.secondary_info
      if (secondaryInfo?.owner?.author?.thumbnails?.[0]?.url) {
        channelAvatar = secondaryInfo.owner.author.thumbnails[0].url
      }
    } catch (e) {
      console.log(`[VIDEO] Could not get related videos: ${e.message}`)
    }

    const converted = await convertVideoInfo(info, relatedVideos, channelAvatar, captions)

    // Prefetch English caption in background (non-blocking)
    if (captions?.caption_tracks?.length > 0) {
      const enTrack = captions.caption_tracks.find(t =>
        t.language_code === 'en' || t.language_code.startsWith('en')
      )
      if (enTrack?.base_url) {
        // Fire and forget - don't await
        prefetchCaption(videoId, 'en', enTrack.base_url).catch(() => {})
      }
    }

    res.json(converted)
  } catch (error) {
    console.error('[VIDEO]', error.message)
    res.status(500).json({ error: error.message })
  }
})

// Channel info
router.get('/channels/:id', async (req, res) => {
  try {
    const channelId = req.params.id
    console.log(`[CHANNEL] Fetching: ${channelId}`)

    const innertube = getInnertube()
    const channel = await innertube.getChannel(channelId)

    const metadata = channel.metadata || {}

    // Available tabs
    const tabs = []
    if (channel.has_videos) tabs.push('videos')
    if (channel.has_shorts) tabs.push('shorts')
    if (channel.has_live_streams) tabs.push('live')
    if (channel.has_playlists) tabs.push('playlists')
    if (channel.has_community) tabs.push('community')
    tabs.push('about')

    // Avatar
    const avatarUrl = metadata.avatar?.[0]?.url || ''
    const authorThumbnails = createAuthorThumbnails(avatarUrl)

    // Banner
    const bannerUrl = metadata.banner?.[0]?.url || ''
    const authorBanners = bannerUrl ? [
      { url: toGgphtProxyUrl(bannerUrl), width: 1280, height: 720 }
    ] : []

    // Subscriber count
    let subCount = 0
    const subText = metadata.subscriber_count || ''
    if (subText) {
      const match = subText.match(/([\d.]+)\s*([KMB萬億])?/i)
      if (match) {
        let num = parseFloat(match[1])
        const unit = (match[2] || '').toUpperCase()
        if (unit === 'K' || unit === '萬') num *= 1000
        else if (unit === 'M' || unit === '億') num *= 1000000
        else if (unit === 'B') num *= 1000000000
        subCount = Math.floor(num)
      }
    }

    // Latest videos
    let latestVideos = []
    try {
      if (channel.has_videos) {
        const videosTab = await channel.getVideos()
        latestVideos = convertChannelVideos(videosTab.videos || [], channelId)
      }
    } catch (e) {
      console.log(`[CHANNEL] Could not fetch latest videos: ${e.message}`)
    }

    res.json({
      author: metadata.title || '',
      authorId: channelId,
      authorUrl: `/channel/${channelId}`,
      authorVerified: false,
      authorBanners: authorBanners,
      authorThumbnails: authorThumbnails,
      subCount: subCount,
      totalViews: 0,
      joined: 0,
      autoGenerated: false,
      isFamilyFriendly: metadata.is_family_safe ?? true,
      description: metadata.description || '',
      descriptionHtml: metadata.description || '',
      allowedRegions: [],
      tabs: tabs,
      latestVideos: latestVideos,
      relatedChannels: [],
    })
  } catch (error) {
    console.error('[CHANNEL]', error.message)
    res.status(500).json({ error: error.message })
  }
})

// Channel sub-resources
router.get('/channels/:id/:subResource', async (req, res) => {
  try {
    const { id: channelId, subResource } = req.params
    console.log(`[CHANNEL] Fetching ${subResource} for: ${channelId}`)

    const innertube = getInnertube()
    const channel = await innertube.getChannel(channelId)

    let data = { videos: [], continuation: null }

    switch (subResource) {
      case 'videos': {
        const videosTab = await channel.getVideos()
        data = {
          videos: convertChannelVideos(videosTab.videos || [], channelId),
          continuation: videosTab.has_continuation ? 'has_more' : null
        }
        break
      }
      case 'shorts': {
        if (channel.has_shorts) {
          const shortsTab = await channel.getShorts()
          const videos = (shortsTab.videos || []).map(video => {
            const videoId = video.id
            if (!videoId) return null
            return {
              type: 'video',
              title: video.title?.text || '',
              videoId: videoId,
              authorId: channelId,
              authorUrl: `/channel/${channelId}`,
              videoThumbnails: [
                { quality: 'maxres', url: `/vi/${videoId}/maxresdefault.jpg`, width: 1280, height: 720 },
              ],
              viewCountText: video.views?.text || '',
              lengthSeconds: 60,
            }
          }).filter(Boolean)
          data = { videos, continuation: shortsTab.has_continuation ? 'has_more' : null }
        }
        break
      }
      case 'playlists': {
        if (channel.has_playlists) {
          const playlistsTab = await channel.getPlaylists()
          const playlists = (playlistsTab.playlists || []).map(playlist => ({
            type: 'playlist',
            title: playlist.title?.text || '',
            playlistId: playlist.id,
            playlistThumbnail: `/vi/${playlist.first_video_id}/mqdefault.jpg`,
            author: channel.metadata?.title || '',
            authorId: channelId,
            videoCount: playlist.video_count || 0,
          }))
          data = { playlists, continuation: playlistsTab.has_continuation ? 'has_more' : null }
        }
        break
      }
      case 'community':
      case 'posts': {
        if (channel.has_community) {
          const communityTab = await channel.getCommunity()
          const channelName = channel.metadata?.title || ''
          const channelAvatar = channel.metadata?.avatar?.[0]?.url || ''

          const posts = (communityTab.posts || []).map(post => ({
            author: channelName,
            authorId: channelId,
            authorThumbnails: createAuthorThumbnails(channelAvatar),
            authorUrl: `/channel/${channelId}`,
            commentId: post.id || '',
            content: post.content?.text || '',
            contentHtml: post.content?.text || '',
            likeCount: 0,
            publishedText: post.published?.text || '',
            replyCount: 0,
            attachment: null,
          }))
          data = { comments: posts, continuation: communityTab.has_continuation ? 'has_more' : null }
        }
        break
      }
      case 'live':
      case 'streams': {
        if (channel.has_live_streams) {
          const liveTab = await channel.getLiveStreams()
          data = {
            videos: convertChannelVideos(liveTab.videos || [], channelId),
            continuation: liveTab.has_continuation ? 'has_more' : null
          }
        }
        break
      }
      default:
        return res.status(404).json({ error: `Unknown sub-resource: ${subResource}` })
    }

    res.json(data)
  } catch (error) {
    console.error('[CHANNEL SUB]', error.message)
    res.status(500).json({ error: error.message })
  }
})

// Trending / Popular
router.get(['/trending', '/popular'], async (req, res) => {
  try {
    const innertube = getInnertube()
    const trending = await innertube.getTrending()
    const converted = convertSearchResults(trending.videos || [])
    res.json(converted)
  } catch (error) {
    console.log('[TRENDING] getTrending failed, using search fallback')
    try {
      const innertube = getInnertube()
      const searchResults = await innertube.search('music video 2024', { sort_by: 'view_count' })
      const converted = convertSearchResults(searchResults.results || [])
      res.json(converted)
    } catch (searchError) {
      console.error('[TRENDING]', searchError.message)
      res.status(500).json({ error: 'Unable to fetch trending videos' })
    }
  }
})

// DASH Manifest
router.get('/manifest/dash/id/:id', async (req, res) => {
  try {
    const videoId = req.params.id
    console.log(`[DASH] Generating manifest for: ${videoId}`)

    const innertubeAndroid = getInnertubeAndroid()
    const info = await innertubeAndroid.getBasicInfo(videoId)
    const streaming = info.streaming_data

    if (!streaming || !streaming.adaptive_formats) {
      console.error(`[DASH] No streaming data for video: ${videoId}`)
      return res.status(404).send('No streaming data available')
    }

    // Filter out formats without URL or range data
    const validFormats = streaming.adaptive_formats.filter(f => {
      if (!f.url) {
        console.warn(`[DASH] Skipping format ${f.itag}: no URL`)
        return false
      }
      return true
    })

    if (validFormats.length === 0) {
      console.error(`[DASH] No valid formats for video: ${videoId}`)
      return res.status(404).send('No valid streaming formats')
    }

    console.log(`[DASH] Found ${validFormats.length} valid formats for ${videoId}`)

    // Use relative URLs in manifest - they work correctly with Vite proxy
    // Absolute URLs fail when behind proxy because req.get('host') returns localhost:3001
    const manifest = generateDashManifest(videoId, validFormats, info.basic_info?.duration || 0, '')

    res.set('Content-Type', 'application/dash+xml')
    res.set('Cache-Control', 'no-cache')
    res.set('Access-Control-Allow-Origin', '*')
    res.send(manifest)
  } catch (error) {
    console.error('[DASH]', error.message, error.stack)
    res.status(500).send('Error generating manifest')
  }
})

// Captions/Transcript - proxy YouTube timedtext
router.get('/captions/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params
    const langCode = req.query.lang || 'en'
    const encodedSrc = req.query.src || ''
    const clientCookie = req.headers['x-youtube-cookie'] || ''

    console.log(`[CAPTIONS] Fetching captions for ${videoId}, lang=${langCode}, hasSrc=${!!encodedSrc}, hasCookie=${!!clientCookie}`)

    // Check cache first
    const cachedCaption = captionCache.get(videoId, langCode)
    if (cachedCaption) {
      console.log(`[CAPTIONS] Serving from cache`)
      res.set({
        'Content-Type': 'text/vtt; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
        'X-Caption-Cache': 'HIT',
      })
      return res.send(cachedCaption)
    }

    let captionBaseUrl = null

    // If we have an encoded source URL, use it directly (no need to call getInfo again)
    if (encodedSrc) {
      try {
        captionBaseUrl = Buffer.from(encodedSrc, 'base64url').toString('utf-8')
        console.log(`[CAPTIONS] Using encoded URL: ${captionBaseUrl.substring(0, 100)}...`)
      } catch (e) {
        console.log(`[CAPTIONS] Failed to decode src: ${e.message}`)
      }
    }

    // Fallback: fetch caption URL from YouTube API
    if (!captionBaseUrl) {
      console.log(`[CAPTIONS] No encoded URL, fetching from YouTube API...`)
      const innertube = getInnertube()
      const info = await innertube.getInfo(videoId)

      const tracks = info.captions?.caption_tracks || []
      console.log(`[CAPTIONS] Found ${tracks.length} caption tracks`)

      if (tracks.length === 0) {
        return res.status(404).json({ error: 'No captions available' })
      }

      let track = tracks.find(t => t.language_code === langCode)
      if (!track) {
        track = tracks.find(t =>
          t.language_code.startsWith(langCode) || langCode.startsWith(t.language_code)
        )
      }
      if (!track) {
        track = tracks[0]
        console.log(`[CAPTIONS] Requested ${langCode} not found, using ${track.language_code}`)
      }

      if (!track.base_url) {
        return res.status(404).json({ error: 'No caption URL available' })
      }

      captionBaseUrl = track.base_url
    }

    // Fetch the caption content
    console.log(`[CAPTIONS] Fetching from: ${captionBaseUrl.substring(0, 100)}...`)

    try {
      const captionUrl = new URL(captionBaseUrl)
      captionUrl.searchParams.set('fmt', 'vtt')

      // Build headers with optional cookie
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/vtt,*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.youtube.com/',
        'Origin': 'https://www.youtube.com'
      }

      // Add YouTube cookie if provided by client
      if (clientCookie) {
        headers['Cookie'] = clientCookie
        console.log(`[CAPTIONS] Using client-provided cookie`)
      }

      const response = await fetch(captionUrl.toString(), { headers })

      if (!response.ok) {
        throw new Error(`Fetch failed with status ${response.status}`)
      }

      let text = await response.text()
      console.log(`[CAPTIONS] Fetched ${text.length} bytes`)

      // If empty, try other formats
      if (text.length === 0) {
        console.log(`[CAPTIONS] Empty response, trying JSON3 format...`)
        captionUrl.searchParams.set('fmt', 'json3')
        const jsonResponse = await fetch(captionUrl.toString(), { headers })
        if (jsonResponse.ok) {
          const jsonText = await jsonResponse.text()
          if (jsonText.length > 0 && jsonText.startsWith('{')) {
            const jsonData = JSON.parse(jsonText)
            text = convertJson3ToVtt(jsonData)
            console.log(`[CAPTIONS] Converted JSON3 to VTT: ${text.length} bytes`)
          }
        }
      }

      // If still empty, try without format parameter
      if (text.length === 0) {
        console.log(`[CAPTIONS] Still empty, trying without fmt param...`)
        captionUrl.searchParams.delete('fmt')
        const defaultResponse = await fetch(captionUrl.toString(), { headers })
        if (defaultResponse.ok) {
          text = await defaultResponse.text()
          if (text.includes('<text')) {
            text = convertXmlToVtt(text)
            console.log(`[CAPTIONS] Converted XML to VTT: ${text.length} bytes`)
          }
        }
      }

      if (text.length === 0) {
        console.log(`[CAPTIONS] All fetch attempts returned empty`)
        return res.status(404).json({ error: 'Caption content unavailable (YouTube API restriction)' })
      }

      // Ensure it's valid VTT
      if (!text.startsWith('WEBVTT')) {
        text = 'WEBVTT\n\n' + text
      }

      console.log(`[CAPTIONS] Returning VTT (${text.length} bytes)`)

      // Store in cache
      captionCache.set(videoId, langCode, text)

      res.set({
        'Content-Type': 'text/vtt; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
        'X-Caption-Cache': 'MISS',
      })
      return res.send(text)

    } catch (fetchError) {
      console.log(`[CAPTIONS] Fetch error: ${fetchError.message}`)
      return res.status(404).json({ error: 'Failed to fetch captions' })
    }
  } catch (error) {
    console.error('[CAPTIONS]', error.message)
    res.status(500).json({ error: error.message })
  }
})

// Helper function to format milliseconds to VTT timestamp
function formatVttTime(ms) {
  const hours = Math.floor(ms / 3600000)
  const minutes = Math.floor((ms % 3600000) / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  const milliseconds = ms % 1000
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`
}

// Helper function to format seconds to VTT timestamp
function formatVttTimeFromSeconds(seconds) {
  const ms = Math.round(seconds * 1000)
  return formatVttTime(ms)
}

// Convert YouTube JSON3 caption format to VTT
function convertJson3ToVtt(json) {
  let vtt = 'WEBVTT\n\n'

  const events = json.events || []
  let index = 1

  for (const event of events) {
    if (!event.segs || event.segs.length === 0) continue

    const startMs = event.tStartMs || 0
    const durationMs = event.dDurationMs || 5000
    const endMs = startMs + durationMs

    // Combine all segments text
    const text = event.segs.map(seg => seg.utf8 || '').join('').trim()
    if (!text) continue

    vtt += `${index}\n`
    vtt += `${formatVttTime(startMs)} --> ${formatVttTime(endMs)}\n`
    vtt += `${text}\n\n`
    index++
  }

  return vtt
}

// Convert YouTube XML caption format to VTT
function convertXmlToVtt(xml) {
  let vtt = 'WEBVTT\n\n'

  // Parse XML text elements: <text start="0.48" dur="3.28">caption text</text>
  const textRegex = /<text\s+start="([^"]+)"\s+dur="([^"]+)"[^>]*>([^<]*)<\/text>/g
  let match
  let index = 1

  while ((match = textRegex.exec(xml)) !== null) {
    const start = parseFloat(match[1])
    const duration = parseFloat(match[2])
    const end = start + duration
    let text = match[3]

    // Decode HTML entities
    text = text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n/g, ' ')
      .trim()

    if (text) {
      vtt += `${index}\n`
      vtt += `${formatVttTimeFromSeconds(start)} --> ${formatVttTimeFromSeconds(end)}\n`
      vtt += `${text}\n\n`
      index++
    }
  }

  return vtt
}

// List available captions for a video
router.get('/captions/:videoId/list', async (req, res) => {
  try {
    const { videoId } = req.params
    console.log(`[CAPTIONS] Listing for ${videoId}`)

    const innertube = getInnertube()
    const info = await innertube.getInfo(videoId)

    const tracks = (info.captions?.caption_tracks || []).map(track => ({
      label: track.name?.text || track.language_code,
      language_code: track.language_code,
      url: `/api/captions/${videoId}?lang=${track.language_code}&fmt=vtt`
    }))

    res.json(tracks)
  } catch (error) {
    console.error('[CAPTIONS LIST]', error.message)
    res.status(500).json({ error: error.message })
  }
})

// Captions via yt-dlp (more reliable than YouTube API)
router.get('/captions-ytdlp/:videoId', async (req, res) => {
  const { videoId } = req.params
  const langCode = req.query.lang || 'en'

  console.log(`[CAPTIONS-YTDLP] Fetching captions for ${videoId}, lang=${langCode}`)

  // Check cache first
  const cachedCaption = captionCache.get(videoId, langCode)
  if (cachedCaption) {
    console.log(`[CAPTIONS-YTDLP] Serving from cache`)
    res.set({
      'Content-Type': 'text/vtt; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
      'X-Caption-Cache': 'HIT',
    })
    return res.send(cachedCaption)
  }

  const tmpDir = os.tmpdir()
  const outputPath = path.join(tmpDir, `caption_${videoId}_${langCode}`)

  try {
    // Clean up any existing files
    const vttPath = `${outputPath}.${langCode}.vtt`
    try {
      await fs.unlink(vttPath)
    } catch {}

    // Use yt-dlp to download subtitles with Chrome impersonation for reliability
    const ytdlpCmd = `yt-dlp --impersonate chrome-131 --skip-download --write-sub --write-auto-sub --sub-lang "${langCode}" --sub-format vtt --convert-subs vtt -o "${outputPath}" "https://www.youtube.com/watch?v=${videoId}"`

    console.log(`[CAPTIONS-YTDLP] Running: ${ytdlpCmd}`)

    await execAsync(ytdlpCmd, { timeout: 30000 })

    // Try to read the subtitle file
    let subtitleContent = null
    const possiblePaths = [
      `${outputPath}.${langCode}.vtt`,
      `${outputPath}.${langCode.split('-')[0]}.vtt`,
    ]

    for (const p of possiblePaths) {
      try {
        subtitleContent = await fs.readFile(p, 'utf-8')
        await fs.unlink(p) // Clean up
        console.log(`[CAPTIONS-YTDLP] Found subtitle at: ${p}`)
        break
      } catch {}
    }

    if (!subtitleContent) {
      // Try to find any VTT file with the video ID
      const files = await fs.readdir(tmpDir)
      for (const f of files) {
        if (f.startsWith(`caption_${videoId}`) && f.endsWith('.vtt')) {
          const fullPath = path.join(tmpDir, f)
          subtitleContent = await fs.readFile(fullPath, 'utf-8')
          await fs.unlink(fullPath)
          console.log(`[CAPTIONS-YTDLP] Found subtitle at: ${fullPath}`)
          break
        }
      }
    }

    if (!subtitleContent) {
      console.log(`[CAPTIONS-YTDLP] No subtitle file found`)
      return res.status(404).json({ error: 'Subtitles not available' })
    }

    console.log(`[CAPTIONS-YTDLP] Returning ${subtitleContent.length} bytes`)

    // Store in cache
    captionCache.set(videoId, langCode, subtitleContent)

    res.set({
      'Content-Type': 'text/vtt; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
      'X-Caption-Cache': 'MISS',
    })
    return res.send(subtitleContent)

  } catch (error) {
    console.error(`[CAPTIONS-YTDLP] Error:`, error.message)

    // Clean up any partial files
    try {
      const files = await fs.readdir(tmpDir)
      for (const f of files) {
        if (f.startsWith(`caption_${videoId}`)) {
          await fs.unlink(path.join(tmpDir, f))
        }
      }
    } catch {}

    return res.status(500).json({ error: error.message })
  }
})

// Storyboards (placeholder)
router.get('/storyboards/:id', (req, res) => {
  res.json({ storyboards: [] })
})

// Stats (health check)
router.get('/stats', (req, res) => {
  res.json({
    version: '1.0.0',
    software: { name: 'meetube', version: '1.0.0' },
    openRegistrations: true,
    usage: { users: { total: 1, activeHalfyear: 1, activeMonth: 1 } },
  })
})

// Caption cache stats (debug)
router.get('/caption-cache/stats', (req, res) => {
  res.json(captionCache.getStats())
})

// ============================================
// Translation API (Google Translate)
// ============================================

// Translation cache (LRU)
class TranslationCache {
  constructor(maxSize = 2000, ttlMs = 7 * 24 * 60 * 60 * 1000) { // 7 days
    this.maxSize = maxSize
    this.ttlMs = ttlMs
    this.cache = new Map()
  }

  _makeKey(text, targetLang) {
    return `${targetLang}:${text.substring(0, 100)}`
  }

  get(text, targetLang) {
    const key = this._makeKey(text, targetLang)
    const entry = this.cache.get(key)
    if (!entry || Date.now() > entry.expiresAt) {
      if (entry) this.cache.delete(key)
      return null
    }
    // Move to end (LRU)
    this.cache.delete(key)
    this.cache.set(key, entry)
    return entry.data
  }

  set(text, targetLang, translation) {
    const key = this._makeKey(text, targetLang)
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value
      this.cache.delete(oldestKey)
    }
    this.cache.set(key, {
      data: translation,
      expiresAt: Date.now() + this.ttlMs
    })
  }

  getStats() {
    return { size: this.cache.size, maxSize: this.maxSize }
  }
}

const translationCache = new TranslationCache()

/**
 * Google Translate (免費、無需 API Key)
 */
async function googleTranslate(text, targetLang = 'zh-TW') {
  const cleanText = text.replace(/\u200B/g, '').trim()
  if (!cleanText) return ''

  // Check cache
  const cached = translationCache.get(cleanText, targetLang)
  if (cached) {
    console.log(`[TRANSLATE] Cache HIT: "${cleanText.substring(0, 30)}..."`)
    return cached
  }

  const params = new URLSearchParams({
    client: 'gtx',
    sl: 'en',
    tl: targetLang,
    dt: 't',
    strip: '1',
    nonced: '1',
    q: cleanText,
  })

  const resp = await fetch(
    `https://translate.googleapis.com/translate_a/single?${params}`
  )

  if (!resp.ok) {
    throw new Error(`Google Translate failed: ${resp.status}`)
  }

  const result = await resp.json()
  const translation = result[0]
    .filter(Array.isArray)
    .map(chunk => chunk[0])
    .filter(Boolean)
    .join('')

  // Cache result
  translationCache.set(cleanText, targetLang, translation)
  console.log(`[TRANSLATE] Translated: "${cleanText.substring(0, 30)}..." => "${translation.substring(0, 30)}..."`)

  return translation
}

/**
 * 批次翻譯 (個別翻譯每個文本)
 */
async function batchTranslate(texts, targetLang = 'zh-TW') {
  // Translate each text individually in parallel for reliability
  const translations = await Promise.all(
    texts.map(text => googleTranslate(text, targetLang))
  )
  return translations
}

// Single text translation
router.post('/translate', async (req, res) => {
  try {
    const { text, targetLang = 'zh-TW' } = req.body

    if (!text) {
      return res.status(400).json({ error: 'Text is required' })
    }

    const translation = await googleTranslate(text, targetLang)
    res.json({ translation })
  } catch (error) {
    console.error('[TRANSLATE]', error.message)
    res.status(500).json({ error: error.message })
  }
})

// Batch translation (for subtitles)
router.post('/translate/batch', async (req, res) => {
  try {
    const { texts, targetLang = 'zh-TW' } = req.body

    if (!texts || !Array.isArray(texts)) {
      return res.status(400).json({ error: 'Texts array is required' })
    }

    if (texts.length === 0) {
      return res.json({ translations: [] })
    }

    // Limit batch size (increased for progressive loading optimization)
    if (texts.length > 100) {
      return res.status(400).json({ error: 'Max 100 texts per batch' })
    }

    const translations = await batchTranslate(texts, targetLang)
    res.json({ translations })
  } catch (error) {
    console.error('[TRANSLATE BATCH]', error.message)
    res.status(500).json({ error: error.message })
  }
})

// Translation cache stats
router.get('/translate/stats', (req, res) => {
  res.json(translationCache.getStats())
})

// === Helper Functions ===

function generateDashManifest(videoId, adaptiveFormats, duration, baseUrl = '') {
  const durationSeconds = duration || 0
  const durationISO = `PT${Math.floor(durationSeconds / 3600)}H${Math.floor((durationSeconds % 3600) / 60)}M${durationSeconds % 60}S`

  const videoFormats = adaptiveFormats.filter(f => f.mime_type?.startsWith('video/'))
  const audioFormats = adaptiveFormats.filter(f => f.mime_type?.startsWith('audio/'))

  function getRange(format, type) {
    const rangeKey = type === 'init' ? 'init_range' : 'index_range'
    const shortKey = type === 'init' ? 'init' : 'index'

    if (format[rangeKey]?.start !== undefined) {
      return `${format[rangeKey].start}-${format[rangeKey].end}`
    }
    if (format[shortKey]) {
      return format[shortKey]
    }
    // If no range data, return null to indicate unavailable
    return null
  }

  function escapeXml(str) {
    if (!str) return ''
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
  }

  // Helper to build representation XML
  function buildRepresentation(format, isVideo) {
    const proxyUrl = toProxyUrl(format.url)
    // Use absolute URL for better compatibility
    const url = baseUrl ? `${baseUrl}${proxyUrl}` : proxyUrl
    const codecs = format.mime_type?.match(/codecs="([^"]+)"/)?.[1] || ''
    const initRange = getRange(format, 'init')
    const indexRange = getRange(format, 'index')

    // Skip format if missing critical range data
    if (!initRange || !indexRange) {
      console.warn(`[DASH] Format ${format.itag} missing range data, skipping`)
      return ''
    }

    if (isVideo) {
      const frameRate = format.fps ? ` frameRate="${format.fps}"` : ''
      return `
        <Representation id="${format.itag}" bandwidth="${format.bitrate || 0}" width="${format.width || 0}" height="${format.height || 0}" codecs="${codecs}"${frameRate}>
          <BaseURL>${escapeXml(url)}</BaseURL>
          <SegmentBase indexRange="${indexRange}">
            <Initialization range="${initRange}"/>
          </SegmentBase>
        </Representation>`
    } else {
      const audioSampleRate = format.audio_sample_rate ? ` audioSamplingRate="${format.audio_sample_rate}"` : ''
      return `
        <Representation id="${format.itag}" bandwidth="${format.bitrate || 0}" codecs="${codecs}"${audioSampleRate}>
          <BaseURL>${escapeXml(url)}</BaseURL>
          <SegmentBase indexRange="${indexRange}">
            <Initialization range="${initRange}"/>
          </SegmentBase>
        </Representation>`
    }
  }

  let adaptationSets = ''

  // Video formats by container type
  const mp4Video = videoFormats.filter(f => f.mime_type?.includes('video/mp4'))
  const webmVideo = videoFormats.filter(f => f.mime_type?.includes('video/webm'))

  if (mp4Video.length > 0) {
    const representations = mp4Video.map(f => buildRepresentation(f, true)).filter(Boolean).join('')
    if (representations) {
      adaptationSets += `
    <AdaptationSet mimeType="video/mp4" subsegmentAlignment="true" startWithSAP="1">
      ${representations}
    </AdaptationSet>`
    }
  }

  if (webmVideo.length > 0) {
    const representations = webmVideo.map(f => buildRepresentation(f, true)).filter(Boolean).join('')
    if (representations) {
      adaptationSets += `
    <AdaptationSet mimeType="video/webm" subsegmentAlignment="true" startWithSAP="1">
      ${representations}
    </AdaptationSet>`
    }
  }

  // Audio formats by container type
  const mp4Audio = audioFormats.filter(f => f.mime_type?.includes('audio/mp4'))
  const webmAudio = audioFormats.filter(f => f.mime_type?.includes('audio/webm'))

  if (mp4Audio.length > 0) {
    const representations = mp4Audio.map(f => buildRepresentation(f, false)).filter(Boolean).join('')
    if (representations) {
      adaptationSets += `
    <AdaptationSet mimeType="audio/mp4" subsegmentAlignment="true" startWithSAP="1">
      ${representations}
    </AdaptationSet>`
    }
  }

  if (webmAudio.length > 0) {
    const representations = webmAudio.map(f => buildRepresentation(f, false)).filter(Boolean).join('')
    if (representations) {
      adaptationSets += `
    <AdaptationSet mimeType="audio/webm" subsegmentAlignment="true" startWithSAP="1">
      ${representations}
    </AdaptationSet>`
    }
  }

  // Ensure we have at least one adaptation set
  if (!adaptationSets.trim()) {
    console.error('[DASH] No valid adaptation sets generated')
    throw new Error('No valid adaptation sets')
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" profiles="urn:mpeg:dash:profile:isoff-on-demand:2011" type="static" mediaPresentationDuration="${durationISO}" minBufferTime="PT1.5S">
  <Period duration="${durationISO}">
    ${adaptationSets}
  </Period>
</MPD>`
}

export default router
