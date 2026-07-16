import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';
import helmet from 'helmet';
import { ZodError } from 'zod';
import { registeredModules } from './modules/index.js';
import { apiErrorResponseBody, requestError, statusFromError } from './modules/shared/apiErrors.js';
import { requestLanguage } from './modules/shared/localization.js';
import { securityConfig, validateProductionSecurityConfig } from './security/config.js';

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
        callback(requestError({ status: 403, code: 'SECURITY_CORS_ORIGIN_DENIED', userMessage: 'This browser origin is not allowed.', reason: 'ProcureX blocked a request from an unapproved origin.' }));
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

  app.use((req, res) => {
    const language = requestLanguage(req);
    res.status(404).json(
      apiErrorResponseBody(
        requestError({
          status: 404,
          code: 'ROUTE_NOT_FOUND',
          userMessage: 'The requested ProcureX endpoint was not found.',
          reason: 'Check the link or return to the previous page.'
        }),
        language
      )
    );
  });

  const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
    const language = requestLanguage(req);
    const normalizedError =
      error instanceof ZodError
        ? requestError({
            status: 400,
            code: 'VALIDATION_FAILED',
            userMessage: 'Some submitted information is incomplete or invalid.',
            reason: 'Review the highlighted fields and try again.',
            fieldErrors: error.issues.map((issue) => ({
              path: issue.path.join('.'),
              message: issue.message,
              code: issue.code
            }))
          })
        : error;
    const status = statusFromError(normalizedError);
    res.status(status).json(apiErrorResponseBody(normalizedError, language));
  };

  app.use(errorHandler);

  return app;
}
