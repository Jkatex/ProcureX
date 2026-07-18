import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { delimiter, dirname, extname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [cwdArg, envFileArg, separator, ...commandParts] = process.argv.slice(2);

if (!cwdArg || !envFileArg || separator !== '--' || commandParts.length === 0) {
  console.error('Usage: node scripts/run-with-env.mjs <cwd> <env-file> -- <command> [args...]');
  process.exit(1);
}

const cwd = isAbsolute(cwdArg) ? cwdArg : resolve(repoRoot, cwdArg);
const envPath = isAbsolute(envFileArg) ? envFileArg : resolve(cwd, envFileArg);

if (!existsSync(envPath)) {
  console.error(`Environment file not found: ${envPath}`);
  process.exit(1);
}

function parseEnvFile(source) {
  const env = {};

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const normalized = line.startsWith('export ') ? line.slice('export '.length).trimStart() : line;
    const equalsIndex = normalized.indexOf('=');
    if (equalsIndex === -1) continue;

    const key = normalized.slice(0, equalsIndex).trim();
    let value = normalized.slice(equalsIndex + 1).trim();

    if (!key) continue;

    const quote = value[0];
    if ((quote === '"' || quote === "'") && value[value.length - 1] === quote) {
      value = value.slice(1, -1);
    }

    if (quote === '"') {
      value = value.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t');
    }

    env[key] = value;
  }

  return env;
}

const parsedEnv = parseEnvFile(readFileSync(envPath, 'utf8'));
const [command, ...args] = commandParts;
const isWindows = process.platform === 'win32';
const pathEntries = [
  resolve(cwd, 'node_modules', '.bin'),
  resolve(repoRoot, 'node_modules', '.bin'),
  ...(process.env.PATH ?? '').split(delimiter)
].filter(Boolean);

function resolveWindowsCommand(executable) {
  if (!isWindows) return { command: executable, shell: false };

  function resolveNodeShim(commandPath) {
    const source = readFileSync(commandPath, 'utf8');
    const match = source.match(/"%dp0%\\([^"]+)"\s+%\*/);
    if (!match) return null;
    return resolve(dirname(commandPath), match[1]);
  }

  function nodeShimCommand(commandPath) {
    const scriptPath = resolveNodeShim(commandPath);
    return scriptPath ? { command: process.execPath, argsPrefix: [scriptPath], shell: false } : null;
  }

  if (extname(executable)) {
    const extension = extname(executable).toLowerCase();
    if (extension === '.cmd' || extension === '.bat') {
      return nodeShimCommand(executable) ?? { command: executable, shell: true };
    }
    return { command: executable, shell: false };
  }

  for (const directory of pathEntries) {
    for (const extension of ['.cmd', '.exe', '.bat', '']) {
      const candidate = resolve(directory, `${executable}${extension}`);
      if (existsSync(candidate)) {
        if (extension === '.cmd' || extension === '.bat') {
          return nodeShimCommand(candidate) ?? { command: candidate, shell: true };
        }
        return { command: candidate, shell: false };
      }
    }
  }

  return { command: executable, shell: false };
}

const resolvedCommand = resolveWindowsCommand(command);
const resolvedArgs = [...(resolvedCommand.argsPrefix ?? []), ...args];

const child = spawn(resolvedCommand.command, resolvedArgs, {
  cwd,
  env: {
    ...process.env,
    ...parsedEnv,
    PATH: pathEntries.join(delimiter)
  },
  shell: resolvedCommand.shell,
  stdio: 'inherit'
});

child.on('error', (error) => {
  console.error(error);
  process.exit(1);
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
