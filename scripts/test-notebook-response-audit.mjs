import assert from 'node:assert/strict';
import {
  bindUndeclaredFactReferences,
  confirmsAllChecksPass,
  extractNotebookAnswer,
  normalizeEvidenceBlock,
  repairMappedFactReferences,
} from './lib/notebook-response-audit.mjs';

assert.equal(confirmsAllChecksPass('是，TYPE=CHECK的RESULT（Y01至Y41）全部为PASS；'), true);
assert.equal(confirmsAllChecksPass('所有TYPE=CHECK项目均为PASS。'), true);
assert.equal(confirmsAllChecksPass('部分CHECK已PASS，其余待确认。'), false);
assert.match(normalizeEvidenceBlock('正文\n证据登记\nE01=DA03-L01 E02=DA03-L'), /E01=DA03-L01\nE02=DA03-L$/);

const q6Page = [
  '问题6用户提示',
  'Thoughts',
  'expand_more',
  'CASE-X / CURRENT_Q=6',
  'C6-1【关系主题】',
  '正文内容'.repeat(50),
  '证据登记',
  'E01=B12',
  'keep_pin',
].join('\n');
assert.match(extractNotebookAnswer(q6Page, 'Q6'), /C6-1/);

const q7bPage = [
  '问题7B用户提示',
  'Thoughts',
  'expand_more',
  '问题7B：父母互动候选',
  'C7B-1【候选主题】',
  '正文内容'.repeat(50),
  '证据登记',
  'E01=B12',
  'keep_pin',
].join('\n');
assert.match(extractNotebookAnswer(q7bPage, 'Q7B'), /C7B-1/);

const checkpointPage = [
  'CP-A-M用户提示',
  'Thoughts',
  'expand_more',
  '模式E：本命专题（CP-A-M 审计检查点）',
  'PENDING_SOURCE：无',
  'SCOPE_BLOCKED：无',
  '正文内容'.repeat(50),
  'keep_pin',
].join('\n');
assert.match(extractNotebookAnswer(checkpointPage, 'CP-A-M'), /审计检查点/);

const stalePage = [
  'Thoughts',
  'expand_more',
  '问题5：财务机制',
  'C5-1【财务主题】',
  '正文内容'.repeat(50),
  'keep_pin',
  '问题6用户提示',
  '正在思考…',
].join('\n');
assert.throws(() => extractNotebookAnswer(stalePage, 'Q6'), /Cannot find/);

const repaired = repairMappedFactReferences([
  '问题5：财务机制',
  '父母宫B12参与加减。',
  '证据登记',
  'E09=B12',
].join('\n'));
assert.equal(repaired.answer.includes('父母宫E09参与加减。'), true);
assert.deepEqual(repaired.repairs, [{ factId: 'B12', evidenceId: 'E09', count: 1 }]);

const duplicateFactMappings = repairMappedFactReferences([
  '问题10：过去大限',
  '第一大限使用DA01-L解释。',
  '证据登记',
  'E95=DA01-L',
  'E99=DA01-L',
].join('\n'));
assert.match(duplicateFactMappings.answer, /第一大限使用E95解释/);
assert.deepEqual(duplicateFactMappings.repairs, [{ factId: 'DA01-L', evidenceId: 'E95', count: 1 }]);

const bound = bindUndeclaredFactReferences([
  '问题9：身心机制',
  '身主（M07）参与解释。',
  '证据登记',
  'E01=B01',
].join('\n'), 'FACT|B01|TYPE=PALACE\nFACT|M07|TYPE=META');
assert.deepEqual(bound.bindings, [{ factId: 'M07', evidenceId: 'E02' }]);
assert.match(bound.answer, /E02=M07/);

console.log('NotebookLM response audit regression passed.');
assert.throws(() => extractNotebookAnswer([
  'Earlier prompt: do not enter CP-C-M yet',
  'Thoughts', 'expand_more', '问题7B：家庭互动', '正文'.repeat(100), 'keep_pin',
  'Now execute CP-C-M',
].join('\n'), 'CP-C-M'), /completed CP-C-M assistant turn/);
