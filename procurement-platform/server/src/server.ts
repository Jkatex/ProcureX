/* Bootstraps the HTTP server separately from the Express app so tests can import app behavior without opening a port. */
import dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const serverDir = dirname(fileURLToPath(import.meta.url));
const serverRoot = resolve(serverDir, '..');
const defaultEnvFile = existsSync(resolve(serverRoot, '.env')) ? '.env' : '.env.example';
const envFile = process.env.PROCUREX_SERVER_ENV_FILE ?? defaultEnvFile;
const envPath = isAbsolute(envFile) ? envFile : resolve(serverRoot, envFile);
dotenv.config({ path: envPath });

const { createApp } = await import('./app.js');

const port = Number(process.env.PORT ?? 4000);
const app = createApp();

app.listen(port, () => {
  console.log(`ProcureX server listening on http://localhost:${port} (env file: ${envFile}, APP_ENV: ${process.env.APP_ENV ?? 'unset'})`);
});
