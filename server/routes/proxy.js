/**
 * Proxy Routes
 * Handle video streaming and image proxying
 */

import { Router } from 'express'
import https from 'https'
import { getYouTubeCookie } from '../services/youtube.js'

const router = Router()

// Video thumbnail proxy
router.get(['/:viPath(vi|vi_webp)/:videoId/:filename'], (req, res) => {
  const { viPath, videoId, filename } = req.params
  const targetUrl = `https://i.ytimg.com/${viPath}/${videoId}/${filename}`

  console.log(`[THUMB] ${targetUrl}`)

  https.get(targetUrl, (proxyRes) => {
    res.set({
      'Content-Type': proxyRes.headers['content-type'] || 'image/jpeg',
      'Cache-Control': 'public, max-age=86400',
      'Access-Control-Allow-Origin': '*',
    })
    res.status(proxyRes.statusCode)
    proxyRes.pipe(res)
  }).on('error', () => {
    res.status(404).send('Not found')
  })
})

// Channel avatar proxy (ggpht)
router.get('/ggpht/*', (req, res) => {
  const ggphtPath = req.path.replace('/ggpht', '')

  const tryGoogleusercontent = () => {
    const googleUrl = `https://yt3.googleusercontent.com${ggphtPath}`
    console.log(`[GGPHT] Trying googleusercontent: ${googleUrl}`)

    https.get(googleUrl, (proxyRes) => {
      if (proxyRes.statusCode === 200) {
        res.set({
          'Content-Type': proxyRes.headers['content-type'] || 'image/jpeg',
          'Cache-Control': 'public, max-age=86400',
          'Access-Control-Allow-Origin': '*',
        })
        proxyRes.pipe(res)
      } else {
        proxyRes.resume()
        tryGgpht()
      }
    }).on('error', () => {
      tryGgpht()
    })
  }

  const tryGgpht = () => {
    const ggphtUrl = `https://yt3.ggpht.com${ggphtPath}`
    console.log(`[GGPHT] Trying ggpht: ${ggphtUrl}`)

    https.get(ggphtUrl, (proxyRes) => {
      res.set({
        'Content-Type': proxyRes.headers['content-type'] || 'image/jpeg',
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
      })
      res.status(proxyRes.statusCode)
      proxyRes.pipe(res)
    }).on('error', () => {
      res.status(404).send('Not found')
    })
  }

  tryGoogleusercontent()
})

// Generic image proxy
router.get('/imgproxy', (req, res) => {
  const encodedUrl = req.query.url
  if (!encodedUrl) {
    return res.status(400).send('Missing url parameter')
  }

  const targetUrl = Buffer.from(encodedUrl, 'base64url').toString('utf-8')
  console.log(`[IMGPROXY] ${targetUrl}`)

  https.get(targetUrl, (proxyRes) => {
    res.set({
      'Content-Type': proxyRes.headers['content-type'] || 'image/jpeg',
      'Cache-Control': 'public, max-age=86400',
      'Access-Control-Allow-Origin': '*',
    })
    res.status(proxyRes.statusCode)
    proxyRes.pipe(res)
  }).on('error', () => {
    res.status(404).send('Not found')
  })
})

