/**
 * YouTube Service
 * Handles all YouTube API interactions using youtubei.js
 */

import { Innertube, ClientType } from 'youtubei.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// YouTube clients
let innertube = null
let innertubeAndroid = null

// Cookie support
function loadYouTubeCookie() {
  // From environment variable
  if (process.env.YOUTUBE_COOKIE) {
    console.log('[COOKIE] Loaded from environment variable')
    return parseNetscapeCookie(process.env.YOUTUBE_COOKIE)
  }

  // From .env.local file
  const envLocalPath = path.join(__dirname, '../../.env.local')
  if (fs.existsSync(envLocalPath)) {
    const content = fs.readFileSync(envLocalPath, 'utf-8')
    const match = content.match(/YOUTUBE_COOKIE="([^"]+)"/s)
    if (match) {
      console.log('[COOKIE] Loaded from .env.local')
      return parseNetscapeCookie(match[1])
    }
  }

  console.log('[COOKIE] No cookie found, running without authentication')
  return null
}

function parseNetscapeCookie(cookieString) {
  if (!cookieString) return null

  const cookies = {}
  const lines = cookieString.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const parts = trimmed.split('\t')
    if (parts.length >= 7) {
      const name = parts[5]
      const value = parts[6]
      if (name && value !== undefined) {
        cookies[name] = value
      }
    }
  }

  const cookieStr = Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ')

  console.log(`[COOKIE] Parsed ${Object.keys(cookies).length} cookies`)
  return cookieStr
}

// Initialize YouTube clients
export async function initYouTube() {
  console.log('[YOUTUBE] Initializing...')

  const cookie = loadYouTubeCookie()

  const baseConfig = {
    lang: 'zh-TW',
    location: 'TW',
    retrieve_player: false,
  }

  if (cookie) {
    baseConfig.cookie = cookie
    console.log('[YOUTUBE] Using authenticated session')
  }

  // General client (search, channel, etc.)
  innertube = await Innertube.create(baseConfig)

  // Android client (for high quality streams)
  innertubeAndroid = await Innertube.create({
    ...baseConfig,
    client_type: ClientType.ANDROID,
    retrieve_player: true,
  })

  console.log('[YOUTUBE] Ready!')
}

// Get clients
export function getInnertube() {
  return innertube
}

export function getInnertubeAndroid() {
  return innertubeAndroid
}

// === Conversion Helpers ===

// Convert thumbnail URL to proxy URL
export function toVideoThumbnailProxyUrl(url) {
  if (!url) return ''
  const match = url.match(/^https?:\/\/i\.ytimg\.com\/((vi|vi_webp)\/[^/]+\/.+)$/)
  if (match) {
    return `/${match[1]}`
  }
  return url
}

// Convert ggpht URL to proxy URL (channel avatars)
export function toGgphtProxyUrl(url) {
  if (!url) return ''
  if (url.startsWith('//')) {
    url = 'https:' + url
  }
  if (url.includes('yt3.ggpht.com')) {
    const ggphtPath = url.replace(/^https?:\/\/yt3\.ggpht\.com/, '')
    return `/ggpht${ggphtPath}`
  }
  if (url.includes('googleusercontent.com')) {
    const encoded = Buffer.from(url).toString('base64url')
    return `/imgproxy?url=${encoded}`
  }
  return url
}

// Convert video stream URL to proxy URL
export function toProxyUrl(originalUrl) {
  if (!originalUrl) return ''
  const encoded = Buffer.from(originalUrl).toString('base64url')
  return `/videoplayback?url=${encoded}`
}

// Create standard author thumbnails array
export function createAuthorThumbnails(avatarUrl) {
  const url = toGgphtProxyUrl(avatarUrl)
  if (!url) return []
  return [
    { url, width: 32, height: 32 },
    { url, width: 48, height: 48 },
    { url, width: 76, height: 76 },
    { url, width: 176, height: 176 },
  ]
}

// Parse duration string (e.g., "3:45" -> 225)
export function parseDuration(durationStr) {
  if (!durationStr) return 0
  const parts = durationStr.split(':').map(Number)
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1]
  } else if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2]
  }
  return 0
}

