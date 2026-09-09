import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const sourcePath = path.resolve(root, '..', '报告复制版', '2002-11-19-女-旧版十二问-复制版.md');
const routeId = '39d8c650';
const routeDir = path.join(root, 'public', 'r', routeId);

const escapeHtml = value => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');

const inline = value => escapeHtml(value)
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/`(.+?)`/g, '<code>$1</code>');

const renderMarkdown = markdown => {
  const lines = markdown.split(/\r?\n/);
  const html = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (/^\* \* \*$/.test(line)) {
      html.push('<hr>');
    } else if (line.startsWith('### ')) {
      html.push(`<h3>${inline(line.slice(4))}</h3>`);
    } else if (line.startsWith('## ')) {
      html.push(`<h2>${inline(line.slice(3))}</h2>`);
    } else if (line.startsWith('# ')) {
      html.push(`<h1>${inline(line.slice(2))}</h1>`);
    } else if (line.startsWith('> ')) {
      html.push(`<aside>${inline(line.slice(2))}</aside>`);
    } else if (/^\d+\\\.\s+/.test(line)) {
      html.push(`<h3>${inline(line.replace(/^\d+\\\.\s+/, ''))}</h3>`);
    } else if (line.startsWith('-')) {
      const parts = line.split(/-\s+(?=\*\*)/).filter(Boolean);
      html.push(parts.map(part => `<p class="detail">${inline(part.trim())}</p>`).join(''));
    } else {
      html.push(`<p>${inline(line)}</p>`);
    }
  }

  return html.join('\n');
};

