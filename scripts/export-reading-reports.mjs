import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('..');
const outputDir = path.join(root, '报告复制版');
const reports = [
  { route: '6c2f9d81', name: '昕昕-完整报告-复制版' },
  { route: '5fd8e05d', name: '2004-04-15-女-完整报告-复制版' },
  { route: 'a74e19c3', name: '2007-10-27-女-完整报告-复制版' },
  { route: '3334298d', name: '2001-02-12-男-完整报告-复制版' },
];
const legacyReport = {
  name: '2002-11-19-女-旧版十二问-复制版',
  source: path.join(root, '紫薇对话', '进阶对话', '紫薇知识库 - Gemini Notebook - 2026-07-24 (1).md'),
};

const extractReport = html => {
  const match = html.match(/const REPORT = (.*?);\r?\n\s*const STORAGE_KEY/s);
  if (!match) throw new Error('Cannot find REPORT data in reading page.');
  return JSON.parse(match[1]);
};

const block = (label, value) => value?.trim()
  ? `**${label}**\n\n${value.trim()}\n\n`
  : '';

const render = (entry, report) => {
  const lines = [
    `# ${report.title}`,
    '',
    report.subtitle,
    '',
    `> 在线阅读：https://www.nageclub.cn/r/${entry.route}/`,
    '',
    '> 本文件为网页最终阅读内容的便携复制版，不含事实包、证据编号和审计底稿。',
    '',
  ];

  for (const chapter of report.chapters) {
    lines.push(`## ${chapter.title}`, '');
    if (chapter.intro?.trim()) lines.push(chapter.intro.trim(), '');
    for (const section of chapter.sections) {
      lines.push(`### ${section.title}`, '');
      lines.push(block('判断', section.answer));
      lines.push(block('推演', section.reasoning));
      lines.push(block('合参', section.synthesis));
      lines.push(block('边界与补充', section.boundary));
    }
  }

  return lines.join('\n').replace(/\n{4,}/g, '\n\n\n').trimEnd() + '\n';
};

const cleanLegacyAnswer = value => value
  .replace(/\s*\\?\[Source:[^\]]+\]/g, '')
  .replace(/\n{4,}/g, '\n\n\n')
  .trim();

const renderLegacy = source => {
  const legacyTitles = {
    1: '全盘统摄结构与主次排序',
    2: '外在、内在与压力反应机制',
    3: '认知、学习、表达与执行系统',
    4: '事业系统与职业上限',
    5: '财富形成、现金流与资产结构',
    6: '感情需求、对待方式与长期关系结构',
    7: '父母、原生家庭与代际影响',
    8: '人际网络、合作与资源交换',
    9: '身心节律与长期消耗机制',
    10: '过去大限盲验',
    11: '当前大限与当年触发',
    12: '下一大限与阶段转换',
  };
  const turnPattern = /### User\s*\n([\s\S]*?)\n---\s*\n\s*### Model\s*\n([\s\S]*?)(?=\n---\s*\n\s*### User|$)/g;
  const turns = [...source.matchAll(turnPattern)]
    .map(match => ({ prompt: match[1].trim(), answer: match[2].trim() }))
    .filter(turn => /^问题(?:[1-9]|1[0-2])：/.test(turn.prompt));

  if (turns.length !== 12) {
    throw new Error(`Expected 12 legacy questions, found ${turns.length}.`);
  }

  const lines = [
    '# 2002年案例：旧版十二问命盘研究',
    '',
    '> 出生资料：2002-11-19 21:50，女。',
    '',
    '> 本文件从早期NotebookLM完整对话中提取问题1至12的原回答，并移除聊天指令与引用角标。它不是后来网页协议生成或人工修订的版本。',
    '',
  ];
  for (const turn of turns) {
    const question = Number(turn.prompt.match(/^问题(\d+)：/)?.[1]);
    lines.push(`## 问题${question}：${legacyTitles[question]}`, '', cleanLegacyAnswer(turn.answer), '');
  }
  return lines.join('\n').trimEnd() + '\n';
};

await mkdir(outputDir, { recursive: true });
const indexLines = [
  '# 最近生成的命盘报告',
  '',
  '以下文件均从网页最终阅读版导出，适合在手机上打开后整篇复制。',
  '',
];

for (const entry of reports) {
  const htmlPath = path.resolve(`public/r/${entry.route}/index.html`);
  const report = extractReport(await readFile(htmlPath, 'utf8'));
  const markdown = render(entry, report);
  const outputPath = path.join(outputDir, `${entry.name}.md`);
  await writeFile(outputPath, markdown, 'utf8');
  const topicCount = report.chapters.reduce((total, chapter) => total + chapter.sections.length, 0);
  indexLines.push(
    `- [${entry.name}](./${entry.name}.md)：${report.chapters.length}章，${topicCount}个论段；[在线阅读](https://www.nageclub.cn/r/${entry.route}/)`
  );
}

const legacySource = await readFile(legacyReport.source, 'utf8');
const legacyOutput = path.join(outputDir, `${legacyReport.name}.md`);
await writeFile(legacyOutput, renderLegacy(legacySource), 'utf8');
indexLines.push(`- [${legacyReport.name}](./${legacyReport.name}.md)：早期问题1至12原回答整理版，未做后来网页协议修订`);

await writeFile(path.join(outputDir, '00-报告索引.md'), `${indexLines.join('\n')}\n`, 'utf8');
