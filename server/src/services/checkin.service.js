import { pool } from '../config/db.js';
import { hashToken } from '../utils/crypto.js';

export class CheckinService {
  /**
   * Executes the 9-step atomic check-in transaction.
   * Guarantees strict transactional integrity, idempotency, and exactly-once reward points.
   */
  async scanAndCheckIn({ eventId, gateId, scanUuid, qrPayload, scannedByUserId }) {
    // Step 1: Parse and validate QR payload format (EVPASS:v1:<passCode>:<rawToken>)
    const qrRegex = /^EVPASS:v1:([^:]+):([a-f0-9]{64})$/i;
    const match = qrPayload.match(qrRegex);

    if (!match) {
      const error = new Error('Malformed QR payload format. Expected EVPASS:v1:<passCode>:<rawToken>');
      error.statusCode = 400;
      error.code = 'INVALID_QR_PAYLOAD';
      throw error;
    }

    const passCode = match[1];
    const rawToken = match[2];
    const tokenHash = hashToken(rawToken);

    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      // Step 2: Query and lock pass record using SHA-256 token hash
      const [passRows] = await conn.query(
        `SELECT 
          p.id, p.event_id, p.user_id, p.pass_code, p.token_hash, p.status, p.checked_in_at,
          e.id AS event_id, e.title AS event_title, e.status AS event_status, 
          e.start_time AS start_time, e.end_time AS end_time,
          u.full_name, u.student_id, u.department,
          r.team_name
        FROM passes p
        JOIN events e ON p.event_id = e.id
        JOIN users u ON p.user_id = u.id
        JOIN registrations r ON p.registration_id = r.id
        WHERE p.token_hash = ?
        FOR UPDATE`,
        [tokenHash]
      );

      let pass = null;

      if (passRows.length === 0) {
        // Check if passCode exists with a rotated/different token hash
        const [codeRows] = await conn.query(
          `SELECT id, token_hash, status FROM passes WHERE pass_code = ? FOR UPDATE`,
          [passCode]
        );

        if (codeRows.length > 0) {
          const error = new Error('This pass has been reissued. The presented QR token is no longer valid.');
          error.statusCode = 400;
          error.code = 'INVALID_TOKEN';
          throw error;
        }

        const error = new Error('Invalid pass token or pass does not exist.');
        error.statusCode = 404;
        error.code = 'PASS_NOT_FOUND';
        throw error;
      }

      pass = passRows[0];

      // Step 3: Validate event association
      if (Number(pass.event_id) !== Number(eventId)) {
        const error = new Error('Pass belongs to a different event.');
        error.statusCode = 400;
        error.code = 'EVENT_MISMATCH';
        throw error;
      }

      // Step 4: Validate event status and check-in time window (60 min before start until end)
      if (pass.event_status === 'cancelled') {
        const error = new Error('Event was cancelled.');
        error.statusCode = 400;
        error.code = 'EVENT_CANCELLED';
        throw error;
      }

      const now = new Date();
      const startTime = new Date(pass.start_time);
      const endTime = new Date(pass.end_time);
      const windowStart = new Date(startTime.getTime() - 60 * 60 * 1000); // 60 min before start

      if (now < windowStart) {
        const error = new Error('Check-in is only permitted from 60 minutes prior to event start until event conclusion.');
        error.statusCode = 400;
        error.code = 'WINDOW_CLOSED';
        throw error;
      }

      if (now > endTime) {
        const error = new Error('Check-in window has closed. The event has concluded.');
        error.statusCode = 400;
        error.code = 'WINDOW_CLOSED';
        throw error;
      }

      // Step 5: Validate gate existence, active state, and event ownership
      const [gateRows] = await conn.query(
        `SELECT id, event_id, gate_name, is_active FROM gates WHERE id = ? FOR UPDATE`,
        [gateId]
      );

      if (gateRows.length === 0) {
        const error = new Error('Gate not found.');
        error.statusCode = 404;
        error.code = 'GATE_NOT_FOUND';
        throw error;
      }

      const gate = gateRows[0];

      if (!gate.is_active) {
        const error = new Error('Gate is inactive.');
        error.statusCode = 400;
        error.code = 'GATE_INACTIVE';
        throw error;
      }

      if (Number(gate.event_id) !== Number(pass.event_id)) {
        const error = new Error(`Gate ${gateId} does not belong to the event associated with this pass.`);
        error.statusCode = 400;
        error.code = 'GATE_MISMATCH';
        throw error;
      }

      // Step 6: Validate scan_uuid idempotency
      const [existingScan] = await conn.query(
        `SELECT al.id, al.pass_id, al.gate_id, al.scanned_at, al.scan_uuid, g.gate_name
         FROM attendance_logs al
         JOIN gates g ON al.gate_id = g.id
         WHERE al.scan_uuid = ?`,
        [scanUuid]
      );

      if (existingScan.length > 0) {
        // If same pass and same scan_uuid, return idempotent approved response (0 points added)
        if (existingScan[0].pass_id === pass.id) {
          await conn.rollback();
          return {
            status: 'APPROVED',
            attendee: {
              name: pass.full_name,
              studentId: pass.student_id,
              department: pass.department
            },
            teamName: pass.team_name || null,
            eventTitle: pass.event_title,
            gateName: gate.gate_name,
            checkedInAt: existingScan[0].scanned_at
          };
        } else {
          const error = new Error('Scan UUID has already been used for another check-in.');
          error.statusCode = 409;
          error.code = 'DUPLICATE_SCAN_UUID';
          throw error;
        }
      }

      // Step 7: Check pass status (duplicate check-in, revocation, expiration)
      if (pass.status === 'checked_in') {
        const [prevAttendance] = await conn.query(
          `SELECT al.scanned_at, g.gate_name 
           FROM attendance_logs al 
           JOIN gates g ON al.gate_id = g.id 
           WHERE al.pass_id = ?`,
          [pass.id]
        );

        let timeStr = 'earlier';
        let prevGate = 'an authorized gate';

        if (prevAttendance.length > 0) {
          const prevTime = new Date(prevAttendance[0].scanned_at);
          timeStr = prevTime.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          });
          prevGate = prevAttendance[0].gate_name;
        }

