# EventHub — Version 2.2 (Implementation Ready)
## REST API Design Specification
**Intelligent Campus Event Management Ecosystem**

---

## 1. Global API Conventions & Standards

- **Base URL**: `/api/v1`
- **Payload Format**: `application/json` for all request and response bodies.
- **Authentication**: Stateless JSON Web Tokens (JWT) stored exclusively in an **HTTP-only cookie** named `access_token`.
  - `Authorization: Bearer` headers are entirely unsupported and rejected.
  - The Express backend extracts the session token directly via `req.cookies.access_token`.
- **CSRF Protection**:
  - The server issues a readable cookie `XSRF-TOKEN` upon authentication or via `GET /api/v1/auth/csrf`.
  - The React client (configured with `axios.defaults.withCredentials = true`) transmits this token in the `X-CSRF-Token` HTTP header on all mutating methods: `POST`, `PUT`, `PATCH`, `DELETE`.
- **Standardized Response Envelope**:

  *Success Response Envelope*:
  ```json
  {
    "success": true,
    "message": "Operation completed successfully",
    "data": {}
  }
  ```

  *Error Response Envelope*:
  ```json
  {
    "success": false,
    "error": {
      "code": "ERROR_CODE_STRING",
      "message": "Human-readable explanation of error",
      "details": []
    }
  }
  ```

- **HTTP Status Code Mapping**:
  - `200 OK`: Request succeeded.
  - `201 Created`: Resource successfully created.
  - `400 Bad Request`: Schema validation error, inactive event, or invalid pass state.
  - `401 Unauthorized`: Missing, expired, or invalid `access_token` cookie.
  - `403 Forbidden`: Insufficient role permissions, resource ownership mismatch, or CSRF validation failure.
  - `404 Not Found`: Target resource does not exist.
  - `409 Conflict`: Concurrency conflict, capacity full, duplicate participation, or duplicate check-in.
  - `422 Unprocessable Entity`: Syntactically valid JSON failing semantic business rules.
  - `500 Internal Server Error`: Unhandled transactional or database failure.

---

## 2. Authentication & Session Endpoints

### 2.1 CSRF Bootstrap Endpoint
- **Method**: `GET`
- **Endpoint**: `/api/v1/auth/csrf`
- **Access**: Public
- **Description**: Generates a cryptographic CSRF token and sets the `XSRF-TOKEN` cookie for the frontend client.
- **Response Headers**:
  ```http
  Set-Cookie: XSRF-TOKEN=c83f982d12...; Path=/; SameSite=Lax
  ```
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "message": "CSRF token initialized"
  }
  ```

### 2.2 Register New Student Account
- **Method**: `POST`
- **Endpoint**: `/api/v1/auth/register`
- **Access**: Public
- **Security Rule**: The server unconditionally assigns `role = 'student'`. Any `role` field in the request body is stripped/ignored to prevent privilege escalation.
- **Request Body**:
  ```json
  {
    "fullName": "Alex Chen",
    "email": "alex.chen@campus.edu",
    "password": "Password123!",
    "studentId": "CS-2024-0042",
    "department": "Computer Science",
    "interests": ["Artificial Intelligence", "Web Development"]
  }
  ```
- **Response Headers**:
  ```http
  Set-Cookie: access_token=eyJhbGciOiJIUzI1Ni...; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400
  Set-Cookie: XSRF-TOKEN=c83f982d12...; Path=/; SameSite=Lax
  ```
- **Response `201 Created`**:
  ```json
  {
    "success": true,
    "message": "User registered successfully",
    "data": {
      "user": {
        "id": 1,
        "fullName": "Alex Chen",
        "email": "alex.chen@campus.edu",
        "role": "student",
        "studentId": "CS-2024-0042",
        "department": "Computer Science"
      }
    }
  }
  ```

### 2.3 Login User
- **Method**: `POST`
- **Endpoint**: `/api/v1/auth/login`
- **Access**: Public
- **Request Body**:
  ```json
  {
    "email": "alex.chen@campus.edu",
    "password": "Password123!"
  }
  ```
- **Response Headers**:
  ```http
  Set-Cookie: access_token=eyJhbGciOiJIUzI1Ni...; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400
  Set-Cookie: XSRF-TOKEN=c83f982d12...; Path=/; SameSite=Lax
  ```
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "message": "Login successful",
    "data": {
      "user": {
        "id": 1,
        "fullName": "Alex Chen",
        "email": "alex.chen@campus.edu",
        "role": "student",
        "studentId": "CS-2024-0042",
        "department": "Computer Science"
      }
    }
  }
  ```

