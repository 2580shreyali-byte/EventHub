# EventHub Server

> Scalable Node.js (ESM) / Express 4.21 RESTful API backend engine powering EventHub.

---

## Overview

The EventHub backend server manages core business logic, cryptographic pass generation, transactional seat reservations with pessimistic row-locking (`SELECT ... FOR UPDATE`), multi-gate check-in verification, and real-time ingress throughput analytics.

---

## Directory Structure

```
server/
├── package.json                 # Backend dependencies, package scripts & metadata
├── src/
│   ├── app.js                   # Express application setup & middleware composition
│   ├── server.js                # HTTP server initialization & graceful shutdown
│   ├── config/
│   │   ├── db.js                # mysql2 connection pool with promise support
│   │   └── env.js               # Environment variable loading & validation
│   ├── controllers/             # HTTP controller layer
│   │   ├── auth.controller.js        # Authentication & profile endpoints
│   │   ├── checkin.controller.js     # Gate check-in & QueueLess analytics endpoints
│   │   ├── event.controller.js       # Event CRUD & gate configuration endpoints
│   │   ├── invitation.controller.js  # Team invitation acceptance & decline endpoints
│   │   ├── pass.controller.js        # SmartPass retrieval & reissuance endpoints
│   │   └── registration.controller.js# Individual & team registration endpoints
│   ├── middleware/              # Express middleware pipeline
│   │   ├── auth.middleware.js        # JWT cookie extraction & role enforcement
│   │   ├── error.middleware.js       # Global centralized error handler
│   │   └── validate.middleware.js    # Zod schema validation interceptor
│   ├── routes/                  # Express route routers
│   │   ├── auth.routes.js            # Mounted at /api/v1/auth
│   │   ├── checkin.routes.js         # Mounted at /api/v1/checkin
│   │   ├── event.routes.js           # Mounted at /api/v1/events
│   │   ├── health.routes.js          # Mounted at /api/v1/health (via root aggregator)
│   │   ├── index.js                  # Master route aggregator mounted at /api/v1
│   │   ├── invitation.routes.js      # Mounted at /api/v1/invitations
│   │   └── pass.routes.js            # Mounted at /api/v1/passes
│   ├── services/                # Pure business logic & database transactions
│   │   ├── auth.service.js           # Bcrypt hashing & JWT signing
│   │   ├── checkin.service.js        # Gate check-in, idempotency & QueueLess calculation
│   │   ├── event.service.js          # Event lifecycle & capacity management
│   │   ├── invitation.service.js     # Team quorum tracking & automatic capacity release
│   │   ├── pass.service.js           # Blind QR token hashing & pass issuance
│   │   └── registration.service.js   # Transactional headcount reservation (FOR UPDATE)
│   ├── utils/                   # Reusable helpers & response formatters
│   │   ├── apiResponse.js            # Standardized success & error JSON envelopes
│   │   └── crypto.js                 # SHA-256 token hashing & random token generators
│   └── validators/              # Zod validation schemas
│       ├── auth.validator.js         # Auth registration & login schemas
│       ├── checkin.validator.js      # QR payload, scanUuid & gate schemas
│       ├── event.validator.js        # Event creation, update & eventQuery schemas
│       └── registration.validator.js # Individual & team registration schemas
├── scripts/
│   └── seedAdmin.js             # Idempotent administrator seed script
└── tests/                       # Deterministic integration test suites (Node.js assert)
    ├── phase2.test.js           # 13 tests: Auth, session cookies, event CRUD
    ├── phase3.test.js           # 14 tests: Concurrency, capacity limits, SmartPass QR
    ├── phase4.test.js           # 15 tests: Gate check-in, idempotency, QueueLess
    ├── phase6.test.js           # 17 tests: Discovery search, filtering, gate management
    └── phase7.test.js           # 13 tests: Headcount team registration, invitations
```

---

## Production Dependencies

The server relies strictly on production-ready libraries declared in `package.json`:

