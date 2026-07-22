/* Automates the sync procurex UI developer workflow so repeated project tasks run with the same assumptions every time. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const sourceDir = path.resolve(repoRoot, '..', 'procurex-ui');
const destinationDir = path.resolve(repoRoot, 'client', 'public', 'procurex-ui');
const publicDir = path.resolve(repoRoot, 'client', 'public');

function assertInside(parent, child) {
  const relative = path.relative(parent, child);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Refusing to write outside ${parent}: ${child}`);
  }
}

await fs.access(path.join(sourceDir, 'index.html'));
assertInside(publicDir, destinationDir);

await fs.rm(destinationDir, { recursive: true, force: true });
await fs.mkdir(path.dirname(destinationDir), { recursive: true });
await fs.cp(sourceDir, destinationDir, { recursive: true });

console.log(`Synced raw ProcureX UI prototype to ${path.relative(repoRoot, destinationDir)}`);
