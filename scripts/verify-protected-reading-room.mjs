import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, readdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const routeId = process.argv[2];
if (!/^[a-f0-9]{8}$/i.test(routeId ?? '')) {
  throw new Error('Usage: node scripts/verify-protected-reading-room.mjs <8-char-route-id>');
}

const workspaceRoot = new URL('../../tmp/', import.meta.url);
const outputDir = new URL(`${routeId}-protected-publish/`, workspaceRoot);
const privateDir = new URL(`${routeId}-protected-private/`, workspaceRoot);
const source = JSON.parse(readFileSync(new URL('documents.json', privateDir), 'utf8'));
const { password } = JSON.parse(readFileSync(new URL('access.json', privateDir), 'utf8'));
const publicFiles = ['index.html', 'reader.js', 'reader.css', 'content.enc.json', 'report.md'];

assert.deepEqual(readdirSync(outputDir).sort(), [...publicFiles].sort());
for (const file of publicFiles) {
  const content = readFileSync(new URL(file, outputDir), 'utf8');
  assert(!content.includes(password), `Password leaked in ${file}.`);
  for (const document of source.documents) {
    assert(!content.includes(document.text.slice(0, 70)), `Plaintext leaked in ${file}/${document.id}.`);
  }
}

const server = createServer((request, response) => {
  const name = new URL(request.url, 'http://localhost').pathname.split('/').pop() || 'index.html';
  if (!publicFiles.includes(name)) {
    response.writeHead(404);
    response.end();
    return;
  }
  response.setHeader(
    'Content-Type',
    name.endsWith('.js') ? 'text/javascript'
      : name.endsWith('.css') ? 'text/css'
        : name.endsWith('.json') ? 'application/json'
          : name.endsWith('.md') ? 'text/plain;charset=utf-8'
            : 'text/html;charset=utf-8',
  );
  response.end(readFileSync(new URL(name, outputDir)));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
});
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    permissions: ['clipboard-read', 'clipboard-write'],
    acceptDownloads: true,
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${origin}/r/${routeId}/`);
  assert(await page.locator('#gate').isVisible());
  assert(!(await page.locator('#workspace').isVisible()));

  await page.locator('#password').fill('wrong-password');
  await page.locator('#unlock').click();
  await page.waitForFunction(() => document.getElementById('gate-status').textContent.includes('密码不正确'));
  assert.equal(await page.locator('#content').textContent(), '');

  await page.locator('#password').fill(password);
  await page.locator('#unlock').click();
  await page.locator('#workspace').waitFor({ state: 'visible' });
  for (const document of source.documents) {
    await page.evaluate(id => { location.hash = id; }, document.id);
    await page.waitForFunction(title => document.getElementById('article-title').textContent === title, document.title);
    await page.locator('#copy').click();
    const copied = (await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n');
    assert.equal(copied, document.text.replace(/\r\n/g, '\n'));
  }

  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: width > 500 ? 1000 : 844 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Overflow at ${width}px.`);
  }

  const downloadPromise = page.waitForEvent('download');
  await page.locator('#download').click();
  const download = await downloadPromise;
  const downloaded = readFileSync(await download.path(), 'utf8');
  for (const document of source.documents) assert(downloaded.includes(document.text));

  await page.locator('#lock').click();
  assert(await page.locator('#gate').isVisible());
  assert.equal(await page.locator('#content').textContent(), '');
  assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({
    routeId,
    documents: source.documents.map(document => document.id),
    wrongPasswordRejected: true,
    allDocumentsCopiedExactly: true,
    downloadComplete: true,
    lockClearsContent: true,
    noPersistentStorage: true,
    publicFilesContainNoPlaintext: true,
    viewports: [320, 390, 1440],
    errors,
  }, null, 2));
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
