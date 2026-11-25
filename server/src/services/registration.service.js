import crypto from 'crypto';
import qrcode from 'qrcode';
import { pool } from '../config/db.js';
import { generateSecureToken, hashToken } from '../utils/crypto.js';

export class RegistrationService {
  /**
   * Registers a student for an event (individual or team) using an ACID transaction
   * with pessimistic row locking (SELECT ... FOR UPDATE) to prevent overbooking and race conditions.
   */
  async registerForEvent(eventId, user, payload = {}) {
    if (!user || user.role !== 'student') {
      const error = new Error('Only students can register for events.');
      error.statusCode = 403;
      error.code = 'STUDENT_ONLY';
      throw error;
    }

    const registrationType = payload.registrationType || 'individual';
    const userId = user.id;
    const userEmail = (user.email || '').toLowerCase();
    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      // 1. Lock the event row and validate event state
      const [events] = await conn.query(
        `SELECT id, title, status, start_time, registration_deadline, max_capacity,
                current_registrations, registration_type, min_team_size, max_team_size
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

      // Validate registration type matching event configuration
      if (registrationType === 'individual' && event.registration_type === 'team') {
        const error = new Error('This event requires team registration.');
        error.statusCode = 400;
        error.code = 'INVALID_REGISTRATION_TYPE';
        throw error;
      }

      if (registrationType === 'team' && event.registration_type === 'individual') {
        const error = new Error('This event is for individual participants only.');
        error.statusCode = 400;
        error.code = 'INVALID_REGISTRATION_TYPE';
        throw error;
      }

      // ==============================================================
      // BRANCH A: INDIVIDUAL REGISTRATION
      // ==============================================================
      if (registrationType === 'individual') {
        // Check capacity limit
        if (event.current_registrations + 1 > event.max_capacity) {
          const error = new Error('Sorry, maximum event capacity has been reached.');
          error.statusCode = 409;
          error.code = 'CAPACITY_FULL';
          throw error;
        }

        // Check for duplicate registration for this student and event
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

        const [existingTeamMembers] = await conn.query(
          `SELECT id FROM team_members
           WHERE event_id = ? AND user_id = ? AND status IN ('invited', 'accepted') FOR UPDATE`,
          [eventId, userId]
        );

        if (existingTeamMembers.length > 0) {
          const error = new Error('You are already registered or participating in this event.');
          error.statusCode = 409;
          error.code = 'ALREADY_REGISTERED';
          throw error;
        }

        // Insert into registrations table
        const [regResult] = await conn.query(
          `INSERT INTO registrations (event_id, leader_id, registration_type, reserved_headcount, status)
           VALUES (?, ?, 'individual', 1, 'confirmed')`,
          [eventId, userId]
        );
        const registrationId = regResult.insertId;

        // Atomically increment capacity
        await conn.query(
          `UPDATE events
           SET current_registrations = current_registrations + 1
           WHERE id = ?`,
          [eventId]
        );

        // Generate cryptographic pass token and unique pass code
        const rawToken = generateSecureToken();
        const tokenHash = hashToken(rawToken);
        const passCode = `PASS-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

        // Insert into passes table
        const [passResult] = await conn.query(
          `INSERT INTO passes (registration_id, event_id, user_id, pass_code, token_hash, status, issued_at)
           VALUES (?, ?, ?, ?, ?, 'active', NOW())`,
          [registrationId, eventId, userId, passCode, tokenHash]
        );
        const passId = passResult.insertId;

        // Commit all operations together
        await conn.commit();

        // Generate QR code Data URL (rawToken returned only in QR payload)
        const qrPayload = `EVPASS:v1:${passCode}:${rawToken}`;
        const qrDataUrl = await qrcode.toDataURL(qrPayload, {
          errorCorrectionLevel: 'M',
          margin: 2,
          width: 300
        });

        return {
          registrationId,
          status: 'confirmed',
          pass: {
            id: passId,
            passCode,
            qrPayload,
            qrDataUrl,
            status: 'active',
            issuedAt: new Date().toISOString()
          }
        };
      }

      // ==============================================================
      // BRANCH B: TEAM REGISTRATION
      // ==============================================================
      const teamName = (payload.teamName || '').trim();
      if (!teamName) {
        const error = new Error('Team name is required.');
        error.statusCode = 400;
        error.code = 'INVALID_TEAM_NAME';
        throw error;
      }

      const rawMemberEmails = payload.memberEmails || [];
      if (!Array.isArray(rawMemberEmails) || rawMemberEmails.length === 0) {
        const error = new Error('Team registration requires at least one invited team member email.');
        error.statusCode = 400;
        error.code = 'INVALID_MEMBER_EMAILS';
        throw error;
      }

      // Format and lowercase all emails
      const memberEmails = rawMemberEmails.map(e => String(e).trim().toLowerCase());

      // 1. Check self-invitation
      if (memberEmails.includes(userEmail)) {
        const error = new Error('You cannot invite yourself as a team member.');
        error.statusCode = 400;
        error.code = 'CANNOT_INVITE_SELF';
        throw error;
      }

      // 2. Check duplicate emails within the member list
      const uniqueMemberEmails = [...new Set(memberEmails)];
      if (uniqueMemberEmails.length !== memberEmails.length) {
        const error = new Error('Duplicate email addresses found in invited members list.');
        error.statusCode = 400;
        error.code = 'DUPLICATE_INVITEE_EMAILS';
        throw error;
      }

      // 3. Validate team size (leader + members)
      const reservedHeadcount = 1 + uniqueMemberEmails.length;
      if (reservedHeadcount < event.min_team_size || reservedHeadcount > event.max_team_size) {
        const error = new Error(
          `Team size (including leader) must be between ${event.min_team_size} and ${event.max_team_size} members.`
        );
        error.statusCode = 400;
        error.code = 'INVALID_TEAM_SIZE';
        throw error;
      }

      // 4. Concurrency-safe capacity locking
      if (event.current_registrations + reservedHeadcount > event.max_capacity) {
        const error = new Error('Sorry, event does not have enough remaining capacity for the requested team size.');
        error.statusCode = 409;
        error.code = 'CAPACITY_FULL';
        throw error;
      }

      // 5. Verify all invitee emails exist in users as active student accounts
      const [studentRows] = await conn.query(
        `SELECT id, email, full_name, role
         FROM users
         WHERE LOWER(email) IN (?)`,
        [uniqueMemberEmails]
      );

      const foundMap = new Map();
      studentRows.forEach(u => foundMap.set(u.email.toLowerCase(), u));

      for (const email of uniqueMemberEmails) {
        const student = foundMap.get(email);
        if (!student || student.role !== 'student') {
          const error = new Error(`Invitee ${email} does not have an eligible student account.`);
          error.statusCode = 400;
          error.code = 'INVITEE_NOT_FOUND';
          throw error;
        }
      }

      const memberUsers = uniqueMemberEmails.map(email => foundMap.get(email));
      const allParticipantIds = [userId, ...memberUsers.map(u => u.id)];

      // 6. Check duplicate event participation across team_members and passes
      const [duplicateMembers] = await conn.query(
        `SELECT tm.user_id, u.email
         FROM team_members tm
         JOIN users u ON tm.user_id = u.id
         WHERE tm.event_id = ? AND tm.user_id IN (?) AND tm.status IN ('invited', 'accepted')`,
        [eventId, allParticipantIds]
      );

      if (duplicateMembers.length > 0) {
        const dup = duplicateMembers[0];
        const error = new Error(
          dup.user_id === userId
            ? 'You are already registered or participating in this event.'
            : `Invitee ${dup.email} is already registered or invited to another team for this event.`
        );
        error.statusCode = 409;
        error.code = 'DUPLICATE_PARTICIPATION';
        throw error;
      }

      const [duplicatePasses] = await conn.query(
        `SELECT p.user_id, u.email
         FROM passes p
         JOIN users u ON p.user_id = u.id
         WHERE p.event_id = ? AND p.user_id IN (?) AND p.status IN ('active', 'checked_in')`,
        [eventId, allParticipantIds]
      );

      if (duplicatePasses.length > 0) {
        const dup = duplicatePasses[0];
        const error = new Error(
          dup.user_id === userId
            ? 'You are already registered for this event.'
            : `Invitee ${dup.email} is already registered or invited to another team for this event.`
        );
        error.statusCode = 409;
        error.code = 'DUPLICATE_PARTICIPATION';
        throw error;
      }

      // 7. Insert into registrations table with pending_members status
      const [regResult] = await conn.query(
        `INSERT INTO registrations (event_id, leader_id, team_name, registration_type, reserved_headcount, status)
         VALUES (?, ?, ?, 'team', ?, 'pending_members')`,
        [eventId, userId, teamName, reservedHeadcount]
      );
      const registrationId = regResult.insertId;

      // 8. Atomically reserve headcount capacity
      await conn.query(
        `UPDATE events
         SET current_registrations = current_registrations + ?
         WHERE id = ?`,
        [reservedHeadcount, eventId]
      );

      // 9. Insert team_members records (Leader as accepted, invitees as invited)
      await conn.query(
        `INSERT INTO team_members (registration_id, event_id, user_id, role, status, invited_at, responded_at)
         VALUES (?, ?, ?, 'leader', 'accepted', NOW(), NOW())`,
        [registrationId, eventId, userId]
      );

      for (const member of memberUsers) {
        await conn.query(
          `INSERT INTO team_members (registration_id, event_id, user_id, role, status, invited_at, responded_at)
           VALUES (?, ?, ?, 'member', 'invited', NOW(), NULL)`,
          [registrationId, eventId, member.id]
        );
      }

      // 10. Commit all operations together
      await conn.commit();

      // Note: No passes are issued yet; team leader receives invitation tracking details only
      return {
        registrationId,
        teamName,
        status: 'pending_members',
        reservedHeadcount,
        invitations: memberUsers.map(m => ({
          memberEmail: m.email,
          status: 'invited'
        }))
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