### 2.4 Logout User
- **Method**: `POST`
- **Endpoint**: `/api/v1/auth/logout`
- **Access**: Authenticated
- **Headers**: `X-CSRF-Token: <token>`
- **Response Headers**:
  ```http
  Set-Cookie: access_token=; Path=/; HttpOnly; Max-Age=0
  Set-Cookie: XSRF-TOKEN=; Path=/; Max-Age=0
  ```
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "message": "Session terminated successfully"
  }
  ```

### 2.5 Get Current User Profile (`/me`)
- **Method**: `GET`
- **Endpoint**: `/api/v1/auth/me`
- **Access**: Authenticated (Student / Admin)
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": {
      "id": 1,
      "fullName": "Alex Chen",
      "email": "alex.chen@campus.edu",
      "role": "student",
      "studentId": "CS-2024-0042",
      "department": "Computer Science",
      "rewardPoints": 150
    }
  }
  ```

---

## 3. Event & Gate Management Endpoints

### 3.1 List Events (Search & Filter)
- **Method**: `GET`
- **Endpoint**: `/api/v1/events`
- **Access**: Public / Authenticated
- **Query Parameters**: `search`, `category`, `status`, `page`, `limit`
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": {
      "events": [
        {
          "id": 14,
          "title": "HackCampus 2026",
          "description": "36-hour flagship annual campus hackathon.",
          "category": "Hackathon",
          "venue": "Main University Auditorium",
          "startTime": "2026-11-28T09:00:00.000Z",
          "endTime": "2026-11-29T21:00:00.000Z",
          "registrationDeadline": "2026-11-27T23:59:59.000Z",
          "maxCapacity": 250,
          "currentRegistrations": 180,
          "availableSeats": 70,
          "registrationType": "team",
          "minTeamSize": 2,
          "maxTeamSize": 4,
          "status": "published",
          "bannerUrl": "https://images.campus.edu/events/hackcampus.jpg",
          "tags": ["Coding", "Artificial Intelligence"]
        }
      ],
      "pagination": {
        "page": 1,
        "limit": 10,
        "total": 1,
        "totalPages": 1
      }
    }
  }
  ```

### 3.2 Get Event Details
- **Method**: `GET`
- **Endpoint**: `/api/v1/events/:id`
- **Access**: Public / Authenticated
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": {
      "id": 14,
      "title": "HackCampus 2026",
      "description": "36-hour flagship annual campus hackathon.",
      "category": "Hackathon",
      "venue": "Main University Auditorium",
      "startTime": "2026-11-28T09:00:00.000Z",
      "endTime": "2026-11-29T21:00:00.000Z",
      "registrationDeadline": "2026-11-27T23:59:59.000Z",
      "maxCapacity": 250,
      "currentRegistrations": 180,
      "availableSeats": 70,
      "registrationType": "team",
      "minTeamSize": 2,
      "maxTeamSize": 4,
      "status": "published",
      "bannerUrl": "https://images.campus.edu/events/hackcampus.jpg",
      "tags": ["Coding", "Artificial Intelligence"],
      "gates": [
        {
          "id": 1,
          "gateName": "North Gate",
          "locationDescription": "Facing Academic Block",
          "isActive": true
        },
        {
          "id": 2,
          "gateName": "South Auditorium Gate",
          "locationDescription": "Rear Parking Side",
          "isActive": true
        }
      ]
    }
  }
  ```