const original = await readFile(sourcePath, 'utf8');
const publicMarkdown = original
  .replace(/^# .*$/m, '# 一份旧版十二问命盘研究')
  .replace(/^> 出生资料：.*(?:\r?\n){1,2}/m, '')
  .trim();
const articleHtml = renderMarkdown(publicMarkdown);
const copyPayload = JSON.stringify(publicMarkdown);
const questionParts = publicMarkdown.split(/(?=^## 问题\d+)/m);
const preface = questionParts.shift()?.trim() ?? '';
const questionFiles = questionParts.map((content, index) => ({
  name: `question-${String(index + 1).padStart(2, '0')}.md`,
  content: `${content.trim()}\n`,
}));
const rawBase = `https://raw.githubusercontent.com/damnbig/-/main/public/r/${routeId}`;
const aiIndex = [
  '# 十二问命盘研究：AI读取索引',
  '',
  '这是匿名化的旧版十二问原始记录。请依次读取下列十二个文件后，再进行整体分析；不要只根据单独一问下结论。',
  '',
  ...questionFiles.map((file, index) => `${index + 1}. [问题${index + 1}](${rawBase}/${file.name})`),
  '',
  '资料边界：本报告属于命理研究文本，不等于已验证的现实事实。涉及具体经历时，请区分原文判断、现实验证与进一步推演。',
].join('\n');
const aiIndexUrl = `${rawBase}/ai-index.md`;

const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="robots" content="noindex,nofollow,noarchive,nosnippet">
  <title>旧版十二问命盘研究</title>
  <style>
    :root { color-scheme: light; --ink:#1b1d22; --muted:#6f727b; --line:#dedbd4; --paper:#fbfaf7; --accent:#722f24; }
    * { box-sizing:border-box; }
    html { scroll-behavior:smooth; }
    body { margin:0; color:var(--ink); background:#efede8; font-family:"Noto Serif SC","Songti SC",serif; letter-spacing:0; }
    button { font:inherit; }
    .topbar { position:sticky; top:0; z-index:10; display:flex; align-items:center; justify-content:space-between; gap:16px; padding:12px max(18px,env(safe-area-inset-left)); background:rgba(251,250,247,.96); border-bottom:1px solid var(--line); backdrop-filter:blur(12px); }
    .brand { font-family:system-ui,sans-serif; font-weight:750; }
    .actions { display:flex; gap:8px; }
    .button { min-height:42px; padding:0 16px; border:1px solid #c9c4ba; background:#fff; color:var(--ink); border-radius:6px; cursor:pointer; }
    .button.primary { background:var(--ink); color:#fff; border-color:var(--ink); }
    main { width:min(860px,100%); margin:0 auto; padding:54px 54px 120px; background:var(--paper); min-height:100vh; }
    .eyebrow { margin:0 0 10px; color:var(--accent); font:700 13px/1.4 system-ui,sans-serif; }
    .intro h1 { margin:0; font-size:clamp(30px,5vw,48px); line-height:1.2; font-weight:650; }
    .intro p { color:var(--muted); line-height:1.8; }
    article { margin-top:42px; }
    article h1 { display:none; }
    article h2 { margin:64px 0 22px; padding-top:24px; border-top:1px solid var(--line); font-size:27px; line-height:1.45; }
    article h3 { margin:32px 0 12px; font-size:20px; line-height:1.55; }
    article p { margin:10px 0; font-size:17px; line-height:2; text-align:justify; }
    article .detail { padding-left:17px; border-left:2px solid #d6c7b8; }
    article aside { margin:16px 0; padding:14px 16px; background:#f1eee7; border-left:3px solid var(--accent); color:#555; line-height:1.8; }
    article hr { margin:34px 0; border:0; border-top:1px solid var(--line); }
    article code { font-family:ui-monospace,monospace; font-size:.86em; }
    .bottom { position:fixed; z-index:12; left:50%; bottom:max(16px,env(safe-area-inset-bottom)); transform:translateX(-50%); display:flex; gap:8px; padding:8px; background:rgba(255,255,255,.94); border:1px solid var(--line); border-radius:8px; box-shadow:0 10px 36px rgba(0,0,0,.12); backdrop-filter:blur(12px); }
    .status { min-width:70px; }
    @media (max-width:640px) {
      .topbar { padding:10px 12px; }
      .topbar .secondary { display:none; }
      main { padding:36px 20px 110px; }
      article h2 { margin-top:48px; font-size:24px; }
      article h3 { font-size:19px; }
      article p { font-size:16px; line-height:1.9; text-align:left; }
      .bottom { width:calc(100% - 24px); }
      .bottom .button { flex:1; }
    }
  </style>
</head>
<body>
  <header class="topbar">
    <div class="brand">紫微命盘阅读</div>
    <div class="actions">
      <a class="button secondary" href="${aiIndexUrl}">AI 读取索引</a>
      <button class="button primary status" data-copy>复制全文</button>
    </div>
  </header>
  <main>
    <section class="intro">
      <p class="eyebrow">旧版原始研究记录</p>
      <h1>十二问命盘研究</h1>
      <p>以下保留早期十二问的原始判断，仅移除身份信息与聊天指令。它不代表后来核验协议或人工修订版本。</p>
    </section>
    <article>${articleHtml}</article>
  </main>
  <nav class="bottom" aria-label="阅读工具">
    <button class="button" onclick="scrollTo({top:0,behavior:'smooth'})">回到顶部</button>
    <button class="button primary status" data-copy>复制全文</button>
  </nav>
  <script>
    const REPORT_TEXT = ${copyPayload};
    async function copyFull(button) {
      try {
        if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(REPORT_TEXT);
        else {
          const area = document.createElement('textarea');
          area.value = REPORT_TEXT;
          area.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
          document.body.append(area);
          area.focus(); area.select(); area.setSelectionRange(0, area.value.length);
          if (!document.execCommand('copy')) throw new Error('copy failed');
          area.remove();
        }
        document.querySelectorAll('[data-copy]').forEach(item => item.textContent = '已复制');
        setTimeout(() => document.querySelectorAll('[data-copy]').forEach(item => item.textContent = '复制全文'), 1800);
      } catch {
        window.location.href = 'report.md';
      }
    }
    document.querySelectorAll('[data-copy]').forEach(button => button.addEventListener('click', () => copyFull(button)));
  </script>
</body>
</html>`;

await mkdir(routeDir, { recursive: true });
await Promise.all([
  writeFile(path.join(routeDir, 'index.html'), html),
  writeFile(path.join(routeDir, 'report.md'), publicMarkdown),
  writeFile(path.join(routeDir, 'ai-index.md'), `${aiIndex}\n`),
  ...questionFiles.map(file => writeFile(path.join(routeDir, file.name), file.content)),
]);

console.log(`Built legacy report route /r/${routeId}/ (${publicMarkdown.length} characters, ${questionFiles.length} AI chunks).`);