// Parse published time text to milliseconds
export function parsePublishedTime(text) {
  if (!text) return 0
  const match = text.match(/(\d+)\s*(秒|分鐘|小時|天|週|個月|年|second|minute|hour|day|week|month|year)/i)
  if (!match) return 0

  const num = parseInt(match[1])
  const unit = match[2].toLowerCase()

  const multipliers = {
    '秒': 1000,
    'second': 1000,
    '分鐘': 60 * 1000,
    'minute': 60 * 1000,
    '小時': 60 * 60 * 1000,
    'hour': 60 * 60 * 1000,
    '天': 24 * 60 * 60 * 1000,
    'day': 24 * 60 * 60 * 1000,
    '週': 7 * 24 * 60 * 60 * 1000,
    'week': 7 * 24 * 60 * 60 * 1000,
    '個月': 30 * 24 * 60 * 60 * 1000,
    'month': 30 * 24 * 60 * 60 * 1000,
    '年': 365 * 24 * 60 * 60 * 1000,
    'year': 365 * 24 * 60 * 60 * 1000
  }

  return num * (multipliers[unit] || 0)
}

// Convert search results to Invidious format
export function convertSearchResults(results) {
  return results.map(item => {
    if (item.type === 'Video') {
      const videoId = item.id
      const videoThumbnails = [
        { quality: 'maxres', url: `/vi/${videoId}/maxresdefault.jpg`, width: 1280, height: 720 },
        { quality: 'sddefault', url: `/vi/${videoId}/sddefault.jpg`, width: 640, height: 480 },
        { quality: 'high', url: `/vi/${videoId}/hqdefault.jpg`, width: 480, height: 360 },
        { quality: 'medium', url: `/vi/${videoId}/mqdefault.jpg`, width: 320, height: 180 },
        { quality: 'default', url: `/vi/${videoId}/default.jpg`, width: 120, height: 90 },
      ]
      return {
        type: 'video',
        title: item.title?.text || '',
        videoId: videoId,
        author: item.author?.name || '',
        authorId: item.author?.id || '',
        authorUrl: `/channel/${item.author?.id || ''}`,
        videoThumbnails: videoThumbnails,
        description: item.description || '',
        viewCount: parseInt(item.view_count?.text?.replace(/[^0-9]/g, '') || '0'),
        viewCountText: item.view_count?.text || '',
        published: item.published?.text || '',
        publishedText: item.published?.text || '',
        lengthSeconds: item.duration?.seconds || 0,
        liveNow: item.is_live || false,
      }
    } else if (item.type === 'Channel') {
      const rawThumbs = item.author?.thumbnails || []
      let thumbUrl = rawThumbs[0]?.url || ''
      if (thumbUrl.startsWith('//')) {
        thumbUrl = 'https:' + thumbUrl
      }
      if (thumbUrl.includes('yt3.ggpht.com')) {
        const ggphtPath = thumbUrl.replace(/^https?:\/\/yt3\.ggpht\.com/, '')
        thumbUrl = `/ggpht${ggphtPath}`
      }
      const authorThumbnails = [
        { url: thumbUrl, width: 32, height: 32 },
        { url: thumbUrl, width: 48, height: 48 },
        { url: thumbUrl, width: 76, height: 76 },
        { url: thumbUrl, width: 176, height: 176 },
      ]

      return {
        type: 'channel',
        author: item.author?.name || '',
        authorId: item.author?.id || '',
        authorUrl: `/channel/${item.author?.id || ''}`,
        authorThumbnails: authorThumbnails,
        subCount: item.subscriber_count?.text || '',
        videoCount: item.video_count?.text || '',
        description: item.description || '',
      }
    } else if (item.type === 'Playlist') {
      return {
        type: 'playlist',
        title: item.title?.text || '',
        playlistId: item.id,
        author: item.author?.name || '',
        authorId: item.author?.id || '',
        videoCount: item.video_count || 0,
      }
    }
    return null
  }).filter(Boolean)
}

