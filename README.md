# Sync-Right

A real-time collaboration platform built on the MERN stack. Rooms support live chat (end-to-end encrypted), video calls over WebRTC, a shared whiteboard with AI-assisted diagram generation, and AI-generated session summaries with downloadable PDF reports.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Local Container Setup (MongoDB + Redis)](#local-container-setup-mongodb--redis)
- [Environment Variables](#environment-variables)
- [Installation](#installation)
- [Running the App](#running-the-app)
- [Core Flows](#core-flows)
- [Security Notes](#security-notes)
- [Known Limitations](#known-limitations)

---

## Features

**Auth**

- Email/password registration and login
- Google OAuth 2.0 login
- Access token (short-lived JWT) + refresh token (Redis-backed, rotated on every refresh)
- Optional TOTP-based 2FA (setup via QR code, enforced at login)
- CSRF protection on OAuth flows (double-submit cookie pattern)

**Rooms**

- Create public or password-protected private rooms
- Join/leave with host and participant roles
- Room capacity limits, live participant list

**Chat**

- Real-time messaging over Socket.io
- End-to-end encryption using ECDH (P-256) + HKDF + AES-GCM, entirely client-side
- Client-side content moderation (TensorFlow.js toxicity model) before a message is ever encrypted or sent
- Typing indicators, paginated message history

**Video Calls**

- WebRTC mesh calls, capped at 8 participants per room
- STUN/TURN config served from the backend
- Mute/camera toggle synced across peers

**Whiteboard**

- Shared drawing surface (pen, shapes, text, eraser) restricted to the host
- Redis-backed live state with MongoDB fallback snapshot for cold starts
- AI diagram generation: host types a prompt, an LLM (via Groq) returns strokes rendered directly on the board
- Host can pin the whiteboard for all participants, similar to a screen share

**Sessions**

- Each room join/leave is tracked as a session with start/end time and duration
- Host can generate an AI summary + action items from the (already-decrypted) chat transcript
- Downloadable PDF session report

**Admin**

- User list, activate/deactivate, delete
- Audit log of sensitive actions (logins, role changes, room deletions, etc.)

---

## Tech Stack

**Backend**

- Node.js, Express 5
- MongoDB with Mongoose
- Redis (ioredis) for refresh tokens, rate limiting, whiteboard state caching
- Socket.io for all real-time events
- JWT for access/refresh tokens, bcrypt for password hashing
- Groq SDK for AI summaries and whiteboard generation
- Cloudinary for avatar storage
- Multer (memory storage) for avatar uploads
- pdfkit for PDF report generation
- otplib + qrcode for 2FA
- helmet, csrf-csrf, express-rate-limit for security

**Frontend**

- React 19 with Vite
- Tailwind CSS 4
- React Router 7
- axios with interceptors for token refresh
- socket.io-client
- TensorFlow.js + toxicity model for client-side moderation
- Native Web Crypto API for E2E encryption

---

## Project Structure

```
Sync-Right/
├─ client/                  # React frontend (Vite)
│  ├─ src/
│  │  ├─ components/        # auth, chat, whiteboard UI pieces
│  │  ├─ hooks/              # useChat, useE2E, useWebRTC, useWhiteboard
│  │  ├─ pages/              # route-level views
│  │  ├─ routes/             # route definitions
│  │  └─ utils/              # api client, socket client, crypto, moderation
├─ server/                  # Express + Socket.io backend
│  ├─ config/                # db, redis, cloudinary, env, rate limiter
│  ├─ controllers/
│  ├─ middleware/
│  ├─ models/
│  ├─ routes/
│  ├─ sockets/                # Socket.io event handlers
│  └─ utils/
├─ docker-compose for containers/
│  ├─ for mongodb/docker-compose.yml
│  └─ for redis/docker-compose.yml
└─ README.md
```

---

## Prerequisites

- Node.js 18+ and npm
- Docker + Docker Compose (for local MongoDB and Redis containers)
- A Google Cloud OAuth client (for Google login)
- A Cloudinary account (for avatar uploads)
- A Groq API key (for AI summaries and whiteboard generation)

---

## Local Container Setup (MongoDB + Redis)

Both databases run as Docker containers using the compose files already included in the project. You don't need MongoDB or Redis installed locally, Docker handles both.

### 1. MongoDB

Path: `docker-compose for containers/for mongodb/docker-compose.yml`

This spins up a single `mongo:7.0` container with a root user, persistent volumes, and a healthcheck.

Before starting it, create a `.env` file in that same folder (or export the variables in your shell) with:

```env
MONGO_ROOT_USERNAME=your_root_username
MONGO_ROOT_PASSWORD=your_root_password
MONGO_DATABASE=syncright
```

Then start it:

```bash
cd "docker-compose for containers/for mongodb"
docker compose up -d
```

MongoDB will be reachable at `mongodb://<username>:<password>@localhost:27017`. Use this to build your `MONGO_URI` in the server's `.env` (see [Environment Variables](#environment-variables)).

Check container health:

```bash
docker compose ps
docker exec -it mongo mongosh --eval "db.adminCommand('ping')"
```

### 2. Redis

Path: `docker-compose for containers/for redis/docker-compose.yml`

This spins up `redis:7-alpine` with ACL-based auth (a dedicated user instead of the default user) plus a **RedisInsight** container for GUI inspection.

Before starting, edit the compose file (or override via `.env`) and replace the placeholders:

- `YOUR_CONTAINER_NAME` → any name you want for the container
- `{REDIS_DB_NAME}` → the ACL username the app will connect with
- `{REDIS_PASSWORD}` → a strong password for that user

These same values must match `REDIS_USERNAME` and `REDIS_PASSWORD` in the server's `.env` file.

Start both containers:

```bash
cd "docker-compose for containers/for redis"
docker compose up -d
```

- Redis: `localhost:6379`
- RedisInsight (GUI): `http://localhost:5540`

Verify Redis is accepting connections with the ACL user you configured:

```bash
docker exec -it <redis-container-name> redis-cli --user <REDIS_DB_NAME> -a <REDIS_PASSWORD> ping
```

Should return `PONG`.

### Notes

- Both compose files use named volumes (`mongo_data`, `mongo_config`, `redis_data`, `redisinsight_data`), data persists across container restarts.
- The Mongo container has `restart: no`, meaning it won't auto-restart on a host reboot, start it manually if needed.
- The Redis container has `restart: unless-stopped`, so it will come back up automatically.
- Both containers are on the same `backend` bridge network, so if you ever containerize the server itself, it can reach them by service name (`mongo`, `redis`) instead of `localhost`.

---

## Environment Variables

Create a `.env` file inside `server/` (an `.env.example` is already provided as a template). At minimum you'll need:

```env
# Server
PORT=8000
NODE_ENV=development
CLIENT_URL=http://localhost:5173

# MongoDB
MONGO_URI=mongodb://your_root_username:your_root_password@localhost:27017/syncright?authSource=admin

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_USERNAME=your_redis_acl_user
REDIS_PASSWORD=your_redis_password
REDIS_TLS=false

# JWT
JWT_ACCESS_SECRET=some_long_random_string
JWT_REFRESH_SECRET=another_long_random_string
JWT_ACCESS_EXPIRY=15m

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:8000/auth/google/callback

# Cloudinary
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Groq (AI summaries + whiteboard AI)
GROQ_API_KEY=

# TURN (optional, only needed for calls across restrictive NATs)
TURN_USERNAME=
TURN_CREDENTIAL=
```

The client only needs one variable, set in `client/.env` if your backend isn't on `localhost:8000`:

```env
VITE_API_URL=http://localhost:8000
```

---

## Installation

```bash
# clone the repo, then from the root:

# backend
cd server
npm install

# frontend
cd ../client
npm install
```

---

## Running the App

1. Start MongoDB and Redis containers (see [Local Container Setup](#local-container-setup-mongodb--redis)).
2. Start the backend:
   ```bash
   cd server
   npm run dev
   ```
   Runs on `http://localhost:8000` by default.
3. Start the frontend:
   ```bash
   cd client
   npm run dev
   ```
   Runs on `http://localhost:5173` by default.
4. Open the frontend URL, register an account, and create or join a room.

---

## Core Flows

**Login**
`POST /auth/login` → if 2FA is off, returns access token immediately and sets refresh token cookie. If 2FA is on, returns a short-lived `mfaToken` and expects `POST /auth/2fa/verify` with the OTP before issuing real tokens.

**Token refresh**
Axios interceptor in `client/src/utils/api.js` catches 401s, calls `POST /auth/refresh` using the httpOnly refresh cookie, and retries the original request with the new access token.

**Joining a room**
`POST /rooms/join/:roomId` (REST) must be called before the client connects to the room's Socket.io channel. The socket-side `room:join` event only handles channel membership and history sync, actual room membership changes happen through REST so join/leave system messages fire exactly once.

**Chat encryption**
Each client generates an ECDH key pair on session start, exchanges public keys with peers over the socket (`e2e:public-key` / `e2e:peer-key`), and derives a shared AES-GCM key per peer. Messages are encrypted client-side before being sent, the server only ever relays ciphertext and never touches plaintext. Moderation runs on the plaintext right before encryption, on the client.

**Whiteboard state**
Strokes are cached in Redis (`boardCache.js`) keyed by room, with a 4-hour TTL, so the server doesn't hit MongoDB on every stroke. A snapshot is retained in `Room.boardSnapshot` as a cold-start fallback if Redis has nothing cached.

---

## Security Notes

- Refresh tokens are never stored raw, only their SHA-256 hash lives in Redis.
- Room passwords are bcrypt-hashed, never returned in API responses.
- CSP is enforced via helmet with no inline scripts allowed.
- CSRF protection guards the OAuth flow specifically (double-submit cookie).
- Rate limiting is applied per-IP via Redis, stricter on auth routes than general API routes.

---

## Known Limitations

- Live captioning was attempted in an earlier phase and removed, it never worked reliably and isn't part of this build.
- WebRTC calls use a full mesh topology, capped at 8 participants for browser connection limits, not suited for large rooms. An SFU would be needed beyond that.
- Whiteboard drawing is host-only, participants can only view.
