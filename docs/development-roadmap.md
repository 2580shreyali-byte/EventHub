# EventHub — Version 2.2 (Implementation Ready)
## Development Roadmap & Quality Assurance Strategy
**Intelligent Campus Event Management Ecosystem**

---

## 1. Engineering Strategy & MVP Tiers

EventHub follows an iterative, **"Security-First Core MVP"** methodology: establish a bulletproof transactional core before expanding into smart ecosystem features and offline resilience.

```
┌────────────────────────────────────────────────────────────────────────┐
│  TIER 1: CORE TRANSACTIONAL MVP (Hackathon Core)                       │
│  - JWT in HTTP-only, SameSite Cookies + Double-Submit CSRF Protection  │
│  - Headcount-based Concurrency-safe Registration (FOR UPDATE)          │
│  - Verified Team Invitation Workflow with Pass Isolation               │
│  - Universal Duplicate Event Participation Prevention (user_id Level)  │
│  - Cryptographic Blind QR Pass Verification (SHA-256 Hashes)           │
│  - 9-Step Single-Transaction Atomic Gate Check-in & Gate Validation    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Unlocks
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│  TIER 2: SMART ECOSYSTEM (Differentiators & High Scoring)              │
│  - QueueLess: Transparent Scan Throughput & Activity Indicators        │
│  - CampusPass: Auditable Points Ledger & Non-duplicable Badges         │
│  - EventIQ: Rule-Based Explainable Recommendation Scoring              │
│  - Event Health Monitor: Real-Time Operational Analytics (Recharts)    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Unlocks
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│  TIER 3: ADVANCED RESILIENCE (Stretch Goal)                            │
│  - Ed25519 Asymmetric Signed Offline Manifests into IndexedDB          │
│  - Idempotent Offline Scan Queue (scan_uuid) & Sync Anomaly Logging    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Phase-by-Phase Implementation Milestones

### Phase 1: Technical Architecture & Specification (Completed)
- **Status**: Completed & Validated (v2.2).
- **Deliverables**:
  - `docs/architecture.md` (v2.2)
  - `docs/api-design.md` (v2.2)
  - `docs/development-roadmap.md` (v2.2)
- **Completion Criteria**: Complete cross-document consistency across database constraints, API specs, security policies, and testing matrices.

---

### Phase 2: Database Design, Schema DDL & Secure Data Seeding
- **Dependencies**: Phase 1.
- **Key Tasks**:
  1. Author `database/schema.sql`:
     - `USERS`: `id`, `full_name`, `email` (UK), `password_hash`, `role`, `student_id` (UK), `department`, `reward_points`, `created_at`, `updated_at`.
     - `INTEREST_TAGS`: `id`, `name` (UK), `category`.
     - `USER_INTERESTS`: `user_id` (FK), `tag_id` (FK), `PRIMARY KEY (user_id, tag_id)`.
     - `EVENTS`: `id`, `title`, `description`, `category`, `venue`, `start_time`, `end_time`, `registration_deadline`, `max_capacity`, `current_registrations`, `registration_type`, `min_team_size`, `max_team_size`, `status`, `banner_url`, `created_by` (FK), `created_at`, `updated_at`.
     - `EVENT_TAGS`: `event_id` (FK), `tag_id` (FK), `PRIMARY KEY (event_id, tag_id)`.
     - `GATES`: `id`, `event_id` (FK), `gate_name`, `location_description`, `is_active`, `created_at`.
     - `REGISTRATIONS`: `id`, `event_id` (FK), `leader_id` (FK), `team_name`, `registration_type`, `reserved_headcount`, `status`, `created_at`, `updated_at`.
     - `TEAM_MEMBERS`: `id`, `registration_id` (FK), `event_id` (FK), `user_id` (FK), `role`, `status`, `invited_at`, `responded_at`.
       - `UNIQUE KEY uq_event_user_participation (event_id, user_id)` (prevents duplicate participation across teams).
     - `PASSES`: `id`, `registration_id` (FK), `event_id` (FK), `user_id` (FK), `pass_code` (UK), `token_hash` (UK), `status`, `issued_at`, `checked_in_at`.
       - `UNIQUE KEY uq_event_user_pass (event_id, user_id)` (exactly 1 pass per student per event).
     - `ATTENDANCE_LOGS`: `id`, `pass_id` (FK, UK), `gate_id` (FK), `scanned_by` (FK), `checkin_mode`, `scan_uuid` (UK), `scanned_at`, `synced_at`.
     - `POINTS_LEDGER`: `id`, `user_id` (FK), `event_id` (FK), `pass_id` (FK), `points_change`, `reason`, `created_at`.
       - `UNIQUE KEY uq_pass_reason (pass_id, reason)` (prevents duplicate rewards).
     - `BADGES`: `id`, `title` (UK), `description`, `icon_name`, `required_points`, `required_events_count`.
     - `USER_BADGES`: `id`, `user_id` (FK), `badge_id` (FK), `awarded_at`.
       - `UNIQUE KEY uq_user_badge (user_id, badge_id)` (prevents duplicate badges).
     - Referential deletion rules: `ON DELETE RESTRICT` on all audited historical entities (`events`, `registrations`, `passes`, `attendance_logs`, `points_ledger`), `ON DELETE CASCADE` on metadata tags (`user_interests`, `event_tags`).
  2. Author `database/seeds.sql`:
     - Standardize password hashing to **bcrypt cost factor 12**.
     - Insert pre-computed hashes for default admin (`admin@eventhub.campus.edu`) and test students. Never commit plaintext credentials.
- **Completion Criteria**: Executing `schema.sql` and `seeds.sql` on a fresh MySQL 8 instance runs without errors and all constraints/indexes are active.

---

### Phase 3: Frontend Scaffolding, Design System & Axios Client Setup
- **Dependencies**: None (can run in parallel with Phase 2).
- **Key Tasks**:
  1. Scaffold React 18 SPA with Vite, Tailwind CSS, Lucide React, and React Router DOM.
  2. Configure Axios client (`src/services/api.js`):
     - `withCredentials: true` enabled globally.
     - Response/Request interceptors reading `XSRF-TOKEN` cookie and injecting `X-CSRF-Token` header.
     - **Strict Rule**: Zero authentication tokens stored in `localStorage` or `sessionStorage`.
  3. Create reusable atomic UI components (`Button`, `Input`, `Modal`, `Badge`, `Toast`).
  4. Build responsive layout shells (`Navbar`, `Sidebar`, `ProtectedRoute`).
- **Completion Criteria**: UI component showcase renders cleanly; Axios interceptor verifies credentials and CSRF header behavior in browser network logs.

---

### Phase 4: Backend Gateway, Connection Pool & Security Middleware
- **Dependencies**: Phase 2.
- **Key Tasks**:
  1. Scaffold Express application with `mysql2/promise` connection pool (`src/config/db.js`).
  2. Implement environment validation (`src/config/env.js`) with Zod.
  3. Mount security middleware:
     - `helmet()` for security headers.
     - `cors()` with origin whitelisting (`http://localhost:5173` in dev, Vercel domain in prod) and `credentials: true`.
     - `cookie-parser` for reading HTTP-only auth cookies.
     - `csrf.middleware.js` validating `X-CSRF-Token` on `POST`, `PUT`, `PATCH`, `DELETE`.
     - `rateLimit.middleware.js` protecting authentication and scanner routes.
  4. Centralized error handling and standardized `{ success, data, error }` response wrappers.
