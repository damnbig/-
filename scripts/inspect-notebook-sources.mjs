import { spawn } from 'node:child_process';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';

const url = process.argv[2];
if (!url) throw new Error('Usage: node scripts/inspect-notebook-sources.mjs <notebook-url>');

const profileDir = process.env.NOTEBOOKLM_PROFILE_DIR
  ?? path.join(process.env.LOCALAPPDATA ?? path.join(os.homedir(), 'AppData', 'Local'), 'iZiwei', 'notebooklm-playwright-profile');
const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const port = await new Promise((resolve, reject) => {
  const server = net.createServer();
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    server.close(error => error ? reject(error) : resolve(address.port));
  });
});
const child = spawn(chromePath, [
  `--user-data-dir=${profileDir}`,
  '--remote-debugging-address=127.0.0.1',
  `--remote-debugging-port=${port}`,
  '--no-first-run',
  '--no-default-browser-check',
  url,
], { stdio: 'ignore', windowsHide: false });

let browser;
try {
  const endpoint = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${endpoint}/json/version`);
      if (response.ok) break;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  browser = await chromium.connectOverCDP(endpoint);
  const context = browser.contexts()[0];
  const page = context.pages().find(candidate => candidate.url().includes('notebook.google.com'))
    ?? await context.newPage();
  if (page.url() !== url) await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(8000);
  const sourcesTab = page.getByText('来源', { exact: true }).first();
  if (await sourcesTab.isVisible().catch(() => false)) {
    await sourcesTab.click();
    await page.waitForTimeout(2500);
  }
  const addSource = page.getByRole('button', { name: '添加来源' }).first();
  if (await addSource.isVisible().catch(() => false)) {
    await addSource.click();
    await page.waitForTimeout(1500);
  }
  const controls = await page.locator('button, input, textarea, [role="button"], [role="checkbox"]').evaluateAll(elements =>
    elements.map(element => ({
      tag: element.tagName,
      type: element.getAttribute('type'),
      role: element.getAttribute('role'),
      aria: element.getAttribute('aria-label'),
      title: element.getAttribute('title'),
      text: (element.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 160),
      checked: element instanceof HTMLInputElement ? element.checked : element.getAttribute('aria-checked'),
    })).filter(item => item.aria || item.title || item.text));
  const bodyText = await page.locator('body').innerText();
  const sourceLines = bodyText.split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => /来源|事实包|LOCKED|添加|上传/.test(line))
    .slice(0, 120);
  const screenshot = path.resolve('tmp/automation-poc/notebook-source-inspection.png');
  await page.screenshot({ path: screenshot, fullPage: false });
  console.log(JSON.stringify({ url: page.url(), title: await page.title(), sourceLines, screenshot, controls }, null, 2));
} finally {
  await browser?.close().catch(() => {});
  if (child.exitCode === null) child.kill();
}
