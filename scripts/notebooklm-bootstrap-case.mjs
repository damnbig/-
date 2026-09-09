import { readFile, rename, stat, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';

const [, , caseDirArg, notebookUrl] = process.argv;
if (!caseDirArg || !notebookUrl) {
  throw new Error('Usage: node scripts/notebooklm-bootstrap-case.mjs <case-dir> <notebook-url>');
}

const caseDir = path.resolve(caseDirArg);
const statePath = path.join(caseDir, 'state.json');
const state = JSON.parse(await readFile(statePath, 'utf8'));
const factsPath = path.join(caseDir, `LOCKED-FACTS-${state.caseId}-${state.ledger.fingerprint}.md`);
const profileDir = process.env.NOTEBOOKLM_PROFILE_DIR
  ?? path.join(process.env.LOCALAPPDATA ?? path.join(os.homedir(), 'AppData', 'Local'), 'iZiwei', 'notebooklm-playwright-profile');
const chromeCandidates = [
  process.env.NOTEBOOKLM_CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
].filter(Boolean);
let chromePath;
for (const candidate of chromeCandidates) {
  try {
    if ((await stat(candidate)).isFile()) { chromePath = candidate; break; }
  } catch {}
}
if (!chromePath) throw new Error('Google Chrome was not found.');

let child;
let endpoint = process.env.NOTEBOOKLM_CDP_ENDPOINT;
if (!endpoint) {
  const port = await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(error => error ? reject(error) : resolve(address.port));
    });
  });
  endpoint = `http://127.0.0.1:${port}`;
  child = spawn(chromePath, [
    `--user-data-dir=${profileDir}`,
    '--remote-debugging-address=127.0.0.1',
    `--remote-debugging-port=${port}`,
    '--no-first-run',
    '--no-default-browser-check',
    notebookUrl,
  ], { stdio: 'ignore', windowsHide: false });
}

let browser;
try {
  const deadline = Date.now() + 30000;
  let ready = false;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${endpoint}/json/version`);
      if (response.ok) { ready = true; break; }
    } catch {}
    if (child?.exitCode !== null) throw new Error(`Dedicated Chrome exited before CDP connected (${child.exitCode}).`);
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (!ready) throw new Error(`Timed out connecting to ${endpoint}.`);
  browser = await chromium.connectOverCDP(endpoint);
  const context = browser.contexts()[0];
  const page = context.pages().find(candidate => candidate.url().includes('notebook.google.com'))
    ?? await context.newPage();
  if (page.url().split('?')[0] !== notebookUrl.split('?')[0]) {
    await page.goto(notebookUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
  }
  await page.getByText('来源', { exact: true }).first().click();
  await page.getByRole('button', { name: '添加来源' }).first().waitFor({ state: 'visible', timeout: 120000 });

  await page.waitForTimeout(2500);
  let looseSourceChecks = page.locator('input[type="checkbox"]:is([aria-label^="Select "],[aria-label^="选择“"])');
  const lockedCount = await looseSourceChecks.count();
  let currentFound = false;
  for (let index = 0; index < lockedCount; index += 1) {
    const checkbox = looseSourceChecks.nth(index);
    const label = await checkbox.getAttribute('aria-label') ?? '';
    const isCurrent = (label.includes(state.caseId) && label.includes(state.ledger.fingerprint)) || (state.notebook.sourcePolicy?.courseLabels ?? []).includes(label);
    currentFound ||= label.includes(state.caseId) && label.includes(state.ledger.fingerprint);
    if (isCurrent) {
      if (!await checkbox.isChecked()) await checkbox.check();
    } else if (await checkbox.isChecked()) {
      await checkbox.uncheck();
    }
  }

  if (!currentFound) {
    await page.getByRole('button', { name: '添加来源' }).first().click();
    const uploadButton = page.getByText('上传文件', { exact: true }).first();
    await uploadButton.waitFor({ state: 'visible', timeout: 30000 });
    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser', { timeout: 30000 }),
      uploadButton.click(),
    ]);
    await chooser.setFiles(factsPath);
    const currentCheck = page.locator(
      `input[type="checkbox"][aria-label*="${state.ledger.fingerprint}"][aria-label*="${state.caseId}"]`,
    ).first();
    await currentCheck.waitFor({ state: 'visible', timeout: 180000 });
    if (!await currentCheck.isChecked()) await currentCheck.check();
  }

  for (let pass = 0; pass < 5; pass += 1) {
    looseSourceChecks = page.locator('input[type="checkbox"]:is([aria-label^="Select "],[aria-label^="选择“"])');
    const refreshedCount = await looseSourceChecks.count();
    for (let index = 0; index < refreshedCount; index += 1) {
      const checkbox = looseSourceChecks.nth(index);
      const label = await checkbox.getAttribute('aria-label') ?? '';
      const isCurrent = (label.includes(state.caseId) && label.includes(state.ledger.fingerprint)) || (state.notebook.sourcePolicy?.courseLabels ?? []).includes(label);
      await checkbox.setChecked(isCurrent, { force: true });
    }
    await page.waitForTimeout(750);
    const wrongCheckedCount = await page.locator(
      'input[type="checkbox"]:is([aria-label^="Select "],[aria-label^="选择“"]):checked',
    ).evaluateAll((elements, expected) => elements.filter(element => {
      const label = element.getAttribute('aria-label') ?? '';
      return !(expected.courseLabels ?? []).includes(label) && (!label.includes(expected.caseId) || !label.includes(expected.fingerprint));
    }).length, { caseId: state.caseId, fingerprint: state.ledger.fingerprint, courseLabels: state.notebook.sourcePolicy?.courseLabels ?? [] });
    if (wrongCheckedCount === 0) break;
  }
  await page.waitForTimeout(1000);

  const checkedLockedLabels = (await page.locator('input[type="checkbox"]:checked').evaluateAll(elements =>
    elements.map(element => element.getAttribute('aria-label') ?? ''))).filter(label => /^(?:Select |选择“)/.test(label) && !(state.notebook.sourcePolicy?.courseLabels ?? []).includes(label));
  if (checkedLockedLabels.length !== 1
    || !checkedLockedLabels[0].includes(state.caseId)
    || !checkedLockedLabels[0].includes(state.ledger.fingerprint)) {
    throw new Error(`Locked fact selection is unsafe: ${checkedLockedLabels.join(' | ')}`);
  }

  const currentUrl = page.url().split('?')[0];
  state.phase = 'QUESTION_PENDING';
  state.notebook = {
    ...state.notebook,
    url: currentUrl,
    promptVersion: 'v0.11',
    sourceUploaded: true,
    admissionPassed: false,
    currentQuestion: 'Q0',
    completedQuestions: [],
    includedOptionalQuestions: ['Q7B', 'Q12B'],
    inFlight: null,
  };
  const tempPath = `${statePath}.${process.pid}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  await rename(tempPath, statePath);
  console.log(JSON.stringify({
    caseId: state.caseId,
    fingerprint: state.ledger.fingerprint,
    notebookUrl: currentUrl,
    checkedLockedLabels,
    next: state.notebook.currentQuestion,
    optionals: state.notebook.includedOptionalQuestions,
  }, null, 2));
} finally {
  await browser?.close().catch(() => {});
  if (child?.exitCode === null) child.kill();
}