- **Completion Criteria**: `GET /api/v1/auth/csrf` bootstraps CSRF cookie; `GET /api/v1/health` returns `200 OK` with DB connection status `healthy`.

---

### Phase 5: Authentication, Session Cookies & Role Authorization
- **Dependencies**: Phase 2, Phase 4.
- **Key Tasks**:
  1. `auth.service.js`: bcrypt password hashing (**cost factor 12**) and JWT generation.
  2. `auth.controller.js`:
     - Public registration unconditionally assigns `role = 'student'` on the server; client input `role` is discarded.
     - Sets `access_token` in **HTTP-only, Secure, SameSite=Lax cookie**.
     - Sets readable `XSRF-TOKEN` cookie for client CSRF protection.
     - Logout endpoint destroys both cookies.
  3. `auth.middleware.js`:
     - `verifyToken`: extracts JWT from `req.cookies.access_token`, verifies signature, injects `req.user`.
     - `requireRole('admin')`: restricts administration endpoints.
  4. Connect frontend `AuthContext.jsx` via `GET /api/v1/auth/me`.
- **Completion Criteria**: Registration creates student account with role `student`; JWT is inaccessible via `document.cookie`; student role is blocked from admin routes (`403 Forbidden`).

---

### Phase 6: Event Management Module & Discovery Portal
- **Dependencies**: Phase 5.
- **Key Tasks**:
  1. Admin Event CRUD with Zod validation (`title`, `startTime`, `maxCapacity`, `registrationType`, etc.).
  2. Gate configuration endpoints (`POST /api/v1/events/:id/gates`, `GET /api/v1/events/:id/gates`, `PUT /api/v1/events/:id/gates/:gateId`).
  3. Student event discovery page:
     - Real-time keyword search, category filtering, and pagination.
     - Available headcount indicators showing remaining seats.
