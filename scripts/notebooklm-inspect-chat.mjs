import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';

const [, , notebookUrl, outputPath] = process.argv;
if (!notebookUrl || !outputPath) {
  throw new Error('Usage: node scripts/notebooklm-inspect-chat.mjs <notebook-url> <output-path>');
}

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
  notebookUrl,
], { stdio: 'ignore', windowsHide: false });

let browser;
try {
  const endpoint = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`${endpoint}/json/version`)).ok) break;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  browser = await chromium.connectOverCDP(endpoint);
  const context = browser.contexts()[0];
  const page = context.pages().find(candidate => candidate.url().includes('notebook.google.com'))
    ?? await context.newPage();
  if (page.url().split('?')[0] !== notebookUrl.split('?')[0]) {
    await page.goto(notebookUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
  }
  await page.locator('textarea[aria-label="查询框"], textarea[aria-label="Query box"]')
    .first().waitFor({ state: 'visible', timeout: 120000 });
  await page.waitForTimeout(10000);
  const text = await page.locator('body').innerText();
  const buttons = await page.locator('button').evaluateAll(elements => elements.map(element => ({
    text: (element.textContent ?? '').trim().replace(/\s+/g, ' '),
    ariaLabel: element.getAttribute('aria-label'),
    title: element.getAttribute('title'),
  })).filter(item => item.text || item.ariaLabel || item.title));
  await writeFile(path.resolve(outputPath), text, 'utf8');
  console.log(JSON.stringify({ url: page.url(), chars: text.length, buttons, tail: text.slice(-8000) }, null, 2));
} finally {
  await browser?.close().catch(() => {});
  if (child.exitCode === null) child.kill();
}
