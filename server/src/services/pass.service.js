import qrcode from 'qrcode';
import { pool } from '../config/db.js';
import { generateSecureToken, hashToken } from '../utils/crypto.js';

export class PassService {
  /**
   * Retrieves all passes belonging to the authenticated student.
   * Never exposes raw tokens or token hashes.
   */
  async getMyPasses(userId) {
    const [rows] = await pool.query(
      `SELECT 
        p.id AS passId,
        p.pass_code AS passCode,
        p.status,
        p.issued_at AS issuedAt,
        p.checked_in_at AS checkedInAt,
        e.id AS eventId,
        e.title AS eventTitle,
        e.venue,
        e.start_time AS startTime,
        e.end_time AS endTime,
        e.status AS eventStatus,
        e.banner_url AS bannerUrl
       FROM passes p
       JOIN events e ON p.event_id = e.id
       WHERE p.user_id = ?
       ORDER BY p.issued_at DESC`,
      [userId]
    );

    return rows;
  }

  /**
   * Retrieves an individual pass by ID, enforcing ownership.
   */
  async getPassById(passId, requestingUser) {
    const [rows] = await pool.query(
      `SELECT 
        p.id AS passId,
        p.pass_code AS passCode,
        p.user_id AS userId,
        p.status,
        p.issued_at AS issuedAt,
        p.checked_in_at AS checkedInAt,
        e.id AS eventId,
        e.title AS eventTitle,
        e.venue,
        e.start_time AS startTime,
        e.end_time AS endTime,
        e.status AS eventStatus
       FROM passes p
       JOIN events e ON p.event_id = e.id
       WHERE p.id = ?`,
      [passId]
    );

    if (rows.length === 0) {
      return null;
    }

    const pass = rows[0];

    // Ownership check: only owner or admin can inspect pass
    if (pass.userId !== requestingUser.id && requestingUser.role !== 'admin') {
      const error = new Error('You do not have permission to view this pass.');
      error.statusCode = 403;
      error.code = 'FORBIDDEN';
      throw error;
    }

    // Do not leak internal userId
    delete pass.userId;
    return pass;
  }

  /**
   * Reissues a pass by generating a fresh token and rotating the stored hash.
   * Immediately invalidates the previous QR token.
   */
  async reissuePass(passId, userId) {
    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      // Lock pass row for update
      const [rows] = await conn.query(
        `SELECT p.id, p.user_id, p.pass_code, p.status, p.event_id, e.status AS event_status
         FROM passes p
         JOIN events e ON p.event_id = e.id
         WHERE p.id = ? FOR UPDATE`,
        [passId]
      );

      if (rows.length === 0) {
        const error = new Error('Pass not found.');
        error.statusCode = 404;
        error.code = 'PASS_NOT_FOUND';
        throw error;
      }

      const pass = rows[0];

      // Ownership validation
      if (pass.user_id !== userId) {
        const error = new Error('You do not have permission to reissue this pass.');
        error.statusCode = 403;
        error.code = 'FORBIDDEN';
        throw error;
      }

      // Check pass status
      if (pass.status === 'checked_in') {
        const error = new Error('Cannot reissue a pass that has already been checked in.');
        error.statusCode = 400;
        error.code = 'ALREADY_CHECKED_IN';
        throw error;
      }

      if (pass.status === 'revoked' || pass.status === 'expired') {
        const error = new Error(`Cannot reissue a ${pass.status} pass.`);
        error.statusCode = 400;
        error.code = 'PASS_INACTIVE';
        throw error;
      }

      // Generate new token and replacement hash
      const newRawToken = generateSecureToken();
      const newTokenHash = hashToken(newRawToken);

      // Atomically rotate token hash
      await conn.query(
        `UPDATE passes 
         SET token_hash = ? 
         WHERE id = ?`,
        [newTokenHash, pass.id]
      );

      await conn.commit();

      // Generate fresh QR code Data URL
      const qrPayload = `EVPASS:v1:${pass.pass_code}:${newRawToken}`;
      const qrDataUrl = await qrcode.toDataURL(qrPayload, {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 300
      });

      return {
        passId: pass.id,
        passCode: pass.pass_code,
        qrPayload,
        qrDataUrl,
        status: 'active',
        message: 'Pass reissued successfully. Previous QR token is immediately invalidated.'
      };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }
}

export const passService = new PassService();
