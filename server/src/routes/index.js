import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import eventRoutes from './event.routes.js';

const router = Router();

// Mount Health Check endpoint at /api/v1/health
router.use('/', healthRoutes);

// Mount Authentication endpoints at /api/v1/auth
router.use('/auth', authRoutes);

// Mount Event endpoints at /api/v1/events
router.use('/events', eventRoutes);

export default router;