        const error = new Error(`ALREADY SCANNED: Pass was previously checked in at ${timeStr} at ${prevGate}.`);
        error.statusCode = 409;
        error.code = 'DUPLICATE_CHECKIN';
        throw error;
      }

      if (pass.status === 'revoked') {
        const error = new Error('Pass has been revoked by administration.');
        error.statusCode = 400;
        error.code = 'PASS_REVOKED';
        throw error;
      }

      if (pass.status === 'expired') {
        const error = new Error('Pass has expired.');
        error.statusCode = 400;
        error.code = 'PASS_EXPIRED';
        throw error;
      }

      // Step 8: Atomic conditional update of pass status
      const [updateResult] = await conn.query(
        `UPDATE passes 
         SET status = 'checked_in', checked_in_at = NOW() 
         WHERE id = ? AND status = 'active'`,
        [pass.id]
      );

      if (updateResult.affectedRows === 0) {
        const error = new Error('Concurrent check-in conflict: pass is no longer active.');
        error.statusCode = 409;
        error.code = 'CONCURRENT_CHECKIN';
        throw error;
      }

      // Step 9: Insert attendance log record
      await conn.query(
        `INSERT INTO attendance_logs (
          pass_id, gate_id, scanned_by, checkin_mode, scan_uuid, scanned_at
        ) VALUES (?, ?, ?, 'online', ?, NOW())`,
        [pass.id, gate.id, scannedByUserId, scanUuid]
      );

      // Step 10: Insert reward points ledger (+50 pts)
      // Guarded by UNIQUE KEY uq_pass_reason (pass_id, reason)
      await conn.query(
        `INSERT INTO points_ledger (
          user_id, event_id, pass_id, points_change, reason, created_at
        ) VALUES (?, ?, ?, 50, 'EVENT_CHECKIN', NOW())`,
        [pass.user_id, pass.event_id, pass.id]
      );

      // Step 11: Increment attendee reward points
      await conn.query(
        `UPDATE users SET reward_points = reward_points + 50 WHERE id = ?`,
        [pass.user_id]
      );

      await conn.commit();

      return {
        status: 'APPROVED',
        attendee: {
          name: pass.full_name,
          studentId: pass.student_id,
          department: pass.department
        },
        teamName: pass.team_name || null,
        eventTitle: pass.event_title,
        gateName: gate.gate_name,
        checkedInAt: new Date().toISOString()
      };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  /**
   * Calculates QueueLess live gate throughput metrics over the last 10 minutes.
   */
  async getQueueLessMetrics(eventId) {
    // Verify event exists
    const [eventRows] = await pool.query(
      `SELECT id, title FROM events WHERE id = ?`,
      [eventId]
    );

    if (eventRows.length === 0) {
      const error = new Error('Event not found.');
      error.statusCode = 404;
      error.code = 'EVENT_NOT_FOUND';
      throw error;
    }

    // Query all active gates for this event and count check-ins in the last 10 minutes
    const [gateStats] = await pool.query(
      `SELECT 
        g.id AS gateId,
        g.gate_name AS gateName,
        COUNT(al.id) AS scansInLast10Min
       FROM gates g
       LEFT JOIN attendance_logs al ON g.id = al.gate_id 
         AND al.scanned_at >= DATE_SUB(NOW(), INTERVAL 10 MINUTE)
       WHERE g.event_id = ? AND g.is_active = TRUE
       GROUP BY g.id, g.gate_name
       ORDER BY g.id ASC`,
      [eventId]
    );

    const formattedGates = gateStats.map((gate) => {
      const scans = Number(gate.scansInLast10Min) || 0;
      const throughput = Number((scans / 10).toFixed(1));

      let activityLevel = 'Low Activity (Fast Entry)';
      let indicatorColor = 'green';

      if (throughput > 8.0) {
        activityLevel = 'High Scan Velocity';
        indicatorColor = 'red';
      } else if (throughput >= 3.0) {
        activityLevel = 'Steady Flow';
        indicatorColor = 'yellow';
      }

      return {
        gateId: gate.gateId,
        gateName: gate.gateName,
        scansInLast10Min: scans,
        throughputScansPerMin: throughput,
        activityLevel,
        indicatorColor
      };
    });

    let recommendedGateId = null;
    let recommendedGateName = null;

    if (formattedGates.length > 0) {
      // Recommend the active gate with the lowest scan throughput in the last 10 minutes
      const sorted = [...formattedGates].sort((a, b) => a.scansInLast10Min - b.scansInLast10Min);
      recommendedGateId = sorted[0].gateId;
      recommendedGateName = sorted[0].gateName;
    }

    return {
      eventId: Number(eventId),
      disclaimer: 'Gate activity indicators and recommendations are calculated strictly from check-in scan throughput at each terminal over the past 10 minutes. They do not measure physical queue lengths outside the venue.',
      recommendedGateId,
      recommendedGateName,
      gates: formattedGates
    };
  }
}

export const checkinService = new CheckinService();
