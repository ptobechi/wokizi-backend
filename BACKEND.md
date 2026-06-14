# BACKEND.md

# Wokizi Backend Architecture

This document defines the backend architecture, coding standards, module responsibilities, service patterns, and infrastructure conventions for the Wokizi API.

All backend development must follow these standards.

---

# Technology Stack

| Layer          | Technology     |
| -------------- | -------------- |
| Framework      | NestJS 11      |
| Language       | TypeScript     |
| ORM            | Prisma 5       |
| Database       | PostgreSQL 16  |
| Geospatial     | PostGIS 3.4    |
| Cache          | Redis 7        |
| Realtime       | Socket.IO      |
| Storage        | AWS S3 / MinIO |
| Authentication | Custom JWT     |
| SMS            | Termii         |

---

# Backend Folder Structure

```text
backend/src/

├── common/
├── config/
├── core/
├── integrations/
└── modules/
```

---

# Common Layer

Contains reusable framework-level utilities.

```text
common/
├── decorators/
├── dto/
├── enums/
├── exceptions/
├── filters/
├── guards/
├── interceptors/
├── pipes/
├── constants/
└── utils/
```

Never place feature-specific logic here.

---

# Config Layer

All environment-backed configuration.

```text
config/
├── app.config.ts
├── auth.config.ts
├── database.config.ts
├── redis.config.ts
├── storage.config.ts
├── sms.config.ts
└── notification.config.ts
```

No hardcoded values.

Everything configurable via environment variables.

---

# Core Layer

Infrastructure services shared across the application.

```text
core/
├── prisma/
├── cache/
├── websocket/
├── logger/
├── events/
├── security/
└── storage/
```

Core should never depend on feature modules.

Feature modules depend on core.

---

# Integrations Layer

Third-party services.

```text
integrations/

├── aws/
├── sms/
├── firebase/
├── resend/
└── payments/
```

External providers should always be wrapped.

Never use third-party SDKs directly inside feature services.

---

# Feature Modules

Business functionality lives inside modules.

```text
modules/

├── auth/
├── users/
├── profiles/
├── verification/
├── categories/
├── services/
├── portfolios/
├── feed/
├── locations/
├── conversations/
├── messages/
├── quotations/
├── bookings/
├── reviews/
├── disputes/
├── notifications/
├── uploads/
├── search/
├── analytics/
├── follows/
├── likes/
├── saved-services/
├── reports/
├── admin/
└── health/
```

---

# Module Structure Standard

Every module should follow:

```text
module-name/

├── dto/
├── entities/
├── repositories/
├── services/
├── controllers/
├── gateways/
├── events/
├── types/
├── constants/
└── module-name.module.ts
```

Use only required folders.

Do not create empty folders.

---

# Controller Rules

Controllers should:

* Receive requests
* Validate requests
* Authorize requests
* Delegate to services

Controllers should NOT:

* Contain business logic
* Query Prisma directly
* Handle transactions
* Perform calculations

Example:

```ts
@Controller('services')
export class ServicesController {
  constructor(
    private readonly servicesService: ServicesService,
  ) {}

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateServiceDto,
  ) {
    return this.servicesService.create(user.id, dto);
  }
}
```

---

# Service Rules

Services contain business logic.

Services may:

* Validate business rules
* Call repositories
* Publish events
* Handle transactions
* Coordinate workflows

All business logic belongs here.

---

# Repository Rules

Repositories handle data access.

Example:

```ts
service.repository.ts
conversation.repository.ts
booking.repository.ts
```

Repositories should:

* Encapsulate Prisma queries
* Return typed results
* Be reusable

Avoid Prisma calls scattered across services.

---

# Prisma Access

Only repositories should access:

```ts
PrismaService
```

directly.

Avoid:

```ts
constructor(
  private prisma: PrismaService
)
```

inside many services.

Prefer:

```ts
ServicesRepository
BookingsRepository
UsersRepository
```

---

# Event-Driven Architecture

Use domain events for cross-module communication.

Example:

