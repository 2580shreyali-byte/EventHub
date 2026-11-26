# EventHub System Architecture & Data Flow

> High-resolution architectural diagram and component data-flow walkthrough for the EventHub campus event management platform.

---

## 1. Complete System Architecture Diagram

```mermaid
flowchart TB
    subgraph CLIENT_TIER["Client Tier (React 18 + Vite SPA)"]
        direction TB
        subgraph USER_PERSONAS["User Personas"]
            STUDENT["Student Attendee"]
            ADMIN["Admin / Gate Staff"]
        end

        subgraph FRONTEND_CORE["Frontend Architecture"]
            ROUTER["React Router DOM v6\n(Role Guards & ProtectedRoute)"]
            AUTH_CTX["AuthContext\n(Session Sync & Profile State)"]
            AXIOS_CLIENT["Axios API Client\n(withCredentials: true, Error Interceptors)"]
            
            subgraph PAGES["Application Pages"]
                STUDENT_PAGES["Student Pages\n(Explore, Details, Team Reg, Invitations, MyPasses)"]
                ADMIN_PAGES["Admin Pages\n(Dashboard, Create/Edit Event, GateScanner, QueueLess)"]
            end
            
            QR_SCANNER["HTML5-QRCode Scanner\n(Webcam Capture & QR Decoder)"]
        end
    end

    STUDENT --> STUDENT_PAGES
    ADMIN --> ADMIN_PAGES
    STUDENT_PAGES --> ROUTER
    ADMIN_PAGES --> ROUTER
    ADMIN_PAGES --> QR_SCANNER
    ROUTER --> AUTH_CTX
    AUTH_CTX --> AXIOS_CLIENT
    QR_SCANNER --> AXIOS_CLIENT

    subgraph API_GATEWAY["API Gateway & Middleware Tier (Express 4.21)"]
        direction TB
        HELMET["Helmet.js\n(Security Headers)"]
        CORS_GUARD["CORS Guard\n(Origin: localhost:5173, Credentials: true)"]
        COOKIE_PARSER["Cookie Parser\n(HTTP-Only JWT Token Extraction)"]
        ZOD_VALIDATOR["Zod Validation Middleware\n(Strict Schema Enforcement)"]
        AUTH_GUARD["Authentication Guard\n(requireAuth, requireRole)"]
        GLOBAL_ERROR["Global Error Middleware\n(Normalized JSON Error Envelope)"]
    end

    AXIOS_CLIENT -- "HTTP / JSON (Cookies)" --> HELMET
    HELMET --> CORS_GUARD
    CORS_GUARD --> COOKIE_PARSER
    COOKIE_PARSER --> ZOD_VALIDATOR
    ZOD_VALIDATOR --> AUTH_GUARD

    subgraph APPLICATION_SERVICES["Application Layer (Controllers & Services)"]
        direction TB
        subgraph CONTROLLERS["Express Controllers"]
            AUTH_CTRL["auth.controller.js"]
            EVENT_CTRL["event.controller.js"]
            REG_CTRL["registration.controller.js"]
            INV_CTRL["invitation.controller.js"]
            PASS_CTRL["pass.controller.js"]
            CHECKIN_CTRL["checkin.controller.js"]
        end

        subgraph SERVICES["Domain Services Layer"]
            AUTH_SVC["auth.service.js\n(Bcrypt Hashing, JWT Sign/Verify)"]
            EVENT_SVC["event.service.js\n(Event CRUD, Gate Config, Search/Filter)"]
            REG_SVC["registration.service.js\n(Transactional Row Locking & Headcount)"]
            INV_SVC["invitation.service.js\n(Member Quorum & Automatic Capacity Release)"]
            PASS_SVC["pass.service.js\n(Blind Token Generation & Hash Storage)"]
            CHECKIN_SVC["checkin.service.js\n(Scan Idempotency, Window Check & Points)"]
        end

        subgraph CRYPTO_UTILS["Security & Utilities"]
            CRYPTO_HELPER["crypto.js\n(SHA-256 Hasher, Token Gen)"]
            QR_HELPER["qrcode\n(Dynamic High-Density Data URLs)"]
        end
    end

    AUTH_GUARD --> CONTROLLERS
    AUTH_CTRL --> AUTH_SVC
    EVENT_CTRL --> EVENT_SVC
    REG_CTRL --> REG_SVC
    INV_CTRL --> INV_SVC
    PASS_CTRL --> PASS_SVC
    CHECKIN_CTRL --> CHECKIN_SVC

    REG_SVC --> PASS_SVC
    INV_SVC --> PASS_SVC
    PASS_SVC --> CRYPTO_HELPER
    PASS_SVC --> QR_HELPER
    CHECKIN_SVC --> CRYPTO_HELPER

    subgraph PERSISTENCE_TIER["Persistence Tier (MySQL 8.x InnoDB)"]
        direction TB
        POOL["mysql2 Connection Pool\n(Promise API, Transaction Isolation)"]
        
        subgraph TABLES["Relational Schema (eventhub)"]
            TB_USERS[("users\n(Credentials, Role, Reward Points)")]
            TB_EVENTS[("events\n(Capacity, Dates, Individual/Team)")]
            TB_GATES[("gates\n(Entry Checkpoints, Active Flag)")]
            TB_REG[("registrations\n(Headcount, Status, Team Name)")]
            TB_TM[("team_members\n(User, Role, Status: invited/accepted)")]
            TB_PASSES[("passes\n(Pass Code, SHA-256 Token Hash, Status)")]
            TB_ATTENDANCE[("attendance_logs\n(Scan UUID, Gate ID, Timestamp)")]
            TB_LEDGER[("points_ledger\n(Immutable Points Audit, +50 Pts)")]
        end
    end

    SERVICES --> POOL
    POOL --> TABLES

    %% Error Handling Route
    AUTH_GUARD -.-> GLOBAL_ERROR
    CONTROLLERS -.-> GLOBAL_ERROR
    SERVICES -.-> GLOBAL_ERROR
    GLOBAL_ERROR -.-> AXIOS_CLIENT
```