// Convert related videos to Invidious format
export function convertRelatedVideos(relatedVideos) {
  if (!relatedVideos || !Array.isArray(relatedVideos)) return []

  return relatedVideos.map(item => {
    const skipTypes = ['Playlist', 'CompactPlaylist', 'Mix', 'CompactMix', 'Radio', 'CompactRadio', 'RichSection']
    if (skipTypes.includes(item.type)) {
      return null
    }

    let videoId, title, author, authorId, viewCountText, durationSeconds, publishedText

    if (item.type === 'LockupView') {
      if (item.content_type === 'PLAYLIST' || item.content_type === 'MIX') {
        return null
      }
      videoId = item.content_id
      if (!videoId) return null

      const meta = item.metadata
      title = meta?.title?.text || ''
      const metaView = meta?.metadata

      if (metaView?.metadata_rows && metaView.metadata_rows.length > 0) {
        const row0 = metaView.metadata_rows[0]
        const row1 = metaView.metadata_rows[1]

        author = row0?.metadata_parts?.[0]?.text?.content ||
                 row0?.metadata_parts?.[0]?.text?.text || ''
        authorId = row0?.metadata_parts?.[0]?.text?.command?.inner_endpoint?.browse_id || ''

        if (row1?.metadata_parts) {
          viewCountText = row1.metadata_parts[0]?.text?.content ||
                          row1.metadata_parts[0]?.text?.text || ''
          publishedText = row1.metadata_parts[1]?.text?.content ||
                          row1.metadata_parts[1]?.text?.text || ''
        }
      }

      if (!author && meta?.byline) {
        author = meta.byline.text || meta.byline || ''
      }

      if (!author && meta?.owner?.title) {
        author = meta.owner.title || ''
      }

      const decorations = item.content_image?.decorations || []
      for (const deco of decorations) {
        if (deco.type === 'ThumbnailOverlayBadgeView' && deco.text) {
          durationSeconds = parseDuration(deco.text)
          break
        }
        if (deco.type === 'ThumbnailOverlayTimeStatusView' && deco.text) {
          durationSeconds = parseDuration(deco.text)
          break
        }
      }
      durationSeconds = durationSeconds || 0

    } else if (item.type === 'CompactVideo' || item.type === 'Video') {
      videoId = item.id || item.video_id
      if (!videoId) return null

      title = item.title?.text || item.title || ''
      author = item.author?.name || item.author || ''
      authorId = item.author?.id || ''
      viewCountText = item.view_count?.text || item.short_view_count?.text || ''
      publishedText = item.published?.text || ''
      durationSeconds = item.duration?.seconds || 0

    } else {
      videoId = item.id || item.video_id || item.content_id
      if (!videoId) return null

      title = item.title?.text || item.title || ''
      author = item.author?.name || item.author || ''
      authorId = item.author?.id || ''
      viewCountText = ''
      publishedText = ''
      durationSeconds = 0
    }

    const videoThumbnails = [
      { quality: 'maxres', url: `/vi/${videoId}/maxresdefault.jpg`, width: 1280, height: 720 },
      { quality: 'high', url: `/vi/${videoId}/hqdefault.jpg`, width: 480, height: 360 },
      { quality: 'medium', url: `/vi/${videoId}/mqdefault.jpg`, width: 320, height: 180 },
      { quality: 'default', url: `/vi/${videoId}/default.jpg`, width: 120, height: 90 },
    ]

    return {
      videoId: videoId,
      title: title,
      author: author || '未知頻道',
      authorId: authorId,
      authorUrl: `/channel/${authorId}`,
      authorThumbnails: [],
      videoThumbnails: videoThumbnails,
      viewCount: parseInt(viewCountText?.replace(/[^0-9]/g, '') || '0'),
      viewCountText: viewCountText || '',
      lengthSeconds: durationSeconds,
      published: publishedText,
      publishedText: publishedText || '',
    }
  }).filter(Boolean)
}

// Convert channel videos to Invidious format
export function convertChannelVideos(videos, channelId) {
  return videos.map(video => {
    const videoId = video.id
    if (!videoId) return null

    const videoThumbnails = [
      { quality: 'maxres', url: `/vi/${videoId}/maxresdefault.jpg`, width: 1280, height: 720 },
      { quality: 'high', url: `/vi/${videoId}/hqdefault.jpg`, width: 480, height: 360 },
      { quality: 'medium', url: `/vi/${videoId}/mqdefault.jpg`, width: 320, height: 180 },
      { quality: 'default', url: `/vi/${videoId}/default.jpg`, width: 120, height: 90 },
    ]

    let viewCount = 0
    const viewText = video.view_count?.text || video.short_view_count?.text || ''
    if (viewText) {
      const match = viewText.match(/([\d,.]+)\s*([KMB萬億次])?/i)
      if (match) {
        let num = parseFloat(match[1].replace(/,/g, ''))
        const unit = (match[2] || '').toUpperCase()
        if (unit === 'K' || unit === '萬') num *= 1000
        else if (unit === 'M' || unit === '億') num *= 1000000
        else if (unit === 'B') num *= 1000000000
        viewCount = Math.floor(num)
      }
    }

    return {
      type: 'video',
      title: video.title?.text || '',
      videoId: videoId,
      author: video.author?.name || '',
      authorId: channelId,
      authorUrl: `/channel/${channelId}`,
      videoThumbnails: videoThumbnails,
      description: '',
      viewCount: viewCount,
      viewCountText: viewText,
      published: video.published?.text ? Date.now() - parsePublishedTime(video.published.text) : Date.now(),
      publishedText: video.published?.text || '',
      lengthSeconds: video.duration?.seconds || 0,
      liveNow: video.is_live || false,
      isUpcoming: video.is_upcoming || false,
    }
  }).filter(Boolean)
}

