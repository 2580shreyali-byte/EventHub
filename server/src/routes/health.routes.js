import { Router } from 'express';
import { checkDatabaseConnection } from '../config/db.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';

const router = Router();

router.get('/health', async (req, res) => {
  const dbStatus = await checkDatabaseConnection();

  const responseData = {
    service: 'EventHub Backend API',
    status: dbStatus.ok ? 'HEALTHY' : 'DEGRADED',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    database: {
      connected: dbStatus.ok,
      ...(dbStatus.ok ? {} : { error: dbStatus.error })
    }
  };

  if (dbStatus.ok) {
    return successResponse(res, responseData, 'Service is healthy and database is connected', 200);
  }

  // If DB is down, return 503 Service Unavailable with diagnostic data
  return res.status(503).json({
    success: false,
    message: 'Database connection failed',
    data: responseData
  });
});

export default router;
