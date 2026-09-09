import { appendFile, mkdir, open, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright-core';
import { auditCheckpointPage, auditQuestionPage, extractNotebookAnswer } from './lib/notebook-response-audit.mjs';
import { assertWorkflowAllowed, canAdvanceAfterAudit } from './lib/notebook-manual-gate.mjs';
import { validateSourceSnapshot, submissionAction, assertRepairAttempt } from './lib/notebook-contract.mjs';

const FULL_RUN_ORDER = [
  'Q0', 'Q1', 'Q2', 'Q3', 'CP-A-M',
  'Q4', 'Q5', 'Q6', 'CP-B-M',
  'Q7', 'Q7B', 'Q8', 'Q9', 'CP-C-M',
  'Q10', 'Q11', 'Q12', 'Q12B', 'CP-D-M',
];
const OPTIONAL_IDS = new Set(['Q7B', 'Q12B']);
const CHROME_PATHS = [
  process.env.NOTEBOOKLM_CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
].filter(Boolean);
const PROFILE_DIR = process.env.NOTEBOOKLM_PROFILE_DIR
  ?? path.join(process.env.LOCALAPPDATA ?? path.join(os.homedir(), 'AppData', 'Local'), 'iZiwei', 'notebooklm-playwright-profile');
const FLOW_PATH = path.resolve('tmp/automation-poc/question-flow-v0.11.json');
const GENERATION_TIMEOUT_MS = Number(process.env.NOTEBOOKLM_GENERATION_TIMEOUT_MS ?? 20 * 60 * 1000);
const LOGIN_TIMEOUT_MS = Number(process.env.NOTEBOOKLM_LOGIN_TIMEOUT_MS ?? 15 * 60 * 1000);
const QUERY_SELECTOR = 'textarea[aria-label="查询框"], textarea[aria-label="Query box"]';
const STOP_SELECTOR = 'button[aria-label="停止生成"], button[aria-label="Stop generating"]';

const [, , command = 'status', caseDirArg, ...flags] = process.argv;
if (!caseDirArg) {
  throw new Error('Usage: node scripts/notebooklm-playwright.mjs <login|run|repair|status> <case-dir> [--once] [--prompt-file=path]');
}

const caseDir = path.resolve(caseDirArg);
const statePath = path.join(caseDir, 'state.json');
const factsPath = path.join(caseDir, 'notebook-facts.md');
const responsesDir = path.join(caseDir, 'responses');
const artifactsDir = path.join(caseDir, 'run-artifacts');
const logPath = path.join(caseDir, 'run-log.jsonl');
const lockPath = path.join(caseDir, '.notebooklm-run.lock');
const runOnce = flags.includes('--once');
const promptFileFlag = flags.find(flag => flag.startsWith('--prompt-file='));
if (flags.includes('--headless')) {
  throw new Error('Headless mode is intentionally disabled for NotebookLM authentication and review.');
}

const readJson = async filePath => JSON.parse(await readFile(filePath, 'utf8'));
const writeJsonAtomic = async (filePath, value) => {
  const tempPath = `${filePath}.${process.pid}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(tempPath, filePath);
};
const log = async (event, details = {}) => {
  const record = { at: new Date().toISOString(), event, ...details };
  await appendFile(logPath, `${JSON.stringify(record)}\n`, 'utf8');
  console.log(JSON.stringify(record));
};

const getNextStep = state => {
  const completed = new Set(state.notebook.completedQuestions ?? []);
  return getRunOrder(state).find(id => !completed.has(id)) ?? null;
};
const getRunOrder = state => {
  const included = new Set(state.notebook.includedOptionalQuestions ?? []);
  return FULL_RUN_ORDER.filter(id => !OPTIONAL_IDS.has(id) || included.has(id));
};

const getChromePath = async () => {
  for (const candidate of CHROME_PATHS) {
    try {
      if ((await stat(candidate)).isFile()) return candidate;
    } catch {}
  }
  throw new Error('Google Chrome was not found. Set NOTEBOOKLM_CHROME_PATH.');
};

const acquireLock = async () => {
  try {
    const handle = await open(lockPath, 'wx');
    await handle.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
    await handle.close();
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error;
    const lock = await readJson(lockPath).catch(() => ({}));
    let alive = false;
    if (Number.isInteger(lock.pid)) {
      try { process.kill(lock.pid, 0); alive = true; } catch {}
    }
    if (alive) throw new Error(`Another NotebookLM runner is active (PID ${lock.pid}).`);
    await rm(lockPath, { force: true });
    return acquireLock();
  }
};
const releaseLock = async () => rm(lockPath, { force: true });

const getFreeLoopbackPort = async () => new Promise((resolve, reject) => {
  const server = net.createServer();
  server.unref();
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : null;
    server.close(error => error ? reject(error) : resolve(port));
  });
});

const waitForCdp = async (port, chromeProcess, timeoutMs = 30000) => {
  const endpoint = `http://127.0.0.1:${port}`;
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (chromeProcess.exitCode !== null) {
      throw new Error(`Dedicated Chrome exited before automation connected (code ${chromeProcess.exitCode}).`);
    }
    try {
      const response = await fetch(`${endpoint}/json/version`);
      if (response.ok) return endpoint;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('Timed out connecting to the dedicated Chrome session.');
};

const waitForChildExit = async (child, timeoutMs = 10000) => {
  if (child.exitCode !== null) return;
  await Promise.race([
    new Promise(resolve => child.once('exit', resolve)),
    new Promise(resolve => setTimeout(resolve, timeoutMs)),
  ]);
};

const launchAutomationSession = async startUrl => {
  await mkdir(PROFILE_DIR, { recursive: true });
  const executablePath = await getChromePath();
  const port = await getFreeLoopbackPort();
  const chromeProcess = spawn(executablePath, [
    `--user-data-dir=${PROFILE_DIR}`,
    '--remote-debugging-address=127.0.0.1',
    `--remote-debugging-port=${port}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-mode',
    '--disable-features=Translate',
    startUrl,
  ], {
    stdio: 'ignore',
    windowsHide: false,
  });
  try {
    const endpoint = await waitForCdp(port, chromeProcess);
    const browser = await chromium.connectOverCDP(endpoint);
    const context = browser.contexts()[0];
    if (!context) throw new Error('Dedicated Chrome did not expose a browser context.');
    const page = context.pages().find(candidate => candidate.url().includes('notebook.google.com'))
      ?? context.pages()[0]
      ?? await context.newPage();
    return {
      browser,
      context,
      page,
      async close() {
        await browser.close().catch(() => {});
        await waitForChildExit(chromeProcess);
        if (chromeProcess.exitCode === null) chromeProcess.kill();
      },
    };
  } catch (error) {
    if (chromeProcess.exitCode === null) chromeProcess.kill();
    throw error;
  }
};

const waitForNotebook = async (page, timeoutMs) => {
  await page.waitForURL(url => url.hostname === 'notebook.google.com', { timeout: timeoutMs });
  await page.locator(QUERY_SELECTOR).first().waitFor({ state: 'visible', timeout: timeoutMs });
  await page.waitForFunction(() => {
    const text = document.body?.innerText ?? '';
    const stillLoading = /Loading Notebook|正在加载笔记本/i.test(text);
    const emptySourceShell = /(?:^|\n)0\s*(?:个)?来源(?:\n|$)/.test(text);
    return !stillLoading && !emptySourceShell && text.length > 500;
  }, undefined, { timeout: timeoutMs, polling: 1000 });
};

const verifySources = async (page, state) => {
  const sourcesTab = page.getByText('来源', { exact: true }).first();
  if (await sourcesTab.isVisible().catch(() => false)) {
    await sourcesTab.click();
    await page.getByRole('button', { name: '添加来源' }).first()
      .waitFor({ state: 'visible', timeout: 60000 });
  }
  await page.waitForTimeout(2500);
  for (let pass = 0; pass < 5; pass += 1) {
    const looseSourceChecks = page.locator('input[type="checkbox"]:is([aria-label^="Select "],[aria-label^="选择“"])');
    const looseSourceCount = await looseSourceChecks.count();
    for (let index = 0; index < looseSourceCount; index += 1) {
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
  const checkedLabels = await page.locator('input[type="checkbox"]:checked').evaluateAll(elements =>
    elements.map(element => element.getAttribute('aria-label') ?? '').filter(Boolean));
  const dangerous = checkedLabels.filter(label => /事实包-刘|事实包-仪|建账|台账/.test(label));
  const wrongLockedFacts = checkedLabels.filter(label =>
    /^(?:Select |选择“)/.test(label)
    && !(state.notebook.sourcePolicy?.courseLabels ?? []).includes(label)
    && (!label.includes(state.caseId) || !label.includes(state.ledger.fingerprint)));
  if (dangerous.length) throw new Error(`Unsafe selected sources: ${dangerous.join(', ')}`);
  if (wrongLockedFacts.length) throw new Error(`Wrong locked fact source selected: ${wrongLockedFacts.join(', ')}`);

  const snapshot = {
    url: page.url().split('?')[0], verifiedAt: new Date().toISOString(),
    checks: await page.locator('input[type="checkbox"][aria-label]').evaluateAll(es => es.map(e => ({label:e.getAttribute('aria-label'),checked:e.checked}))),
  };
  validateSourceSnapshot(snapshot, state);
  const bodyText = await page.locator('body').innerText();
  const sourceHints = bodyText.split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => /事实包|LOCKED-FACTS|课程|讲义|紫微/.test(line))
    .slice(0, 30);
  await log('source_snapshot', {
    url: page.url(),
    title: await page.title(),
    bodyChars: bodyText.length,
    bodySample: bodyText.slice(0, 500),
    checkedLabels,
    sourceHints,
  });
  if (!bodyText.includes(state.ledger.fingerprint)) {
    throw new Error(`Notebook does not expose expected fingerprint ${state.ledger.fingerprint}; visible source hints: ${sourceHints.join(' | ')}`);
  }
  await log('sources_verified', { checkedCount: checkedLabels.length, fingerprint: state.ledger.fingerprint });
  const chatTab = page.getByText('对话', { exact: true }).first();
  if (await chatTab.isVisible().catch(() => false)) {
    await chatTab.click();
    await page.locator(QUERY_SELECTOR).first().waitFor({ state: 'visible', timeout: 60000 });
  }
  return snapshot;
};

const isGenerationActive = async page => {
  const stopVisible = await page.locator(STOP_SELECTOR).first().isVisible().catch(() => false);
  const queryDisabled = await page.locator(QUERY_SELECTOR).first().isDisabled().catch(() => false);
  const bodyText = await page.locator('body').innerText().catch(() => '');
  const thinkingVisible = /正在思考|Thinking\.\.\.|Generating/i.test(bodyText);
  return stopVisible || queryDisabled || thinkingVisible;
};

const hasCompletedAnswer = (pageText, stepId) => {
  try {
    const answer = extractNotebookAnswer(pageText, stepId);
    if (answer.length < 200) return false;
    const anchor = answer.slice(0, Math.min(120, answer.length));
    const answerStart = pageText.lastIndexOf(anchor);
    if (answerStart < 0) return false;
    return ['\nkeep_pin', '\n保存到笔记', '\ncopy_all']
      .some(marker => pageText.indexOf(marker, answerStart + anchor.length) >= 0);
  } catch {
    return false;
  }
};

const waitForGeneration = async (page, bodyLengthBefore, promptLength, stepId) => {
  const startedAt = Date.now();
  let nextRefreshAt = startedAt + 60_000;
  let sawGeneration = false;
  let stableReadyPolls = 0;
  while (Date.now() - startedAt < GENERATION_TIMEOUT_MS) {
    await page.waitForTimeout(5000);
    if (Date.now() >= nextRefreshAt) {
      await log('refresh_generation_status', { stepId });
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
      await waitForNotebook(page, 120000);
      nextRefreshAt = Date.now() + 60_000;
    }
    const active = await isGenerationActive(page);
    const bodyText = await page.locator('body').innerText();
    const currentLength = bodyText.length;
    if (hasCompletedAnswer(bodyText, stepId)) {
      stableReadyPolls += 1;
      if (stableReadyPolls >= 2) return currentLength;
      continue;
    }
    const hasSubstantialResponse = currentLength > bodyLengthBefore + promptLength + 200;
    sawGeneration ||= active || hasSubstantialResponse;
    if (sawGeneration && !active && hasSubstantialResponse) {
      stableReadyPolls += 1;
      if (stableReadyPolls >= 2) return currentLength;
    } else {
      stableReadyPolls = 0;
    }
  }
  throw new Error(`NotebookLM generation exceeded ${Math.round(GENERATION_TIMEOUT_MS / 60000)} minutes.`);
};

const getPromptMarker = prompt => prompt.split(/\r?\n/)
  .map(line => line.trim())
  .find(line => line.length >= 24)
  ?.slice(0, 60) ?? prompt.trim().slice(0, 40);

const pageContainsPrompt = async (page, prompt) => {
  const marker = getPromptMarker(prompt);
  const bodyText = await page.locator('body').innerText().catch(() => '');
  return marker.length > 0 && bodyText.includes(marker);
};

const submitStep = async ({ page, state, step, save = value => writeJsonAtomic(statePath, value) }) => {
  const query = page.locator(QUERY_SELECTOR).first();
  await query.waitFor({ state: 'visible', timeout: 60000 });
  if (state.notebook.inFlight?.stepId === step.id) {
    if (!state.notebook.inFlight.confirmedAt) {
      throw new Error(`Ambiguous unconfirmed submission for ${step.id}; refusing to resend automatically.`);
    }
    if (!await pageContainsPrompt(page, step.prompt)) {
      await log('refresh_for_in_flight_history', { stepId: step.id });
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
      await waitForNotebook(page, 120000);
      await page.waitForFunction(marker => (document.body?.innerText ?? '').includes(marker),
        getPromptMarker(step.prompt), { timeout: 120000, polling: 1000 }).catch(() => {});
    }
    submissionAction(state.notebook.inFlight, true);
    if (!await pageContainsPrompt(page, step.prompt)) {
      throw new Error(`Confirmed ${step.id} is not visible after refresh; refusing to resend automatically.`);
    }
    await log('resume_in_flight_response', { stepId: step.id });
    return;
  }
  if (await isGenerationActive(page)) {
    await log('wait_for_previous_generation_idle', { nextStepId: step.id });
    const idleDeadline = Date.now() + 120_000;
    while (await isGenerationActive(page)) {
      if (Date.now() >= idleDeadline) {
        throw new Error(`NotebookLM remained busy before ${step.id}; no submission receipt exists, so the step was not sent.`);
      }
      await page.waitForTimeout(2000);
    }
    await query.waitFor({ state: 'visible', timeout: 60000 });
  }

  const sourceSnapshot = await verifySources(page, state);
  const bodyLengthBefore = (await page.locator('body').innerText()).length;
  state.notebook.inFlight = { stepId: step.id, submittedAt: new Date().toISOString(), bodyLengthBefore, sourceSnapshot };
  await save(state);
  await query.fill(step.prompt);
  await query.press('Enter');
  try {
    await page.waitForFunction(({ selector, marker }) => {
      const queryElement = document.querySelector(selector);
      const queryCleared = queryElement instanceof HTMLTextAreaElement && queryElement.value.length === 0;
      const promptVisible = (document.body?.innerText ?? '').includes(marker);
      return queryCleared && promptVisible;
    }, { selector: QUERY_SELECTOR, marker: getPromptMarker(step.prompt) }, { timeout: 15000, polling: 500 });
  } catch (error) {
    await save(state);
    throw new Error(`NotebookLM did not confirm submission for ${step.id}.`);
  }
  state.notebook.inFlight.confirmedAt = new Date().toISOString();
  await save(state);
  await writeJsonAtomic(path.join(responsesDir, `${step.id}-receipt.json`), state.notebook.inFlight);
  await log('prompt_submitted', { stepId: step.id, promptChars: step.prompt.length, bodyLengthBefore });
};

const saveFailureEvidence = async (page, stepId, error) => {
  await mkdir(artifactsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const screenshotPath = path.join(artifactsDir, `${stepId}-${stamp}-failure.png`);
  await page.screenshot({ path: screenshotPath, fullPage: false }).catch(() => {});
  await log('step_failed', { stepId, message: error.message, screenshotPath });
};

const advanceState = async (state, stepId, auditPath) => {
  const audit = await readJson(auditPath);
  if (!canAdvanceAfterAudit(state, stepId, audit)) {
    if (audit.status === 'PASS') {
      state.phase = 'MANUAL_REVIEW_PENDING';
      await writeJsonAtomic(statePath, state);
    }
    return { advanced: false, audit };
  }
  const completed = new Set(state.notebook.completedQuestions ?? []);
  completed.add(stepId);
  state.notebook.completedQuestions = getRunOrder(state).filter(id => completed.has(id));
  state.notebook.currentQuestion = getNextStep(state);
  state.notebook.inFlight = null;
  state.notebook.lastCheckpointAt = new Date().toISOString();
  state.phase = state.notebook.currentQuestion
    ? (state.notebook.currentQuestion.startsWith('CP-') ? 'CHECKPOINT_PENDING' : 'QUESTION_PENDING')
    : 'COMPLETE';
  await writeJsonAtomic(statePath, state);
  return { advanced: true, audit };
};

const runWorkflow = async () => {
  await acquireLock();
  await mkdir(responsesDir, { recursive: true });
  await mkdir(artifactsDir, { recursive: true });
  let session;
  try {
    const flow = await readJson(FLOW_PATH);
    let state = await readJson(statePath);
    assertWorkflowAllowed(state);
    if (!state.notebook.url) throw new Error('state.json has no notebook URL. Bootstrap is required first.');
    session = await launchAutomationSession(state.notebook.url);
    const { page } = session;
    if (page.url() !== state.notebook.url) {
      await page.goto(state.notebook.url, { waitUntil: 'domcontentloaded', timeout: 120000 });
    }
    await waitForNotebook(page, 120000);
    await verifySources(page, state);

    while (true) {
      state = await readJson(statePath);
      assertWorkflowAllowed(state);
      const stepId = getNextStep(state);
      if (!stepId) {
        state.notebook.currentQuestion = null;
        state.notebook.inFlight = null;
        state.phase = 'COMPLETE';
        await writeJsonAtomic(statePath, state);
        await log('workflow_complete', { caseId: state.caseId });
        break;
      }
      const step = flow.items.find(item => item.id === stepId);
      if (!step) throw new Error(`Missing prompt ${stepId}.`);
      if (state.notebook.inFlight?.stepId && state.notebook.inFlight.stepId !== stepId) {
        throw new Error(`State mismatch: in-flight ${state.notebook.inFlight.stepId}, next ${stepId}.`);
      }

      try {
        // Source selection can reset after a generation-recovery reload.
        // Recheck immediately before each submission, including continuous runs.
        await verifySources(page, state);
        await submitStep({ page, state, step });
        const bodyLengthBefore = state.notebook.inFlight?.bodyLengthBefore
          ?? (await readJson(statePath)).notebook.inFlight?.bodyLengthBefore
          ?? 0;
        await waitForGeneration(page, bodyLengthBefore, step.prompt.length, stepId);
        const pageText = await page.locator('body').innerText();
        const pagePath = path.join(responsesDir, `${stepId}-page.txt`);
        await writeFile(pagePath, pageText, 'utf8');
        const completionScreenshot = path.join(artifactsDir, `${stepId}-complete.png`);
        await page.screenshot({ path: completionScreenshot, fullPage: false, timeout: 15000 })
          .catch(error => log('completion_screenshot_skipped', { stepId, message: error.message }));

        const audited = stepId.startsWith('CP-')
          ? await auditCheckpointPage({ pagePath, stepId })
          : await auditQuestionPage({ pagePath, factsPath, stepId });
        await writeFile(path.join(responsesDir, `${stepId}-page.html`), await page.content());
        const advanced = await advanceState(await readJson(statePath), stepId, audited.auditPath);
        await log('step_audited', {
          stepId,
          status: audited.result.status,
          issues: audited.result.issues?.length ?? 0,
          advanced: advanced.advanced,
        });
        if (!advanced.advanced) break;
        if (runOnce || state.notebook.manualReviewRequired) break;
        await page.waitForTimeout(3000);
      } catch (error) {
        await saveFailureEvidence(page, stepId, error);
        throw error;
      }
    }
  } finally {
    await session?.close().catch(() => {});
    await releaseLock().catch(() => {});
  }
};

const runRepair = async () => {
  if (!promptFileFlag) throw new Error('repair requires --prompt-file=<path>.');
  const promptPath = path.resolve(promptFileFlag.slice('--prompt-file='.length));
  const prompt = await readFile(promptPath, 'utf8');
  const repairId = prompt.match(/^([A-Z]+-[A-Z0-9-]+)/)?.[1];
  if (!repairId) throw new Error('Repair prompt must begin with a stable uppercase repair id, such as REPAIR-Q6.');

  await acquireLock();
  await mkdir(responsesDir, { recursive: true });
  await mkdir(artifactsDir, { recursive: true });
  let session;
  try {
    const state = await readJson(statePath);
    if (!state.notebook.url) throw new Error('state.json has no notebook URL.');
    session = await launchAutomationSession(state.notebook.url);
    const { page } = session;
    if (page.url() !== state.notebook.url) {
      await page.goto(state.notebook.url, { waitUntil: 'domcontentloaded', timeout: 120000 });
    }
    await waitForNotebook(page, 120000);
    await verifySources(page, state);
    const receiptPath = path.join(responsesDir, repairId + '-receipt.json');
    const previous = await readJson(receiptPath).catch(() => null);
    assertRepairAttempt(repairId, await readdir(responsesDir), previous, state.notebook.manualReviewRequired === true);
    const repairState = structuredClone(state);
    repairState.notebook.inFlight = previous;
    await submitStep({page, state:repairState, step:{id:repairId,prompt}, save:value => writeJsonAtomic(receiptPath,value.notebook.inFlight)});
    await waitForGeneration(page, repairState.notebook.inFlight.bodyLengthBefore, prompt.length, repairId);
    const pageText = await page.locator('body').innerText();
    const pagePath = path.join(responsesDir, `${repairId}-page.txt`);
    const answerPath = path.join(responsesDir, `${repairId}-answer.txt`);
    await writeFile(pagePath, pageText, 'utf8');
    await writeFile(answerPath, extractNotebookAnswer(pageText, repairId), 'utf8');
    await page.screenshot({ path: path.join(artifactsDir, `${repairId}-complete.png`), fullPage: false });
    await log('repair_answer_saved', { repairId, pagePath, answerPath });
  } finally {
    await session?.close().catch(() => {});
    await releaseLock().catch(() => {});
  }
};

const login = async () => {
  const state = await readJson(statePath);
  await mkdir(PROFILE_DIR, { recursive: true });
  const executablePath = await getChromePath();
  const chromeProcess = spawn(executablePath, [
    `--user-data-dir=${PROFILE_DIR}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-mode',
    state.notebook.url || 'https://notebook.google.com/',
  ], {
    stdio: 'inherit',
    windowsHide: false,
  });
  console.log('请在这个普通的专用Chrome窗口中登录Google并打开NotebookLM。完成后直接关闭整个专用Chrome窗口。');
  console.log(`脚本最多等待${Math.round(LOGIN_TIMEOUT_MS / 60000)}分钟；不会读取、复制或导出登录信息。`);
  try {
    await Promise.race([
      new Promise((resolve, reject) => {
        chromeProcess.once('exit', code => code === 0 ? resolve() : reject(new Error(`Chrome exited with code ${code}.`)));
        chromeProcess.once('error', reject);
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Login window timed out.')), LOGIN_TIMEOUT_MS)),
    ]);
  } catch (error) {
    if (chromeProcess.exitCode === null) chromeProcess.kill();
    throw error;
  }
  console.log('专用Chrome已关闭，登录配置已保存在本机。');
};

if (command === 'status') {
  const state = await readJson(statePath);
  console.log(JSON.stringify({
    caseId: state.caseId,
    phase: state.phase,
    next: getNextStep(state),
    inFlight: state.notebook.inFlight ?? null,
    profileDir: PROFILE_DIR,
  }, null, 2));
} else if (command === 'login') {
  await login();
} else if (command === 'run') {
  await runWorkflow();
} else if (command === 'repair') {
  await runRepair();
} else {
  throw new Error(`Unknown command: ${command}`);
}

