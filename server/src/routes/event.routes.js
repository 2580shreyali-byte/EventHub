import { Router } from 'express';
import { eventController } from '../controllers/event.controller.js';
import { registrationController } from '../controllers/registration.controller.js';
import { authenticate, requireRole, optionalAuth } from '../middleware/auth.middleware.js';
import { validateBody, validateQuery } from '../middleware/validate.middleware.js';
import { createEventSchema, updateEventSchema, eventQuerySchema } from '../validators/event.validator.js';

const router = Router();

// Public routes (with optional auth to detect admin role for draft/internal visibility)
router.get('/', optionalAuth, validateQuery(eventQuerySchema), (req, res, next) => eventController.getEvents(req, res, next));
router.get('/:id', optionalAuth, (req, res, next) => eventController.getEventById(req, res, next));

// Student event registration route
router.post(
  '/:id/register',
  authenticate,
  requireRole('student'),
  (req, res, next) => registrationController.register(req, res, next)
);

// Admin-only management routes
router.post(
  '/',
  authenticate,
  requireRole('admin'),
  validateBody(createEventSchema),
  (req, res, next) => eventController.createEvent(req, res, next)
);

router.patch(
  '/:id',
  authenticate,
  requireRole('admin'),
  validateBody(updateEventSchema),
  (req, res, next) => eventController.updateEvent(req, res, next)
);

router.delete(
  '/:id',
  authenticate,
  requireRole('admin'),
  (req, res, next) => eventController.deleteEvent(req, res, next)
);

export default router;
