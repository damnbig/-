import { spawn } from 'node:child_process';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';

const sourceUrl = process.argv[2];
const copyTitle = process.argv[3];
if (!sourceUrl) throw new Error('Usage: node scripts/notebooklm-copy-notebook.mjs <source-url>');
const profileDir = process.env.NOTEBOOKLM_PROFILE_DIR
  ?? path.join(process.env.LOCALAPPDATA ?? path.join(os.homedir(), 'AppData', 'Local'), 'iZiwei', 'notebooklm-playwright-profile');
const port = await new Promise((resolve, reject) => {
  const server = net.createServer();
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    server.close(error => error ? reject(error) : resolve(address.port));
  });
});
const child = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  `--user-data-dir=${profileDir}`,
  '--remote-debugging-address=127.0.0.1',
  `--remote-debugging-port=${port}`,
  '--no-first-run',
  '--no-default-browser-check',
  sourceUrl,
], { stdio: 'ignore', windowsHide: false });

let browser;
try {
  const endpoint = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 30000;
  let ready = false;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${endpoint}/json/version`);
      if (response.ok) { ready = true; break; }
    } catch {}
    if (child.exitCode !== null) throw new Error(`Dedicated Chrome exited (${child.exitCode}).`);
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (!ready) throw new Error('Timed out connecting to dedicated Chrome.');
  browser = await chromium.connectOverCDP(endpoint);
  const context = browser.contexts()[0];
  const page = context.pages().find(candidate => candidate.url().includes('notebook.google.com'))
    ?? await context.newPage();
  if (page.url().split('?')[0] !== sourceUrl.split('?')[0]) {
    await page.goto(sourceUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
  }
  if (sourceUrl === 'https://notebook.google.com/') {
    await page.waitForTimeout(5000);
    if (copyTitle) {
      const titleElement = page.getByText(copyTitle, { exact: true }).first();
      const titleId = await titleElement.getAttribute('id');
      if (!titleId) throw new Error(`Notebook card title has no id: ${copyTitle}`);
      const href = await page.locator(`a[aria-labelledby~="${titleId}"]`).first().getAttribute('href');
      if (!href) throw new Error(`Notebook card has no href: ${copyTitle}`);
      console.log(JSON.stringify({ title: copyTitle, url: new URL(href, page.url()).href }, null, 2));
    } else {
      const notebooks = await page.locator('[data-notebook-id], a[href*="/notebook/"], [role="button"]')
        .evaluateAll(elements => elements.map(element => ({
          title: (element.textContent ?? '').trim().replace(/\s+/g, ' '),
          url: element instanceof HTMLAnchorElement ? element.href : null,
          notebookId: element.getAttribute('data-notebook-id'),
          ariaLabel: element.getAttribute('aria-label'),
        })).filter(item => item.title || item.ariaLabel || item.notebookId));
      console.log(JSON.stringify({ url: page.url(), notebooks, body: (await page.locator('body').innerText()).slice(0, 12000) }, null, 2));
    }
  } else {
    const copyButton = page.getByRole('button', { name: '复制笔记本' }).first();
    await copyButton.waitFor({ state: 'visible', timeout: 120000 });
    await copyButton.click();
    await page.waitForTimeout(2000);
    if (copyTitle) {
    const copyDialog = page.locator('[role="dialog"]').filter({ hasText: '复制笔记本' }).last();
    const titleInput = copyDialog.getByRole('textbox').first();
    await titleInput.fill(copyTitle);
    await Promise.all([
      page.waitForURL(url => url.hostname === 'notebook.google.com'
        && url.pathname.startsWith('/notebook/')
        && url.href.split('?')[0] !== sourceUrl.split('?')[0], { timeout: 120000 }),
      copyDialog.getByRole('button', { name: '创建', exact: true }).click(),
    ]);
    await page.waitForTimeout(3000);
    }
    const dialogs = await page.locator('[role="dialog"]').allTextContents();
    const buttons = await page.locator('button').evaluateAll(elements => elements
      .map(element => ({ aria: element.getAttribute('aria-label'), text: (element.textContent ?? '').trim().replace(/\s+/g, ' ') }))
      .filter(item => item.aria || item.text));
    console.log(JSON.stringify({ url: page.url(), dialogs, buttons: buttons.slice(-30) }, null, 2));
  }
} finally {
  await browser?.close().catch(() => {});
  if (child.exitCode === null) child.kill();
}
