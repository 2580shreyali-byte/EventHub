import app from './app.js';
import { env } from './config/env.js';
import { checkDatabaseConnection } from './config/db.js';

const PORT = parseInt(env.PORT, 10) || 5000;
const HOST = '0.0.0.0';

const server = app.listen(PORT, HOST, async () => {
  console.log(`[EventHub Server] Running on http://localhost:${PORT}`);
  console.log(`[EventHub Server] Environment: ${env.NODE_ENV}`);
  console.log(`[EventHub Server] Health Check: http://localhost:${PORT}/api/v1/health`);

  // Check Database connectivity on startup
  const dbStatus = await checkDatabaseConnection();
  if (dbStatus.ok) {
    console.log(`[Database] Connection pool established successfully to '${env.MYSQL_DATABASE}' on ${env.MYSQL_HOST}:${env.MYSQL_PORT}`);
  } else {
    console.warn(`[Database WARNING] Could not connect to MySQL: ${dbStatus.error}`);
    console.warn(`[Database WARNING] Please ensure local MySQL is running and credentials in server/.env are set.`);
  }
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('[EventHub Server] SIGTERM signal received. Closing HTTP server.');
  server.close(() => {
    console.log('[EventHub Server] HTTP server closed.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[EventHub Server] SIGINT signal received. Closing HTTP server.');
  server.close(() => {
    console.log('[EventHub Server] HTTP server closed.');
    process.exit(0);
  });
});