- **Completion Criteria**: Admin creates event with multiple gates; students view active event in browse portal with exact capacity metrics.

---

### Phase 7: Headcount-Based Registration & Team Invitation Engine
- **Dependencies**: Phase 6.
- **Key Tasks**:
  1. Concurrency-safe capacity locking via `SELECT ... FOR UPDATE`:
     - Verify $\text{current\_registrations} + \text{reservedHeadcount} \le \text{max\_capacity}$.
  2. Team Invitation Workflow:
     - Verify that all invited emails correspond to verified student accounts in `users`.
     - Verify no invitee is already registered or invited via `UNIQUE (event_id, user_id)` on `TEAM_MEMBERS`.
     - Insert `REGISTRATIONS` record with status `'pending_members'`.
     - Create `TEAM_MEMBERS` invitation records.
  3. Acceptance & Confirmation:
     - Endpoints for `GET /api/v1/invitations`, `POST /api/v1/invitations/:id/accept`, `POST /api/v1/invitations/:id/decline`.
     - When all members accept, registration transitions to `'confirmed'`.
     - Pass generation: Create individual passes in `PASSES` for each verified member (`user_id = member.user_id`).
     - **Pass Isolation**: Ensure team leader receives **only their own pass** and never sees members' raw QR tokens.
     - **Invitation Expiry & Capacity Release**: If invitations are declined or expire without reaching `min_team_size` before `registration_deadline`, registration transitions to `'cancelled'` and reserved capacity is released.
- **Completion Criteria**: Team of 3 reserves 3 seats; invitations are accepted; individual passes are issued to each student's personal account.

---

### Phase 8: SmartPass QR Issuance & 9-Step Atomic Check-in
- **Dependencies**: Phase 7.
- **Key Tasks**:
  1. Server generates QR payload `EVPASS:v1:<passCode>:<rawToken>` using `crypto.randomBytes(32)`.
  2. Stores SHA-256 hash in `passes.token_hash`. `token_hash` is never returned to students.
  3. Frontend `MyPassesPage.jsx` renders personal QR codes.
  4. Frontend `GateScannerPage.jsx` integrates `html5-qrcode` with a video scanner and manual code entry fallback.
  5. Backend `checkin.service.js` **9-Step Single Transaction**:
     - Validate pass existence, event match, and gate validity (`gate.event_id === pass.event_id`).
     - Validate check-in time window (`NOW() BETWEEN startTime - 60 min AND endTime`).
     - Validate event is active (reject `cancelled` or expired events).
     - Atomic conditional update: `UPDATE passes SET status = 'checked_in', checked_in_at = NOW() WHERE id = ? AND status = 'active'`.
     - Insert `attendance_logs` record with client-generated `scan_uuid`.
     - Insert `points_ledger` record (+50) guarded by `UNIQUE (pass_id, reason)`.
     - Increment `users.reward_points`.
     - Award badges idempotently via `user_badges` (`UNIQUE KEY (user_id, badge_id)`).
     - Roll back entire transaction if any step fails.
- **Completion Criteria**: Valid scan approves entry (Green screen); duplicate scan 1 second later rejects entry (Red screen); gate mismatch rejects with 400.

---