// Captions/subtitles proxy
router.get('/captions', (req, res) => {
  const encodedUrl = req.query.url
  if (!encodedUrl) {
    return res.status(400).send('Missing url parameter')
  }

  let targetUrl
  try {
    targetUrl = Buffer.from(encodedUrl, 'base64url').toString('utf-8')
  } catch (e) {
    return res.status(400).send('Invalid URL encoding')
  }

  console.log(`[CAPTIONS] ${targetUrl.substring(0, 80)}...`)

  const parsedUrl = new URL(targetUrl)

  const options = {
    hostname: parsedUrl.hostname,
    port: 443,
    path: parsedUrl.pathname + parsedUrl.search,
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/vtt, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://www.youtube.com/',
      'Origin': 'https://www.youtube.com',
    },
  }

  const proxyReq = https.request(options, (proxyRes) => {
    console.log(`[CAPTIONS] Status: ${proxyRes.statusCode}, Content-Type: ${proxyRes.headers['content-type']}`)

    res.set({
      'Content-Type': proxyRes.headers['content-type'] || 'text/vtt; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    })
    res.status(proxyRes.statusCode)
    proxyRes.pipe(res)
  })

  proxyReq.on('error', (e) => {
    console.error('[CAPTIONS ERROR]', e.message)
    res.status(502).send('Caption fetch failed')
  })

  proxyReq.end()
})

// DASH Manifest proxy
router.get('/manifest', (req, res) => {
  const encodedUrl = req.query.url
  if (!encodedUrl) {
    return res.status(400).send('Missing url parameter')
  }

  const targetUrl = Buffer.from(encodedUrl, 'base64url').toString('utf-8')
  console.log(`[MANIFEST] ${targetUrl.substring(0, 80)}...`)

  https.get(targetUrl, (proxyRes) => {
    let data = ''
    proxyRes.on('data', chunk => { data += chunk })
    proxyRes.on('end', () => {
      // Replace BaseURL with proxy URL
      const modifiedData = data.replace(
        /<BaseURL>([^<]+)<\/BaseURL>/g,
        (match, url) => {
          const encoded = Buffer.from(url).toString('base64url')
          return `<BaseURL>/videoplayback?url=${encoded}</BaseURL>`
        }
      )

      res.set({
        'Content-Type': 'application/dash+xml',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
      })
      res.status(proxyRes.statusCode)
      res.send(modifiedData)
    })
  }).on('error', (e) => {
    console.error('[MANIFEST ERROR]', e.message)
    res.status(502).send('Manifest fetch failed')
  })
})

// HLS playlist/segment proxy
router.get('/hlsproxy', (req, res) => {
  const encodedUrl = req.query.url
  if (!encodedUrl) return res.status(400).send('Missing url parameter')

  let targetUrl
  try {
    targetUrl = Buffer.from(encodedUrl, 'base64url').toString('utf-8')
  } catch {
    return res.status(400).send('Invalid URL')
  }

  const parsedUrl = new URL(targetUrl)
  const isPlaylist = targetUrl.includes('/manifest/') || targetUrl.endsWith('.m3u8')

  const options = {
    hostname: parsedUrl.hostname,
    port: 443,
    path: parsedUrl.pathname + parsedUrl.search,
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      'Accept': '*/*',
      'Connection': 'keep-alive',
    },
  }

  const cookie = getYouTubeCookie()
  if (cookie) options.headers['Cookie'] = cookie

  const proxyReq = https.request(options, (proxyRes) => {
    if (proxyRes.statusCode === 302 || proxyRes.statusCode === 301) {
      const redirect = proxyRes.headers.location
      if (redirect) {
        const enc = Buffer.from(redirect).toString('base64url')
        return res.redirect(`/hlsproxy?url=${enc}`)
      }
    }

    if (isPlaylist) {
      let data = ''
      proxyRes.on('data', chunk => { data += chunk })
      proxyRes.on('end', () => {
        const rewritten = data.replace(/https?:\/\/[^\s"]+/g, (url) => {
          const enc = Buffer.from(url).toString('base64url')
          return `/hlsproxy?url=${enc}`
        })
        res.set({
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Cache-Control': 'no-cache',
          'Access-Control-Allow-Origin': '*',
        })
        res.send(rewritten)
      })
    } else {
      res.set({
        'Content-Type': proxyRes.headers['content-type'] || 'video/mp2t',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=300',
      })
      if (proxyRes.headers['content-length']) {
        res.set('Content-Length', proxyRes.headers['content-length'])
      }
      res.writeHead(proxyRes.statusCode)
      proxyRes.pipe(res)
    }
  })

  proxyReq.on('error', (e) => {
    console.error('[HLS-PROXY]', e.message)
    if (!res.headersSent) res.status(502).send('HLS proxy error')
  })

  proxyReq.setTimeout(30000, () => {
    proxyReq.destroy()
    if (!res.headersSent) res.status(504).send('HLS proxy timeout')
  })

  proxyReq.end()
})

