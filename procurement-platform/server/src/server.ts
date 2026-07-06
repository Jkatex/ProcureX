import dotenv from 'dotenv';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const serverDir = dirname(fileURLToPath(import.meta.url));
const serverRoot = resolve(serverDir, '..');
const envFile = process.env.PROCUREX_SERVER_ENV_FILE ?? '.env.example';
const envPath = isAbsolute(envFile) ? envFile : resolve(serverRoot, envFile);
dotenv.config({ path: envPath });

const { createApp } = await import('./app.js');

const port = Number(process.env.PORT ?? 4000);
const app = createApp();

app.listen(port, () => {
  console.log(`ProcureX server listening on http://localhost:${port}`);
});
