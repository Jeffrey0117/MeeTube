# MeeTube

Private YouTube client with search, video streaming, captions, and favorites.

## Stack

- Express.js (backend) + Vue.js 3 (frontend)
- JavaScript (ESM)
- SQLite3 (better-sqlite3)
- youtubei.js (YouTube API client)
- shaka-player (DASH video player)
- Port: 4008

## Run

```bash
npm run dev           # dev (client :5173 + server :3001)
npm run dev:client    # frontend only
npm run dev:server    # backend only
npm run build         # build Vue client
npm start             # production (NODE_ENV=production)
npm test              # run tests
```

## Key Files

```
server/
  index.js                — Express server entry
  routes/api.js           — YouTube API (search, videos, channels, trending, captions)
  routes/auth.js          — User auth (register, login, logout)
  routes/favorites.js     — Favorites CRUD
  routes/proxy.js         — Thumbnail + video stream proxy
  services/youtube.js     — Innertube client initialization
  services/database.js    — SQLite operations + user management

client/
  src/main.js             — Vue app entry
  src/views/              — Page components
  src/components/         — Reusable UI
  src/store/              — Vuex state
  src/composables/        — Vue 3 composables
  src/i18n/               — Internationalization
```

## API

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/search` | Search YouTube (?q, ?continuation) |
| GET | `/api/v1/search/suggestions` | Search autocomplete |
| GET | `/api/v1/trending` | Trending videos |
| GET | `/api/v1/videos/:id` | Video details (streams, captions, related) |
| GET | `/api/v1/channels/:id` | Channel info + videos |
| GET | `/api/v1/captions/:videoId/list` | List caption tracks |
| POST | `/api/v1/translate` | Translate text |
| POST | `/api/v1/translate/batch` | Batch translate |
| GET | `/api/favorites` | List favorites |
| POST | `/api/favorites` | Add favorite |
| DELETE | `/api/favorites/:videoId` | Remove favorite |
| GET | `/api/v1/stats` | Server stats |
| GET | `/api/health` | Health check |

## Env

- `PORT` (default: 3001)
- `SESSION_SECRET` — session encryption (change in production)
- `DATABASE_PATH` — SQLite path (default: ./data/meetube.db)
- `YOUTUBE_COOKIE` — optional YouTube auth cookies

## CloudPipe

- Manifest: `data/manifests/meetube.json` (12 tools)
- Auth: none
- Entry: `server/index.js`

## Notes

- Search returns `{ results: [...] }` not top-level array
- Video thumbnails proxied via `/vi/:videoId/:filename`
