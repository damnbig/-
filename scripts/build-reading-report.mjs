import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { renderReportHtml, renderReportMarkdown } from './report-markdown.mjs';

const [, , caseDirArg, routeId] = process.argv;
if (!caseDirArg || !/^[a-f0-9]{8}$/i.test(routeId ?? '')) {
  throw new Error('Usage: node scripts/build-reading-report.mjs <case-dir> <8-char-route-id>');
}

const caseDir = path.resolve(caseDirArg);
const templatePath = path.resolve('public/r/6c2f9d81/index.html');
const outputDir = path.resolve(`public/r/${routeId}`);
const publicationRepairsPath = path.join(caseDir, 'publication-repairs.json');
const completionManifestPath = path.join(caseDir, 'delivery', 'completion-manifest.json');
const questionOrder = ['1', '2', '3', '4', '5', '6', '7', '7B', '8', '9', '10', '11', '12', '12B'];
const supplementSpecs = [
  { file: '人物画像.md', question: 'portrait', sectionPrefix: 'PORTRAIT' },
  { file: '精神分析.md', question: 'psyche', sectionPrefix: 'PSYCHE' },
];

const template = await readFile(templatePath, 'utf8');
const publicationRepairs = await readFile(publicationRepairsPath, 'utf8')
  .then(content => JSON.parse(content))
  .catch(error => {
    if (error.code === 'ENOENT') return {};
    throw error;
  });
