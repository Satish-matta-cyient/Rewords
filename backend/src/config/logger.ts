import pino from 'pino';
import { env, isProd, isTest } from './env';

export const logger = pino({
  level: isTest ? 'silent' : env.LOG_LEVEL,
  base: { service: 'edurewards-api', version: env.APP_VERSION },
  redact: {
    paths: [
      'req.headers.authorization', 'req.headers.cookie',
      '*.password', '*.passwordHash', '*.token', '*.tokenHash',
      '*.panNumber', '*.accountNumber', '*.refreshToken',
    ],
    censor: '[redacted]',
  },
  transport: isProd
    ? undefined
    : { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname,service,version' } },
});
