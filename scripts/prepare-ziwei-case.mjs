import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { astro } from 'iztro';
import { Solar } from 'lunar-javascript';

import { generateLockedZiweiLedger } from '../services/ziweiLedger.ts';

const [, , yearArg, monthArg, dayArg, hourArg, minuteArg, genderArg] = process.argv;
const values = [yearArg, monthArg, dayArg, hourArg, minuteArg].map(Number);
if (values.some(value => !Number.isInteger(value)) || !['男', '女'].includes(genderArg)) {
  throw new Error('Usage: node scripts/prepare-ziwei-case.mjs <year> <month> <day> <hour> <minute> <男|女>');
}

const [year, month, day, hour, minute] = values;
const now = new Date();
const genderCode = genderArg === '女' ? 'F' : 'M';
const input = {
  caseId: `CASE-${String(year).padStart(4, '0')}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}${String(hour).padStart(2, '0')}${String(minute).padStart(2, '0')}-${genderCode}`,
  gender: genderArg,
  birth: { year, month, day, hour, minute },
  report: { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() },
  timeBasis: '用户已确认的真太阳时',
};

const birthDate = new Date(
  input.birth.year,
  input.birth.month - 1,
  input.birth.day,
  input.birth.hour,
  input.birth.minute,
  0,
);
const reportDate = new Date(
  input.report.year,
  input.report.month - 1,
  input.report.day,
  12,
  0,
  0,
);

const solar = Solar.fromYmdHms(
  input.birth.year,
  input.birth.month,
  input.birth.day,
  input.birth.hour,
  input.birth.minute,
  0,
);
const lunar = solar.getLunar();
const hourIndex = Math.floor((input.birth.hour + 1) / 2) % 12;
const astrolabe = astro.bySolar(
  `${input.birth.year}-${input.birth.month}-${input.birth.day}`,
  hourIndex,
  input.gender,
  true,
  'zh-CN',
);

const ledger = generateLockedZiweiLedger({
  astrolabe,
  caseId: input.caseId,
  gender: input.gender,
  birthDate,
  reportDate,
  lunarText: lunar.toString(),
});

const outputDir = resolve('tmp', 'automation-poc', input.caseId);
mkdirSync(outputDir, { recursive: true });
const statePath = resolve(outputDir, 'state.json');
const previousState = existsSync(statePath)
  ? JSON.parse(readFileSync(statePath, 'utf8'))
  : null;

const state = {
  schemaVersion: 1,
  caseId: input.caseId,
  input,
  phase: previousState?.phase
    ?? (ledger.status === 'PASS' ? 'FACTS_READY' : 'FACTS_BLOCKED'),
  ledger: {
    status: ledger.status,
    factCount: ledger.factCount,
    fingerprint: ledger.fingerprint,
    issues: ledger.issues,
  },
  notebook: previousState?.notebook ?? {
    url: null,
    sourceUploaded: false,
    admissionPassed: false,
    currentQuestion: null,
    completedQuestions: [],
  },
  publishing: previousState?.publishing ?? {
    approved: false,
    url: null,
  },
};

writeFileSync(resolve(outputDir, 'locked-ledger.md'), ledger.markdown, 'utf8');
const notebookFacts = ledger.notebookFacts.replace(
  /^# \[LOCKED-FACTS\]\s*/m,
  `# [LOCKED-FACTS] FP=${ledger.fingerprint} `,
);
writeFileSync(resolve(outputDir, 'notebook-facts.md'), notebookFacts, 'utf8');
writeFileSync(
  resolve(outputDir, `LOCKED-FACTS-${input.caseId}-${ledger.fingerprint}.md`),
  notebookFacts,
  'utf8',
);
writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');

console.log(JSON.stringify({ outputDir, ...state.ledger }, null, 2));
