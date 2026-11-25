import { pool } from '../config/db.js';

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
      conditions.push('(e.title LIKE ? OR e.description LIKE ? OR e.venue LIKE ?)');
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
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
        (e.max_capacity - e.current_registrations) AS availableSeats,
        e.registration_type AS registrationType,
        e.min_team_size AS minTeamSize, e.max_team_size AS maxTeamSize,
        e.status, e.banner_url AS bannerUrl,
        e.created_by AS createdBy, e.created_at AS createdAt, e.updated_at AS updatedAt,
        u.full_name AS organizerName
       FROM events e
       JOIN users u ON e.created_by = u.id
       ${whereClause}
       ORDER BY e.start_time ASC
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
  async getEventById(eventId, { isAdmin = false } = {}) {
    const [rows] = await pool.query(
      `SELECT 
        e.id, e.title, e.description, e.category, e.venue,
        e.start_time AS startTime, e.end_time AS endTime,
        e.registration_deadline AS registrationDeadline,
        e.max_capacity AS maxCapacity, e.current_registrations AS currentRegistrations,
        (e.max_capacity - e.current_registrations) AS availableSeats,
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

    // Convert ISO strings to MySQL DATETIME format YYYY-MM-DD HH:MM:SS
    const formatSqlDate = (isoStr) => new Date(isoStr).toISOString().slice(0, 19).replace('T', ' ');

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

    if (updateData.maxCapacity !== undefined && updateData.maxCapacity < existing.currentRegistrations) {
      const error = new Error(`Cannot decrease max capacity below current confirmed registrations (${existing.currentRegistrations}).`);
      error.statusCode = 400;
      error.code = 'INVALID_CAPACITY';
      throw error;
    }

    const formatSqlDate = (isoStr) => new Date(isoStr).toISOString().slice(0, 19).replace('T', ' ');

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
}

export const eventService = new EventService();
