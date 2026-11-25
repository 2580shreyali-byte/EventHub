import { Router } from 'express';
import { checkinController } from '../controllers/checkin.controller.js';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { scanCheckInSchema } from '../validators/checkin.validator.js';

const router = Router();

// POST /api/v1/checkin/scan (Admin / Gate Staff only)
router.post(
  '/scan',
  authenticate,
  requireRole('admin'),
  validateBody(scanCheckInSchema),
  (req, res, next) => checkinController.scan(req, res, next)
);

export default router;
