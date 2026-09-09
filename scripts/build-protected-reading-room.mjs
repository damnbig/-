import assert from 'node:assert/strict';
import { createHash, randomBytes, webcrypto } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as icons from 'lucide-react';
import { Marked } from '../../tmp/protected-reader-deps/node_modules/marked/lib/marked.esm.js';

const [, , routeId, profileSourceArg] = process.argv;
if (!/^[a-f0-9]{8}$/i.test(routeId ?? '') || !profileSourceArg) {
  throw new Error('Usage: node scripts/build-protected-reading-room.mjs <8-char-route-id> <profile-source.json>');
}

const workspaceRoot = new URL('../../', import.meta.url);
const projectRoot = new URL('../', import.meta.url);
const publicSource = new URL(`public/r/${routeId}/`, projectRoot);
const outputDir = new URL(`tmp/${routeId}-protected-publish/`, workspaceRoot);
const privateDir = new URL(`tmp/${routeId}-protected-private/`, workspaceRoot);
mkdirSync(outputDir, { recursive: true });
mkdirSync(privateDir, { recursive: true });

const sourceHtml = readFileSync(new URL('index.html', publicSource), 'utf8');
const publicMarkdown = readFileSync(new URL('report.md', publicSource), 'utf8');
const reportChapterCount = (publicMarkdown.match(/^## 第\d+章/gm) ?? []).length;
const profileSource = JSON.parse(readFileSync(profileSourceArg, 'utf8'));
const suppliedAnalysisDocuments = profileSource.documents ?? [
  {
    id: 'portrait',
    group: '命盘研究',
    title: '人物画像',
    label: '人物之神与现实表现',
    subtitle: '从完整报告提炼的综合人物画像。',
    text: profileSource.portrait,
  },
  {
    id: 'psyche',
    group: '命盘研究',
    title: '精神分析',
    label: '内在动力与关系模式',
    subtitle: '基于报告的心理动力假设，并非临床诊断。',
    text: profileSource.psyche,
  },
];
assert(suppliedAnalysisDocuments.length > 0, 'Profile source must contain analysis documents.');
for (const document of suppliedAnalysisDocuments) {
  assert(/^[a-z][a-z0-9-]*$/.test(document.id), `Invalid document id: ${document.id}`);
  assert(document.title && document.text, `Incomplete analysis document: ${document.id}`);
}

const previousDocumentsPath = new URL('documents.json', privateDir);
const previousDocuments = existsSync(previousDocumentsPath)
  ? JSON.parse(readFileSync(previousDocumentsPath, 'utf8')).documents
  : [];
const previousReport = previousDocuments.find(document => document.id === 'report');
const article = sourceHtml.match(/<article id="reportBody">([\s\S]*?)<\/article>/)?.[1]
  ?? sourceHtml.match(/<article id="original-report">([\s\S]*?)<\/article>/)?.[1];
const reportHtml = article ?? previousReport?.html;
const sourceMarkdown = article ? publicMarkdown : previousReport?.text;
assert(reportHtml && sourceMarkdown, 'Expected a reader-facing report article or a private report backup.');
assert(!/<script|<iframe|\son\w+=/i.test(reportHtml), 'Unsafe markup in report article.');

const escape = text => text
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');
const marked = new Marked({
  gfm: true,
  renderer: {
    html(token) { return escape(token.text); },
    link(token) {
      const text = this.parser.parseInline(token.tokens);
      return /^https?:\/\//i.test(token.href)
        ? `<a href="${escape(token.href)}" target="_blank" rel="noopener noreferrer">${text}</a>`
        : text;
    },
  },
});

const documents = [
  {
    id: 'report',
    group: '命盘研究',
    title: '命盘报告',
    label: `完整${reportChapterCount}章`,
    subtitle: '经核验整理的命盘结构研究。',
    text: sourceMarkdown,
    html: reportHtml,
  },
  ...suppliedAnalysisDocuments.map(document => ({
    group: '人物研究',
    label: '',
    subtitle: '',
    ...document,
    html: marked.parse(document.text),
  })),
];
assert.equal(new Set(documents.map(document => document.id)).size, documents.length, 'Duplicate document ids.');

const credentialPath = new URL('access.json', privateDir);
const password = existsSync(credentialPath)
  ? JSON.parse(readFileSync(credentialPath, 'utf8')).password
  : String(100000 + (randomBytes(4).readUInt32BE(0) % 900000));
const salt = randomBytes(16);
const iv = randomBytes(12);
const iterations = 600000;
const material = await webcrypto.subtle.importKey(
  'raw',
  new TextEncoder().encode(password),
  'PBKDF2',
  false,
  ['deriveKey'],
);
const key = await webcrypto.subtle.deriveKey(
  { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
  material,
  { name: 'AES-GCM', length: 256 },
  false,
  ['encrypt'],
);
const encrypted = await webcrypto.subtle.encrypt(
  { name: 'AES-GCM', iv },
  key,
  new TextEncoder().encode(JSON.stringify({ documents })),
);
writeFileSync(new URL('content.enc.json', outputDir), JSON.stringify({
  version: 1,
  iterations,
  salt: salt.toString('base64'),
  iv: iv.toString('base64'),
  data: Buffer.from(encrypted).toString('base64'),
}));

let shell = readFileSync(new URL('./protected-reader/index.html', import.meta.url), 'utf8');
shell = shell.replace(/\{\{(\w+)\}\}/g, (_, name) => {
  assert(icons[name], `Unknown icon: ${name}`);
  return renderToStaticMarkup(createElement(icons[name], {
    'aria-hidden': 'true',
    focusable: 'false',
    strokeWidth: 1.7,
  }));
});
writeFileSync(new URL('index.html', outputDir), shell);
writeFileSync(
  new URL('reader.css', outputDir),
  readFileSync(new URL('./protected-reader/reader.css', import.meta.url)),
);
writeFileSync(
  new URL('reader.js', outputDir),
  readFileSync(new URL('./protected-reader/reader.js', import.meta.url), 'utf8')
    .replace(
      /const allowedIds = \[[^;]+\];/,
      `const allowedIds = ${JSON.stringify(documents.map(document => document.id))};`,
    )
    .replaceAll('/r/39d8c650/', `/r/${routeId}/`),
);
writeFileSync(
  new URL('report.md', outputDir),
  `# 私人阅读室\n\n此资料已改为密码访问。请打开 https://www.nageclub.cn/r/${routeId}/ 解锁后复制或下载。\n`,
);
writeFileSync(credentialPath, JSON.stringify({
  url: `https://www.nageclub.cn/r/${routeId}/`,
  password,
}, null, 2));
writeFileSync(new URL('documents.json', privateDir), JSON.stringify({ documents }, null, 2));
writeFileSync(new URL('verification.json', privateDir), JSON.stringify({
  routeId,
  sourceModel: profileSource.model ?? null,
  documents: documents.map(document => ({
    id: document.id,
    chars: document.text.length,
    sha256: createHash('sha256').update(document.text).digest('hex'),
  })),
  files: ['index.html', 'reader.css', 'reader.js', 'content.enc.json', 'report.md'],
}, null, 2));
console.log(JSON.stringify({
  routeId,
  documents: documents.map(document => ({ id: document.id, chars: document.text.length })),
  encrypted: true,
  passwordStoredPrivately: true,
  outputDir: outputDir.pathname,
}, null, 2));
