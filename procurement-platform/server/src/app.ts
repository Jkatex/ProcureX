import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';
import helmet from 'helmet';
import { registeredModules } from './modules/index.js';
import { securityConfig, validateProductionSecurityConfig } from './security/config.js';

function requestError(message: string, status = 403) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

export function createApp() {
  validateProductionSecurityConfig();

  const app = express();
  const config = securityConfig();
  const allowedOrigins = config.corsOrigins.length > 0 ? config.corsOrigins : config.localCorsOrigins;
  const connectSources = ["'self'", ...allowedOrigins, 'http://localhost:4000', 'http://127.0.0.1:4000'];

  app.set('trust proxy', 1);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          baseUri: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          scriptSrc: ["'self'", 'https://unpkg.com', 'https://challenges.cloudflare.com'],
          connectSrc: connectSources,
          imgSrc: ["'self'", 'data:', 'blob:'],
          styleSrc: ["'self'", "'unsafe-inline'"],
          fontSrc: ["'self'", 'data:'],
          frameSrc: ["'self'", 'https://challenges.cloudflare.com']
        }
      }
    })
  );
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(requestError('CORS origin is not allowed.', 403));
      }
    })
  );
  app.use(express.json({ limit: process.env.REQUEST_BODY_LIMIT ?? '160mb' }));

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'procurex-server',
      modules: registeredModules.map(({ key, basePath }) => ({ key, basePath }))
    });
  });

  for (const module of registeredModules) {
    app.use(module.basePath, module.router);
    if (module.key === 'evaluation') {
      app.use('/api/evaluations', module.router);
    }
  }

  app.use((_req, res) => {
    res.status(404).json({ error: 'not_found' });
  });

  const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    const status = typeof error?.status === 'number' ? error.status : 500;
    res.status(status).json({
      error: status === 500 ? 'internal_error' : 'request_error',
      message: status === 500 ? 'Unexpected server error.' : String(error?.message ?? 'Request failed.')
    });
  };

  app.use(errorHandler);

  return app;
}
