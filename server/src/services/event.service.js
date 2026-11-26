import { pool } from '../config/db.js';

function formatSqlDate(isoStr) {
  const d = new Date(isoStr);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export class EventService {
  /**
   * Lists events with filtering, search and pagination.
   * Public/students can only see 'published' events.
   */
  async listEvents({ page = 1, limit = 10, category, search, status, isAdmin = false }) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];
    const params = [];

    // Access control rule: Non-admin users can ONLY see published events
    if (!isAdmin) {
      conditions.push("e.status = 'published'");
    } else if (status) {
      conditions.push('e.status = ?');
      params.push(status);
    }

    if (category) {
      conditions.push('e.category = ?');
      params.push(category);
    }

    if (search) {
      conditions.push('(e.title LIKE ? OR e.description LIKE ? OR e.venue LIKE ? OR e.category LIKE ?)');
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count total records
    const [countRows] = await pool.query(
      `SELECT COUNT(*) as total FROM events e ${whereClause}`,
      params
    );
    const total = countRows[0].total;

    // Fetch paginated events
    const [rows] = await pool.query(
      `SELECT
        e.id, e.title, e.description, e.category, e.venue,
        e.start_time AS startTime, e.end_time AS endTime,
        e.registration_deadline AS registrationDeadline,
        e.max_capacity AS maxCapacity, e.current_registrations AS currentRegistrations,
        GREATEST(0, CAST(e.max_capacity AS SIGNED) - CAST(e.current_registrations AS SIGNED)) AS availableSeats,
        e.registration_type AS registrationType,
        e.min_team_size AS minTeamSize, e.max_team_size AS maxTeamSize,
        e.status, e.banner_url AS bannerUrl,
        e.created_by AS createdBy, e.created_at AS createdAt, e.updated_at AS updatedAt,
        u.full_name AS organizerName
       FROM events e
       JOIN users u ON e.created_by = u.id
       ${whereClause}
       ORDER BY e.start_time ASC, e.id DESC
       LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );

    return {
      events: rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1
      }
    };
  }

  /**
   * Retrieves an event by ID.
   * Public/students can only view if status is 'published'.
   */
  async getEventById(eventId, { isAdmin = false, userId = null } = {}) {
    const [rows] = await pool.query(
      `SELECT
        e.id, e.title, e.description, e.category, e.venue,
        e.start_time AS startTime, e.end_time AS endTime,
        e.registration_deadline AS registrationDeadline,
        e.max_capacity AS maxCapacity, e.current_registrations AS currentRegistrations,
        GREATEST(0, CAST(e.max_capacity AS SIGNED) - CAST(e.current_registrations AS SIGNED)) AS availableSeats,
        e.registration_type AS registrationType,
        e.min_team_size AS minTeamSize, e.max_team_size AS maxTeamSize,
        e.status, e.banner_url AS bannerUrl,
        e.created_by AS createdBy, e.created_at AS createdAt, e.updated_at AS updatedAt,
        u.full_name AS organizerName, u.email AS organizerEmail
       FROM events e
       JOIN users u ON e.created_by = u.id
       WHERE e.id = ?`,
      [eventId]
    );

    if (rows.length === 0) {
      return null;
    }

    const event = rows[0];

    // Non-admins cannot see non-published events
    if (!isAdmin && event.status !== 'published') {
      return null;
    }

    // Fetch associated active gates
    const [gates] = await pool.query(
      `SELECT id, gate_name AS gateName, location_description AS locationDescription, is_active AS isActive
       FROM gates
       WHERE event_id = ? AND is_active = TRUE`,
      [eventId]
    );

    event.gates = gates;

    // If userId provided, check team participation
    event.userParticipation = null;
    if (userId) {
      const [parts] = await pool.query(
        `SELECT tm.id AS memberId, tm.role, tm.status AS memberStatus,
                r.id AS registrationId, r.team_name AS teamName,
                r.status AS registrationStatus, r.reserved_headcount AS reservedHeadcount,
                r.leader_id AS leaderId
         FROM team_members tm
         JOIN registrations r ON tm.registration_id = r.id
         WHERE tm.event_id = ? AND tm.user_id = ? AND r.status != 'cancelled'`,
        [eventId, userId]
      );

      if (parts.length > 0) {
        const part = parts[0];
        const [teammates] = await pool.query(
          `SELECT tm2.id AS invitationId, tm2.role, tm2.status, u.full_name AS fullName, u.email
           FROM team_members tm2
           JOIN users u ON tm2.user_id = u.id
           WHERE tm2.registration_id = ?
           ORDER BY tm2.role DESC, tm2.invited_at ASC`,
          [part.registrationId]
        );

        event.userParticipation = {
          invitationId: part.memberId,
          registrationId: part.registrationId,
          teamName: part.teamName,
          role: part.role,
          memberStatus: part.memberStatus,
          registrationStatus: part.registrationStatus,
          reservedHeadcount: part.reservedHeadcount,
          isLeader: part.role === 'leader',
          teammates: teammates.map(t => ({
            invitationId: t.invitationId,
            fullName: t.fullName,
            email: t.email,
            role: t.role,
            status: t.status
          }))
        };
      }
    }

    return event;
  }

  /**
   * Creates a new event (Admin only).
   */
  async createEvent(eventData, createdByUserId) {
    const {
      title,
      description,
      category,
      venue,
      startTime,
      endTime,
      registrationDeadline,
      maxCapacity,
      registrationType = 'individual',
      minTeamSize = 1,
      maxTeamSize = 1,
      status = 'published',
      bannerUrl = null
    } = eventData;

    const [result] = await pool.query(
      `INSERT INTO events (
        title, description, category, venue,
        start_time, end_time, registration_deadline,
        max_capacity, current_registrations,
        registration_type, min_team_size, max_team_size,
        status, banner_url, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)`,
      [
        title,
        description,
        category,
        venue,
        formatSqlDate(startTime),
        formatSqlDate(endTime),
        formatSqlDate(registrationDeadline),
        maxCapacity,
        registrationType,
        minTeamSize,
        maxTeamSize,
        status,
        bannerUrl,
        createdByUserId
      ]
    );

    return this.getEventById(result.insertId, { isAdmin: true });
  }

  /**
   * Updates an existing event (Admin only).
   */
  async updateEvent(eventId, updateData) {
    const existing = await this.getEventById(eventId, { isAdmin: true });
    if (!existing) {
      const error = new Error('Event not found');
      error.statusCode = 404;
      error.code = 'EVENT_NOT_FOUND';
      throw error;
    }

    // Status transition rules
    if (existing.status === 'cancelled' && updateData.status && updateData.status !== 'cancelled') {
      const error = new Error('Cancelled events cannot be reactivated or updated to another status.');
      error.statusCode = 400;
      error.code = 'INVALID_STATUS_TRANSITION';
      throw error;
    }

    if (existing.status === 'completed' && updateData.status && ['draft', 'published'].includes(updateData.status)) {
      const error = new Error('Completed events cannot transition back to draft or published.');
      error.statusCode = 400;
      error.code = 'INVALID_STATUS_TRANSITION';
      throw error;
    }

    if (updateData.maxCapacity !== undefined && updateData.maxCapacity < existing.currentRegistrations) {
      const error = new Error(`Cannot decrease max capacity below current confirmed registrations (${existing.currentRegistrations}).`);
      error.statusCode = 400;
      error.code = 'INVALID_CAPACITY';
      throw error;
    }

    // If transitioning to cancelled, safely revoke active passes
    if (updateData.status === 'cancelled' && existing.status !== 'cancelled') {
      await pool.query(
        "UPDATE passes SET status = 'revoked' WHERE event_id = ? AND status = 'active'",
        [eventId]
      );
    }

    const fieldMap = {
      title: 'title',
      description: 'description',
      category: 'category',
      venue: 'venue',
      startTime: 'start_time',
      endTime: 'end_time',
      registrationDeadline: 'registration_deadline',
      maxCapacity: 'max_capacity',
      registrationType: 'registration_type',
      minTeamSize: 'min_team_size',
      maxTeamSize: 'max_team_size',
      status: 'status',
      bannerUrl: 'banner_url'
    };

    const updates = [];
    const values = [];

    for (const [key, value] of Object.entries(updateData)) {
      if (value !== undefined && fieldMap[key]) {
        updates.push(`${fieldMap[key]} = ?`);
        if (['startTime', 'endTime', 'registrationDeadline'].includes(key)) {
          values.push(formatSqlDate(value));
        } else {
          values.push(value);
        }
      }
    }

    if (updates.length > 0) {
      values.push(eventId);
      await pool.query(
        `UPDATE events SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
    }

    return this.getEventById(eventId, { isAdmin: true });
  }

  /**
   * Deletes or safely cancels an event (Admin only).
   * If registrations or passes exist, safe cancellation is applied instead to preserve relational integrity.
   */
  async cancelOrDeleteEvent(eventId) {
    const existing = await this.getEventById(eventId, { isAdmin: true });
    if (!existing) {
      const error = new Error('Event not found');
      error.statusCode = 404;
      error.code = 'EVENT_NOT_FOUND';
      throw error;
    }

    // Check if registrations exist
    const [regRows] = await pool.query(
      'SELECT COUNT(*) as count FROM registrations WHERE event_id = ?',
      [eventId]
    );

    const hasRegistrations = regRows[0].count > 0;

    if (hasRegistrations) {
      // Safe cancellation strategy to protect foreign keys and audit history
      await pool.query(
        "UPDATE events SET status = 'cancelled' WHERE id = ?",
        [eventId]
      );

      // Revoke any active passes for this event
      await pool.query(
        "UPDATE passes SET status = 'revoked' WHERE event_id = ? AND status = 'active'",
        [eventId]
      );

      return {
        event: await this.getEventById(eventId, { isAdmin: true }),
        action: 'cancelled',
        message: 'Event has active registrations. Event was safely cancelled and active passes were revoked.'
      };
    }

    // If zero registrations, safely delete gates and the event
    await pool.query('DELETE FROM gates WHERE event_id = ?', [eventId]);
    await pool.query('DELETE FROM events WHERE id = ?', [eventId]);

    return {
      action: 'deleted',
      message: 'Event deleted successfully.'
    };
  }

  /**
   * Adds a new gate to an event (Admin only).
   */
  async addGate(eventId, { gateName, locationDescription = null }) {
    const event = await this.getEventById(eventId, { isAdmin: true });
    if (!event) {
      const error = new Error('Event not found.');
      error.statusCode = 404;
      error.code = 'EVENT_NOT_FOUND';
      throw error;
    }

    // Check for duplicate gate name within the same event
    const [existingGate] = await pool.query(
      'SELECT id FROM gates WHERE event_id = ? AND LOWER(gate_name) = LOWER(?)',
      [eventId, gateName.trim()]
    );

    if (existingGate.length > 0) {
      const error = new Error(`A gate with the name "${gateName}" already exists for this event.`);
      error.statusCode = 409;
      error.code = 'DUPLICATE_GATE_NAME';
      throw error;
    }

    const [result] = await pool.query(
      `INSERT INTO gates (event_id, gate_name, location_description, is_active)
       VALUES (?, ?, ?, TRUE)`,
      [eventId, gateName.trim(), locationDescription]
    );

    return {
      id: result.insertId,
      eventId: Number(eventId),
      gateName: gateName.trim(),
      locationDescription,
      isActive: true
    };
  }

  /**
   * Lists all gates for an event.
   */
  async listGates(eventId) {
    const event = await this.getEventById(eventId, { isAdmin: true });
    if (!event) {
      const error = new Error('Event not found.');
      error.statusCode = 404;
      error.code = 'EVENT_NOT_FOUND';
      throw error;
    }

    const [rows] = await pool.query(
      `SELECT id, gate_name AS gateName, location_description AS locationDescription, is_active AS isActive
       FROM gates
       WHERE event_id = ?
       ORDER BY id ASC`,
      [eventId]
    );

    return rows.map(r => ({
      ...r,
      isActive: Boolean(r.isActive)
    }));
  }

  /**
   * Updates an existing gate (Admin only).
   */
  async updateGate(eventId, gateId, { gateName, locationDescription, isActive }) {
    // 1. Verify gate exists
    const [gateRows] = await pool.query(
      `SELECT id, event_id, gate_name, location_description, is_active
       FROM gates
       WHERE id = ?`,
      [gateId]
    );

    if (gateRows.length === 0) {
      const error = new Error('Gate not found.');
      error.statusCode = 404;
      error.code = 'GATE_NOT_FOUND';
      throw error;
    }

    const gate = gateRows[0];

    // 2. Reject updates if gate belongs to another event
    if (Number(gate.event_id) !== Number(eventId)) {
      const error = new Error(`Gate ${gateId} belongs to another event.`);
      error.statusCode = 400;
      error.code = 'GATE_MISMATCH';
      throw error;
    }

    // 3. Prevent duplicate gate names within same event
    if (gateName && gateName.trim().toLowerCase() !== gate.gate_name.toLowerCase()) {
      const [duplicateCheck] = await pool.query(
        'SELECT id FROM gates WHERE event_id = ? AND LOWER(gate_name) = LOWER(?) AND id != ?',
        [eventId, gateName.trim(), gateId]
      );

      if (duplicateCheck.length > 0) {
        const error = new Error(`A gate with the name "${gateName}" already exists for this event.`);
        error.statusCode = 409;
        error.code = 'DUPLICATE_GATE_NAME';
        throw error;
      }
    }

    const updates = [];
    const values = [];

    if (gateName !== undefined) {
      updates.push('gate_name = ?');
      values.push(gateName.trim());
    }
    if (locationDescription !== undefined) {
      updates.push('location_description = ?');
      values.push(locationDescription);
    }
    if (isActive !== undefined) {
      updates.push('is_active = ?');
      values.push(isActive ? 1 : 0);
    }

    if (updates.length > 0) {
      values.push(gateId);
      await pool.query(
        `UPDATE gates SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
    }

    const [updatedRows] = await pool.query(
      `SELECT id, gate_name AS gateName, location_description AS locationDescription, is_active AS isActive
       FROM gates WHERE id = ?`,
      [gateId]
    );

    return {
      id: updatedRows[0].id,
      gateName: updatedRows[0].gateName,
      locationDescription: updatedRows[0].locationDescription,
      isActive: Boolean(updatedRows[0].isActive)
    };
  }
}

export const eventService = new EventService();