| Package | Version | Purpose |
|---|---|---|
| `express` | `^4.21.2` | Core web framework and HTTP routing |
| `mysql2` | `^3.12.0` | High-performance MySQL client with connection pooling and promise API |
| `zod` | `^3.24.2` | Runtime schema validation for request bodies, params, and queries |
| `bcryptjs` | `^2.4.3` | Salted password hashing with 12 rounds |
| `jsonwebtoken` | `^9.0.2` | Cryptographic JWT signing and token verification |
| `cookie-parser` | `^1.4.7` | Parsing HTTP-only authentication cookies |
| `helmet` | `^8.0.0` | Hardening standard HTTP security headers |
| `cors` | `^2.8.5` | Cross-Origin Resource Sharing with credentials support |
| `dotenv` | `^16.4.7` | Environment variable management |
| `qrcode` | `^1.5.4` | Server-side QR code data URL generation |

*Note: The test harness uses native Node.js (`node:assert`, `fetch`, and ES modules) without external test runner dependencies.*

---

## REST API Route Reference

All API routes are mounted under `/api/v1` through the router aggregator in `src/routes/index.js`:

### 1. Health & Diagnostics (`/api/v1`)
| Method | Path | Auth / Role | Description |
|---|---|:---:|---|
| `GET` | `/api/v1/health` | Public | Live database connectivity check, service status, and server uptime |

### 2. Authentication (`/api/v1/auth`)
| Method | Path | Auth / Role | Description |
|---|---|:---:|---|
| `POST` | `/api/v1/auth/register` | Public | Register a student account with email, password, student ID, and department |
| `POST` | `/api/v1/auth/login` | Public | Authenticate user; returns user profile and sets HTTP-only JWT cookie |
| `POST` | `/api/v1/auth/logout` | Public | Clears the HTTP-only authentication cookie |
| `GET` | `/api/v1/auth/me` | Authenticated | Retrieve authenticated user profile, role, and reward points |

### 3. Events & Discovery (`/api/v1/events`)
| Method | Path | Auth / Role | Description |
|---|---|:---:|---|
| `GET` | `/api/v1/events` | Optional Auth | List published events with keyword search, category filter, and pagination envelope |
| `GET` | `/api/v1/events/:id` | Optional Auth | Detailed event view, venue, times, capacity, gates array, and user participation |
| `GET` | `/api/v1/events/:id/queueless` | Public | Live 10-minute gate throughput analytics and optimal gate recommendations |
| `GET` | `/api/v1/events/:id/gates` | Authenticated | List all active and inactive physical gates for an event |
| `POST` | `/api/v1/events/:id/gates` | Admin | Add a new physical entry gate to an event |
| `PUT` | `/api/v1/events/:id/gates/:gateId` | Admin | Update gate name, location description, or active status |
| `POST` | `/api/v1/events/:id/register` | Student | Register for an individual or team event; atomically reserves capacity |
| `POST` | `/api/v1/events` | Admin | Create a new event (individual or team mode, team size limits, capacity, dates) |
| `PATCH` | `/api/v1/events/:id` | Admin | Update event details and capacity (rejects capacity reductions below booked count) |
| `DELETE` | `/api/v1/events/:id` | Admin | Safely cancel/delete an event and revoke associated active passes |

### 4. SmartPasses (`/api/v1/passes`)
| Method | Path | Auth / Role | Description |
|---|---|:---:|---|
| `GET` | `/api/v1/passes/my-passes` | Student | Retrieve all active and past passes belonging to the authenticated student |
| `GET` | `/api/v1/passes/:id` | Owner / Admin | Retrieve individual pass details by ID (enforces ownership) |
| `POST` | `/api/v1/passes/:id/reissue` | Student | Reissue compromised pass; rotates token hash and returns new QR payload |