---

## 2. Core Architectural Principles

### 2.1 Separation of Concerns
1. **Presentation (Client)**: React 18 Single-Page Application (SPA) driven by component modularity, stateful contexts (`AuthContext`), and role-based route guards (`ProtectedRoute`).
2. **Gateway (Server)**: Express 4.21 middleware chain providing input sanitation, cryptographic token extraction, role validation, and structured error responses.
3. **Domain Logic (Services)**: Autonomous business service layer completely decoupled from HTTP request/response objects, ensuring testability and transactional integrity.
4. **Relational Consistency (Database)**: MySQL 8 InnoDB enforcing ACID guarantees, foreign keys, unique constraints, and row-level locks.

### 2.2 Defense in Depth Security
- **No Stored Plaintext Credentials**: Passwords hashed with bcrypt (cost factor 12).
- **No Stored QR Secrets**: The raw QR secret token is generated cryptographically, delivered to the student, and immediately hashed using SHA-256. The database stores only the hash digest. Even a full database dump cannot forge valid check-in QR codes.
- **XSS-Resistant Sessions**: JWT tokens are placed strictly in HTTP-only, SameSite cookies. JavaScript running on the frontend cannot inspect or modify session credentials.
- **Replay Attack Defense**: Scanning uses client-generated `scanUuid` tokens. Duplicate scans fail gracefully without altering pass state or awarding multiple reward points.

---

## 3. Data Flow Walkthroughs

### 3.1 Authentication & Session Lifecycle

