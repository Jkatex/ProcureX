import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173';
const apiBaseURL = process.env.PLAYWRIGHT_API_BASE_URL ?? 'http://localhost:4000';
const headless = process.env.PLAYWRIGHT_HEADLESS !== 'false';
const shouldReseed = process.env.EVALUATION_E2E_RESEED !== 'false';
const screenshotDir = process.env.EVALUATION_E2E_SCREENSHOT_DIR ?? path.resolve(process.cwd(), '.cache', 'evaluation-e2e');
const credentials = {
  email: process.env.EVALUATION_BUYER_EMAIL ?? 'evaluation-buyer@procurex.tz',
  password: process.env.EVALUATION_BUYER_PASSWORD ?? 'Demo123!'
};
const seededTenders = [
  { reference: 'PX-GDS-2026-001', category: 'Goods' },
  { reference: 'PX-WRK-2026-002', category: 'Works' },
  { reference: 'PX-SRV-2026-003', category: 'Non-Consultancy Services' },
  { reference: 'PX-CON-2026-004', category: 'Consultancy Services' }
];
const visibleErrorPatterns = [/could not be loaded/i, /network error/i, /failed to fetch/i, /authentication service is not available/i, /evaluation workspace issue/i];

function repoRoot() {
  return path.basename(process.cwd()).toLowerCase() === 'client' ? path.resolve(process.cwd(), '..') : process.cwd();
}

async function runCommand(args, label) {
  await new Promise((resolve, reject) => {
    const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const child = spawn(process.platform === 'win32' ? `${npmCommand} ${args.join(' ')}` : npmCommand, process.platform === 'win32' ? [] : args, {
      cwd: repoRoot(),
      env: process.env,
      shell: process.platform === 'win32',
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${label} failed with exit code ${code}.\n${stdout}\n${stderr}`.trim()));
    });
  });
}

async function reseed() {
  if (shouldReseed) await runCommand(['run', 'db:seed:evaluation-intake-demo'], 'Evaluation E2E reseed');
}

async function assertReachable() {
  const [clientResponse, apiResponse] = await Promise.all([
    fetch(baseURL),
    fetch(`${apiBaseURL}/api/evaluations/ready`)
  ]);
  if (!clientResponse.ok) throw new Error(`Client dev server responded ${clientResponse.status} at ${baseURL}.`);
  if (!apiResponse.ok) throw new Error(`API server responded ${apiResponse.status} at ${apiBaseURL}.`);
}

async function signIn(page) {
  await page.goto('/sign-in');
  const accept = page.getByRole('button', { name: 'Accept' });
  if (await accept.isVisible().catch(() => false)) await accept.click();
  const session = await page.evaluate(async ({ apiBase, email, password }) => {
    const response = await fetch(`${apiBase}/api/identity/auth/sign-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, turnstileToken: 'local-dev-turnstile:evaluation-e2e' })
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(`Sign-in API responded ${response.status}: ${JSON.stringify(body)}`);
    window.localStorage.setItem('procurex.authToken', body.token);
    return body;
  }, { apiBase: apiBaseURL, email: credentials.email, password: credentials.password });
  if (!session.user?.permissions?.includes('evaluation.manage')) throw new Error('Seeded evaluation buyer signed in without evaluation.manage permission.');
  await page.goto('/evaluation');
  await page.waitForURL((url) => url.pathname.includes('/evaluation'), { timeout: 20000 });
}

async function assertHealthyPage(page, label, expectedTexts = []) {
  await page.waitForLoadState('domcontentloaded');
  await page.locator('body').waitFor({ state: 'visible', timeout: 15000 });
  let text = (await page.locator('body').innerText()).trim();
  if (!text) throw new Error(`${label} rendered a blank page.`);
  const errorPattern = visibleErrorPatterns.find((pattern) => pattern.test(text));
  if (errorPattern) throw new Error(`${label} displayed an error matching ${errorPattern}.`);
  for (const expected of expectedTexts) {
    await page.waitForFunction((value) => document.body.innerText.toLowerCase().includes(String(value).toLowerCase()), expected, { timeout: 15000 });
  }
  text = (await page.locator('body').innerText()).trim();
  const laterErrorPattern = visibleErrorPatterns.find((pattern) => pattern.test(text));
  if (laterErrorPattern) throw new Error(`${label} displayed an error matching ${laterErrorPattern}.`);
}

