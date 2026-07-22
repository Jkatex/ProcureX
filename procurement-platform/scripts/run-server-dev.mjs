/* Automates the run server dev developer workflow so repeated project tasks run with the same assumptions every time. */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const serverDir = resolve(repoRoot, 'server');
const defaultEnvFile = existsSync(resolve(serverDir, '.env')) ? '.env' : '.env.example';
const envFile = process.argv[2] ?? defaultEnvFile;
const isWindows = process.platform === 'win32';
const command = isWindows ? 'tsx.cmd watch src/server.ts' : 'tsx';
const args = isWindows ? [] : ['watch', 'src/server.ts'];

const child = spawn(command, args, {
  cwd: serverDir,
  env: {
    ...process.env,
    PROCUREX_SERVER_ENV_FILE: envFile
  },
  shell: isWindows,
  stdio: 'inherit'
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    child.kill(signal);
  });
}

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