// CORS preflight for video playback
router.options('/videoplayback', (req, res) => {
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Range, Content-Type',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
    'Access-Control-Max-Age': '86400',
  })
  res.status(204).end()
})

// Video stream proxy - also handle HEAD requests for content length
router.get('/videoplayback', handleVideoPlayback)
router.head('/videoplayback', handleVideoPlayback)

function handleVideoPlayback(req, res) {
  const encodedUrl = req.query.url
  if (!encodedUrl) {
    return res.status(400).json({ error: 'Missing url parameter' })
  }

  let targetUrl
  try {
    targetUrl = Buffer.from(encodedUrl, 'base64url').toString('utf-8')
  } catch (e) {
    console.error('[PROXY] Failed to decode URL:', e.message)
    return res.status(400).json({ error: 'Invalid URL encoding' })
  }

  console.log(`[PROXY] ${req.method}: ${targetUrl.substring(0, 80)}...`)

  let parsedUrl
  try {
    parsedUrl = new URL(targetUrl)
  } catch (e) {
    console.error('[PROXY] Invalid URL:', e.message)
    return res.status(400).json({ error: 'Invalid URL' })
  }

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Accept-Encoding': 'identity',
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Connection': 'keep-alive',
  }

  // Add cookie if available
  const cookie = getYouTubeCookie()
  if (cookie) {
    headers['Cookie'] = cookie
  }

  const options = {
    hostname: parsedUrl.hostname,
    port: 443,
    path: parsedUrl.pathname + parsedUrl.search,
    method: req.method,
    headers,
  }

  // Forward Range header for seek support
  if (req.headers.range) {
    options.headers['Range'] = req.headers.range
    console.log(`[PROXY] Range: ${req.headers.range}`)
  }

  const proxyReq = https.request(options, (proxyRes) => {
    console.log(`[PROXY] Status: ${proxyRes.statusCode}`)

    // Handle redirects
    if (proxyRes.statusCode === 302 || proxyRes.statusCode === 301) {
      const redirectUrl = proxyRes.headers.location
      if (redirectUrl) {
        console.log(`[PROXY] Redirect to: ${redirectUrl.substring(0, 80)}...`)
        const encoded = Buffer.from(redirectUrl).toString('base64url')
        return res.redirect(`/videoplayback?url=${encoded}`)
      }
    }

    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Range',
      'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
      'Content-Type': proxyRes.headers['content-type'] || 'video/mp4',
      'Accept-Ranges': 'bytes',
    }

    if (proxyRes.headers['content-length']) {
      headers['Content-Length'] = proxyRes.headers['content-length']
    }
    if (proxyRes.headers['content-range']) {
      headers['Content-Range'] = proxyRes.headers['content-range']
    }

    res.writeHead(proxyRes.statusCode, headers)

    if (req.method === 'HEAD') {
      proxyRes.resume()
      res.end()
    } else {
      proxyRes.on('error', (e) => {
        console.error('[PROXY] Response stream error:', e.message)
        if (!res.writableEnded) res.end()
      })

      res.on('close', () => {
        proxyRes.destroy()
      })

      proxyRes.pipe(res)
    }
  })

  proxyReq.on('error', (e) => {
    console.error('[PROXY ERROR]', e.message)
    if (!res.headersSent) {
      res.status(502).json({ error: e.message })
    }
  })

  proxyReq.on('socket', (socket) => {
    socket.setTimeout(300000)
    socket.on('timeout', () => {
      console.error('[PROXY] Socket idle 300s, destroying')
      proxyReq.destroy()
    })
  })

  proxyReq.setTimeout(120000, () => {
    console.error('[PROXY TIMEOUT] 120s exceeded waiting for response')
    proxyReq.destroy()
    if (!res.headersSent) {
      res.status(504).json({ error: 'Timeout' })
    }
  })

  proxyReq.end()
}

export default router
