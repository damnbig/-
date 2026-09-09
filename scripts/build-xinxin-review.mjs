import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { renderReportHtml, renderReportMarkdown } from './report-markdown.mjs';

const root = new URL('../', import.meta.url);
const source = readFileSync(new URL('../../报告复制版/昕昕-措辞修订审阅版-20260903/完整修订稿.md', import.meta.url), 'utf8');
const originalPath = new URL('public/r/6c2f9d81/index.html', root);
const template = readFileSync(originalPath, 'utf8');
const originalHash = createHash('sha256').update(template).digest('hex');
const match = template.match(/const REPORT = (.*?);\r?\n\s*const STORAGE_KEY/s);
assert(match, 'Original report data not found');
const original = JSON.parse(match[1]);
const report = {
  title: '命盘结构研究 · 措辞修订审阅版',
  subtitle: '2026-09-03 独立审阅副本。保留原稿主要判断与推演，仅校准绝对化、成立条件与夸张措辞；本次为表达修订，尚未完成事实包与课程逐条复核。',
  chapters: [],
};
let chapter, section, field;
const fields = { '判断': 'answer', '推演': 'reasoning', '合参': 'synthesis', '边界与补充': 'boundary' };
for (const line of source.split(/\r?\n/)) {
  if (line.startsWith('## ')) {
    chapter = { title: line.slice(3), intro: '', sections: [] };
    report.chapters.push(chapter);
    section = null;
    field = null;
  } else if (chapter && line.startsWith('### ')) {
    section = { title: line.slice(4), answer: '', reasoning: '', synthesis: '', boundary: '' };
    chapter.sections.push(section);
    field = null;
  } else if (section && /^\*\*.+\*\*$/.test(line) && fields[line.slice(2, -2)]) {
    field = fields[line.slice(2, -2)];
  } else if (chapter && !section) {
    chapter.intro += `${line}\n`;
  } else if (section && field) {
    section[field] += `${line.replace(/^> /, '')}\n`;
  } else if (section && line.trim()) {
    throw new Error(`Unparsed text: ${line}`);
  }
}
assert.equal(report.chapters.length, 14);
let count = 0;
report.chapters.forEach((current, index) => {
  const previous = original.chapters[index];
  assert.equal(current.title, previous.title);
  assert.equal(current.sections.length, previous.sections.length);
  current.question = previous.question;
  current.intro = current.intro.trim();
  current.sections.forEach((item, sectionIndex) => {
    item.id = previous.sections[sectionIndex].id;
    for (const name of Object.values(fields)) item[name] = item[name].trim();
    assert(item.answer && item.reasoning && item.boundary, `Incomplete section ${item.id}`);
    count++;
  });
});
assert.equal(count, 46);
assert(!JSON.stringify(report).includes('昕昕'), 'Public report must not expose private name');
const route = '58621334';
const directory = new URL(`public/r/${route}/`, root);
assert(!existsSync(directory), 'Refusing to overwrite an existing edition');
let html = template
  .replace(match[0], `const REPORT = ${JSON.stringify(report).replace(/</g, '\\u003c')};\n    const STORAGE_KEY`)
  .replace(/<article id="reportBody">[\s\S]*?<\/article>/, `<article id="reportBody">${renderReportHtml(report)}</article>`)
  .replaceAll('iziwei-reading-6c2f9d81-v2', `iziwei-reading-${route}-v1`)
  .replace('<title>一份完整的命盘结构研究</title>', `<title>${report.title}</title>`)
  .replace('<div class="bar-title">一份完整的命盘结构研究', '<div class="bar-title">措辞修订审阅版')
  .replace('<p class="kicker">紫微斗数 · 单盘进阶</p>', '<p class="kicker">独立审阅副本 · 2026-09-03</p>')
  .replace('<h1>一份完整的<br>命盘结构研究</h1>', '<h1>命盘结构研究<br>措辞修订审阅版</h1>')
  .replace(/<p class="subtitle">.*?<\/p>/, `<p class="subtitle">${report.subtitle}</p><p class="edition-link"><a href="/r/6c2f9d81/">查看原版（未修改）</a></p>`)
  .replace('</style>', '.report-head h1 { font-size:42px; letter-spacing:0; } .kicker { line-height:1.5; } .edition-link { font:15px/1.6 system-ui,sans-serif; } .edition-link a { color:var(--accent); text-underline-offset:4px; } .reasoning,.synthesis,.boundary { white-space:pre-line; } @media(max-width:480px) { .report-head h1 { font-size:30px; } }\n  </style>');
assert(html.includes('noindex'));
assert(html.includes(`iziwei-reading-${route}-v1`));
mkdirSync(directory, { recursive: true });
writeFileSync(new URL('index.html', directory), html);
writeFileSync(new URL('report.md', directory), renderReportMarkdown(report, `https://www.nageclub.cn/r/${route}/`));
assert.equal(createHash('sha256').update(readFileSync(originalPath)).digest('hex'), originalHash);
console.log(JSON.stringify({ route, chapters: report.chapters.length, sections: count, originalUnchanged: true }));