### Phase 9: QueueLess Gate Throughput Engine
- **Dependencies**: Phase 8.
- **Key Tasks**:
  1. SQL aggregation querying `attendance_logs` for check-ins in the last 10-minute sliding window grouped by `gate_id`.
  2. Calculate scan throughput rate ($\text{scans} / 10 \text{ min}$) and categorize activity (`Low Activity`, `Steady Flow`, `High Scan Velocity`).
  3. UI `GateThroughputWidget.jsx`:
     - Renders gate activity status pills.
     - Displays mandatory transparency disclaimer: *"Gate activity indicators and recommendations are calculated strictly from check-in scan throughput at each terminal over the past 10 minutes. They do not measure physical queue lengths outside the venue."*
     - Recommends the gate with lowest recent scan frequency.
- **Completion Criteria**: Live scan activity updates gate velocity in real-time without false claims of measuring physical line length.

---

### Phase 10: CampusPass Auditable Ledger & EventIQ Recommendations
- **Dependencies**: Phase 5, Phase 8.
- **Key Tasks**:
  1. `campuspass.service.js`:
     - Points ledger tracks verified co-curricular attendance rewards.
     - Database uniqueness constraint `UNIQUE (pass_id, reason)` physically prevents duplicate rewards.
     - Automated badge evaluations (`UNIQUE KEY (user_id, badge_id)`).
  2. Frontend `CampusPassPage.jsx` displaying badges, points balance, and chronological audit ledger.
  3. `eventiq.service.js`:
     - Rule-based explainable recommendation scoring formula (Interests + Department + History + Urgency).
     - Displays "Recommended for you" ribbon with explanatory tags.
- **Completion Criteria**: Attending an event awards exactly 50 points in ledger; re-scanning duplicate pass awards zero additional points; earned badges cannot duplicate.

---

### Phase 11: Event Health Monitor (Admin Analytics Dashboard)
- **Dependencies**: Phase 8, Phase 9.
- **Key Tasks**:
  1. Backend analytics service aggregating capacity fill rate, total attendance, and gate distribution.
  2. Frontend `HealthMonitorPage.jsx` with Recharts charts:
     - Donut Chart: Capacity vs Registrations vs Check-ins.
     - Bar Chart: Gate check-in volume distribution.
     - Anomaly Alert Card: Flags gate throughput imbalances.
- **Completion Criteria**: Admin monitors live attendance, gate distribution percentages, and operational alerts.

---

### Phase 12: Offline Check-in Synchronization (Ed25519 & IndexedDB)
- **Dependencies**: Phase 8 (Online check-in must be 100% verified first).
- **Key Tasks**:
  1. Server-side Ed25519 signing utility (`crypto.sign(null, canonicalJson, privateKey)`).
  2. Client-side **IndexedDB** setup (`eventhub_offline_db`) for caching signed manifests.
  3. Frontend Ed25519 public key verification via Web Crypto API before saving manifest.
  4. Offline scanner mode: checks token hash against IndexedDB manifest and logs local scan with a client-generated `scan_uuid`.
  5. Reconnection Sync: `POST /api/v1/checkin/sync-offline` batch processing inside transactions.
  6. Document and log cross-device disconnected double-scan anomalies for administrative audit.
- **Completion Criteria**: Disconnecting network in browser DevTools permits offline scanning; reconnecting syncs attendance logs to server without data loss.

---

### Phase 13: End-to-End Integration, Automated 20-Point Test Suite & Deployment Prep
- **Dependencies**: All prior phases.
- **Key Tasks**:
  1. Automated test suite execution across all 20 security and functional test cases.
  2. Production build verification on Vercel and Railway.
  3. Comprehensive demo walk-through with test personas (Student Alex Chen vs Admin Prof. Davis).
- **Completion Criteria**: All 20 automated test scenarios pass with zero failures.

---

## 3. Authoritative 20-Scenario Quality Assurance Matrix

Prior to production demonstration, we execute strict automated test suites (`server/tests/`) targeting the highest-risk failure modes:

