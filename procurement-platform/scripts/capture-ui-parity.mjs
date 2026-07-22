/* Automates the capture UI parity developer workflow so repeated project tasks run with the same assumptions every time. */
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workspaceRoot = path.resolve(root, '..');
const routesPath = path.join(root, 'docs', 'ui-parity', 'routes.json');
const outputRoot = path.join(root, 'docs', 'ui-parity', 'screenshots');
const routes = JSON.parse(await readFile(routesPath, 'utf8'));

const targetBase = process.env.PROCUREX_TARGET_BASE || 'http://localhost:5173';
const referenceBase =
  process.env.PROCUREX_REFERENCE_BASE || pathToFileURL(path.join(workspaceRoot, 'procurex-ui', 'index.html')).href;
const viewports = [
  { name: 'desktop', width: 1440, height: 1200 },
  { name: 'mobile', width: 390, height: 1000 }
];

const mockSession = {
  user: {
    id: 'ui-parity-admin',
    displayName: 'Admin User',
    email: 'admin@procurex.test',
    accountType: 'ADMIN',
    organization: 'ProcureX UI Parity',
    capabilities: ['BUYER', 'SUPPLIER'],
    verificationStatus: 'APPROVED'
  },
  expiresAt: '2099-01-01T00:00:00.000Z'
};

async function captureUrl(context, url, outputPath) {
  let lastError;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const page = await context.newPage();

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90_000 });
      await page.waitForTimeout(700);
      await page.screenshot({
        path: outputPath,
        fullPage: false,
        timeout: 120_000,
        animations: 'disabled',
        caret: 'hide',
        scale: 'css'
      });
      await page.close();
      return;
    } catch (error) {
      lastError = error;
      await page.close().catch(() => {});

      if (attempt < 3) {
        console.warn(`Retrying screenshot after failure (${attempt}/3): ${url}`);
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  throw lastError;
}

const browser = await chromium.launch({
  args: [
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--disable-features=VizDisplayCompositor',
    '--use-angle=swiftshader'
  ]
});

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport });
    await context.addInitScript(() => {
      window.localStorage.setItem('procurex.authToken', 'ui-parity-token');
    });
    await context.route('http://localhost:4000/api/identity/session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockSession)
      });
    });
    for (const route of routes) {
      const referenceUrl = `${referenceBase}?page=${encodeURIComponent(route.prototypePage)}`;
      const targetUrl = `${targetBase}${route.reactPath}`;
      const referenceDir = path.join(outputRoot, viewport.name, 'reference');
      const targetDir = path.join(outputRoot, viewport.name, 'target');
      await mkdir(referenceDir, { recursive: true });
      await mkdir(targetDir, { recursive: true });

      console.log(`[${viewport.name}] reference ${route.name}`);
      await captureUrl(context, referenceUrl, path.join(referenceDir, `${route.name}.png`));

      console.log(`[${viewport.name}] target ${route.name}`);
      await captureUrl(context, targetUrl, path.join(targetDir, `${route.name}.png`));
    }
    await context.close();
  }
} finally {
  await browser.close();
}
