import { createApp } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { initDatabase, prisma } from './config/prisma';
import { startJobs } from './jobs';

async function bootstrap() {
  await initDatabase();

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, `EduRewards API listening on http://localhost:${env.PORT}`);
    logger.info(`API documentation at http://localhost:${env.PORT}/api/docs`);
  });

  const stopJobs = startJobs();

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'shutting down');
    stopJobs();
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
    // Force-exit if connections refuse to drain.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => logger.error({ reason }, 'unhandled rejection'));
  process.on('uncaughtException', (error) => {
    logger.fatal({ error }, 'uncaught exception');
    process.exit(1);
  });
}

void bootstrap();
