import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173';
const apiBaseURL = process.env.PLAYWRIGHT_API_BASE_URL ?? 'http://localhost:4000';
const headless = process.env.PLAYWRIGHT_HEADLESS !== 'false';
const screenshotDir = process.env.AWARD_E2E_SCREENSHOT_DIR ?? path.resolve(process.cwd(), '.cache', 'award-contract-e2e');
const shouldReseedDemo = process.env.AWARD_E2E_RESEED !== 'false';
const visualViewports = [
  { name: 'desktop', width: 1440, height: 960 },
  { name: 'tablet', width: 900, height: 1100 },
  { name: 'mobile', width: 390, height: 844 }
];
const credentials = {
  buyer: {
    email: process.env.AWARD_BUYER_EMAIL ?? process.env.AWARD_DEMO_EMAIL ?? 'award-demo@procurex.tz',
    password: process.env.AWARD_BUYER_PASSWORD ?? process.env.AWARD_DEMO_PASSWORD ?? 'Demo123!'
  },
  supplier: {
    email: process.env.AWARD_SUPPLIER_EMAIL ?? process.env.AWARD_DEMO_EMAIL ?? 'award-demo@procurex.tz',
    password: process.env.AWARD_SUPPLIER_PASSWORD ?? process.env.AWARD_DEMO_PASSWORD ?? 'Demo123!'
  }
};

const visibleErrorPatterns = [
  /could not be loaded/i,
  /could not be refreshed/i,
  /network error/i,
  /failed to fetch/i,
  /service status/i,
  /authentication service is not available/i
];

async function assertReachable() {
  const response = await fetch(baseURL);
  if (!response.ok) {
    throw new Error(`Client dev server responded ${response.status} at ${baseURL}.`);
  }
}

function repoRoot() {
  return path.basename(process.cwd()).toLowerCase() === 'client'
    ? path.resolve(process.cwd(), '..')
    : process.cwd();
}