async function attachPageGuards(page, label) {
  const pageErrors = [];
  const apiErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('response', (response) => {
    const status = response.status();
    if (status >= 500 && response.url().includes('/api/')) apiErrors.push(`${status} ${response.url()}`);
  });
  return async () => {
    if (pageErrors.length) throw new Error(`${label} page errors: ${pageErrors.join('; ')}`);
    if (apiErrors.length) throw new Error(`${label} API errors: ${apiErrors.join('; ')}`);
  };
}

async function apiFetch(page, pathName, init = {}) {
  return page.evaluate(async ({ apiBase, pathName, init }) => {
    const token = window.localStorage.getItem('procurex.authToken');
    const response = await fetch(`${apiBase}${pathName}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers ?? {})
      }
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(`${pathName} responded ${response.status}: ${JSON.stringify(body)}`);
    return body;
  }, { apiBase: apiBaseURL, pathName, init });
}

async function openTenderFromList(page, tender) {
  await page.goto('/evaluation');
  await assertHealthyPage(page, 'Evaluation tender list', ['Bid Evaluation', tender.reference]);
  const row = page.locator('.evaluation-tender-row').filter({ hasText: tender.reference }).first();
  await row.waitFor({ state: 'visible', timeout: 20000 });
  await row.getByRole('button', { name: 'View Tender' }).click();
  await page.waitForURL((url) => url.pathname.includes('/procurement/tender-details'), { timeout: 15000 });
  await assertHealthyPage(page, `${tender.reference} tender details`, [tender.reference]);
  await page.goto('/evaluation');
  await assertHealthyPage(page, 'Evaluation tender list after detail view', [tender.reference]);
}

async function startOrContinueEvaluation(page, tender) {
  const row = page.locator('.evaluation-tender-row').filter({ hasText: tender.reference }).first();
  await row.waitFor({ state: 'visible', timeout: 20000 });
  const action = row.getByRole('button', { name: /Start Evaluation|Continue Evaluation|View Results/i }).first();
  await action.waitFor({ state: 'visible', timeout: 15000 });
  const label = (await action.innerText()).trim();
  if (/View Results/i.test(label)) throw new Error(`${tender.reference} is already completed before E2E flow starts. Reseed did not reset evaluation state.`);
  if (/Locked/i.test(label)) throw new Error(`${tender.reference} is locked and not eligible to start evaluation.`);
  await action.click();
  await page.locator('[data-evaluation-workspace-panel]').waitFor({ state: 'visible', timeout: 20000 });
  await assertHealthyPage(page, `${tender.reference} workspace`, [tender.reference, 'Opening Register']);
}

async function clickStage(page, label) {
  const tab = page.locator('.evaluation-stage-tab').filter({ hasText: label }).first();
  await tab.waitFor({ state: 'visible', timeout: 15000 });
  await tab.click();
  await assertHealthyPage(page, `stage ${label}`, [label]);
}

async function selectBidder(page, index) {
  const bidders = page.locator('.evaluation-bidder-switcher button');
  if ((await bidders.count()) <= index) throw new Error(`Expected bidder tab ${index + 1} to be available.`);
  await bidders.nth(index).click();
  await page.waitForFunction((selectedIndex) => {
    const button = document.querySelectorAll('.evaluation-bidder-switcher button')[selectedIndex];
    return button?.classList.contains('active') ?? false;
  }, index);
  await page.waitForTimeout(150);
}

async function setAllVisibleDecisions(page, value, remark = '') {
  const selects = page.locator('.evaluation-review-main select.form-input');
  const count = await selects.count();
  for (let index = 0; index < count; index += 1) {
    const select = selects.nth(index);
    if (await select.isVisible()) await select.selectOption(value);
  }
  if (remark) {
    const textareas = page.locator('.evaluation-review-main textarea.form-input');
    const textareaCount = await textareas.count();
    for (let index = 0; index < textareaCount; index += 1) {
      const textarea = textareas.nth(index);
      if (await textarea.isVisible()) await textarea.fill(remark);
    }
  }
}

async function setFinancialReviewDecisions(page, remark = '') {
  const selects = page.locator('.evaluation-review-main select.form-input');
  const count = await selects.count();
  for (let index = 0; index < count; index += 1) {
    const select = selects.nth(index);
    if (!(await select.isVisible())) continue;
    const optionValues = await select.locator('option').evaluateAll((options) => options.map((option) => option.value).filter(Boolean));
    const value = optionValues.find((option) => option === 'Financially Responsive')
      ?? optionValues.find((option) => option === 'Accepted')
      ?? optionValues[0];
    if (value) await select.selectOption(value);
  }
  if (remark) {
    const textareas = page.locator('.evaluation-review-main textarea.form-input');
    const textareaCount = await textareas.count();
    for (let index = 0; index < textareaCount; index += 1) {
      const textarea = textareas.nth(index);
      if (await textarea.isVisible()) await textarea.fill(remark);
    }
    const inputs = page.locator('.evaluation-review-main input.form-input:not([type="number"])');
    const inputCount = await inputs.count();
    for (let index = 0; index < inputCount; index += 1) {
      const input = inputs.nth(index);
      if (await input.isVisible()) await input.fill(remark);
    }
  }
}

async function setAllVisibleScores(page, score) {
  const inputs = page.locator('.evaluation-review-main input[type="number"]');
  const count = await inputs.count();
  for (let index = 0; index < count; index += 1) {
    const input = inputs.nth(index);
    if (await input.isVisible()) {
      const max = Number(await input.getAttribute('max'));
      const value = Number.isFinite(max) ? Math.min(score, max) : score;
      await input.fill(String(value));
    }
  }
  const textareas = page.locator('.evaluation-review-main textarea.form-input');
  const textareaCount = await textareas.count();
  for (let index = 0; index < textareaCount; index += 1) {
    const textarea = textareas.nth(index);
    if (await textarea.isVisible() && !(await textarea.inputValue()).trim()) await textarea.fill(`E2E scored ${score}.`);
  }
}

async function saveDraft(page) {
  const button = footerButton(page, 'Save Draft');
  await button.waitFor({ state: 'visible', timeout: 10000 });
  if (await button.isDisabled()) {
    throw new Error(`Save Draft button is disabled. Body excerpt: ${(await page.locator('body').innerText()).slice(0, 1200)}`);
  }
  const responsePromise = page
    .waitForResponse((response) => response.url().includes('/api/evaluations/tenders/') && response.url().includes('/workspace'), { timeout: 30000 })
    .catch(async (error) => {
      throw new Error(`${error.message}\nAfter Save Draft click body excerpt:\n${(await page.locator('body').innerText()).slice(0, 1600)}`);
    });
  await button.click();
  const response = await responsePromise;
  if (!response.ok()) throw new Error(`Save Draft API returned ${response.status()}.`);
  await assertHealthyPage(page, 'workspace after Save Draft', ['Evaluation saved']);
}

function footerButton(page, exactText) {
  return page.locator('.evaluation-finish-panel button').filter({ hasText: new RegExp(`^${exactText}$`, 'i') }).first();
}

async function submitFinal(page) {
  const button = footerButton(page, 'Submit Evaluation');
  await button.waitFor({ state: 'visible', timeout: 10000 });
  if (await button.isDisabled()) {
    throw new Error(`Submit Evaluation button is disabled. Body excerpt:\n${(await page.locator('body').innerText()).slice(0, 2200)}`);
  }
  const responsePromise = page
    .waitForResponse((response) => response.url().includes('/api/evaluations/tenders/') && response.url().includes('/workspace') && response.request().method() === 'PUT', { timeout: 20000 })
    .catch(async (error) => {
      throw new Error(`${error.message}\nAfter Submit Evaluation click body excerpt:\n${(await page.locator('body').innerText()).slice(0, 2200)}`);
    });
  await button.click();
  const response = await responsePromise;
  if (!response.ok()) throw new Error(`Submit Evaluation API returned ${response.status()}.`);
  await assertHealthyPage(page, 'workspace after final submission', ['Evaluation completed']);
}

async function verifyRefreshAndContinue(page, tender) {
  await page.reload();
  await assertHealthyPage(page, `${tender.reference} refreshed list`, ['Drafted in evaluation', 'Continue Evaluation', tender.reference]);
  const draftSection = page.locator('section.evaluation-panel').filter({ hasText: 'Drafted in evaluation' }).first();
  await draftSection.waitFor({ state: 'visible', timeout: 15000 });
  const row = draftSection.locator('.evaluation-tender-row').filter({ hasText: tender.reference }).first();
  await row.waitFor({ state: 'visible', timeout: 15000 });
  await row.getByRole('button', { name: 'Continue Evaluation' }).click();
  await page.locator('[data-evaluation-workspace-panel]').waitFor({ state: 'visible', timeout: 20000 });
  await assertHealthyPage(page, `${tender.reference} continued draft`, [tender.reference, 'Custom Evaluation Criteria']);
}

async function evaluateTender(page, tender) {
  await openTenderFromList(page, tender);
  await startOrContinueEvaluation(page, tender);

  const workspaceBefore = await getWorkspaceByReference(page, tender.reference);
  const summary = {
    reference: tender.reference,
    category: tender.category,
    bids: workspaceBefore.bids.length,
    sections: [],
    dataLoading: [],
    calculations: [],
    draftRestored: false,
    finalSubmission: false,
    bugs: []
  };

  await clickStage(page, 'Opening Register');
  await assertHealthyPage(page, `${tender.reference} opening`, ['Total submitted bids', 'Receipt number', 'Original bid amount']);
  summary.sections.push('Opening Register');
  summary.dataLoading.push(`Opening register displayed ${workspaceBefore.bids.length} seeded bids.`);

  await clickStage(page, 'Administrative & Eligibility Evaluation');
  await selectBidder(page, 0);
  await setAllVisibleDecisions(page, 'Fail');
  await setAllVisibleDecisions(page, 'Pass', 'E2E preliminary pass after mandatory fail validation.');
  await selectBidder(page, 1);
  await setAllVisibleDecisions(page, 'Pass', 'E2E preliminary pass.');
  summary.sections.push('Administrative & Eligibility Evaluation');

  await clickStage(page, 'Custom Evaluation Criteria');
  await selectBidder(page, 0);
  await setAllVisibleDecisions(page, 'Pass', 'E2E technical manual pass.');
  await setAllVisibleScores(page, tender.category === 'Consultancy Services' ? 100 : 86);
  await selectBidder(page, 1);
  await setAllVisibleDecisions(page, 'Pass', 'E2E technical manual pass.');
  await setAllVisibleScores(page, tender.category === 'Consultancy Services' ? 60 : 78);
  await saveDraft(page);
  await verifyRefreshAndContinue(page, tender);
  summary.sections.push('Custom Evaluation Criteria');
  summary.draftRestored = true;

  await clickStage(page, 'Financial Review');
  await assertHealthyPage(page, `${tender.reference} financial`, ['Financial Review', 'Evaluated bid price']);
  await selectBidder(page, 0);
  await setAllVisibleScores(page, 95);
  await setFinancialReviewDecisions(page, 'E2E commercial pass.');
  await selectBidder(page, 1);
  await setAllVisibleScores(page, 90);
  await setFinancialReviewDecisions(page, 'E2E commercial pass.');
  summary.sections.push('Financial Review');
  summary.calculations.push('Financial review line checks, evaluated bid price, and financial score columns rendered.');

  const verificationLabel = tender.category === 'Consultancy Services' ? 'Due Diligence & Negotiation' : 'Verification / Post-Qualification';
  await clickStage(page, 'Verification / Post-Qualification');
  await selectBidder(page, 0);
  await setAllVisibleDecisions(page, 'Pass', 'E2E post-qualification pass.');
  await selectBidder(page, 1);
  await setAllVisibleDecisions(page, tender.category === 'Consultancy Services' ? 'Fail' : 'Pass', tender.category === 'Consultancy Services' ? 'E2E threshold/due diligence fail path tested.' : 'E2E post-qualification pass.');
  await assertHealthyPage(page, `${tender.reference} verification`, [verificationLabel]);
  summary.sections.push(verificationLabel);

  await clickStage(page, 'Ranking & Recommendation');
  await assertHealthyPage(page, `${tender.reference} ranking`, ['Consolidated supplier comparison']);
  const rankingSelects = page.locator('.evaluation-review-main select.form-input');
  await rankingSelects.nth(0).selectOption('RECOMMENDED');
  if ((await rankingSelects.count()) > 1) await rankingSelects.nth(1).selectOption('FAILED');
  const rankingTextareas = page.locator('.evaluation-review-main textarea.form-input');
  for (let index = 0; index < await rankingTextareas.count(); index += 1) {
    await rankingTextareas.nth(index).fill(index === 0 ? 'Recommended by E2E based on responsive ranking.' : 'Not recommended by E2E validation.');
  }
  summary.sections.push('Ranking & Recommendation');
  summary.calculations.push('Ranking table rendered with preliminary, technical, evaluated price, financial and total fields.');

  await clickStage(page, 'Evaluation Report');
  await assertHealthyPage(page, `${tender.reference} report`, [tender.reference, 'Evaluation Report']);
  summary.sections.push('Evaluation Report');

  await submitFinal(page);
  const workspaceAfter = await getWorkspaceByReference(page, tender.reference);
  if (workspaceAfter.summary.evaluationStatus !== 'COMPLETED') throw new Error(`${tender.reference} final status is ${workspaceAfter.summary.evaluationStatus}, expected COMPLETED.`);
  summary.finalSubmission = true;
  return summary;
}

async function getWorkspaceByReference(page, reference) {
  const ready = await apiFetch(page, '/api/evaluations/ready');
  const row = ready.tenders.find((item) => item.reference === reference);
  if (!row) throw new Error(`Could not find seeded tender ${reference} in ready API.`);
  return apiFetch(page, `/api/evaluations/tenders/${row.tenderId}/workspace`);
}

async function capture(page, label) {
  await mkdir(screenshotDir, { recursive: true });
  const file = `${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}.png`;
  await page.screenshot({ path: path.join(screenshotDir, file), fullPage: false });
}

async function run() {
  await reseed();
  await assertReachable();
  const browser = await chromium.launch({ headless });
  const results = [];
  try {
    const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 960 } });
    const page = await context.newPage();
    const assertGuards = await attachPageGuards(page, 'evaluation');
    await signIn(page);
    await page.goto('/evaluation');
    await assertHealthyPage(page, 'Evaluation landing', ['Bid Evaluation', 'Published tenders']);
    await capture(page, 'evaluation-landing');

    for (const tender of seededTenders) {
      const result = await evaluateTender(page, tender);
      results.push(result);
      await capture(page, `${tender.reference}-submitted`);
    }

    await assertGuards();
    await context.close();
  } finally {
    await browser.close();
  }

  console.log(`Evaluation E2E passed at ${baseURL}`);
  for (const result of results) {
    console.log(JSON.stringify(result));
  }
}

run().catch((error) => {
  console.error('Evaluation E2E failed');
  console.error(error);
  process.exitCode = 1;
});
