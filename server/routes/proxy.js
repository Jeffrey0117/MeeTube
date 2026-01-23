/**
 * Proxy Routes
 * Handle video streaming and image proxying
 */

import { Router } from 'express'
import https from 'https'

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

// Video stream proxy
router.get('/videoplayback', (req, res) => {
  const encodedUrl = req.query.url
  if (!encodedUrl) {
    return res.status(400).json({ error: 'Missing url parameter' })
  }

  const targetUrl = Buffer.from(encodedUrl, 'base64url').toString('utf-8')
  console.log(`[PROXY] Streaming: ${targetUrl.substring(0, 80)}...`)

  const parsedUrl = new URL(targetUrl)

  const options = {
    hostname: parsedUrl.hostname,
    port: 443,
    path: parsedUrl.pathname + parsedUrl.search,
    method: 'GET',
    headers: {
      'User-Agent': 'com.google.android.youtube/19.02.39 (Linux; U; Android 14) gzip',
      'Accept-Encoding': 'identity',
    },
  }

  // Forward Range header for seek support
  if (req.headers.range) {
    options.headers['Range'] = req.headers.range
    console.log(`[PROXY] Range: ${req.headers.range}`)
  }

  const proxyReq = https.request(options, (proxyRes) => {
    console.log(`[PROXY] Status: ${proxyRes.statusCode}`)

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
    proxyRes.pipe(res)
  })

  proxyReq.on('error', (e) => {
    console.error('[PROXY ERROR]', e.message)
    if (!res.headersSent) {
      res.status(502).json({ error: e.message })
    }
  })

  proxyReq.setTimeout(30000, () => {
    console.error('[PROXY TIMEOUT]')
    proxyReq.destroy()
  })

  proxyReq.end()
})

export default router
