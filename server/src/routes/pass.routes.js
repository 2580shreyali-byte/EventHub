import { Router } from 'express';
import { passController } from '../controllers/pass.controller.js';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';

const router = Router();

// Student pass retrieval: get all my passes
router.get(
  '/my-passes',
  authenticate,
  requireRole('student'),
  (req, res, next) => passController.getMyPasses(req, res, next)
);

// Individual pass inspection (owner or admin)
router.get(
  '/:id',
  authenticate,
  (req, res, next) => passController.getPassById(req, res, next)
);

// Student pass reissuance (rotates token hash and returns new QR code)
router.post(
  '/:id/reissue',
  authenticate,
  requireRole('student'),
  (req, res, next) => passController.reissuePass(req, res, next)
);

export default router;
