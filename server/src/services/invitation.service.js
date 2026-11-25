import crypto from 'crypto';
import qrcode from 'qrcode';
import { pool } from '../config/db.js';
import { generateSecureToken, hashToken } from '../utils/crypto.js';

export class InvitationService {
  /**
   * Retrieves pending team invitations for the authenticated student.
   */
  async listInvitations(userId) {
    const [rows] = await pool.query(
      `SELECT
         tm.id AS invitationId,
         r.team_name AS teamName,
         u.full_name AS leaderName,
         e.id AS eventId,
         e.title AS eventTitle,
         e.venue AS eventVenue,
         e.start_time AS eventStartTime,
         tm.invited_at AS invitedAt
       FROM team_members tm
       JOIN registrations r ON tm.registration_id = r.id
       JOIN events e ON tm.event_id = e.id
       JOIN users u ON r.leader_id = u.id
       WHERE tm.user_id = ? AND tm.status = 'invited' AND r.status = 'pending_members'
       ORDER BY tm.invited_at DESC`,
      [userId]
    );

    return rows.map(row => ({
      invitationId: row.invitationId,
      teamName: row.teamName,
      leaderName: row.leaderName,
      event: {
        id: row.eventId,
        title: row.eventTitle,
        venue: row.eventVenue,
        startTime: row.eventStartTime
      },
      invitedAt: row.invitedAt
    }));
  }