```mermaid
sequenceDiagram
    autonumber
    actor User as Student / Admin
    participant Client as Frontend SPA
    participant AuthCtrl as Auth Controller
    participant AuthSvc as Auth Service
    participant DB as MySQL DB

    User->>Client: Enters credentials (Email & Password)
    Client->>AuthCtrl: POST /api/v1/auth/login { email, password }
    AuthCtrl->>AuthSvc: loginUser(email, password)
    AuthSvc->>DB: SELECT * FROM users WHERE email = ?
    DB-->>AuthSvc: User record with password_hash
    AuthSvc->>AuthSvc: bcrypt.compare(password, password_hash)
    AuthSvc->>AuthSvc: jwt.sign({ id, email, role }, JWT_SECRET, { expiresIn: 86400 })
    AuthSvc-->>AuthCtrl: { user, token }
    AuthCtrl-->>Client: Set-Cookie: token=...; HttpOnly; SameSite=Lax; Max-Age=86400
    Client->>AuthCtrl: GET /api/v1/auth/me (Cookie automatically attached)
    AuthCtrl-->>Client: 200 OK { user: { id, fullName, role, rewardPoints } }
```

### 3.2 Concurrency-Safe Headcount Registration

```mermaid
sequenceDiagram
    autonumber
    actor Leader as Team Leader
    participant Client as Frontend SPA
    participant RegCtrl as Registration Controller
    participant RegSvc as Registration Service
    participant DB as MySQL DB

    Leader->>Client: Submits Team Registration (teamName, memberEmails=[B, C])
    Client->>RegCtrl: POST /api/v1/events/:id/register { teamName, memberEmails }
    RegCtrl->>RegSvc: registerForEvent(userId, eventId, payload)
    
    rect rgb(245, 240, 255)
        Note over RegSvc,DB: Explicit Database Transaction (ACID)
        RegSvc->>DB: START TRANSACTION
        RegSvc->>DB: SELECT max_capacity, current_registrations FROM events WHERE id = ? FOR UPDATE
        Note over DB: Event row is locked against concurrent registrations
        RegSvc->>RegSvc: Validate: current + requested_headcount (3) <= max_capacity
        RegSvc->>DB: UPDATE events SET current_registrations = current_registrations + 3 WHERE id = ?
        RegSvc->>DB: INSERT INTO registrations (event_id, leader_id, team_name, reserved_headcount, status)
        RegSvc->>DB: INSERT INTO team_members (leader=accepted, members=invited)
        RegSvc->>DB: COMMIT
    end
    
    RegSvc-->>RegCtrl: Registration record (status: pending_members)
    RegCtrl-->>Client: 201 Created { registration, members }
```

### 3.3 Team Invitation & Automatic Quorum Release

```mermaid
sequenceDiagram
    autonumber
    actor Member as Invited Teammate
    participant Client as Frontend SPA
    participant InvCtrl as Invitation Controller
    participant InvSvc as Invitation Service
    participant PassSvc as Pass Service
    participant DB as MySQL DB

    Member->>Client: Clicks "Accept" on Invitations Page
    Client->>InvCtrl: POST /api/v1/invitations/:id/accept
    InvCtrl->>InvSvc: acceptInvitation(invitationId, userId)
    
    rect rgb(240, 250, 240)
        Note over InvSvc,DB: Atomic Acceptance & Pass Issuance Transaction
        InvSvc->>DB: START TRANSACTION
        InvSvc->>DB: UPDATE team_members SET status = 'accepted' WHERE id = ?
        InvSvc->>DB: SELECT count(*) FROM team_members WHERE registration_id = ? AND status = 'accepted'
        
        alt All invited members accepted (Quorum Reached)
            InvSvc->>DB: UPDATE registrations SET status = 'confirmed' WHERE id = ?
            loop For each accepted team member (Leader + Members)
                InvSvc->>PassSvc: generatePass(registrationId, eventId, userId)
                PassSvc->>PassSvc: Generate rawToken (32 bytes) & SHA-256 hash
                PassSvc->>DB: INSERT INTO passes (pass_code, token_hash, status: 'active')
            end
        end
        InvSvc->>DB: COMMIT
    end
    
    InvSvc-->>InvCtrl: { success: true, teamStatus: 'confirmed' }
    InvCtrl-->>Client: 200 OK
```

