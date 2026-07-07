import { spawn } from 'node:child_process';

const isWindows = process.platform === 'win32';
const npmCommand = isWindows ? 'npm.cmd' : 'npm';
let shuttingDown = false;

const children = [
  spawn(npmCommand, ['--workspace', 'server', 'run', 'dev'], { shell: isWindows, stdio: 'inherit' }),
  spawn(npmCommand, ['--workspace', 'client', 'run', 'dev'], { shell: isWindows, stdio: 'inherit' })
];

function stopChildren(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) child.kill(signal);
  }
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    stopChildren(signal);
  });
}

for (const child of children) {
  child.on('error', (error) => {
    console.error(error);
    stopChildren('SIGTERM');
    process.exit(1);
  });

  child.on('exit', (code, signal) => {
    if (shuttingDown) return;

    stopChildren(signal ?? 'SIGTERM');

    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });
}
