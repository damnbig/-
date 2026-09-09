import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';

const [, , notebookUrl, outputDir] = process.argv;
if (!notebookUrl || !outputDir) {
  throw new Error('Usage: node scripts/notebooklm-export-chat.mjs <notebook-url> <output-dir>');
}

const profileDir = process.env.NOTEBOOKLM_PROFILE_DIR
  ?? path.join(process.env.LOCALAPPDATA ?? path.join(os.homedir(), 'AppData', 'Local'), 'iZiwei', 'notebooklm-playwright-profile');
const resolvedOutputDir = path.resolve(outputDir);
await mkdir(resolvedOutputDir, { recursive: true });

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
  await page.waitForTimeout(5000);

  const scrollables = await page.locator('*').evaluateAll(elements => elements.map((element, index) => ({
    index,
    tag: element.tagName,
    cls: String(element.className || '').slice(0, 160),
    role: element.getAttribute('role'),
    aria: element.getAttribute('aria-label'),
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
    scrollTop: element.scrollTop,
  })).filter(item => item.scrollHeight > item.clientHeight + 200 && item.clientHeight > 250)
    .sort((a, b) => b.scrollHeight - a.scrollHeight));
  await writeFile(path.join(resolvedOutputDir, 'scrollables.json'), `${JSON.stringify(scrollables, null, 2)}\n`, 'utf8');

  const snapshots = [];
  for (let pass = 0; pass < 120; pass += 1) {
    const state = await page.evaluate(() => {
      const query = document.querySelector('textarea[aria-label="查询框"], textarea[aria-label="Query box"]');
      let current = query?.parentElement;
      const candidates = [];
      while (current) {
        if (current.scrollHeight > current.clientHeight + 200) candidates.push(current);
        current = current.parentElement;
      }
      const target = candidates.sort((a, b) => b.scrollHeight - a.scrollHeight)[0]
        ?? [...document.querySelectorAll('*')]
          .filter(element => element.scrollHeight > element.clientHeight + 500 && element.clientHeight > 300)
          .sort((a, b) => b.scrollHeight - a.scrollHeight)[0];
      if (!target) return null;
      const before = target.scrollTop;
      target.scrollTop = Math.max(0, before - Math.max(target.clientHeight * 1.8, 1400));
      target.dispatchEvent(new Event('scroll', { bubbles: true }));
      return {
        before,
        after: target.scrollTop,
        scrollHeight: target.scrollHeight,
        clientHeight: target.clientHeight,
        text: document.body?.innerText ?? '',
      };
    });
    if (!state) break;
    snapshots.push(state.text);
    await writeFile(path.join(resolvedOutputDir, `snapshot-${String(pass).padStart(2, '0')}.txt`), state.text, 'utf8');
    await page.waitForTimeout(450);
    if (state.after === 0 && pass > 2) break;
  }

  const finalText = await page.locator('body').innerText();
  snapshots.push(finalText);
  await writeFile(path.join(resolvedOutputDir, 'final.txt'), finalText, 'utf8');
  console.log(JSON.stringify({ snapshots: snapshots.length, chars: snapshots.map(text => text.length), scrollables: scrollables.slice(0, 8) }, null, 2));
} finally {
  await browser?.close().catch(() => {});
  if (child.exitCode === null) child.kill();
}