If an invited member clicks **Decline**, the service checks if the remaining team size drops below `min_team_size`. If quorum is lost:
1. Team registration is updated to `cancelled`.
2. All team member records are marked `declined`.
3. The reserved headcount is atomically decremented on the event row: `UPDATE events SET current_registrations = current_registrations - reserved_headcount WHERE id = ?`.
4. The capacity is immediately freed for other students.

### 3.4 Cryptographic SmartPass Verification & Gate Check-In

```mermaid
sequenceDiagram
    autonumber
    actor Attendee as Student Attendee
    actor GateStaff as Gate Scanner Operator
    participant Scanner as HTML5-QRCode Scanner
    participant CheckinCtrl as Check-in Controller
    participant CheckinSvc as Check-in Service
    participant Crypto as Crypto Helper
    participant DB as MySQL DB

    Attendee->>GateStaff: Presents SmartPass QR (EVENTHUB:v1:PASS-CODE:RAW-TOKEN)
    GateStaff->>Scanner: Camera scans QR code
    Scanner->>CheckinCtrl: POST /api/v1/checkin/scan { passToken, gateId, scanUuid }
    CheckinCtrl->>CheckinSvc: processCheckin({ passToken, gateId, scanUuid, scannedBy })
    
    CheckinSvc->>Crypto: hashToken(rawToken) -> computedSha256
    
    rect rgb(245, 245, 255)
        Note over CheckinSvc,DB: Check-in Transaction
        CheckinSvc->>DB: START TRANSACTION
        CheckinSvc->>DB: SELECT * FROM passes WHERE pass_code = ? AND token_hash = ? FOR UPDATE
        CheckinSvc->>DB: Verify gate active & event match (gate.event_id == pass.event_id)
        CheckinSvc->>CheckinSvc: Verify checkin window (current_time >= start_time - 60 minutes)
        CheckinSvc->>DB: UPDATE passes SET status = 'checked_in', checked_in_at = NOW() WHERE id = ?
        CheckinSvc->>DB: INSERT INTO attendance_logs (pass_id, gate_id, scanned_by, scan_uuid)
        CheckinSvc->>DB: INSERT INTO points_ledger (user_id, event_id, pass_id, points_change: 50)
        CheckinSvc->>DB: UPDATE users SET reward_points = reward_points + 50 WHERE id = ?
        CheckinSvc->>DB: COMMIT
    end
    
    CheckinSvc-->>CheckinCtrl: { attendeeName, passCode, pointsAwarded: 50, checkedInAt }
    CheckinCtrl-->>Scanner: 200 OK (Green Check-in Confirmation)
```

---

## 4. Key Component Directory Mapping

| Layer | Files | Responsibilities |
|---|---|---|
| **Routing & Guards** | `client/src/App.jsx`<br>`client/src/components/common/ProtectedRoute.jsx` | Authenticated and role-based client routing |
| **HTTP Interceptor** | `client/src/api/client.js` | Base Axios client, cookie credentials, error payload unwrapping |
| **Scanner Interface** | `client/src/pages/admin/GateScannerPage.jsx` | `Html5QrcodeScanner` lifecycle, scan deduplication, audio/visual cues |
| **API Entrypoint** | `server/src/server.js`<br>`server/src/app.js` | Express middleware mount, port listener, graceful shutdown |
| **Auth Middleware** | `server/src/middleware/auth.middleware.js` | JWT cookie validation, user attachment (`req.user`), role enforcement |
| **Validation Layer** | `server/src/validators/*.validator.js`<br>`server/src/middleware/validate.middleware.js` | Zod schema validation for request params and bodies |
| **Service Layer** | `server/src/services/*.service.js` | Domain business logic, database transactions, row-level locks |
| **Crypto Utility** | `server/src/utils/crypto.js` | `crypto.randomBytes`, `crypto.createHash('sha256')` |
| **Database Pool** | `server/src/config/db.js` | `mysql2/promise` connection pool with query timeout and error logging |