| Test Case # | Scenario / Risk Tested | Implementation Verification | Expected Result |
| :---: | :--- | :--- | :--- |
| **1** | **Public Registration Role Escalation** | Client sends `"role": "admin"` in `POST /api/v1/auth/register`. | Server discards `role` input and assigns `student`. User created has `role === 'student'`. |
| **2** | **Unauthorized API Access** | Request sent to protected route without `access_token` cookie. | Middleware intercepts request and returns `401 Unauthorized`. |
| **3** | **Student Pass Privacy & Ownership** | Student A calls `GET /api/v1/passes/:id` requesting Student B's pass. | Ownership check detects `pass.user_id !== req.user.id` and returns `403 Forbidden`. |
| **4** | **Team Leader Token Isolation** | Team leader calls `GET /api/v1/passes/my-passes` after team confirms. | Server returns only the leader's own pass. Leader has zero access to raw QR tokens of members. |
| **5** | **Unverified Team Members** | Leader tries to register team with non-existent student email. | Server validates existence in `users`; rejects with `400 User Not Found`. Zero unconfirmed passes created. |
| **6** | **Universal Duplicate Event Participation** | Student registered on Team A attempts to accept invitation to Team B for same event. | Database constraint `uq_event_user_participation` throws conflict; server returns `409 Duplicate Participation`. |
| **7** | **Team Invitation Expiry & Capacity Release** | Invited members fail to accept before `registration_deadline`. | Registration transitions to `cancelled`; `current_registrations` decremented by `reserved_headcount`. |
| **8** | **Concurrent Registrations (Overbooking)** | 10 parallel HTTP requests competing for 1 remaining seat in an event. | `SELECT ... FOR UPDATE` locks row; exactly 1 request returns `201 Created`; 9 return `409 Capacity Full`. |
| **9** | **Invalid / Expired / Revoked Passes** | Scanner scans pass with tampered token, revoked status, or past event `end_time`. | Step 2 of check-in transaction detects invalid state; returns `400 Invalid / Expired / Revoked Pass`. |
| **10** | **Gate and Event Mismatch** | Scanner scans a pass for Event 14 at a gate belonging to Event 15. | Step 3 of check-in transaction verifies `gate.event_id === pass.event_id`; rejects with `400 Gate Mismatch`. |
| **11** | **Check-In Window Boundary** | Scanner scans pass 2 hours before event start time. | Step 2 checks `NOW() < startTime - 60 min`; rejects with `400 Check-In Window Closed`. |
| **12** | **Sequential Duplicate Check-in** | Scanner scans the same pass twice in sequence (10 seconds apart). | First scan returns `200 Approved`; second scan detects `status == 'checked_in'` and returns `409 Duplicate Pass`. |
| **13** | **Simultaneous Concurrent Duplicate Scans** | Two scanner terminals scan the exact same QR token at the same millisecond. | Atomic update `UPDATE passes ... WHERE status = 'active'` ensures exactly one updates row; other returns `409 Conflict`. |
| **14** | **Transaction Rollback on Failure** | Database error artificially induced during reward points insertion (Step 7). | Transaction rolls back completely; `passes.status` remains `'active'`; zero partial attendance logs exist. |
| **15** | **Duplicate Reward Processing** | Multiple attendance reward insertions attempted for same pass in `points_ledger`. | Database constraint `UNIQUE KEY (pass_id, reason)` blocks second insert; user balance remains strictly correct. |
| **16** | **Duplicate Badge Prevention** | System evaluates badge criteria twice for the same student. | Database constraint `UNIQUE KEY (user_id, badge_id)` prevents duplicate row; student has exactly 1 badge. |
| **17** | **CSRF Validation & Bootstrap** | Mutating request (`POST`, `PUT`, `DELETE`) sent without matching `X-CSRF-Token` header. | `csrf.middleware.js` intercepts request and returns `403 Forbidden (CSRF_INVALID)`. |
| **18** | **CORS Restriction** | Cross-origin request dispatched from unauthorized origin (`http://malicious-site.com`). | CORS middleware rejects preflight with `403 / CORS origin denied`. |
| **19** | **Tampered Offline Manifest** | Offline manifest JSON tampered with (e.g. injected pass) tested against Ed25519 public key. | Web Crypto `verify()` returns `false`; manifest is rejected and deleted from IndexedDB. |
| **20** | **Offline Sync Idempotency & Conflicts** | Retransmitted sync batch reprocessed; conflicting cross-gate scans submitted. | `UNIQUE KEY (scan_uuid)` handles retries idempotently; cross-device conflicts logged as anomalies. |
