# API_CONTRACT.md

# Wokizi API Contract

This document defines API standards, request/response patterns, authentication requirements, pagination conventions, upload workflows, and websocket contracts.

All frontend and backend implementations must follow these contracts.

---

# Base URL

Development:

```text
http://localhost:3000/api/v1
```

Production:

```text
https://api.wokizi.com/api/v1
```

All routes are versioned.

---

# Authentication

Authentication uses:

```text
JWT Access Token
JWT Refresh Token
```

Access Token:

```text
15 minutes
```

Refresh Token:

```text
30 days
```

---

# Authorization Header

Authenticated requests must send:

```http
Authorization: Bearer <token>
```

---

# Standard Response Format

Successful responses should follow:

```json
{
  "success": true,
  "message": "Operation successful",
  "data": {}
}
```

---

# Standard Error Format

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request"
}
```

Validation errors:

```json
{
  "statusCode": 400,
  "message": [
    "phone must be a valid number"
  ],
  "error": "Bad Request"
}
```

Frontend must safely handle:

```ts
string | string[]
```

error messages.

---

# Pagination Standard

All list endpoints should return:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "hasNextPage": true
  }
}
```

---

# AUTH MODULE

## Send OTP

```http
POST /auth/send-otp
```

Request:

```json
{
  "phone": "+2348012345678"
}
```

Response:

```json
{
  "message": "OTP sent",
  "isNewUser": true
}
```

---

## Verify OTP

```http
POST /auth/verify-otp
```

Request:

```json
{
  "phone": "+2348012345678",
  "code": "123456",
  "deviceId": "device-id",
  "fcmToken": "token"
}
```

Response:

```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "isNewUser": true,
  "user": {}
}
```

---

## Refresh Token

```http
POST /auth/refresh
```

---

## Logout

```http
POST /auth/logout
```

Auth required.

---

# USERS MODULE

## Current User

```http
GET /users/me
```

---

## Update User

```http
PATCH /users/me
```

---

## Get User

```http
GET /users/:id
```

---

# PROFILES MODULE

## Update Profile

```http
PATCH /profiles/me
```

Supports:

```text
Name
Avatar
Email
Bio
Location
```

---

# VERIFICATION MODULE

## Verification Status

```http
GET /verification/status
```

Response:

```json
{
  "status": "APPROVED"
}
```

---

## Submit Verification

```http
POST /verification
```

Uploads:

```text
Government ID
Selfie
Proof Of Address
```

---

# CATEGORIES MODULE

## Categories

```http
GET /categories
```

Returns:

```text
Categories
Subcategories
```

---

# SERVICES MODULE

## Create Service

```http
POST /services
```

Creates:

```text
Draft Service
```

---

## My Services

```http
GET /services/my
```

Returns:

```text
All Owned Services
```

---

## Service Details

```http
GET /services/:id
```

---

## Update Service

```http
PATCH /services/:id
```

---

## Delete Service

```http
DELETE /services/:id
```

Soft delete only.

---

## Publish Service

```http
POST /services/:id/publish
```

Requirements:

```text
Verification Approved
Service Approved
```

---

## Pause Service

```http
PATCH /services/:id/status
```

Request:

```json
{
  "status": "SUSPENDED"
}
```

Never send:

```json
{
  "isPublished": false
}
```

unless backend explicitly supports it.

---

# FEED MODULE

## Feed

```http
GET /feed
```

Query:

```text
latitude
longitude
page
limit
```

Only published services returned.

---

# SEARCH MODULE

## Search Services

```http
GET /search/services
```

Filters:

```text
query
category
radius
rating
location
```

---

# CONVERSATIONS MODULE

## Create Conversation

```http
POST /conversations
```

Triggered from:

```text
Request Service
```

---

## My Conversations

```http
GET /conversations
```

---

## Archived Conversations

```http
GET /conversations/archived
```

Returns:

```text
Completed
Cancelled
Archived
```

conversations.

---

## Conversation Details

```http
GET /conversations/:id
```

---

# MESSAGES MODULE

## Get Messages

```http
GET /messages/conversation/:conversationId
```

---

## Send Message

```http
POST /messages
```

Request:

```json
{
  "conversationId": "...",
  "messageType": "TEXT",
  "content": "Hello"
}
```

---

## Attachment Message

```json
{
  "conversationId": "...",
  "messageType": "IMAGE",
  "attachmentUrl": "..."
}
```

Supported:

```text
TEXT
IMAGE
VIDEO
DOCUMENT
SYSTEM
QUOTE
```

---

# QUOTATIONS MODULE

## Create Quote

```http
POST /quotations
```

Provider only.

---

## Update Quote

```http
PATCH /quotations/:id
```

Provider only.

Allowed until:

```text
Payment Completed
```

---

## Accept Quote

```http
POST /quotations/:id/accept
```

---

## Reject Quote

```http
POST /quotations/:id/reject
```

---

## Request Changes

```http
POST /quotations/:id/request-changes
```

Customer only.

---

# BOOKINGS MODULE

## Create Booking

System action.

Requires:

```text
Accepted Quote
Schedule Selected
Successful Payment
```

---

## Booking Details

```http
GET /bookings/:id
```

---

## Reschedule Booking

```http
PATCH /bookings/:id/reschedule
```

Must update booking.

Never create new booking.

---

## Cancel Booking

```http
POST /bookings/:id/cancel
```

---

## Mark In Progress

```http
POST /bookings/:id/start
```

Provider only.

---

## Mark Partial Completion

```http
POST /bookings/:id/partial-complete
```

Provider only.

---

## Mark Completed

```http
POST /bookings/:id/complete
```

Provider only.

---

# REVIEWS MODULE

## Create Review

```http
POST /reviews
```

Requires:

```text
Completed Booking
```

---

# DISPUTES MODULE

## Create Dispute

```http
POST /disputes
```

Requires:

```text
Existing Booking
```

---

# NOTIFICATIONS MODULE

## Notifications

```http
GET /notifications
```

---

## Mark Read

```http
PATCH /notifications/:id/read
```

---

## Unread Count

```http
GET /notifications/unread-count
```

---

# UPLOADS MODULE

## Generate Upload URL

```http
POST /uploads/presigned-url
```

Response:

```json
{
  "uploadUrl": "...",
  "fileUrl": "..."
}
```

---

# SOCKET EVENTS

# Connection

Namespace:

```text
/ws
```

---

# Client Events

```text
message.send

message.read

typing.start

typing.stop
```

---

# Server Events

```text
message.created

message.updated

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

# Notification Deep Links

Supported targets:

```text
Conversation

Quotation

Booking

Review

Dispute

Service
```

---

# React Query Rules

Never fetch directly from screens.

Always use:

```text
services/
hooks/
```

pattern.

---

# API Service Rules

All API calls belong in:

```text
services/
```

Never:

```ts
axios.get(...)
```

inside screens.

---

# Backward Compatibility

When changing APIs:

Prefer:

```text
Additive Changes
```

Avoid:

```text
Breaking DTO Changes
Breaking Response Shapes
Endpoint Renames
```

without migration strategy.

---

# Source Of Truth

Priority:

```text
Database Schema
↓
API Implementation
↓
API_CONTRACT.md
↓
Frontend Integration
```

If documentation conflicts with implementation, verify implementation first.
