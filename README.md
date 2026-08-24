# Wokizi Backend API

Hyperlocal Artisan & Service Marketplace — NestJS 11 + PostgreSQL/PostGIS + Socket.IO

Deployed at: `https://wokizi-045ca9212da0.herokuapp.com/api/v1`

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | NestJS | `^11.0.1` |
| Language | TypeScript | `^5.7.3` |
| ORM | Prisma | `^5.17.0` |
| Database | PostgreSQL 16 + PostGIS | — |
| Real-time | Socket.IO | `^4.7.5` |
| File Storage | Cloudflare R2 (S3-compatible) | AWS SDK `^3.600.0` |
| Push Notifications | Firebase Admin (FCM) | `^12.3.0` |
| SMS | Termii | — |
| Auth | Custom JWT (access + refresh) | `@nestjs/jwt ^11.0.2` |
| API Docs | Swagger / OpenAPI | `@nestjs/swagger ^11.4.4` |
| Runtime | Node.js | `22.x` |

---

## Local Development (Docker)

```bash
cd backend

# 1. Copy and configure environment
cp .env.example .env

# 2. Start Postgres (PostGIS) and MinIO
docker compose up -d

# 3. Install dependencies
npm install

# 4. Run migrations
npm run prisma:migrate

# 5. Seed categories and test data
npm run prisma:seed

# 6. Start with hot-reload
npm run start:dev
```

- API: `http://localhost:3000/api/v1`
- Swagger: `http://localhost:3000/api/v1/docs`
- Prisma Studio: `npm run prisma:studio`
- MinIO Console: `http://localhost:9001` (minioadmin / minioadmin123)

---

## Local Development (Without Docker)

### Prerequisites

- Node.js 22.x
- PostgreSQL 16 with PostGIS extension

### PostGIS setup (one-time)

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
```

### Start

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run start:dev
```

---

## Environment Variables

Copy `.env.example` to `.env` and set all values.

| Variable | Description |
|---|---|
| `NODE_ENV` | `development` \| `staging` \| `production` |
| `PORT` | Server port (default: `3000`) |
| `API_PREFIX` | URL prefix (default: `api/v1`) |
| `FRONTEND_URL` | Mobile app origin for CORS |
| `ADMIN_URL` | Admin dashboard origin for CORS |
| `DATABASE_URL` | PostgreSQL connection string (must include PostGIS extensions) |
| `JWT_ACCESS_SECRET` | Access token signing secret (min 32 chars) |
| `JWT_ACCESS_EXPIRES_IN` | Access token TTL (default: `15m`) |
| `JWT_REFRESH_SECRET` | Refresh token signing secret (min 32 chars) |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token TTL (default: `30d`) |
| `AWS_ACCESS_KEY_ID` | Cloudflare R2 access key |
| `AWS_SECRET_ACCESS_KEY` | Cloudflare R2 secret key |
| `AWS_REGION` | R2 region (`auto`) |
| `AWS_S3_BUCKET` | R2 bucket name |
| `AWS_S3_ENDPOINT` | R2 endpoint URL (private S3 API — used for uploads only) |
| `STORAGE_PUBLIC_URL` | Public base URL for serving uploaded files (e.g. `https://pub-xxx.r2.dev` or a custom CDN domain). Must be set in production — see R2 bucket public access settings. |
| `FIREBASE_PROJECT_ID` | Firebase project ID |
| `FIREBASE_PRIVATE_KEY` | Firebase service account private key |
| `FIREBASE_CLIENT_EMAIL` | Firebase service account email |
| `TERMII_API_KEY` | Termii API key for SMS OTP |
| `TERMII_SENDER_ID` | Termii sender ID |
| `THROTTLE_TTL` | Rate limit window ms (default: `60000`) |
| `THROTTLE_LIMIT` | Max requests per window (default: `100`) |
| `OTP_EXPIRES_MINUTES` | OTP validity in minutes (default: `10`) |
| `OTP_MAX_ATTEMPTS` | Max OTP verification attempts (default: `5`) |
| `RESEND_API_KEY` | Resend transactional email API key (optional) |
| `PAYSTACK_SECRET_KEY` | Paystack secret key — **required in production**; payments/withdrawals no-op only while `NODE_ENV != production` |
| `PAYSTACK_PUBLIC_KEY` | Paystack public key |
| `PAYSTACK_WEBHOOK_SECRET` | Paystack webhook signature secret |
| `WS_ALLOWED_ORIGINS` | Comma-separated CORS origins for Socket.IO. Defaults to `*` — **must be restricted in production** |

---

## API Modules

