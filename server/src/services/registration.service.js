import crypto from 'crypto';
import qrcode from 'qrcode';
import { pool } from '../config/db.js';
import { generateSecureToken, hashToken } from '../utils/crypto.js';

export class RegistrationService {
  /**
   * Registers a student for an individual event using an ACID transaction
   * with pessimistic row locking (SELECT ... FOR UPDATE) to prevent overbooking.
   */
  async registerForEvent(eventId, user) {
    if (!user || user.role !== 'student') {
      const error = new Error('Only students can register for events.');
      error.statusCode = 403;
      error.code = 'STUDENT_ONLY';
      throw error;
    }

    const userId = user.id;
    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      // 1. Lock the event row and validate event state
      const [events] = await conn.query(
        `SELECT id, title, status, start_time, registration_deadline, max_capacity, current_registrations
         FROM events 
         WHERE id = ? FOR UPDATE`,
        [eventId]
      );

      if (events.length === 0) {
        const error = new Error('Event not found.');
        error.statusCode = 404;
        error.code = 'EVENT_NOT_FOUND';
        throw error;
      }

      const event = events[0];

      // 2. Validate event status
      if (event.status !== 'published') {
        const error = new Error('Registration is not open for this event.');
        error.statusCode = 400;
        error.code = 'EVENT_NOT_PUBLISHED';
        throw error;
      }

      // 3. Validate registration deadline
      const now = new Date();
      const deadline = new Date(event.registration_deadline);
      if (now > deadline) {
        const error = new Error('Registration deadline for this event has passed.');
        error.statusCode = 400;
        error.code = 'DEADLINE_PASSED';
        throw error;
      }

      // 4. Validate event start time
      const startTime = new Date(event.start_time);
      if (now >= startTime) {
        const error = new Error('This event has already started.');
        error.statusCode = 400;
        error.code = 'EVENT_ALREADY_STARTED';
        throw error;
      }

      // 5. Check capacity limit
      if (event.current_registrations >= event.max_capacity) {
        const error = new Error('Sorry, maximum event capacity has been reached.');
        error.statusCode = 409;
        error.code = 'CAPACITY_FULL';
        throw error;
      }

      // 6. Check for duplicate registration for this student and event
      const [existingPasses] = await conn.query(
        `SELECT id FROM passes 
         WHERE event_id = ? AND user_id = ? FOR UPDATE`,
        [eventId, userId]
      );

      if (existingPasses.length > 0) {
        const error = new Error('You are already registered for this event.');
        error.statusCode = 409;
        error.code = 'ALREADY_REGISTERED';
        throw error;
      }

      // 7. Insert into registrations table
      const [regResult] = await conn.query(
        `INSERT INTO registrations (event_id, leader_id, registration_type, reserved_headcount, status)
         VALUES (?, ?, 'individual', 1, 'confirmed')`,
        [eventId, userId]
      );
      const registrationId = regResult.insertId;

      // 8. Atomically increment capacity
      await conn.query(
        `UPDATE events 
         SET current_registrations = current_registrations + 1 
         WHERE id = ?`,
        [eventId]
      );

      // 9. Generate cryptographic pass token and unique pass code
      const rawToken = generateSecureToken();
      const tokenHash = hashToken(rawToken);
      const passCode = `PASS-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

      // 10. Insert into passes table
      const [passResult] = await conn.query(
        `INSERT INTO passes (registration_id, event_id, user_id, pass_code, token_hash, status, issued_at)
         VALUES (?, ?, ?, ?, ?, 'active', NOW())`,
        [registrationId, eventId, userId, passCode, tokenHash]
      );
      const passId = passResult.insertId;

      // 11. Commit all operations together
      await conn.commit();

      // 12. Generate QR code Data URL (rawToken returned only in QR payload)
      const qrPayload = `EVPASS:v1:${passCode}:${rawToken}`;
      const qrDataUrl = await qrcode.toDataURL(qrPayload, {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 300
      });

      return {
        registrationId,
        pass: {
          id: passId,
          passCode,
          qrPayload,
          qrDataUrl,
          status: 'active',
          issuedAt: new Date().toISOString()
        }
      };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }
}

export const registrationService = new RegistrationService();
