import { eventService } from '../services/event.service.js';
import { successResponse } from '../utils/apiResponse.js';

export class EventController {
  async getEvents(req, res, next) {
    try {
      const isAdmin = req.user?.role === 'admin';
      const result = await eventService.listEvents({
        ...req.query,
        isAdmin
      });
      return successResponse(res, result, 'Events retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  async getEventById(req, res, next) {
    try {
      const isAdmin = req.user?.role === 'admin';
      const event = await eventService.getEventById(req.params.id, { isAdmin });

      if (!event) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'EVENT_NOT_FOUND',
            message: 'Event not found or not published'
          }
        });
      }

      return successResponse(res, event, 'Event retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  async createEvent(req, res, next) {
    try {
      const event = await eventService.createEvent(req.body, req.user.id);
      return successResponse(res, event, 'Event created successfully', 201);
    } catch (err) {
      next(err);
    }
  }

  async updateEvent(req, res, next) {
    try {
      const event = await eventService.updateEvent(req.params.id, req.body);
      return successResponse(res, event, 'Event updated successfully');
    } catch (err) {
      next(err);
    }
  }

  async deleteEvent(req, res, next) {
    try {
      const result = await eventService.cancelOrDeleteEvent(req.params.id);
      return successResponse(res, result, result.message);
    } catch (err) {
      next(err);
    }
  }
}

export const eventController = new EventController();
