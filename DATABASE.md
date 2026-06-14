# DATABASE.md

# Wokizi Database Architecture

This document defines database standards, Prisma conventions, entity relationships, status lifecycles, and data ownership rules.

All schema changes must follow these standards.

---

# Database Stack

## Primary Database

```text
PostgreSQL 16
```

## ORM

```text
Prisma 5
```

## Geospatial Extension

```text
PostGIS 3.4
```

## Cache

```text
Redis 7
```

---

# Core Principles

## Single Source of Truth

PostgreSQL is the source of truth.

Redis is cache only.

Never store authoritative business data in Redis.

---

## UUID Primary Keys

Every model must use:

```prisma
id String @id @default(uuid())
```

Never use:

```text
Int
BigInt
Auto Increment
```

for primary keys.

---

# Standard Fields

Every model should include:

```prisma
id        String   @id @default(uuid())
createdAt DateTime @default(now())
updatedAt DateTime @updatedAt
```

---

# Soft Delete Standard

Models that support deletion should use:

```prisma
deletedAt DateTime?
```

Never hard-delete:

* Users
* Services
* Conversations
* Bookings

without explicit approval.

---

# User Model

## Important Rule

There is only ONE user model.

Never introduce:

```text
Provider
Customer
Artisan
Vendor
```

tables.

A provider is:

```text
User
+
Approved Service
```

---

# User Relationships

User owns:

```text
Profile
Services
Conversations
Messages
Quotations
Bookings
Reviews
Notifications
```

---

# Profile Model

Stores:

```text
Name
Avatar
Email
Bio
Location
Coordinates
Verification Status
```

Location belongs here.

Not on User.

---

# Location Architecture

Use:

```text
Geography(Point, 4326)
```

for geospatial queries.

Example:

```sql
ST_DWithin
ST_Distance
```

Never calculate distance manually.

---

# Service Model

Represents a public service offering.

Examples:

```text
Plumbing
Electrical Repair
Cleaning
Photography
Driving
```

---

# Service Ownership

```text
User
1
→
Many Services
```

---

# Service Status Lifecycle

```text
DRAFT
↓
PENDING_REVIEW
↓
APPROVED
↓
PUBLISHED
```

Alternative:

```text
REJECTED

SUSPENDED
```

---

# Visibility Rules

Public discovery requires:

```text
APPROVED
AND
Published
```

Hidden services:

```text
DRAFT
PENDING_REVIEW
REJECTED
SUSPENDED
```

must never appear in:

* Feed
* Search
* Nearby Results
* Recommendations

---

# Verification Model

Stores:

```text
Government ID
Selfie
Proof of Address
Review Notes
Verification Status
```

---

# Verification Lifecycle

```text
PENDING
↓
UNDER_REVIEW
↓
APPROVED
```

Alternative:

```text
REJECTED
```

---

# Category Model

Hierarchical structure:

```text
Home Services
 ├── Plumbing
 ├── Electrical
 └── Cleaning
```

Support:

```text
Category
Subcategory
```

relationships.

---

# Portfolio Model

Stores:

```text
Images
Videos
Before/After Media
Captions
```

Belongs to:

```text
Service
```

---

# Conversation Model

Represents service negotiation.

---

# Conversation Creation Rule

Conversation must originate from:

```text
Request Service
```

Never create random conversations.

---

# Conversation Relationships

```text
Conversation
→ User (Requester)

Conversation
→ User (Provider)

Conversation
→ Service
```

---

# Conversation Status

```text
OPEN

NEGOTIATING

BOOKED

IN_PROGRESS

ARCHIVED
```

---

# Archive Rules

Conversation becomes archived when:

```text
Booking Completed
```

or

```text
Booking Cancelled
```

Archived conversations are read-only.

---

# Message Model

Supported message types:

```text
TEXT

IMAGE

VIDEO

DOCUMENT

SYSTEM

QUOTE
```

Future:

