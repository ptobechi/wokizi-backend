# Wokizi Backend API

Hyperlocal Artisan & Service Marketplace — NestJS + PostgreSQL/PostGIS + Redis + Socket.IO

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | NestJS 11 (TypeScript) |
| ORM | Prisma 5 |
| Database | PostgreSQL 16 + PostGIS 3.4 |
| Cache / Pub-Sub | Redis 7 |
| Real-time | Socket.IO (chat gateway) |
| File Storage | AWS S3 / MinIO |
| Auth | JWT (access + refresh tokens) |
| API Docs | Swagger / OpenAPI |

---

## Quick Start (Docker)

```bash
# 1. Enter backend directory
cd backend

# 2. Copy environment file
cp .env.example .env
# Edit .env with your values

# 3. Start all services (Postgres, Redis, MinIO)
docker compose up -d postgres redis minio

# 4. Run migrations
npm run prisma:migrate

# 5. Seed demo data
npm run prisma:seed

# 6. Start API
npm run start:dev

# API:    http://localhost:3000/api/v1
# Docs:   http://localhost:3000/api/v1/docs
```

---

## Manual Setup (without Docker)

### Prerequisites
- Node.js 20+
- PostgreSQL 16 with PostGIS extension
- Redis 7

### PostGIS one-time setup

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
```

### Steps

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run start:dev
```

---

## Environment Variables

See [.env.example](.env.example) for all required variables.

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | JWT signing secret (access tokens) |
| `JWT_REFRESH_SECRET` | JWT signing secret (refresh tokens) |
| `REDIS_HOST` | Redis host |
| `AWS_S3_BUCKET` | S3 bucket name |
| `AWS_S3_ENDPOINT` | Set to MinIO URL for local dev |
| `FIREBASE_PROJECT_ID` | Firebase project for push notifications |

---

## API Modules

| Module | Prefix | Description |
|---|---|---|
| Auth | `/api/v1/auth` | Register, login, OTP, refresh, logout |
| Users | `/api/v1/users` | Public profiles, account management |
| Social | `/api/v1/social` | Follow/unfollow, followers, following |
| Profiles | `/api/v1/profiles` | Update profile, location, stats |
| Verification | `/api/v1/verification` | Provider identity verification |
| Categories | `/api/v1/categories` | Service category hierarchy |
| Services | `/api/v1/services` | CRUD, publish, like, save |
| Portfolio | `/api/v1/portfolio` | Provider portfolio & before/after media |
| Feed | `/api/v1/feed` | Ranked hyperlocal service feed |
| Location | `/api/v1/location` | Nearby providers, location update |
| Search | `/api/v1/search` | Full-text service & provider search |
| Chat | `/api/v1/chat` | Conversations, messages |
| Quotations | `/api/v1/quotations` | Create, revise, accept/reject |
| Bookings | `/api/v1/bookings` | Create, status transitions, availability |
| Reviews | `/api/v1/reviews` | Submit and read reviews |
| Disputes | `/api/v1/disputes` | Raise and resolve booking disputes |
| Notifications | `/api/v1/notifications` | In-app notifications, preferences |
| Uploads | `/api/v1/uploads` | Pre-signed S3 upload URLs |
| Analytics | `/api/v1/analytics` | Provider earnings & engagement stats |
| Admin | `/api/v1/admin` | User/service moderation, dashboard |

---

## WebSocket Gateway

**Namespace:** `ws://host/chat`

Authenticate by passing JWT in the `auth.token` field of the Socket.IO handshake.

### Client → Server events

| Event | Payload | Description |
|---|---|---|
| `join:conversation` | `{ conversationId }` | Join a conversation room |
| `leave:conversation` | `{ conversationId }` | Leave a conversation room |
| `message:send` | `{ conversationId, message }` | Send a message |
| `message:delivered` | `{ messageId }` | Confirm delivery |
| `typing:start` | `{ conversationId }` | Start typing indicator |
| `typing:stop` | `{ conversationId }` | Stop typing indicator |
| `user:status` | `{ userId }` | Check if user is online |

### Server → Client events

| Event | Description |
|---|---|
| `message:new` | New message in a conversation |
| `message:delivered` | Delivery confirmation |
| `typing:start` / `typing:stop` | Typing indicators |
| `user:online` / `user:offline` | Presence updates |

---

## Core Workflow

```
Register → Email OTP → Browse feed / search

Find artisan → Start conversation → Upload damage media
  → Artisan reviews → asks questions

Provider creates Quotation (inside conversation)
  → Customer accepts / negotiates

Quotation ACCEPTED → Customer creates Booking
  → PENDING → ACCEPTED → SCHEDULED → IN_PROGRESS → COMPLETED

Booking COMPLETED → Review submitted → Provider metrics updated
```

---

## Feed Ranking Algorithm

| Factor | Weight |
|---|---|
| Distance | 30% |
| Rating | 20% |
| Completion rate | 15% |
| Response rate | 10% |
| Trending score | 10% |
| Engagement score | 8% |
| Verification status | 5% |
| Recency | 2% |

---

## Demo Accounts (after seeding)

| Role | Email | Password |
|---|---|---|
| Super Admin | admin@wokizi.com | Admin@123456 |
| Provider | demo.provider@wokizi.com | Provider@123456 |
| Customer | demo.customer@wokizi.com | Customer@123456 |

---

## Scripts

```bash
npm run start:dev        # Start with hot-reload
npm run build            # Production build
npm run start:prod       # Start production server
npm run prisma:generate  # Regenerate Prisma client
npm run prisma:migrate   # Run pending migrations
npm run prisma:seed      # Seed demo data
npm run prisma:studio    # Open Prisma Studio GUI
npm run test             # Run unit tests
```
# wokizi-backend