  /**
   * Accepts a team invitation. If all invited members have accepted,
   * transitions the team registration to 'confirmed', issues individual SmartPasses
   * for each member, and returns ONLY the accepting member's own pass (strict pass isolation).
   */
  async acceptInvitation(invitationId, user) {
    if (!user || user.role !== 'student') {
      const error = new Error('Only students can accept invitations.');
      error.statusCode = 403;
      error.code = 'STUDENT_ONLY';
      throw error;
    }

    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      // 1. Lock the invitation row and associated event/registration
      const [invitations] = await conn.query(
        `SELECT tm.*, r.team_name, r.status AS reg_status, r.reserved_headcount, r.leader_id,
                e.title, e.venue, e.start_time, e.registration_deadline, e.status AS event_status
         FROM team_members tm
         JOIN registrations r ON tm.registration_id = r.id
         JOIN events e ON tm.event_id = e.id
         WHERE tm.id = ? FOR UPDATE`,
        [invitationId]
      );

      if (invitations.length === 0) {
        const error = new Error('Invitation not found.');
        error.statusCode = 404;
        error.code = 'INVITATION_NOT_FOUND';
        throw error;
      }

      const inv = invitations[0];

      // 2. Ownership verification: Must match user_id of invitation
      if (inv.user_id !== user.id) {
        const error = new Error('You are not authorized to respond to this invitation.');
        error.statusCode = 403;
        error.code = 'FORBIDDEN';
        throw error;
      }

      // 3. Status checks
      if (inv.status !== 'invited') {
        const error = new Error(`Invitation has already been ${inv.status}.`);
        error.statusCode = 400;
        error.code = 'INVALID_INVITATION_STATUS';
        throw error;
      }

      if (inv.reg_status !== 'pending_members') {
        const error = new Error('Team registration is no longer pending member acceptance.');
        error.statusCode = 400;
        error.code = 'REGISTRATION_NOT_PENDING';
        throw error;
      }

      // 4. Validate event status & registration deadline
      const now = new Date();
      if (now > new Date(inv.registration_deadline)) {
        const error = new Error('Registration deadline for this event has passed.');
        error.statusCode = 400;
        error.code = 'DEADLINE_PASSED';
        throw error;
      }

      if (inv.event_status !== 'published') {
        const error = new Error('Event is no longer accepting registrations.');
        error.statusCode = 400;
        error.code = 'EVENT_NOT_ACTIVE';
        throw error;
      }

      // 5. Update this invitation to accepted
      await conn.query(
        `UPDATE team_members
         SET status = 'accepted', responded_at = NOW()
         WHERE id = ?`,
        [invitationId]
      );

      // 6. Check all team members for this registration
      const [allMembers] = await conn.query(
        `SELECT id, user_id, role, status
         FROM team_members
         WHERE registration_id = ? FOR UPDATE`,
        [inv.registration_id]
      );

      const pendingMembers = allMembers.filter(m => m.status === 'invited');

      if (pendingMembers.length === 0) {
        // All members have accepted! Transition registration to 'confirmed'
        await conn.query(
          `UPDATE registrations
           SET status = 'confirmed'
           WHERE id = ?`,
          [inv.registration_id]
        );

        // Generate individual SmartPasses for all members
        let myPassData = null;

        for (const member of allMembers) {
          const rawToken = generateSecureToken();
          const tokenHash = hashToken(rawToken);
          const passCode = `PASS-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

          await conn.query(
            `INSERT INTO passes (registration_id, event_id, user_id, pass_code, token_hash, status, issued_at)
             VALUES (?, ?, ?, ?, ?, 'active', NOW())`,
            [inv.registration_id, inv.event_id, member.user_id, passCode, tokenHash]
          );

          // Pass Isolation: retain ONLY the accepting user's own token for the response payload
          if (member.user_id === user.id) {
            const qrPayload = `EVPASS:v1:${passCode}:${rawToken}`;
            const qrDataUrl = await qrcode.toDataURL(qrPayload, {
              errorCorrectionLevel: 'M',
              margin: 2,
              width: 300
            });

            myPassData = {
              passCode,
              qrPayload,
              qrDataUrl
            };
          }
        }

        await conn.commit();

        return {
          allConfirmed: true,
          invitationId: inv.id,
          teamRegistrationStatus: 'confirmed',
          myPass: myPassData
        };
      } else {
        // Still pending other team members
        await conn.commit();

        return {
          allConfirmed: false,
          invitationId: inv.id,
          teamRegistrationStatus: 'pending_members'
        };
      }
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  /**
   * Declines a team invitation. If declining causes viable team members to drop
   * below the event's min_team_size, the registration is cancelled and the reserved
   * headcount is released back to the event.
   */
  async declineInvitation(invitationId, user) {
    if (!user || user.role !== 'student') {
      const error = new Error('Only students can decline invitations.');
      error.statusCode = 403;
      error.code = 'STUDENT_ONLY';
      throw error;
    }

    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      // 1. Lock the invitation row and registration/event details
      const [invitations] = await conn.query(
        `SELECT tm.*, r.status AS reg_status, r.reserved_headcount, e.min_team_size, e.id AS event_id
         FROM team_members tm
         JOIN registrations r ON tm.registration_id = r.id
         JOIN events e ON tm.event_id = e.id
         WHERE tm.id = ? FOR UPDATE`,
        [invitationId]
      );

      if (invitations.length === 0) {
        const error = new Error('Invitation not found.');
        error.statusCode = 404;
        error.code = 'INVITATION_NOT_FOUND';
        throw error;
      }

      const inv = invitations[0];

      // 2. Ownership verification
      if (inv.user_id !== user.id) {
        const error = new Error('You are not authorized to respond to this invitation.');
        error.statusCode = 403;
        error.code = 'FORBIDDEN';
        throw error;
      }

      // 3. Status checks
      if (inv.status !== 'invited') {
        const error = new Error(`Invitation has already been ${inv.status}.`);
        error.statusCode = 400;
        error.code = 'INVALID_INVITATION_STATUS';
        throw error;
      }

      if (inv.reg_status !== 'pending_members') {
        const error = new Error('Team registration is no longer pending member acceptance.');
        error.statusCode = 400;
        error.code = 'REGISTRATION_NOT_PENDING';
        throw error;
      }

      // 4. Mark invitation as declined
      await conn.query(
        `UPDATE team_members
         SET status = 'declined', responded_at = NOW()
         WHERE id = ?`,
        [invitationId]
      );

      // 5. Evaluate remaining viable members
      const [members] = await conn.query(
        `SELECT id, status
         FROM team_members
         WHERE registration_id = ? FOR UPDATE`,
        [inv.registration_id]
      );

      const viableMembers = members.filter(m => m.status === 'accepted' || m.status === 'invited');

      if (viableMembers.length < inv.min_team_size) {
        // Team can no longer meet the minimum team size: cancel registration & release headcount
        await conn.query(
          `UPDATE registrations
           SET status = 'cancelled'
           WHERE id = ?`,
          [inv.registration_id]
        );

        await conn.query(
          `UPDATE events
           SET current_registrations = GREATEST(0, CAST(current_registrations AS SIGNED) - ?)
           WHERE id = ?`,
          [inv.reserved_headcount, inv.event_id]
        );
      }

      await conn.commit();

      return {
        invitationId: inv.id,
        declined: true
      };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }
}

export const invitationService = new InvitationService();
