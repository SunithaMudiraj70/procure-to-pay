import app from './app.js';
import env from './config/env.js';
import logger from './utils/logger.js';

const PORT = env.PORT || 5000;

const server = app.listen(PORT, () => {
  logger.info(`Procure-to-Pay Backend server running on port ${PORT} [${env.NODE_ENV}]`);
  logger.info(`Health check endpoint: http://localhost:${PORT}/api/health`);
  logger.info(`Database health endpoint: http://localhost:${PORT}/api/health/db`);
});

const shutdown = () => {
  logger.info('Shutting down backend server gracefully...');
  server.close(() => {
    logger.info('HTTP server closed.');
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export default server;
