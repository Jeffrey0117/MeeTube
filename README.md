# MeeTube

A private YouTube web client extracted from FreeTube.

## Features

- Video search and browsing
- Video playback with shaka-player (DASH support)
- Channel browsing
- Playlists management
- Favorites system
- Course tracking
- Music mode
- Subscriptions
- Watch history
- User authentication

## Quick Start

### Development

```bash
# Install dependencies
npm install
cd client && npm install && cd ..

# Start development servers
npm run dev

# Or start separately:
npm run dev:server  # API server on :3001
npm run dev:client  # Vue client on :5173
```

### Production

```bash
# Build client
npm run build

# Start production server
npm start
```

### Docker

```bash
# Build and run
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

## Configuration

Copy `.env.example` to `.env` and configure:

```env
PORT=3001
SESSION_SECRET=your-secret-key
YOUTUBE_COOKIE=  # Optional: For personalized content
```

## Architecture

```
meetube/
├── client/           # Vue.js SPA
│   ├── src/
│   │   ├── components/
│   │   ├── views/
│   │   ├── store/
│   │   └── router/
│   └── vite.config.js
├── server/           # Express.js API
│   ├── routes/
│   │   ├── api.js    # YouTube API
│   │   ├── proxy.js  # Media proxy
│   │   └── auth.js   # Authentication
│   └── services/
│       ├── youtube.js
│       └── database.js
└── docker-compose.yml
```

## API Endpoints

### YouTube API
- `GET /api/v1/search?q=...` - Search videos
- `GET /api/v1/videos/:id` - Get video info
- `GET /api/v1/channels/:id` - Get channel info
- `GET /api/v1/trending` - Trending videos

### Proxy
- `/vi/:videoId/:filename` - Video thumbnails
- `/ggpht/*` - Channel avatars
- `/videoplayback?url=...` - Video stream proxy

### Auth
- `POST /auth/register` - Create account
- `POST /auth/login` - Login
- `POST /auth/logout` - Logout
- `GET /auth/me` - Current user

## Credits

- Based on [FreeTube](https://github.com/FreeTubeApp/FreeTube)
- Uses [youtubei.js](https://github.com/LuanRT/YouTube.js) for YouTube API
- Uses [shaka-player](https://github.com/google/shaka-player) for video playback

## License

AGPL-3.0-or-later
