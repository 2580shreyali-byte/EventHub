# EventHub Database Schema Documentation

> High-integrity relational schema design for MySQL 8.x (InnoDB engine) compliant with ACID transaction standards.

---

## Schema Overview

The EventHub database schema is defined in [`database/schema.sql`](file:///Users/shreyali/EventHub/database/schema.sql) and enforces strict relational integrity, foreign key constraints (`ON DELETE RESTRICT`), unique constraints, and optimized composite indexes for high-frequency queries.

### Default Character Set & Collation
- **Character Set**: `utf8mb4`
- **Collation**: `utf8mb4_unicode_ci`
- **Storage Engine**: `InnoDB`

---

## Entity Relationship Summary

```
 users (1) ──────────< events (N) [created_by]
   │                      │
   │                      ├──────────< gates (N) [event_id]
   │                      │
   │ (leader_id)          ├──────────< registrations (N) [event_id]
   ├───────────────< registrations        │
   │                                      │
   │ (user_id)                            ├──────────< team_members (N) [registration_id]
   ├───────────────< team_members         │
   │                                      │
   │ (user_id)                            ├──────────< passes (N) [registration_id]
   ├───────────────< passes <─────────────┘
   │                   │
   │ (scanned_by)      ├──────────< attendance_logs (1:1) [pass_id]
   ├───────────────< attendance_logs
   │                   │
   │ (user_id)         ├──────────< points_ledger (1:1) [pass_id]
   └───────────────< points_ledger
```

---

## Detailed Table Reference

### 1. `users`
Stores student and administrator credentials, profile metadata, and gamification points.
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `INT UNSIGNED` | `PRIMARY KEY AUTO_INCREMENT` | Internal user ID |
| `full_name` | `VARCHAR(100)` | `NOT NULL` | User full name |
| `email` | `VARCHAR(150)` | `NOT NULL, UNIQUE` | Academic email address |
| `password_hash` | `VARCHAR(255)` | `NOT NULL` | Bcrypt password hash |
| `role` | `ENUM('student', 'admin')` | `NOT NULL DEFAULT 'student'` | Access control role |
| `student_id` | `VARCHAR(50)` | `NOT NULL, UNIQUE` | Unique campus ID number |
| `department` | `VARCHAR(100)` | `NOT NULL` | Academic department / major |
| `reward_points` | `INT UNSIGNED` | `NOT NULL DEFAULT 0` | Accumulated CampusPass points |
| `created_at` | `DATETIME` | `NOT NULL DEFAULT CURRENT_TIMESTAMP`| Account creation timestamp |
| `updated_at` | `DATETIME` | `NOT NULL ON UPDATE CURRENT_TIMESTAMP` | Last profile update |

---

### 2. `events`
Manages campus event configurations, capacity, and scheduling.
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `INT UNSIGNED` | `PRIMARY KEY AUTO_INCREMENT` | Unique event ID |
| `title` | `VARCHAR(200)` | `NOT NULL` | Event title |
| `description` | `TEXT` | `NOT NULL` | Detailed description |
| `category` | `VARCHAR(50)` | `NOT NULL` | Category tag (e.g., Tech, Sports) |
| `venue` | `VARCHAR(150)` | `NOT NULL` | Physical location on campus |
| `start_time` | `DATETIME` | `NOT NULL` | Event start date and time |
| `end_time` | `DATETIME` | `NOT NULL` | Event end date and time |
| `registration_deadline` | `DATETIME` | `NOT NULL` | Registration cutoff timestamp |
| `max_capacity` | `INT UNSIGNED` | `NOT NULL` | Total seats available |
| `current_registrations` | `INT UNSIGNED` | `NOT NULL DEFAULT 0` | Currently reserved seats |
| `registration_type` | `ENUM('individual', 'team')` | `NOT NULL DEFAULT 'individual'` | Registration mode |
| `min_team_size` | `INT UNSIGNED` | `NOT NULL DEFAULT 1` | Minimum allowed team size |
| `max_team_size` | `INT UNSIGNED` | `NOT NULL DEFAULT 1` | Maximum allowed team size |
| `status` | `ENUM('draft', 'published', 'ongoing', 'completed', 'cancelled')` | `NOT NULL DEFAULT 'published'` | Event status |
| `banner_url` | `VARCHAR(500)` | `DEFAULT NULL` | Optional event banner image URL |
| `created_by` | `INT UNSIGNED` | `NOT NULL, FK -> users(id)` | Admin creator user ID |

---

### 3. `gates`
Defines physical entry checkpoints associated with an event.
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `INT UNSIGNED` | `PRIMARY KEY AUTO_INCREMENT` | Gate identifier |
| `event_id` | `INT UNSIGNED` | `NOT NULL, FK -> events(id)` | Parent event |
| `gate_name` | `VARCHAR(100)` | `NOT NULL` | Human-readable name (e.g., Gate A) |
| `location_description` | `VARCHAR(255)` | `DEFAULT NULL` | Location instructions |
| `is_active` | `BOOLEAN` | `NOT NULL DEFAULT TRUE` | Active/inactive check-in toggle |

---

### 4. `registrations`
Represents an individual or team booking instance.
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `INT UNSIGNED` | `PRIMARY KEY AUTO_INCREMENT` | Registration ID |
| `event_id` | `INT UNSIGNED` | `NOT NULL, FK -> events(id)` | Target event |
| `leader_id` | `INT UNSIGNED` | `NOT NULL, FK -> users(id)` | User who submitted registration |
| `team_name` | `VARCHAR(100)` | `DEFAULT NULL` | Team name (for team events) |
| `registration_type` | `ENUM('individual', 'team')` | `NOT NULL DEFAULT 'individual'` | Registration type |
| `reserved_headcount` | `INT UNSIGNED` | `NOT NULL DEFAULT 1` | Total seats reserved |
| `status` | `ENUM('pending_members', 'confirmed', 'cancelled')` | `NOT NULL DEFAULT 'confirmed'` | Booking status |

---

### 5. `team_members`
Tracks individual member statuses for team registrations.
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `INT UNSIGNED` | `PRIMARY KEY AUTO_INCREMENT` | Team member record ID |
| `registration_id` | `INT UNSIGNED` | `NOT NULL, FK -> registrations(id)`| Parent registration |
| `event_id` | `INT UNSIGNED` | `NOT NULL, FK -> events(id)` | Event reference |
| `user_id` | `INT UNSIGNED` | `NOT NULL, FK -> users(id)` | Member user ID |
| `role` | `ENUM('leader', 'member')` | `NOT NULL DEFAULT 'member'` | Team role |
| `status` | `ENUM('invited', 'accepted', 'declined')` | `NOT NULL DEFAULT 'invited'` | Invitation state |
| `invited_at` | `DATETIME` | `NOT NULL DEFAULT CURRENT_TIMESTAMP`| Invitation dispatch time |
| `responded_at` | `DATETIME` | `DEFAULT NULL` | Member response timestamp |

**Unique Constraint**: `UNIQUE KEY uq_event_user_participation (event_id, user_id)` guarantees a student cannot be part of multiple teams for the same event.

---

### 6. `passes`
Stores verifiable SmartPass records.
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `INT UNSIGNED` | `PRIMARY KEY AUTO_INCREMENT` | Pass ID |
| `registration_id` | `INT UNSIGNED` | `NOT NULL, FK -> registrations(id)`| Parent booking |
| `event_id` | `INT UNSIGNED` | `NOT NULL, FK -> events(id)` | Associated event |
| `user_id` | `INT UNSIGNED` | `NOT NULL, FK -> users(id)` | Pass holder user ID |
| `pass_code` | `VARCHAR(64)` | `NOT NULL, UNIQUE` | Public pass identifier |
| `token_hash` | `VARCHAR(64)` | `NOT NULL, UNIQUE` | SHA-256 hash of raw secret |
| `status` | `ENUM('active', 'checked_in', 'revoked', 'expired')` | `NOT NULL DEFAULT 'active'` | Pass lifecycle state |
| `issued_at` | `DATETIME` | `NOT NULL DEFAULT CURRENT_TIMESTAMP`| Pass issuance time |
| `checked_in_at` | `DATETIME` | `DEFAULT NULL` | Physical admission time |

**Unique Constraint**: `UNIQUE KEY uq_event_user_pass (event_id, user_id)` guarantees one active pass per user per event.

---

### 7. `attendance_logs`
Audit record of successful gate admissions.
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `INT UNSIGNED` | `PRIMARY KEY AUTO_INCREMENT` | Log ID |
| `pass_id` | `INT UNSIGNED` | `NOT NULL, UNIQUE, FK -> passes(id)`| Checked-in pass |
| `gate_id` | `INT UNSIGNED` | `NOT NULL, FK -> gates(id)` | Ingress checkpoint |
| `scanned_by` | `INT UNSIGNED` | `NOT NULL, FK -> users(id)` | Staff member who scanned |
| `checkin_mode` | `ENUM('online', 'offline_synced')` | `NOT NULL DEFAULT 'online'` | Verification mode |
| `scan_uuid` | `VARCHAR(36)` | `NOT NULL, UNIQUE` | Client-generated idempotent UUID |
| `scanned_at` | `DATETIME` | `NOT NULL DEFAULT CURRENT_TIMESTAMP`| Admission timestamp |

---

### 8. `points_ledger`
Immutable points transaction ledger.
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `INT UNSIGNED` | `PRIMARY KEY AUTO_INCREMENT` | Ledger ID |
| `user_id` | `INT UNSIGNED` | `NOT NULL, FK -> users(id)` | Recipient user |
| `event_id` | `INT UNSIGNED` | `NOT NULL, FK -> events(id)` | Event reference |
| `pass_id` | `INT UNSIGNED` | `NOT NULL, FK -> passes(id)` | Triggering pass |
| `points_change` | `INT` | `NOT NULL DEFAULT 50` | Awarded points (+50) |
| `reason` | `VARCHAR(50)` | `NOT NULL DEFAULT 'EVENT_CHECKIN'` | Reason code |
| `created_at` | `DATETIME` | `NOT NULL DEFAULT CURRENT_TIMESTAMP`| Credit timestamp |

**Unique Constraint**: `UNIQUE KEY uq_pass_reason (pass_id, reason)` strictly prevents duplicate reward awards on the same pass.

---

## Database Initialization

To create or reset the database:

```bash
mysql -u root -p < database/schema.sql
```