### 3.3 Create Event
- **Method**: `POST`
- **Endpoint**: `/api/v1/events`
- **Access**: Admin only
- **Headers**: `X-CSRF-Token: <token>`
- **Request Body**:
  ```json
  {
    "title": "HackCampus 2026",
    "description": "Annual 36-hour hackathon.",
    "category": "Hackathon",
    "venue": "Main University Auditorium",
    "startTime": "2026-11-28T09:00:00.000Z",
    "endTime": "2026-11-29T21:00:00.000Z",
    "registrationDeadline": "2026-11-27T23:59:59.000Z",
    "maxCapacity": 250,
    "registrationType": "team",
    "minTeamSize": 2,
    "maxTeamSize": 4,
    "tags": ["Coding", "Artificial Intelligence"],
    "gates": [
      { "gateName": "North Gate", "locationDescription": "Facing Academic Block" },
      { "gateName": "South Auditorium Gate", "locationDescription": "Rear Parking Side" }
    ]
  }
  ```
- **Response `201 Created`**:
  ```json
  {
    "success": true,
    "message": "Event created successfully",
    "data": {
      "id": 14,
      "title": "HackCampus 2026",
      "status": "published"
    }
  }
  ```

### 3.4 Add Gate to Event
- **Method**: `POST`
- **Endpoint**: `/api/v1/events/:id/gates`
- **Access**: Admin only
- **Headers**: `X-CSRF-Token: <token>`
- **Request Body**:
  ```json
  {
    "gateName": "East VIP Gate",
    "locationDescription": "Direct entrance to Auditorium Stage"
  }
  ```
- **Response `201 Created`**:
  ```json
  {
    "success": true,
    "message": "Gate added successfully",
    "data": {
      "id": 3,
      "eventId": 14,
      "gateName": "East VIP Gate",
      "locationDescription": "Direct entrance to Auditorium Stage",
      "isActive": true
    }
  }
  ```

### 3.5 List Gates for Event
- **Method**: `GET`
- **Endpoint**: `/api/v1/events/:id/gates`
- **Access**: Authenticated (Student / Admin)
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": [
      {
        "id": 1,
        "gateName": "North Gate",
        "locationDescription": "Facing Academic Block",
        "isActive": true
      },
      {
        "id": 2,
        "gateName": "South Auditorium Gate",
        "locationDescription": "Rear Parking Side",
        "isActive": true
      }
    ]
  }
  ```

### 3.6 Update Gate Status / Information
- **Method**: `PUT`
- **Endpoint**: `/api/v1/events/:id/gates/:gateId`
- **Access**: Admin only
- **Headers**: `X-CSRF-Token: <token>`
- **Request Body**:
  ```json
  {
    "gateName": "North Main Gate",
    "locationDescription": "Facing Academic Block A",
    "isActive": true
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "message": "Gate updated successfully",
    "data": {
      "id": 1,
      "gateName": "North Main Gate",
      "isActive": true
    }
  }
  ```

---

## 4. Registration & Team Invitation Endpoints

### 4.1 Register for Event (Individual or Team)
- **Method**: `POST`
- **Endpoint**: `/api/v1/events/:id/register`
- **Access**: Authenticated Student
- **Headers**: `X-CSRF-Token: <token>`

*Individual Registration Request Body*:
```json
{
  "registrationType": "individual"
}
```

*Team Registration Request Body*:
```json
{
  "registrationType": "team",
  "teamName": "CyberKnights",
  "memberEmails": [
    "sarah.c@campus.edu",
    "john.d@campus.edu"
  ]
}
```

*Individual Registration Response `201 Created`*:
```json
{
  "success": true,
  "message": "Registration confirmed. Your personal SmartPass has been issued.",
  "data": {
    "registrationId": 104,
    "status": "confirmed",
    "pass": {
      "passCode": "PASS-2026-8941",
      "qrPayload": "EVPASS:v1:PASS-2026-8941:f3a9b809832810a9cde47812bc897120aef12",
      "qrDataUrl": "data:image/png;base64,iVBORw0KGgo..."
    }
  }
}
```

*Team Registration Response `201 Created`*:
*(Note: Registration status is `pending_members`. No passes issued yet; team leader receives invitation tracking only)*
```json
{
  "success": true,
  "message": "Team registration initiated. Invitations dispatched to team members.",
  "data": {
    "registrationId": 105,
    "teamName": "CyberKnights",
    "status": "pending_members",
    "reservedHeadcount": 3,
    "invitations": [
      { "memberEmail": "sarah.c@campus.edu", "status": "invited" },
      { "memberEmail": "john.d@campus.edu", "status": "invited" }
    ]
  }
}
```

*Error Response `409 Conflict` (Duplicate Participation)*:
```json
{
  "success": false,
  "error": {
    "code": "DUPLICATE_PARTICIPATION",
    "message": "Invitee sarah.c@campus.edu is already registered or invited to another team for this event."
  }
}
```

### 4.2 List Pending Team Invitations for Student
- **Method**: `GET`
- **Endpoint**: `/api/v1/invitations`
- **Access**: Authenticated Student
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": [
      {
        "invitationId": 8,
        "teamName": "CyberKnights",
        "leaderName": "Alex Chen",
        "event": {
          "id": 14,
          "title": "HackCampus 2026",
          "venue": "Main University Auditorium",
          "startTime": "2026-11-28T09:00:00.000Z"
        },
        "invitedAt": "2026-11-25T14:30:00.000Z"
      }
    ]
  }
  ```

