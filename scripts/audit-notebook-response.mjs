import { auditQuestionPage } from './lib/notebook-response-audit.mjs';

const [pagePath, factsPath, question = 'AUTO'] = process.argv.slice(2);

if (!pagePath || !factsPath) {
  throw new Error('Usage: node scripts/audit-notebook-response.mjs <page.txt> <facts.md> [Q1]');
}

const { result } = await auditQuestionPage({ pagePath, factsPath, stepId: question });

console.log(JSON.stringify({
  status: result.status,
  question: result.question,
  declarations: `${result.validDeclarationCount}/${result.declarationCount}`,
  references: result.referenceCount,
  issues: result.issues.map(issue => ({ kind: issue.kind, line: issue.line, message: issue.message })),
}, null, 2));
