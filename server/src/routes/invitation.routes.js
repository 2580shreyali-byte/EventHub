import { Router } from 'express';
import { invitationController } from '../controllers/invitation.controller.js';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';

const router = Router();

// All invitation routes require authenticated student role
router.use(authenticate);
router.use(requireRole('student'));

router.get('/', (req, res, next) => invitationController.listInvitations(req, res, next));
router.post('/:id/accept', (req, res, next) => invitationController.acceptInvitation(req, res, next));
router.post('/:id/decline', (req, res, next) => invitationController.declineInvitation(req, res, next));

export default router;
