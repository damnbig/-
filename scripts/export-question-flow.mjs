import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const version = process.argv[2] ?? 'v0.11';
const outputPath = resolve(
  process.argv[3] ?? `tmp/automation-poc/question-flow-${version}.json`,
);
const sourcePath = resolve('content', `紫微单盘-进阶提问清单-${version}.md`);
const markdown = readFileSync(sourcePath, 'utf8');

const normalizeTitle = (title) => title
  .replace(/^[一-十]+\u3001/, '')
  .trim();

const getItemId = (title) => {
  const question = title.match(/问题(\d+B?)/);
  if (question) return `Q${question[1]}`;

  const checkpoint = title.match(/CP-([A-D])-M/);
  if (checkpoint) return `CP-${checkpoint[1]}-M`;

  return title.replace(/[^A-Za-z0-9]+/g, '-');
};

const isFlowHeading = (title) => (
  /问题(?:0|[1-9]|1[0-5])B?(?:[：:]|$)/.test(title)
  || /CP-[A-D]-M(?:[：:]|$)/.test(title)
);

const headings = [];
const headingPattern = /^(#{2,3})\s+(.+)$/gm;
let match;
while ((match = headingPattern.exec(markdown)) !== null) {
  headings.push({
    index: match.index,
    level: match[1].length,
    title: normalizeTitle(match[2]),
  });
}

const items = headings.filter((heading) => isFlowHeading(heading.title)).flatMap((heading) => {
  const next = headings.find((candidate) => (
    candidate.index > heading.index && candidate.level <= heading.level
  ));
  const section = markdown.slice(heading.index, next?.index ?? markdown.length);
  const blocks = Array.from(section.matchAll(/```(?:text)?[ \t]*\r?\n([\s\S]*?)```/g));
  const baseId = getItemId(heading.title);

  return blocks.map((block, index) => ({
    id: baseId === 'Q14' && index > 0 ? 'Q14-REPLY' : baseId,
    title: heading.title,
    optional: /可选/.test(heading.title) || /B$/.test(baseId),
    prompt: block[1].trim(),
  }));
});

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify({ version, sourcePath, items }, null, 2)}\n`, 'utf8');

console.log(JSON.stringify({
  version,
  outputPath,
  itemCount: items.length,
  ids: items.map((item) => item.id),
}, null, 2));
