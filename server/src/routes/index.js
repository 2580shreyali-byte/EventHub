import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import eventRoutes from './event.routes.js';
import passRoutes from './pass.routes.js';
import checkinRoutes from './checkin.routes.js';
import invitationRoutes from './invitation.routes.js';

const router = Router();

// Mount Health Check endpoint at /api/v1/health
router.use('/', healthRoutes);

// Mount Authentication endpoints at /api/v1/auth
router.use('/auth', authRoutes);

// Mount Event endpoints at /api/v1/events
router.use('/events', eventRoutes);

// Mount Pass endpoints at /api/v1/passes
router.use('/passes', passRoutes);

// Mount Checkin endpoints at /api/v1/checkin
router.use('/checkin', checkinRoutes);

// Mount Invitation endpoints at /api/v1/invitations
router.use('/invitations', invitationRoutes);

export default router;