```text
VOICE
```

---

# Quotation Model

Represents provider pricing proposal.

---

# Ownership

Only providers create quotations.

Customers cannot edit quotations.

---

# Quote Lifecycle

```text
DRAFT
↓
SENT
↓
NEGOTIATING
↓
ACCEPTED
↓
SCHEDULING
↓
PAYMENT_PENDING
↓
PAID
↓
LOCKED
```

---

# Quote Versioning

Never overwrite quotes.

Always create revisions.

Example:

```text
V1
V2
V3
```

Maintain history.

---

# Quote Items

Support:

```text
Labour

Materials

Transport

Additional Charges
```

Each item stores:

```text
Name
Quantity
Unit Price
Total
```

---

# VAT Rules

Nigeria VAT:

```text
7.5%
```

System-calculated.

Never trust client calculations.

---

# Booking Model

Represents confirmed work.

---

# Booking Creation Rule

Booking requires:

```text
Accepted Quote
+
Selected Schedule
+
Successful Payment
```

No exceptions.

---

# Booking Lifecycle

```text
PENDING
↓
CONFIRMED
↓
IN_PROGRESS
↓
PARTIALLY_COMPLETED
↓
COMPLETED
```

Alternative:

```text
CANCELLED

DISPUTED
```

---

# Partial Completion

Provider may mark:

```text
PARTIALLY_COMPLETED
```

This requires:

```text
Reschedule Date
Reschedule Time
```

for continuation.

---

# Booking Uniqueness Rule

One quotation may only create:

```text
ONE BOOKING
```

Rescheduling updates booking.

Never creates new booking.

---

# Payment Model

Stores:

```text
Amount
Currency
Status
Reference
Provider Share
Platform Fee
```

---

# Payment Lifecycle

```text
PENDING
↓
SUCCESSFUL
```

Alternative:

```text
FAILED

REFUNDED
```

---

# Review Model

Review belongs to:

```text
Booking
```

Only.

---

# Review Creation Rule

Booking must be:

```text
COMPLETED
```

before review creation.

---

# Dispute Model

Dispute belongs to:

```text
Booking
```

Only.

---

# Dispute Lifecycle

```text
OPEN
↓
UNDER_REVIEW
↓
RESOLVED
```

Alternative:

```text
REJECTED
```

---

# Notification Model

Stores:

```text
Title
Body
Type
Read Status
Deep Link
```

---

# Notification Types

```text
NEW_REQUEST

NEW_MESSAGE

NEW_QUOTE

QUOTE_UPDATED

QUOTE_ACCEPTED

BOOKING_CREATED

BOOKING_CONFIRMED

PAYMENT_RECEIVED

SERVICE_COMPLETED

REVIEW_RECEIVED

DISPUTE_CREATED
```

---

# Analytics Tables

Analytics should be append-only.

Never mutate historical analytics.

---

# Counter Fields

Allowed:

```text
followersCount

likesCount

savedCount

completedJobsCount

reviewsCount
```

Must remain synchronized.

---

# Database Indexing

Required indexes:

```text
Phone

Service Status

Published State

Location

Booking Status

Conversation Status

Notification Read Status
```

---

# Migration Policy

Prefer additive migrations.

Allowed:

```text
Add Table

Add Column

Add Index
```

Avoid:

```text
Drop Table

Drop Column

Rename Column
```

without migration strategy.

---

# Prisma Rules

Always:

```text
prisma generate
```

after schema updates.

Use:

```bash
npx prisma migrate dev --name description
```

for proper migrations.

---

# Forbidden Changes

Never introduce:

* Separate Provider Table
* Separate Customer Table
* MongoDB
* Composite Business Logic in Prisma Models
* Payment Data Outside Payment Tables

without approval.

---

# Database Source Of Truth

Priority:

```text
Prisma Schema
↓
Database
↓
API Contracts
↓
Documentation
```

The Prisma schema is always authoritative.
