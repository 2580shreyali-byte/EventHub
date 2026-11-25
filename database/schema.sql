-- EventHub Production Database Schema (MySQL 8.x / InnoDB)
-- Compliant with Architecture v2.2 Specifications

CREATE DATABASE IF NOT EXISTS `eventhub`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE `eventhub`;

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `full_name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(150) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` ENUM('student', 'admin') NOT NULL DEFAULT 'student',
  `student_id` VARCHAR(50) NOT NULL,
  `department` VARCHAR(100) NOT NULL,
  `reward_points` INT UNSIGNED NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`),
  UNIQUE KEY `uq_users_student_id` (`student_id`),
  INDEX `idx_users_role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. EVENTS TABLE
CREATE TABLE IF NOT EXISTS `events` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `title` VARCHAR(200) NOT NULL,
  `description` TEXT NOT NULL,
  `category` VARCHAR(50) NOT NULL,
  `venue` VARCHAR(150) NOT NULL,
  `start_time` DATETIME NOT NULL,
  `end_time` DATETIME NOT NULL,
  `registration_deadline` DATETIME NOT NULL,
  `max_capacity` INT UNSIGNED NOT NULL,
  `current_registrations` INT UNSIGNED NOT NULL DEFAULT 0,
  `registration_type` ENUM('individual', 'team') NOT NULL DEFAULT 'individual',
  `min_team_size` INT UNSIGNED NOT NULL DEFAULT 1,
  `max_team_size` INT UNSIGNED NOT NULL DEFAULT 1,
  `status` ENUM('draft', 'published', 'ongoing', 'completed', 'cancelled') NOT NULL DEFAULT 'published',
  `banner_url` VARCHAR(500) DEFAULT NULL,
  `created_by` INT UNSIGNED NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_events_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  INDEX `idx_events_status` (`status`),
  INDEX `idx_events_start_time` (`start_time`),
  INDEX `idx_events_category` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. GATES TABLE
CREATE TABLE IF NOT EXISTS `gates` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `event_id` INT UNSIGNED NOT NULL,
  `gate_name` VARCHAR(100) NOT NULL,
  `location_description` VARCHAR(255) DEFAULT NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_gates_event_id` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE RESTRICT,
  INDEX `idx_gates_event_active` (`event_id`, `is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. REGISTRATIONS TABLE
CREATE TABLE IF NOT EXISTS `registrations` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `event_id` INT UNSIGNED NOT NULL,
  `leader_id` INT UNSIGNED NOT NULL,
  `team_name` VARCHAR(100) DEFAULT NULL,
  `registration_type` ENUM('individual', 'team') NOT NULL DEFAULT 'individual',
  `reserved_headcount` INT UNSIGNED NOT NULL DEFAULT 1,
  `status` ENUM('pending_members', 'confirmed', 'cancelled') NOT NULL DEFAULT 'confirmed',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_registrations_event_id` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_registrations_leader_id` FOREIGN KEY (`leader_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  INDEX `idx_registrations_event_leader` (`event_id`, `leader_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. TEAM_MEMBERS TABLE
CREATE TABLE IF NOT EXISTS `team_members` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `registration_id` INT UNSIGNED NOT NULL,
  `event_id` INT UNSIGNED NOT NULL,
  `user_id` INT UNSIGNED NOT NULL,
  `role` ENUM('leader', 'member') NOT NULL DEFAULT 'member',
  `status` ENUM('invited', 'accepted', 'declined') NOT NULL DEFAULT 'invited',
  `invited_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `responded_at` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_event_user_participation` (`event_id`, `user_id`),
  CONSTRAINT `fk_tm_registration_id` FOREIGN KEY (`registration_id`) REFERENCES `registrations` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_tm_event_id` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_tm_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  INDEX `idx_tm_user_status` (`user_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. PASSES TABLE (SmartPass)
CREATE TABLE IF NOT EXISTS `passes` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `registration_id` INT UNSIGNED NOT NULL,
  `event_id` INT UNSIGNED NOT NULL,
  `user_id` INT UNSIGNED NOT NULL,
  `pass_code` VARCHAR(64) NOT NULL,
  `token_hash` VARCHAR(64) NOT NULL,
  `status` ENUM('active', 'checked_in', 'revoked', 'expired') NOT NULL DEFAULT 'active',
  `issued_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `checked_in_at` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_passes_pass_code` (`pass_code`),
  UNIQUE KEY `uq_passes_token_hash` (`token_hash`),
  UNIQUE KEY `uq_event_user_pass` (`event_id`, `user_id`),
  CONSTRAINT `fk_passes_registration_id` FOREIGN KEY (`registration_id`) REFERENCES `registrations` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_passes_event_id` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_passes_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  INDEX `idx_passes_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. ATTENDANCE_LOGS TABLE
CREATE TABLE IF NOT EXISTS `attendance_logs` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `pass_id` INT UNSIGNED NOT NULL,
  `gate_id` INT UNSIGNED NOT NULL,
  `scanned_by` INT UNSIGNED NOT NULL,
  `checkin_mode` ENUM('online', 'offline_synced') NOT NULL DEFAULT 'online',
  `scan_uuid` VARCHAR(36) NOT NULL,
  `scanned_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `synced_at` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_attendance_pass` (`pass_id`),
  UNIQUE KEY `uq_attendance_scan_uuid` (`scan_uuid`),
  CONSTRAINT `fk_attendance_pass_id` FOREIGN KEY (`pass_id`) REFERENCES `passes` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_attendance_gate_id` FOREIGN KEY (`gate_id`) REFERENCES `gates` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_attendance_scanned_by` FOREIGN KEY (`scanned_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  INDEX `idx_attendance_gate_scanned_at` (`gate_id`, `scanned_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. POINTS_LEDGER TABLE (CampusPass)
CREATE TABLE IF NOT EXISTS `points_ledger` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NOT NULL,
  `event_id` INT UNSIGNED NOT NULL,
  `pass_id` INT UNSIGNED NOT NULL,
  `points_change` INT NOT NULL DEFAULT 50,
  `reason` VARCHAR(50) NOT NULL DEFAULT 'EVENT_CHECKIN',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pass_reason` (`pass_id`, `reason`),
  CONSTRAINT `fk_ledger_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_ledger_event_id` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_ledger_pass_id` FOREIGN KEY (`pass_id`) REFERENCES `passes` (`id`) ON DELETE RESTRICT,
  INDEX `idx_ledger_user_created` (`user_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. BADGES TABLE
CREATE TABLE IF NOT EXISTS `badges` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `title` VARCHAR(100) NOT NULL,
  `description` TEXT NOT NULL,
  `icon_name` VARCHAR(50) NOT NULL,
  `required_points` INT UNSIGNED NOT NULL DEFAULT 0,
  `required_events_count` INT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_badges_title` (`title`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. USER_BADGES TABLE
CREATE TABLE IF NOT EXISTS `user_badges` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NOT NULL,
  `badge_id` INT UNSIGNED NOT NULL,
  `awarded_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_badge` (`user_id`, `badge_id`),
  CONSTRAINT `fk_user_badges_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_user_badges_badge_id` FOREIGN KEY (`badge_id`) REFERENCES `badges` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
