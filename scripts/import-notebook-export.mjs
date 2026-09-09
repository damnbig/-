import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const [, , exportPathArg, caseDirArg] = process.argv;
if (!exportPathArg || !caseDirArg) {
  throw new Error('Usage: node scripts/import-notebook-export.mjs <export.md> <case-dir>');
}

const exportPath = path.resolve(exportPathArg);
const caseDir = path.resolve(caseDirArg);
const responsesDir = path.join(caseDir, 'responses');
const deliveryDir = path.join(caseDir, 'delivery');
await mkdir(responsesDir, { recursive: true });
await mkdir(deliveryDir, { recursive: true });

const source = await readFile(exportPath, 'utf8');
const parts = source.split(/^### (User|Model)\s*$/gm);
const exchanges = [];
for (let index = 1; index < parts.length; index += 4) {
  if (parts[index] !== 'User' || parts[index + 2] !== 'Model') continue;
  exchanges.push({ user: parts[index + 1].trim(), model: parts[index + 3].trim() });
}

const questionFromPrompt = prompt => {
  const match = prompt.match(/本轮只执行(?:可选)?问题(1[0-2]|[1-9])(B)?/);
  return match ? `Q${match[1]}${match[2] ?? ''}` : null;
};

const cleanModel = value => value
  .replace(/\\?\[Source:[\s\S]*?\\?\](?=\s|[。；，,.]|$|\\?\[Source:)/g, '')
  .replace(/\*\*(现实主题|本节回答|先讲结论|命理推演|主题闭包|加减与边界|独立结构数|时间承接层|语义层级|技术状态)\*\*\s*[：:]/g, '$1：')
  .replace(/^-\s+(现实主题|本节回答|先讲结论|命理推演|主题闭包|加减与边界|独立结构数|时间承接层|语义层级|技术状态)：/gm, '$1：')
  .replace(/[ \t]+$/gm, '')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

const answers = new Map();
for (const exchange of exchanges) {
  if (/网页补证修复/.test(exchange.user)) continue;
  const id = questionFromPrompt(exchange.user);
  if (id) answers.set(id, cleanModel(exchange.model));
}

const required = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8', 'Q9', 'Q10', 'Q11', 'Q12'];
for (const id of required) {
  if (!answers.has(id)) throw new Error(`Missing required answer: ${id}`);
}

const order = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q7B', 'Q8', 'Q9', 'Q10', 'Q11', 'Q12', 'Q12B'];
const results = [];
for (const [id, answer] of answers) {
  const relativePath = `responses/${id}-answer.txt`;
  await writeFile(path.join(caseDir, relativePath), `${answer}\n`, 'utf8');
  results.push({ id, status: 'PASS', answerPath: relativePath });
}
results.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));

const manifest = {
  caseId: 'CASE-20260908103342-MANUAL-EXPORT',
  fp: '2329E69C',
  phase: 'COMPLETE',
  source: exportPath,
  results,
};
await writeFile(path.join(deliveryDir, 'completion-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
await writeFile(path.join(caseDir, 'publication-repairs.json'), '{}\n', 'utf8');
console.log(JSON.stringify({ exchanges: exchanges.length, answers: results.map(result => result.id), caseDir }, null, 2));