// Convert video info to Invidious format
export async function convertVideoInfo(info, relatedVideos, channelAvatar = null) {
  const details = info.basic_info
  const streaming = info.streaming_data
  const playabilityStatus = info.playability_status

  const authorThumbnails = channelAvatar ? createAuthorThumbnails(channelAvatar) : []

  let errorMessage = null
  if (playabilityStatus?.status === 'LOGIN_REQUIRED') {
    errorMessage = '此影片需要登入才能觀看'
  } else if (playabilityStatus?.status === 'UNPLAYABLE') {
    errorMessage = playabilityStatus.reason || '此影片無法播放'
  } else if (playabilityStatus?.status === 'ERROR') {
    errorMessage = playabilityStatus.reason || '影片載入錯誤'
  }

  const formatStreams = []
  const adaptiveFormats = []

  if (streaming?.formats) {
    for (const f of streaming.formats) {
      formatStreams.push({
        url: toProxyUrl(f.url),
        itag: f.itag,
        type: f.mime_type,
        quality: f.quality_label || f.quality,
        container: f.mime_type?.split('/')[1]?.split(';')[0] || 'mp4',
        encoding: f.codecs,
        resolution: f.quality_label || '',
        qualityLabel: f.quality_label || f.quality,
        size: `${f.width}x${f.height}`,
      })
    }
  }

  if (streaming?.adaptive_formats) {
    for (const f of streaming.adaptive_formats) {
      adaptiveFormats.push({
        url: toProxyUrl(f.url),
        itag: f.itag,
        type: f.mime_type,
        bitrate: f.bitrate,
        width: f.width,
        height: f.height,
        container: f.mime_type?.split('/')[1]?.split(';')[0] || '',
        encoding: f.codecs,
        qualityLabel: f.quality_label || '',
        resolution: f.quality_label || `${f.height}p`,
        fps: f.fps,
        audioQuality: f.audio_quality,
        audioSampleRate: f.audio_sample_rate,
        audioChannels: f.audio_channels,
        init: f.init_range ? `${f.init_range.start}-${f.init_range.end}` : '0-0',
        index: f.index_range ? `${f.index_range.start}-${f.index_range.end}` : '0-0',
        clen: f.content_length || 0,
        lmt: f.last_modified || '',
      })
    }
  }

  const recommendedVideos = convertRelatedVideos(relatedVideos)

  return {
    type: 'video',
    title: details.title || '',
    videoId: details.id,
    videoThumbnails: (details.thumbnail || []).map(t => ({
      ...t,
      url: toVideoThumbnailProxyUrl(t.url)
    })),
    description: details.short_description || '',
    descriptionHtml: details.short_description || '',
    published: details.publish_date || '',
    publishedText: '',
    keywords: details.keywords || [],
    viewCount: details.view_count || 0,
    likeCount: info.basic_info.like_count || 0,
    dislikeCount: 0,
    paid: false,
    premium: false,
    isFamilyFriendly: true,
    allowedRegions: [],
    genre: details.category || '',
    author: details.author || '',
    authorId: details.channel_id || '',
    authorUrl: `/channel/${details.channel_id || ''}`,
    authorThumbnails: authorThumbnails,
    subCountText: '',
    lengthSeconds: details.duration || 0,
    allowRatings: true,
    rating: 0,
    isListed: true,
    liveNow: details.is_live || false,
    isUpcoming: details.is_upcoming || false,
    hlsUrl: streaming?.hls_manifest_url || null,
    dashUrl: `/api/manifest/dash/id/${details.id}`,
    adaptiveFormats: adaptiveFormats,
    formatStreams: formatStreams,
    captions: [],
    recommendedVideos: recommendedVideos,
    playabilityStatus: playabilityStatus?.status || 'OK',
    errorMessage: errorMessage,
  }
}
