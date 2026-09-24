import express from 'express';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import path from 'node:path';
import swaggerUi from 'swagger-ui-express';
import routes from './routes';
import { corsMiddleware, helmetMiddleware, csrfGuard } from './middleware/security';
import { requestContext } from './middleware/requestContext';
import { globalLimiter } from './middleware/rateLimit';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { openapiDocument } from './docs/openapi';
import { checkDatabase } from './config/prisma';
import { env } from './config/env';
import { uploadRoot } from './middleware/upload';

export function createApp() {
  const app = express();

  // Required for correct client IPs behind a reverse proxy (rate limiting, audit).
  app.set('trust proxy', 1);

  app.use(helmetMiddleware);
  app.use(corsMiddleware);
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());
  app.use(requestContext);
  app.use(csrfGuard);

  app.get('/health', (_req, res) => {
    res.json({ success: true, data: { status: 'ok', version: env.APP_VERSION, uptime: process.uptime() } });
  });

  app.get('/health/ready', async (_req, res) => {
    const database = await checkDatabase();
    res.status(database ? 200 : 503).json({
      success: database,
      data: { api: 'ok', database: database ? 'ok' : 'unreachable', version: env.APP_VERSION },
    });
  });

  // Locally served uploads. In production this is replaced by object storage.
  app.use('/uploads', express.static(uploadRoot, { maxAge: '7d', index: false, dotfiles: 'deny' }));

  app.get('/api/docs.json', (_req, res) => res.json(openapiDocument));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapiDocument, { customSiteTitle: 'EduRewards API' }));

  app.use('/api/v1', globalLimiter, routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