| Module | Prefix | Description |
|---|---|---|
| Auth | `/api/v1/auth` | Phone registration, OTP verification, token refresh, logout |
| Users | `/api/v1/users` | Public profiles, account management |
| Social | `/api/v1/social` | Follow / unfollow, followers, following |
| Profiles | `/api/v1/profiles` | Update profile, location, provider stats |
| Verification | `/api/v1/verification` | KYC document submission and review |
| Categories | `/api/v1/categories` | Service category hierarchy |
| Services | `/api/v1/services` | CRUD, publish, pause, like, save |
| Portfolio | `/api/v1/portfolio` | Provider portfolio and before/after media |
| Feed | `/api/v1/feed` | Ranked hyperlocal service discovery feed |
| Location | `/api/v1/location` | Nearby providers, location update |
| Search | `/api/v1/search` | Full-text service and provider search |
| Chat | `/api/v1/chat` | Conversations and messages |
| Quotations | `/api/v1/quotations` | Create, revise, accept, reject |
| Bookings | `/api/v1/bookings` | Create, status transitions, availability |
| Reviews | `/api/v1/reviews` | Submit and read reviews |
| Disputes | `/api/v1/disputes` | Raise and resolve booking disputes |
| Notifications | `/api/v1/notifications` | In-app notifications and preferences |
| Uploads | `/api/v1/uploads` | Pre-signed Cloudflare R2 upload URLs |
| Analytics | `/api/v1/analytics` | Provider earnings and engagement stats |
| Payments | `/api/v1/payments` | Paystack integration, escrow, wallet |
| Admin | `/api/v1/admin` | User/service moderation, dashboard stats |

---

## WebSocket Gateway

**Namespace:** `ws://host/chat`

Authenticate by passing a valid JWT in the `auth.token` field of the Socket.IO handshake.

### Client → Server

| Event | Payload | Description |
|---|---|---|
| `join:conversation` | `{ conversationId }` | Join a conversation room |
| `leave:conversation` | `{ conversationId }` | Leave a conversation room |
| `message:send` | `{ conversationId, message }` | Send a message |
| `message:delivered` | `{ messageId }` | Confirm delivery |
| `typing:start` | `{ conversationId }` | Start typing indicator |
| `typing:stop` | `{ conversationId }` | Stop typing indicator |
| `user:status` | `{ userId }` | Check online status |

### Server → Client

| Event | Description |
|---|---|
| `message:new` | New message in a conversation |
| `message:delivered` | Delivery confirmation |
| `typing:start` / `typing:stop` | Typing indicators |
| `user:online` / `user:offline` | Presence updates |

---

## Core Transaction Flow

```
Phone registration → OTP verification → Browse feed

Find artisan → Request service → Conversation created → Notify provider

Provider creates Quotation inside conversation
  → Customer accepts / requests changes / rejects

Quotation ACCEPTED → Schedule selected → Payment processed → Booking created
  → PENDING → CONFIRMED → SCHEDULED → IN_PROGRESS → COMPLETED

Booking COMPLETED → Review submitted → Provider metrics updated
  → Conversation archived (read-only)
```

---

## Authentication

Authentication is **phone number + OTP only**. There are no passwords.

Flow:
1. `POST /api/v1/auth/check-phone` — check if phone exists
2. `POST /api/v1/auth/register` — register with phone
3. `POST /api/v1/auth/send-otp` — send OTP via Termii SMS
4. `POST /api/v1/auth/verify-otp` — verify OTP, receive JWT pair
5. `POST /api/v1/auth/refresh` — refresh access token
6. `POST /api/v1/auth/logout` — revoke refresh token

In development with no `TERMII_API_KEY`, OTP is printed to the terminal console.

---

## Database Migrations

```bash
# Development — create and run a new migration
npm run prisma:migrate

# Production — run pending migrations only (used in postinstall)
npm run prisma:migrate:prod

# Inspect the database
npm run prisma:studio

# Reset and reseed (dev only — DESTROYS ALL DATA)
npm run db:reset
```

Migration policy: **additive only**. Never drop columns or tables in production. Use soft deletes (`deletedAt`) for removal.

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

## Deployment (Heroku)

The `Procfile` runs:

```
web: node dist/main.js
```

The `postinstall` script builds and migrates on every deploy:

```
prisma generate → npm run build → prisma migrate deploy
```

All environment variables are configured in Heroku Config Vars. Never commit `.env` to git.

---

## Scripts

```bash
npm run start:dev          # Start with hot-reload
npm run build              # Production build
npm run start:prod         # Start production server
npm run prisma:generate    # Regenerate Prisma client
npm run prisma:migrate     # Create and run migration (dev)
npm run prisma:migrate:prod # Run pending migrations (prod)
npm run prisma:seed        # Seed categories and test data
npm run prisma:studio      # Open Prisma Studio GUI
npm run test               # Run unit tests
npm run test:integration   # Run integration tests
npm run test:e2e           # Run end-to-end tests
npm run test:coverage      # Unit tests with coverage report
npm run lint               # Lint and auto-fix
npm run db:up              # Start docker services
npm run db:down            # Stop docker services
npm run db:reset           # Destroy and reseed (dev only)
```
# wokizy
