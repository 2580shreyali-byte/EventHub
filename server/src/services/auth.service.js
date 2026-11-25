import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js';
import { env } from '../config/env.js';

export class AuthService {
  /**
   * Registers a new student account.
   * Public registration unconditionally creates role = 'student'.
   */
  async registerUser({ fullName, email, password, studentId, department }) {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedStudentId = studentId.trim();

    // 1. Check for duplicate email or studentId
    const [existing] = await pool.query(
      'SELECT id, email, student_id FROM users WHERE email = ? OR student_id = ?',
      [normalizedEmail, normalizedStudentId]
    );

    if (existing.length > 0) {
      if (existing.some(u => u.email === normalizedEmail)) {
        const error = new Error('An account with this email already exists.');
        error.statusCode = 409;
        error.code = 'EMAIL_ALREADY_EXISTS';
        throw error;
      }
      if (existing.some(u => u.student_id === normalizedStudentId)) {
        const error = new Error('An account with this Student ID already exists.');
        error.statusCode = 409;
        error.code = 'STUDENT_ID_ALREADY_EXISTS';
        throw error;
      }
    }

    // 2. Hash password with bcrypt cost factor 12
    const passwordHash = await bcrypt.hash(password, 12);

    // 3. Insert user record with forced role = 'student'
    const [result] = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, role, student_id, department, reward_points)
       VALUES (?, ?, ?, 'student', ?, ?, 0)`,
      [fullName.trim(), normalizedEmail, passwordHash, normalizedStudentId, department.trim()]
    );

    const userId = result.insertId;

    // 4. Generate JWT token
    const token = this.generateToken({ id: userId, role: 'student', email: normalizedEmail });

    return {
      user: {
        id: userId,
        fullName: fullName.trim(),
        email: normalizedEmail,
        role: 'student',
        studentId: normalizedStudentId,
        department: department.trim(),
        rewardPoints: 0
      },
      token
    };
  }

  /**
   * Authenticates user credentials and generates a JWT session.
   */
  async loginUser({ email, password }) {
    const normalizedEmail = email.trim().toLowerCase();

    // 1. Find user by email
    const [rows] = await pool.query(
      `SELECT id, full_name, email, password_hash, role, student_id, department, reward_points
       FROM users WHERE email = ?`,
      [normalizedEmail]
    );

    if (rows.length === 0) {
      const error = new Error('Invalid email or password.');
      error.statusCode = 401;
      error.code = 'INVALID_CREDENTIALS';
      throw error;
    }

    const user = rows[0];

    // 2. Compare password hash
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      const error = new Error('Invalid email or password.');
      error.statusCode = 401;
      error.code = 'INVALID_CREDENTIALS';
      throw error;
    }

    // 3. Generate token
    const token = this.generateToken({ id: user.id, role: user.role, email: user.email });

    return {
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        role: user.role,
        studentId: user.student_id,
        department: user.department,
        rewardPoints: user.reward_points
      },
      token
    };
  }

  /**
   * Retrieves safe profile by user ID.
   */
  async getUserById(userId) {
    const [rows] = await pool.query(
      `SELECT id, full_name, email, role, student_id, department, reward_points, created_at
       FROM users WHERE id = ?`,
      [userId]
    );

    if (rows.length === 0) {
      return null;
    }

    const u = rows[0];
    return {
      id: u.id,
      fullName: u.full_name,
      email: u.email,
      role: u.role,
      studentId: u.student_id,
      department: u.department,
      rewardPoints: u.reward_points,
      createdAt: u.created_at
    };
  }

  /**
   * Helper to sign JWT
   */
  generateToken(payload) {
    const expiresIn = parseInt(env.JWT_EXPIRES_IN, 10) || 86400;
    return jwt.sign(payload, env.JWT_SECRET, { expiresIn });
  }
}

export const authService = new AuthService();