### 5. Team Invitations (`/api/v1/invitations`)
| Method | Path | Auth / Role | Description |
|---|---|:---:|---|
| `GET` | `/api/v1/invitations` | Student | List pending team invitations sent to the authenticated student |
| `POST` | `/api/v1/invitations/:id/accept` | Student | Accept team invite; confirms team and generates passes if quorum met |
| `POST` | `/api/v1/invitations/:id/decline` | Student | Decline invite; cancels team and frees capacity if size drops below minTeamSize |

### 6. Gate Scanner & Ingress Check-In (`/api/v1/checkin`)
| Method | Path | Auth / Role | Description |
|---|---|:---:|---|
| `POST` | `/api/v1/checkin/scan` | Admin | Validate QR payload, verify window & gate, check in attendee, and award +50 pts |

---

## Key Backend Capabilities & Business Rules

### 1. Concurrency Control with Pessimistic Locking
All event registration workflows execute within explicit database transactions (`START TRANSACTION` ... `COMMIT`). Capacity is strictly protected from race conditions and overbooking using pessimistic row locking:
```sql
SELECT max_capacity, current_registrations, registration_type, min_team_size, max_team_size
FROM events
WHERE id = ? FOR UPDATE;
```
- If `current_registrations + requestedHeadcount > max_capacity`, the transaction rolls back cleanly with HTTP `409 CAPACITY_FULL`.
- For team registrations, the entire team headcount (`1 + memberEmails.length`) is reserved atomically at creation.
- If an invited member declines and remaining team members drop below `min_team_size`, the team registration is cancelled and the full reserved headcount is atomically decremented:
  ```sql
  UPDATE events SET current_registrations = current_registrations - reserved_headcount WHERE id = ?;
  ```