async function resetAwardContractDemo() {
  if (!shouldReseedDemo) return;
  await new Promise((resolve, reject) => {
    const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const reseedArgs = ['--workspace', 'server', 'run', 'db:seed:award-contract-demo'];
    const child = spawn(process.platform === 'win32' ? `${npmCommand} ${reseedArgs.join(' ')}` : npmCommand, process.platform === 'win32' ? [] : reseedArgs, {
      cwd: repoRoot(),
      env: process.env,
      shell: process.platform === 'win32',
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Award-contract demo reseed failed with exit code ${code}.\n${stdout}\n${stderr}`.trim()));
    });
  });
}

async function attachPageGuards(page, label) {
  const pageErrors = [];
  const failedResponses = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('response', (response) => {
    const status = response.status();
    const url = response.url();
    if (status >= 500 && /\/api\/|localhost:4000/.test(url)) {
      failedResponses.push(`${status} ${url}`);
    }
  });
  return async () => {
    if (pageErrors.length) throw new Error(`${label} page error: ${pageErrors.join('; ')}`);
    if (failedResponses.length) throw new Error(`${label} API error: ${failedResponses.join('; ')}`);
  };
}

async function assertHealthyPage(page, label, expectedTexts = []) {
  await page.waitForLoadState('domcontentloaded');
  await page.locator('body').waitFor({ state: 'visible', timeout: 15000 });
  let bodyText = (await page.locator('body').innerText()).trim();
  if (!bodyText) throw new Error(`${label} rendered a blank page.`);
  const visibleError = visibleErrorPatterns.find((pattern) => pattern.test(bodyText));
  if (visibleError) throw new Error(`${label} displayed an API/error state matching ${visibleError}.`);
  for (const text of expectedTexts) {
    await page.waitForFunction((expected) => document.body.innerText.toLowerCase().includes(String(expected).toLowerCase()), text, { timeout: 15000 });
  }
  bodyText = (await page.locator('body').innerText()).trim();
  const laterVisibleError = visibleErrorPatterns.find((pattern) => pattern.test(bodyText));
  if (laterVisibleError) throw new Error(`${label} displayed an API/error state matching ${laterVisibleError}.`);
}

async function captureVisualSmoke(page, label, expectedTexts = []) {
  await mkdir(screenshotDir, { recursive: true });
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  for (const viewport of visualViewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.waitForTimeout(150);
    await assertHealthyPage(page, `${label} ${viewport.name}`, expectedTexts);
    const metrics = await page.evaluate(() => {
      const root = document.documentElement;
      const body = document.body;
      const buttons = Array.from(document.querySelectorAll('button, a, input, select, textarea'));
      const clipped = buttons.filter((element) => {
        if (element.closest('[aria-hidden="true"]')) return false;
        if (element.closest('.evaluation-table-scroll, .data-table, .award-workflow-tabs, .supplier-detail-tabs, .app-drawer-menu')) return false;
        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;
        return rect.width > window.innerWidth + 2 || rect.left < -2 || rect.right > window.innerWidth + 2;
      });
      return {
        scrollWidth: Math.max(root.scrollWidth, body.scrollWidth),
        innerWidth: window.innerWidth,
        clippedControls: clipped.length,
        clippedControl: clipped[0] ? {
          tag: clipped[0].tagName,
          text: clipped[0].textContent?.trim().slice(0, 80),
          className: String(clipped[0].getAttribute('class') ?? ''),
          rect: (() => {
            const rect = clipped[0].getBoundingClientRect();
            return { left: rect.left, right: rect.right, width: rect.width };
          })()
        } : null
      };
    });
    if (metrics.scrollWidth > metrics.innerWidth + 6) {
      throw new Error(`${label} ${viewport.name} has horizontal overflow: ${metrics.scrollWidth}px > ${metrics.innerWidth}px.`);
    }
    if (metrics.clippedControls > 0) {
      throw new Error(`${label} ${viewport.name} has ${metrics.clippedControls} clipped interactive controls: ${JSON.stringify(metrics.clippedControl)}.`);
    }
    await page.screenshot({ path: path.join(screenshotDir, `${slug}-${viewport.name}.png`), fullPage: false });
  }
  await page.setViewportSize({ width: 1440, height: 960 });
}

async function signIn(page, account) {
  await page.goto('/sign-in');
  await page.locator('#sign-in-email').fill(account.email);
  await page.locator('#sign-in-password').fill(account.password);
  const submit = page.locator('form.screen-form-new button[type="submit"]');
  await submit.waitFor({ state: 'visible' });
  await page.waitForFunction(() => {
    const button = document.querySelector('form.screen-form-new button[type="submit"]');
    return button instanceof HTMLButtonElement && !button.disabled;
  }, null, { timeout: 10000 });
  await submit.click();
  await page.waitForURL((url) => !url.pathname.includes('/sign-in'), { timeout: 20000 });
}

async function fetchDashboard(page) {
  return await page.evaluate(async (apiBase) => {
    const token = window.localStorage.getItem('procurex.authToken');
    const response = await fetch(`${apiBase}/api/award-contract/dashboard`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    if (!response.ok) throw new Error(`Dashboard API responded ${response.status}`);
    return await response.json();
  }, apiBaseURL);
}

async function pickQueueRecord(page, queue, expectedPath) {
  const dashboard = await fetchDashboard(page);
  const rows = dashboard.queues?.[queue] ?? [];
  const matches = rows.filter((row) => String(row.nextAction?.url ?? row.nextRoute ?? '').includes(expectedPath));
  const matching = expectedPath.includes('/award-response')
    ? matches.find((row) => row.noticeId) ?? matches[0]
    : matches[0];
  if (matching) return matching;
  if (rows.length === 0) throw new Error(`No seeded records found in ${queue}.`);
  throw new Error(`No ${queue} record links to ${expectedPath}. Available routes: ${rows.map((row) => row.nextAction?.url ?? row.nextRoute ?? row.title).join(', ')}`);
}

async function openFirstQueueRecord(page, queue, label, expectedPath) {
  await page.goto(`/awards-contracts?queue=${queue}`);
  await assertHealthyPage(page, label, ['Awarding and Contracts', 'Lifecycle queues']);
  const row = await pickQueueRecord(page, queue, expectedPath);
  const visibleQueue = page.locator(`[data-tab="${queue}"].tab-content--visible`);
  await visibleQueue.waitFor({ state: 'visible', timeout: 15000 });
  const card = visibleQueue.locator('.award-lifecycle-card').filter({ hasText: row.title }).first();
  await card.waitFor({ state: 'visible', timeout: 15000 });
  await card.locator('button.btn-primary').first().click();
  const dialog = page.getByRole('dialog').first();
  await dialog.waitFor({ state: 'visible', timeout: 10000 });
  await dialog.getByRole('button', { name: /continue/i }).click();
  await page.waitForURL((url) => url.pathname.includes(expectedPath), { timeout: 15000 });
}

async function submitSupplierClarification(page) {
  const responseTab = page.getByRole('tab', { name: /Response/i }).first();
  await responseTab.click();
  await page.getByRole('button', { name: 'Open action' }).click();
  const dialog = page.getByRole('dialog', { name: 'Supplier award response' });
  await dialog.waitFor({ state: 'visible', timeout: 10000 });
  await dialog.getByLabel(/Response action/i).selectOption('REQUEST_CLARIFICATION');
  await dialog.getByLabel(/Response note/i).fill('E2E smoke clarification request for seeded award data.');
  const responsePromise = page.waitForResponse((response) => response.url().includes('/api/award-contract/notices/') && response.url().includes('/respond'), { timeout: 20000 });
  await dialog.getByRole('button', { name: 'Submit Response' }).click();
  const response = await responsePromise;
  if (!response.ok()) throw new Error(`Supplier response API returned ${response.status()}.`);
  await page.getByRole('dialog', { name: 'Supplier award response' }).waitFor({ state: 'detached', timeout: 20000 });
  await assertHealthyPage(page, 'supplier award response after clarification', ['Supplier award workspace']);
}

async function run() {
  await resetAwardContractDemo();
  await assertReachable();
  const browser = await chromium.launch({ headless });
  const summaries = [];

  try {
    const buyerContext = await browser.newContext({ baseURL });
    const buyerPage = await buyerContext.newPage();
    const assertBuyerGuards = await attachPageGuards(buyerPage, 'buyer');
    await signIn(buyerPage, credentials.buyer);
    summaries.push('buyer signed in');

    await buyerPage.goto('/awards-contracts?queue=my-urgent-actions');
    await assertHealthyPage(buyerPage, 'buyer award dashboard', ['Awarding and Contracts', 'Lifecycle queues']);
    await captureVisualSmoke(buyerPage, 'buyer award dashboard', ['Awarding and Contracts', 'Lifecycle queues']);
    summaries.push('captured buyer dashboard visual smoke');

    await openFirstQueueRecord(buyerPage, 'awarding-in-progress', 'buyer awarding queue', '/awards-contracts/recommendation');
    await assertHealthyPage(buyerPage, 'buyer award recommendation', ['Award readiness review', 'Workflow step']);
    await captureVisualSmoke(buyerPage, 'buyer award recommendation', ['Award readiness review', 'Workflow step']);
    summaries.push('buyer opened award recommendation');

    await openFirstQueueRecord(buyerPage, 'contracts-in-progress', 'buyer contract queue', '/awards-contracts/negotiation');
    await assertHealthyPage(buyerPage, 'buyer contract negotiation', ['Contract preparation', 'Contract formation workspace']);
    await captureVisualSmoke(buyerPage, 'buyer contract negotiation', ['Contract preparation', 'Contract formation workspace']);
    summaries.push('buyer opened contract negotiation');

    await openFirstQueueRecord(buyerPage, 'active-contracts', 'buyer active contract queue', '/awards-contracts/post-award');
    await assertHealthyPage(buyerPage, 'buyer post-award tracking', ['Contract execution and monitoring', 'Post-award workspace']);
    await captureVisualSmoke(buyerPage, 'buyer post-award tracking', ['Contract execution and monitoring', 'Post-award workspace']);
    summaries.push('buyer opened post-award tracking');
    await assertBuyerGuards();
    await buyerContext.close();

    const supplierContext = await browser.newContext({ baseURL });
    const supplierPage = await supplierContext.newPage();
    const assertSupplierGuards = await attachPageGuards(supplierPage, 'supplier');
    await signIn(supplierPage, credentials.supplier);
    summaries.push('supplier signed in');

    await openFirstQueueRecord(supplierPage, 'awards-received', 'supplier awards received queue', '/awards-contracts/award-response');
    await assertHealthyPage(supplierPage, 'supplier award response', ['Supplier award workspace', 'Awards received']);
    await captureVisualSmoke(supplierPage, 'supplier award response', ['Supplier award workspace', 'Awards received']);
    await submitSupplierClarification(supplierPage);
    summaries.push('supplier submitted clarification path');

    await openFirstQueueRecord(supplierPage, 'contracts-in-progress', 'supplier contract queue', '/awards-contracts/negotiation');
    await assertHealthyPage(supplierPage, 'supplier contract negotiation', ['Contract preparation']);
    summaries.push('supplier opened contract negotiation');

    await openFirstQueueRecord(supplierPage, 'active-contracts', 'supplier active contract queue', '/awards-contracts/post-award');
    await assertHealthyPage(supplierPage, 'supplier post-award tracking', ['Contract execution and monitoring']);
    summaries.push('supplier opened post-award tracking');
    await assertSupplierGuards();
    await supplierContext.close();
  } finally {
    await browser.close();
  }

  console.log(`Award/contract E2E smoke passed at ${baseURL}`);
  for (const summary of summaries) console.log(`- ${summary}`);
}

run().catch((error) => {
  console.error('Award/contract E2E smoke failed');
  console.error(error);
  process.exitCode = 1;
});