const completionManifest = await readFile(completionManifestPath, 'utf8')
  .then(content => JSON.parse(content))
  .catch(error => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
const completedAnswers = new Map(
  (completionManifest?.results ?? [])
    .filter(result => result.status === 'PASS' && /^Q(?:1[0-2]|[1-9])B?$/.test(result.id))
    .map(result => [result.id, result.answerPath]),
);
const optionalQuestions = new Set(['7B', '12B']);
const reportMatch = template.match(/const REPORT = (.*?);\r?\n\s*const STORAGE_KEY/s);
if (!reportMatch) throw new Error('Cannot locate REPORT data in reading-page template.');
const templateReport = JSON.parse(reportMatch[1]);
const chapterMeta = new Map(templateReport.chapters.map(chapter => [String(chapter.question), chapter]));

const factSourceName = (await readdir(caseDir)).find(name => /^LOCKED-FACTS-.+\.md$/i.test(name));
if (!factSourceName) throw new Error('Cannot locate the locked fact source for reader translation.');
const factSource = await readFile(path.join(caseDir, factSourceName), 'utf8');
const facts = new Map();
for (const match of factSource.matchAll(/^FACT\|([^|]+)\|(.+)$/gm)) {
  const fields = Object.fromEntries(
    match[2].split('|').map(entry => {
      const separator = entry.indexOf('=');
      return separator < 0
        ? [entry, '']
        : [entry.slice(0, separator), entry.slice(separator + 1)];
    }),
  );
  facts.set(match[1], fields);
}
const palaceNames = new Map(
  [...facts.entries()]
    .filter(([, fields]) => fields.TYPE === 'PALACE')
    .map(([id, fields]) => [id, fields.PALACE_NAME]),
);
const palaceName = id => palaceNames.get(id) ?? '';
const ageLabel = range => String(range ?? '').replace('-', '至');
const factLabel = factId => {
  const fact = facts.get(factId);
  if (!fact) return '';
  switch (fact.TYPE) {
    case 'PALACE':
      return fact.PALACE_NAME ?? '';
    case 'ITEM': {
      const brightness = fact.BRIGHTNESS && fact.BRIGHTNESS !== '—' ? `（${fact.BRIGHTNESS}）` : '';
      return `${fact.PALACE_NAME ?? ''}${fact.NAME ?? ''}${brightness}`;
    }
    case 'BIRTH_HUA':
      return `${fact.STAR ?? ''}生年化${fact.HUA ?? ''}`;
    case 'TRANSFORM': {
      const target = palaceName(fact.TARGET);
      if (fact.LAYER === '本命宫干飞化') {
        return `${palaceName(fact.SOURCE)}飞${fact.HUA ?? ''}入${target}`;
      }
      return `${String(fact.LAYER ?? '').replace(/四化$/, '')}${fact.STAR ?? ''}化${fact.HUA ?? ''}入${target}`;
    }
    case 'SELF_HUA': {
      const source = palaceName(fact.SOURCE);
      const target = palaceName(fact.TARGET);
      if (fact.SOURCE === fact.TARGET) {
        return `${source}${fact.STAR ?? ''}${fact.DIRECTION ?? ''}自化${fact.HUA ?? ''}`;
      }
      return `${source}向${target}${fact.DIRECTION ?? ''}${fact.STAR ?? ''}化${fact.HUA ?? ''}`;
    }
    case 'RELATION':
      return `${fact.PALACE_NAME ?? ''}三方四正`;
    case 'DECADA':
      return `${ageLabel(fact.AGE_RANGE)}岁大限`;
    case 'DECADA_PALACE':
      return `${fact.DECADA_PALACE ?? '大限宫位'}叠本命${fact.NATAL_PALACE ?? palaceName(fact.TARGET)}`;
    case 'YEAR_PALACE':
      return `${fact.YEAR_PALACE ?? '流年宫位'}叠本命${fact.NATAL_PALACE ?? palaceName(fact.TARGET)}`;
    case 'LAYER':
      return `${fact.LAYER ?? ''}${fact.SOURCE_STEM ? `（${fact.SOURCE_STEM}干）` : ''}`;
    case 'CHECK':
      return fact.RESULT === 'PASS' ? '一致性检查通过' : '一致性检查';
    default:
      return '';
  }
};

const auditCodeSource = String.raw`(?:E\d+|DA\d+(?:-(?:L\d*|[QKJ]))?|D\d+(?:-[LQKJ])?|LY\d+|F\d{2}-[A-Z]|BS\d+|B(?:0[1-9]|1[0-2])|[SZRY]\d+)`;
const auditCodePattern = new RegExp(`\\b${auditCodeSource}\\b`, 'g');
const bracketedAuditCodePattern = new RegExp(`\\[[^\\]]*\\b${auditCodeSource}\\b[^\\]]*\\]`, 'g');

const cleanField = (value, evidenceLabels = new Map()) => value
  .split(/\r?\n/)
  .map(line => line.trim())
  .filter(line => line && !/^\d+$/.test(line) && line !== 'more_horiz')
  .join(' ')
  .replace(/\bC(?:1[0-2]|[1-9])B?-\d+\b/g, '前文相关论段')
  .replace(/\bE\d+\b/g, code => evidenceLabels.get(code) ?? '')
  .replace(/(?:\/)?[LQKJ](?=\b|[、,，；;:/])/g, '')
  .replace(/\.\.L12\b/g, '至大限父母宫')
  .replace(/[\uE000-\uF8FF]\s*=\s*/g, '不等于')
  .replace(/[\uE000-\uF8FF]/g, '')
  .replace(bracketedAuditCodePattern, '')
  .replace(auditCodePattern, '')
  .replace(/[\\*_`]+/g, '')
  .replace(/[（(]\s*[、,，；;:/\\\s]*[）)]/g, '')
  .replace(/([（(])\s*[、,，；;:/\\]+/g, '$1')
  .replace(/[、,，；;:/\\]+\s*([）)])/g, '$1')
  .replace(/\s+([，。；：、！？）)])/g, '$1')
  .replace(/([（(])\s+/g, '$1')
  .replace(/([，。；：、！？])(?:\s*\1)+/g, '$1')
  .replace(/\s+/g, ' ')
  .trim();

const locateLabel = (segment, label, from = 0) => {
  const bare = label.replace(/[：:]$/, '');
  const candidates = [`${bare}：`, `${bare}:`, bare]
    .map(marker => ({ marker, index: segment.indexOf(marker, from) }))
    .filter(match => match.index >= 0)
    .sort((left, right) => left.index - right.index || right.marker.length - left.marker.length);
  return candidates[0] ?? null;
};

const field = (segment, label, stopLabels, evidenceLabels) => {
  const start = locateLabel(segment, label);
  if (!start) return '';
  const contentStart = start.index + start.marker.length;
  const stops = stopLabels
    .map(stop => locateLabel(segment, stop, contentStart)?.index)
    .filter(index => Number.isInteger(index));
  const end = stops.length ? Math.min(...stops) : segment.length;
  return cleanField(segment.slice(contentStart, end), evidenceLabels);
};

const parseSections = answer => {
  const evidenceLabels = new Map(
    [...answer.matchAll(/^(E\d+)=([^\s]+)$/gm)]
      .map(match => [match[1], factLabel(match[2])])
      .filter(([, label]) => label),
  );
  const headingPattern = /^(?:候选命题\s*)?C((?:1[0-2]|[1-9])B?)-(\d+)【([^】]+)】（([^）]+)）.*$/gm;
  const headings = [...answer.matchAll(headingPattern)];
  return headings.map((heading, index) => {
    const segmentEnd = headings[index + 1]?.index ?? answer.length;
    const segment = answer.slice(heading.index + heading[0].length, segmentEnd);
    return {
      id: `C${heading[1]}-${heading[2]}`,
      title: heading[3].trim(),
      technicalTitle: cleanField(heading[4], evidenceLabels),
      answer: field(segment, '先讲结论：', ['转换四步：', '命理推演：', '主题闭包：', '加减与边界：', '独立结构数：', '证据登记台账', '证据登记'], evidenceLabels),
      reasoning: field(segment, '命理推演：', ['主题闭包：', '加减与边界：', '独立结构数：', '时间承接层：', '语义层级：', '技术状态：', '证据登记台账', '证据登记'], evidenceLabels),
      synthesis: field(segment, '主题闭包：', ['加减与边界：', '独立结构数：', '时间承接层：', '语义层级：', '技术状态：', '证据登记台账', '证据登记'], evidenceLabels),
      boundary: field(segment, '加减与边界：', ['独立结构数：', '时间承接层：', '语义层级：', '最小充分结论：', '技术状态：', '证据登记台账', '证据登记'], evidenceLabels),
    };
  }).filter(section => section.answer);
};

const parseSupplement = (markdown, spec) => {
  const title = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim();
  const headings = [...markdown.matchAll(/^##\s+(.+)$/gm)];
  if (!title || !headings.length) throw new Error(`Invalid publication supplement: ${spec.file}`);
  const introStart = markdown.indexOf('\n', markdown.indexOf(`# ${title}`)) + 1;
  const intro = cleanField(markdown.slice(introStart, headings[0].index));
  const sections = headings.map((heading, index) => {
    const end = headings[index + 1]?.index ?? markdown.length;
    const answer = cleanField(markdown.slice(heading.index + heading[0].length, end));
    return {
      id: `${spec.sectionPrefix}-${String(index + 1).padStart(2, '0')}`,
      title: heading[1].trim(),
      technicalTitle: '',
      answer,
      reasoning: '',
      synthesis: '',
      boundary: '',
    };
  }).filter(section => section.answer);
  return { question: spec.question, title, intro, sections };
};

const chapters = [];
for (const question of questionOrder) {
  if (optionalQuestions.has(question) && completionManifest && !completedAnswers.has(`Q${question}`)) continue;
  const relativeAnswerPath = completedAnswers.get(`Q${question}`) ?? path.join('responses', `Q${question}-answer.txt`);
  const answerPath = path.resolve(caseDir, relativeAnswerPath);
  if (!answerPath.startsWith(`${caseDir}${path.sep}`)) {
    throw new Error(`Answer path escapes case directory: ${relativeAnswerPath}`);
  }
  const answer = await readFile(answerPath, 'utf8');
  const meta = chapterMeta.get(question);
  if (!meta) throw new Error(`Template has no chapter metadata for question ${question}.`);
  const sections = parseSections(answer);
  if (!sections.length) throw new Error(`No publishable C sections found in ${answerPath}.`);
  for (const section of sections) {
    const repair = publicationRepairs[section.id];
    if (!repair) continue;
    section.boundary = [section.boundary, `补充辨析：${cleanField(repair)}`]
      .filter(Boolean)
      .join(' ');
  }
  chapters.push({ question, title: meta.title, intro: meta.intro, sections });
}

for (const spec of supplementSpecs) {
  const markdown = await readFile(path.join(caseDir, 'delivery', spec.file), 'utf8')
    .catch(error => {
      if (error.code === 'ENOENT') return null;
      throw error;
    });
  if (markdown) chapters.push(parseSupplement(markdown, spec));
}

const report = {
  title: '一份完整的命盘结构研究',
  subtitle: '从本命骨架出发，依次观察人格、认知、事业、财富、关系、家庭、人际与阶段运势。',
  chapters,
};
const topicCount = chapters.reduce((count, chapter) => count + chapter.sections.length, 0);
let output = template
  .replace(reportMatch[0], `const REPORT = ${JSON.stringify(report)};\n    const STORAGE_KEY`)
  .replace(/<article id="reportBody">[\s\S]*?<\/article>/, `<article id="reportBody">${renderReportHtml(report)}</article>`)
  .replace(/14 个章节<\/span><span>\d+ 个主题/, `${chapters.length} 个章节</span><span>${topicCount} 个主题`)
  .replace(/iziwei-reading-6c2f9d81-v2/g, `iziwei-reading-${routeId}-v1`);

await mkdir(outputDir, { recursive: true });
await writeFile(path.join(outputDir, 'index.html'), output, 'utf8');
await writeFile(
  path.join(outputDir, 'report.md'),
  renderReportMarkdown(report, `https://www.nageclub.cn/r/${routeId}/`),
  'utf8',
);
console.log(JSON.stringify({ routeId, chapters: chapters.length, topics: topicCount, output: path.join(outputDir, 'index.html') }, null, 2));
