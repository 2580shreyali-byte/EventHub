import bcrypt from 'bcryptjs';
import { pool } from '../src/config/db.js';
import { env } from '../src/config/env.js';

async function seedAdmin() {
  const adminName = env.ADMIN_NAME || 'Campus Administrator';
  const adminEmail = (env.ADMIN_EMAIL || 'admin@eventhub.campus.edu').trim().toLowerCase();
  const adminPassword = env.ADMIN_PASSWORD || 'AdminPassword123!';
  const adminStudentId = 'ADMIN-001';
  const adminDepartment = 'Administration';

  console.log(`[Seed Admin] Starting idempotent admin seed for: ${adminEmail}`);

  try {
    // 1. Check if an account with this email or student ID already exists
    const [existing] = await pool.query(
      'SELECT id, email, role FROM users WHERE email = ? OR student_id = ?',
      [adminEmail, adminStudentId]
    );

    const passwordHash = await bcrypt.hash(adminPassword, 12);

    if (existing.length > 0) {
      const user = existing[0];
      // Update role to admin and refresh password
      await pool.query(
        `UPDATE users 
         SET full_name = ?, password_hash = ?, role = 'admin', updated_at = NOW()
         WHERE id = ?`,
        [adminName, passwordHash, user.id]
      );
      console.log(`[Seed Admin] Existing user found (ID: ${user.id}). Successfully verified/updated role to 'admin'.`);
    } else {
      // Insert new admin user
      const [result] = await pool.query(
        `INSERT INTO users (full_name, email, password_hash, role, student_id, department, reward_points)
         VALUES (?, ?, ?, 'admin', ?, ?, 0)`,
        [adminName, adminEmail, passwordHash, adminStudentId, adminDepartment]
      );
      console.log(`[Seed Admin] Successfully created new administrator account (ID: ${result.insertId}) with role 'admin'.`);
    }

    console.log('[Seed Admin] Admin seed completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('[Seed Admin Error]:', err.message);
    process.exit(1);
  }
}

seedAdmin();