### 4.3 Accept Team Invitation
- **Method**: `POST`
- **Endpoint**: `/api/v1/invitations/:id/accept`
- **Access**: Authenticated Student (Must match `user_id` of invitation)
- **Headers**: `X-CSRF-Token: <token>`
- **Response `200 OK`**:
  *(Note: Response contains ONLY the accepting student's own pass)*
  ```json
  {
    "success": true,
    "message": "Invitation accepted. Team registration is now confirmed and your individual SmartPass has been issued.",
    "data": {
      "invitationId": 8,
      "teamRegistrationStatus": "confirmed",
      "myPass": {
        "passCode": "PASS-2026-8942",
        "qrPayload": "EVPASS:v1:PASS-2026-8942:78b021a81239c091e8471928019ab912cd719",
        "qrDataUrl": "data:image/png;base64,iVBORw0KGgo..."
      }
    }
  }
  ```

### 4.4 Decline Team Invitation
- **Method**: `POST`
- **Endpoint**: `/api/v1/invitations/:id/decline`
- **Access**: Authenticated Student
- **Headers**: `X-CSRF-Token: <token>`
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "message": "Invitation declined."
  }
  ```

---

## 5. SmartPass Endpoints

### 5.1 Get Logged-In Student's Passes
- **Method**: `GET`
- **Endpoint**: `/api/v1/passes/my-passes`
- **Access**: Authenticated Student
- **Security Rule**: Returns strictly the authenticated student's personal passes (`WHERE user_id = req.user.id`). Team leaders cannot view member passes. `token_hash` is never exposed.
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": [
      {
        "passId": 82,
        "passCode": "PASS-2026-8941",
        "status": "active",
        "qrPayload": "EVPASS:v1:PASS-2026-8941:f3a9b809832810a9cde47812bc897120aef12",
        "qrDataUrl": "data:image/png;base64,iVBORw0KGgo...",
        "event": {
          "id": 14,
          "title": "HackCampus 2026",
          "venue": "Main University Auditorium",
          "startTime": "2026-11-28T09:00:00.000Z",
          "endTime": "2026-11-29T21:00:00.000Z"
        },
        "issuedAt": "2026-11-25T15:00:00.000Z"
      }
    ]
  }
  ```