### 2. Cryptographically Blind SmartPass Tokens
- Pass secrets are generated with 256 bits of cryptographic entropy:
  ```javascript
  const rawToken = crypto.randomBytes(32).toString('hex'); // 64-character hex string
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  ```
- Public pass code format:
  ```javascript
  const passCode = `PASS-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  ```
- QR code payload format:
  ```
  EVPASS:v1:<passCode>:<rawToken>
  ```
- **Zero Token Leakage**: The database stores **only** the SHA-256 hash in `passes.token_hash`. The raw secret token is never persisted in MySQL. Even in the event of a full database compromise, attackers cannot forge valid admission QR codes.
- **Pass Reissuance**: Calling `POST /api/v1/passes/:id/reissue` generates a fresh raw token and atomically rotates `passes.token_hash`. Scans presenting the previous QR token fail with `400 INVALID_TOKEN`.

### 3. Gate Check-In Verification Rules
Gate check-ins (`POST /api/v1/checkin/scan`) execute an atomic 11-step transaction with the following validations:
- **QR Format**: Payload must match `/^EVPASS:v1:([^:]+):([a-f0-9]{64})$/i`. Malformed QR codes return `400 INVALID_QR_PAYLOAD`.
- **Event Status**: Check-in is rejected if the event is cancelled (`400 EVENT_CANCELLED`).
- **Check-In Window**:
  - Check-in opens strictly **60 minutes prior to event start time**: `now >= start_time - 60 minutes`.
  - Check-in closes at **event end time**: `now <= end_time`.
  - Attempts outside this window return `400 WINDOW_CLOSED`.
- **Gate Validation**:
  - Gate must exist in database (`404 GATE_NOT_FOUND`).
  - Gate must be marked active (`400 GATE_INACTIVE`).
  - Gate must belong to the event associated with the pass (`400 GATE_MISMATCH`).
  - Request `eventId` must match the pass's event (`400 EVENT_MISMATCH`).
- **Pass Status**:
  - Passes already checked in return `409 DUPLICATE_CHECKIN` with message:  
    `ALREADY SCANNED: Pass was previously checked in at <time> at <gateName>.`
  - Revoked passes return `400 PASS_REVOKED`.
  - Expired passes return `400 PASS_EXPIRED`.
- **Idempotency via `scanUuid`**:
  - Scans provide a client-generated UUID (`scanUuid`).
  - Retrying with the same `scanUuid` and same pass returns `200 APPROVED` idempotently with the original `checkedInAt` timestamp and 0 duplicate points awarded.
  - Using a previously used `scanUuid` with a different pass returns `409 DUPLICATE_SCAN_UUID`.
- **Atomic Pass Check-In & Rewards**:
  - Pass status is updated conditionally: `UPDATE passes SET status = 'checked_in', checked_in_at = NOW() WHERE id = ? AND status = 'active'`. Concurrent scans on the same pass fail with `409 CONCURRENT_CHECKIN`.
  - An entry is created in `attendance_logs` recording `pass_id`, `gate_id`, `scanned_by`, `scan_uuid`, and `scanned_at`.
  - An audit record of **+50 reward points** is inserted into `points_ledger` (guarded by `UNIQUE KEY uq_pass_reason (pass_id, reason)` where reason is `'EVENT_CHECKIN'`).
  - Attendee's total points are incremented in `users`: `UPDATE users SET reward_points = reward_points + 50 WHERE id = ?`.

### 4. QueueLess Ingress Throughput Engine
`GET /api/v1/events/:id/queueless` computes real-time ingress velocity across all active gates:
- **Rolling Window**: Analyzes check-in scans recorded over the **last 10 minutes** (`DATE_SUB(NOW(), INTERVAL 10 MINUTE)`).
- **Throughput Calculation**:
  $$\text{throughputScansPerMin} = \text{Number}\left(\left(\frac{\text{scansInLast10Min}}{10}\right).\text{toFixed}(1)\right)$$
- **Activity Classification**:
  - `throughput > 8.0 scans/min`: `High Scan Velocity` (Indicator: `red`)
  - `3.0 <= throughput <= 8.0 scans/min`: `Steady Flow` (Indicator: `yellow`)
  - `throughput < 3.0 scans/min`: `Low Activity (Fast Entry)` (Indicator: `green`)
- **Recommendation Logic**: Recommends the active gate with the lowest `scansInLast10Min` (`recommendedGateId`, `recommendedGateName`).
- **Response Disclaimer**: Explicitly states that metrics represent terminal scan throughput over the past 10 minutes rather than external physical queue lengths.

---

## Available npm Scripts

```bash
# Start backend server in production mode
npm start

# Start development server with auto-reload (using Node.js native --watch)
npm run dev

# Seed default administrator account (idempotent seed script)
npm run seed:admin

# Run Phase 2 automated test suite (Auth, session cookies, and event CRUD)
npm run test:phase2

# Run Phase 3 automated test suite (Concurrency row-locking, capacity, and SmartPass QR)
npm run test:phase3

# Run Phase 4 automated test suite (Gate check-in, idempotency, points, and QueueLess)
npm run test:phase4

# Run Phase 6 automated test suite (Discovery search, category filter, and gate management)
npm run test:phase6

# Run Phase 7 automated test suite (Team registration, invitation engine, and capacity release)
npm run test:phase7
```

---

## Automated Test Suites

The test suite executes against the actual application and database using Node's native test assertion harness.

```
======================================================================
EVENTHUB BACKEND TEST EXECUTION SUMMARY
======================================================================
Test Suite Script    Phase / Scope                               Status
----------------------------------------------------------------------
npm run test:phase2  Authentication, JWT Cookies & Event CRUD    13/13 PASS
npm run test:phase3  Row Locking, Capacity & SmartPass QR        14/14 PASS
npm run test:phase4  Gate Check-In, Idempotency & QueueLess      15/15 PASS
npm run test:phase6  Discovery Search, Filtering & Gates         17/17 PASS
npm run test:phase7  Team Registrations & Invitation Engine      13/13 PASS
----------------------------------------------------------------------
TOTAL                5 Test Suites                               72/72 PASS (100%)
======================================================================
```
