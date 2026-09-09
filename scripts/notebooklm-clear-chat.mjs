import { spawn } from 'node:child_process';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';

const notebookUrl = process.argv[2];
if (!notebookUrl) throw new Error('Usage: node scripts/notebooklm-clear-chat.mjs <notebook-url>');

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
  let ready = false;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`${endpoint}/json/version`)).ok) { ready = true; break; }
    } catch {}
    if (child.exitCode !== null) throw new Error(`Dedicated Chrome exited (${child.exitCode}).`);
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (!ready) throw new Error('Timed out connecting to dedicated Chrome.');

  browser = await chromium.connectOverCDP(endpoint);
  const context = browser.contexts()[0];
  const page = context.pages().find(candidate => candidate.url().includes('notebook.google.com'))
    ?? await context.newPage();
  if (page.url().split('?')[0] !== notebookUrl.split('?')[0]) {
    await page.goto(notebookUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
  }
  const query = page.locator('textarea[aria-label="查询框"], textarea[aria-label="Query box"]')
    .first();
  await query.waitFor({ state: 'visible', timeout: 120000 });
  await page.waitForTimeout(10000);

  const stop = page.getByRole('button', { name: /停止生成|Stop generating/ }).first();
  if (await stop.isVisible().catch(() => false)) {
    await stop.click();
    await stop.waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1500);
  }

  await page.getByRole('button', { name: /对话选项|Chat options/ }).first().click();
  const deleteItem = page.getByText(/删除.*对话记录|清除.*对话记录|删除.*聊天记录|Delete.*chat history/i).filter({ visible: true }).first();
  await deleteItem.waitFor({ state: 'visible', timeout: 15000 });
  await deleteItem.click();

  const dialog = page.locator('[role="dialog"]').last();
  if (await dialog.isVisible().catch(() => false)) {
    const confirm = dialog.getByRole('button', { name: /删除|清除|Delete|Clear/i }).last();
    await confirm.click();
  }

  await page.waitForTimeout(4000);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
  await query.waitFor({ state: 'visible', timeout: 120000 });
  await page.waitForTimeout(12000);
  const bodyText = await page.locator('body').innerText();
  const hasConversation = /\nThoughts\r?\nexpand_more\r?\n/.test(bodyText)
    || /继续ACTIVE_MODE=E|问题0：事实包准入登记/.test(bodyText);
  if (hasConversation) throw new Error('Chat history is still present after deletion.');
  console.log(JSON.stringify({
    url: page.url(),
    cleared: true,
    bodyChars: bodyText.length,
    queryVisible: await query.isVisible(),
  }, null, 2));
} finally {
  await browser?.close().catch(() => {});
  if (child.exitCode === null) child.kill();
}