### 5.2 Get Individual Pass by ID
- **Method**: `GET`
- **Endpoint**: `/api/v1/passes/:id`
- **Access**: Authenticated Student (Pass Owner) / Admin
- **Security Rule**: Verifies `pass.user_id === req.user.id` or `req.user.role === 'admin'`. Unauthorized access returns `403 Forbidden`.
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": {
      "passId": 82,
      "passCode": "PASS-2026-8941",
      "status": "active",
      "qrPayload": "EVPASS:v1:PASS-2026-8941:f3a9b809832810a9cde47812bc897120aef12",
      "qrDataUrl": "data:image/png;base64,iVBORw0KGgo...",
      "event": {
        "id": 14,
        "title": "HackCampus 2026",
        "venue": "Main University Auditorium",
        "startTime": "2026-11-28T09:00:00.000Z"
      }
    }
  }
  ```

---

## 6. Entry Check-In & Verification Endpoints

### 6.1 Scan & Redeem SmartPass (Gate Check-In)
- **Method**: `POST`
- **Endpoint**: `/api/v1/checkin/scan`
- **Access**: Admin / Staff only (Requires event authorization)
- **Headers**: `X-CSRF-Token: <token>`
- **Request Body**:
  ```json
  {
    "eventId": 14,
    "gateId": 1,
    "scanUuid": "b3e94a82-1234-4567-89ab-cdef01234567",
    "qrPayload": "EVPASS:v1:PASS-2026-8941:f3a9b809832810a9cde47812bc897120aef12"
  }
  ```
- **Response `200 OK` (Approved)**:
  ```json
  {
    "success": true,
    "message": "Entry Approved",
    "data": {
      "status": "APPROVED",
      "attendee": {
        "name": "Alex Chen",
        "studentId": "CS-2024-0042",
        "department": "Computer Science"
      },
      "teamName": "CyberKnights",
      "eventTitle": "HackCampus 2026",
      "gateName": "North Gate",
      "checkedInAt": "2026-11-28T09:05:14.000Z"
    }
  }
  ```
- **Response `400 Bad Request` (Gate Mismatch)**:
  ```json
  {
    "success": false,
    "error": {
      "code": "GATE_MISMATCH",
      "message": "Gate 1 does not belong to the event associated with this pass."
    }
  }
  ```
- **Response `400 Bad Request` (Check-In Window Closed / Not Open)**:
  ```json
  {
    "success": false,
    "error": {
      "code": "WINDOW_CLOSED",
      "message": "Check-in is only permitted from 60 minutes prior to event start until event conclusion."
    }
  }
  ```
- **Response `409 Conflict` (Duplicate Check-in)**:
  ```json
  {
    "success": false,
    "error": {
      "code": "DUPLICATE_CHECKIN",
      "message": "ALREADY SCANNED: Pass was previously checked in at 09:01 AM at North Gate."
    }
  }
  ```

### 6.2 Get Ed25519 Public Verification Key
- **Method**: `GET`
- **Endpoint**: `/api/v1/checkin/public-key`
- **Access**: Admin / Staff only
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": {
      "algorithm": "Ed25519",
      "publicKey": "MCowBQYDK2VwAyEA0d...[Base64 Encoded Ed25519 SPKI Public Key]"
    }
  }
  ```