```text
QuotationAccepted
BookingCreated
BookingCompleted
ConversationArchived
ReviewCreated
```

Avoid direct coupling.

---

# Event Examples

```text
ServiceApprovedEvent

→ Notification

→ Feed Refresh

→ Analytics
```

```text
BookingCompletedEvent

→ Archive Conversation

→ Review Reminder

→ Analytics Update
```

---

# Transaction Rules

Use Prisma transactions for:

* Booking creation
* Quote acceptance
* Payment processing
* Service approval
* Verification approval

Example:

```ts
await prisma.$transaction(async (tx) => {
  ...
});
```

---

# WebSocket Architecture

Socket.IO powers realtime functionality.

---

# Gateway Responsibilities

Gateways should:

* Authenticate sockets
* Join rooms
* Broadcast events

Gateways should NOT:

* Contain business logic
* Query Prisma

---

# Socket Events

Supported events:

```text
message.created

message.read

conversation.updated

quotation.created

quotation.updated

quotation.accepted

booking.created

booking.updated

notification.created
```

---

# Room Strategy

Conversation Room:

```text
conversation:{id}
```

User Room:

```text
user:{id}
```

Never broadcast globally.

---

# Notifications

All notifications should pass through:

```text
notifications module
```

Do not send notifications directly from unrelated modules.

---

# Upload Architecture

Uploads use:

```text
Presigned URL Flow
```

Workflow:

```text
Client Requests Upload URL
↓
Backend Generates Presigned URL
↓
Client Uploads To S3
↓
Backend Stores Metadata
```

Avoid proxy uploads through NestJS.

---

# Feed Module Responsibilities

Feed module handles:

* Nearby discovery
* Ranking
* Recommendations
* Trending services

Feed should never contain booking logic.

---

# Search Module Responsibilities

Search handles:

* Full text search
* Category filtering
* Radius filtering
* Provider lookup

Search does not manage feed ranking.

---

# Conversation Architecture

Conversation creation happens only through:

```text
Request Service
```

Never create standalone conversations.

---

# Quotation Architecture

Only providers can create quotations.

Customers:

```text
Accept
Reject
Request Changes
```

Providers:

```text
Edit
Revise
Resubmit
```

---

# Booking Architecture

Booking creation requires:

```text
Accepted Quote
+
Selected Schedule
+
Successful Payment
```

Never bypass this workflow.

---

# Review Architecture

Reviews can only be created after:

```text
Booking Status = COMPLETED
```

---

# Dispute Architecture

Disputes require:

```text
Existing Booking
```

Disputes cannot exist independently.

---

# Security Rules

Every protected route must use:

```ts
JwtAuthGuard
```

Role-protected routes must also use:

```ts
RolesGuard
```

---

# RBAC

Roles:

```text
USER

ADMIN

SUPER_ADMIN
```

No additional roles without approval.

---

# Validation Rules

All requests must use DTO validation.

Use:

```ts
class-validator
class-transformer
```

Never accept raw request bodies.

---

# Error Handling

Use domain-specific exceptions.

Examples:

```ts
throw new NotFoundException();

throw new ConflictException();

throw new BadRequestException();
```

Avoid generic errors.

---

# Logging

Use centralized logger.

Never use:

```ts
console.log()
```

outside development debugging.

---

# API Versioning

Current:

```text
/api/v1
```

Future versions must not break existing clients.

---

# Forbidden Backend Changes

Never introduce:

* MongoDB
* Firebase Auth
* Clerk
* GraphQL
* Microservices
* Multiple User Tables
* Multiple Auth Systems

without explicit approval.

---

# Session Checklist

Before modifying backend code:

1. Read CLAUDE.md
2. Read BACKEND.md
3. Read DATABASE.md
4. Read API_CONTRACT.md
5. Read HANDOFF.md
6. Read PROGRESS.md

Then review the affected module before implementing changes.

---

# Backend Source Of Truth

Priority:

```text
Database Schema
↓
API Contracts
↓
Current Implementation
↓
Documentation
```

The repository always wins over documentation when conflicts occur.