### 6.3 Download Signed Offline Manifest
- **Method**: `GET`
- **Endpoint**: `/api/v1/checkin/manifest/:eventId`
- **Access**: Admin / Staff only
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": {
      "manifest": {
        "manifestVersion": "1.0",
        "eventId": 14,
        "eventTitle": "HackCampus 2026",
        "generatedAt": "2026-11-28T08:00:00.000Z",
        "expiresAt": "2026-11-29T22:00:00.000Z",
        "passes": [
          {
            "passCode": "PASS-2026-8941",
            "tokenHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            "studentName": "Alex Chen",
            "studentId": "CS-2024-0042"
          }
        ]
      },
      "ed25519Signature": "MC4CAQACBQDK2VwA...[Base64 Encoded Ed25519 Signature]"
    }
  }
  ```

### 6.4 Synchronize Offline Scans (Idempotent Batch Sync)
- **Method**: `POST`
- **Endpoint**: `/api/v1/checkin/sync-offline`
- **Access**: Admin / Staff only
- **Headers**: `X-CSRF-Token: <token>`
- **Request Body**:
  ```json
  {
    "eventId": 14,
    "gateId": 1,
    "scans": [
      {
        "scanUuid": "c47f9812-7812-4019-9128-871239120391",
        "passCode": "PASS-2026-8941",
        "rawToken": "f3a9b809832810a9cde47812bc897120aef12",
        "scannedAt": "2026-11-28T09:15:00.000Z"
      }
    ]
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": {
      "totalSubmitted": 1,
      "synced": 1,
      "duplicatesRejected": 0,
      "anomaliesLogged": 0
    }
  }
  ```

---

## 7. QueueLess Gate Analytics Endpoints

### 7.1 Get Live Gate Scan Throughput & Activity Indicators
- **Method**: `GET`
- **Endpoint**: `/api/v1/events/:id/queueless`
- **Access**: Public / Authenticated
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": {
      "eventId": 14,
      "disclaimer": "Gate activity indicators and recommendations are calculated strictly from check-in scan throughput at each terminal over the past 10 minutes. They do not measure physical queue lengths outside the venue.",
      "recommendedGateId": 2,
      "recommendedGateName": "South Auditorium Gate",
      "gates": [
        {
          "gateId": 1,
          "gateName": "North Gate",
          "scansInLast10Min": 45,
          "throughputScansPerMin": 4.5,
          "activityLevel": "Steady Flow",
          "indicatorColor": "yellow"
        },
        {
          "gateId": 2,
          "gateName": "South Auditorium Gate",
          "scansInLast10Min": 6,
          "throughputScansPerMin": 0.6,
          "activityLevel": "Low Activity (Fast Entry)",
          "indicatorColor": "green"
        }
      ]
    }
  }
  ```

---

## 8. CampusPass & EventIQ Endpoints

### 8.1 Get Student CampusPass Profile & Points Ledger
- **Method**: `GET`
- **Endpoint**: `/api/v1/campuspass/profile`
- **Access**: Authenticated Student
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": {
      "totalRewardPoints": 150,
      "eventsAttendedCount": 3,
      "badges": [
        {
          "id": 1,
          "title": "First Step",
          "description": "Attended your first university event",
          "iconName": "Award",
          "awardedAt": "2026-10-15T10:00:00.000Z"
        }
      ],
      "ledger": [
        {
          "id": 12,
          "eventTitle": "HackCampus 2026",
          "pointsChange": 50,
          "reason": "EVENT_CHECKIN",
          "createdAt": "2026-11-28T09:05:14.000Z"
        }
      ]
    }
  }
  ```

### 8.2 Get Personalized Event Recommendations (EventIQ)
- **Method**: `GET`
- **Endpoint**: `/api/v1/recommendations`
- **Access**: Authenticated Student
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": [
      {
        "event": {
          "id": 14,
          "title": "HackCampus 2026",
          "category": "Hackathon",
          "startTime": "2026-11-28T09:00:00.000Z"
        },
        "matchScore": 85,
        "recommendationReason": "Matched your declared interest in Artificial Intelligence and previous participation in Hackathons."
      }
    ]
  }
  ```

---

## 9. Event Health Monitor (Admin Analytics)

### 9.1 Get Event Operational Health Dashboard
- **Method**: `GET`
- **Endpoint**: `/api/v1/admin/events/:id/health`
- **Access**: Admin only
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": {
      "eventId": 14,
      "title": "HackCampus 2026",
      "capacityMetrics": {
        "maxCapacity": 250,
        "totalRegistrations": 180,
        "capacityFilledPercentage": 72.0,
        "availableSeats": 70
      },
      "attendanceMetrics": {
        "totalCheckedIn": 120,
        "attendanceRatePercentage": 66.7,
        "pendingAttendees": 60
      },
      "gateDistribution": [
        { "gateName": "North Gate", "checkins": 85, "percentage": 70.8 },
        { "gateName": "South Auditorium Gate", "checkins": 35, "percentage": 29.2 }
      ],
      "alerts": [
        {
          "severity": "WARNING",
          "title": "Throughput Imbalance",
          "message": "North Gate is handling 70.8% of incoming check-ins. Suggest attendees use South Auditorium Gate."
        }
      ]
    }
  }
  ```
