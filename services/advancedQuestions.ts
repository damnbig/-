import advancedQuestionGuideV011 from '../content/紫微单盘-进阶提问清单-v0.11.md?raw';
import advancedQuestionGuideV012 from '../content/紫微单盘-进阶提问清单-v0.12.md?raw';

export type AdvancedQuestionItem = {
  id: string;
  title: string;
  group: string;
  prompt: string;
  optional: boolean;
};

type MarkdownHeading = {
  index: number;
  level: number;
  title: string;
};

const normalizeTitle = (title: string) => title
  .replace(/^[一二三四五六七八九十]+、/, '')
  .trim();

const getItemId = (title: string) => {
  const questionMatch = title.match(/问题(\d+B?)/);
  if (questionMatch) return `Q${questionMatch[1]}`;

  const checkpointMatch = title.match(/CP-([A-D])-M/);
  if (checkpointMatch) return `CP-${checkpointMatch[1]}-M`;

  return title.replace(/[^A-Za-z0-9]+/g, '-');
};

const getGroup = (id: string) => {
  if (id === 'Q0') return '准入与锁定';
  if (['Q1', 'Q2', 'Q3', 'CP-A-M'].includes(id)) return '本命骨架';
  if (['Q4', 'Q5', 'Q6', 'CP-B-M'].includes(id)) return '现实领域';
  if (['Q7', 'Q7B', 'Q8', 'Q9', 'CP-C-M'].includes(id)) return '本命专题';
  if (['Q10', 'Q11', 'Q12', 'Q12B', 'CP-D-M'].includes(id)) return '时间验证';
  if (['Q13', 'Q14', 'Q14-REPLY'].includes(id)) return '现实校准';
  return '最终整合';
};

const isFlowHeading = (title: string) => (
  /问题(?:0|[1-9]|1[0-5])B?(?:[：:]|$)/.test(title)
  || /CP-[A-D]-M(?:[：:]|$)/.test(title)
);

const parseAdvancedQuestions = (markdown: string): AdvancedQuestionItem[] => {
  const allHeadings: MarkdownHeading[] = [];
  const headingPattern = /^(#{2,3})\s+(.+)$/gm;
  let headingMatch: RegExpExecArray | null;

  while ((headingMatch = headingPattern.exec(markdown)) !== null) {
    allHeadings.push({
      index: headingMatch.index,
      level: headingMatch[1].length,
      title: normalizeTitle(headingMatch[2]),
    });
  }

  return allHeadings.filter(heading => isFlowHeading(heading.title)).flatMap(heading => {
    const nextBoundary = allHeadings.find(candidate => (
      candidate.index > heading.index && candidate.level <= heading.level
    ));
    const sectionEnd = nextBoundary?.index ?? markdown.length;
    const section = markdown.slice(heading.index, sectionEnd);
    const codeBlocks = Array.from(section.matchAll(/```(?:text)?[ \t]*\r?\n([\s\S]*?)```/g));
    const baseId = getItemId(heading.title);

    return codeBlocks.map((match, blockIndex) => {
      const isReply = baseId === 'Q14' && blockIndex > 0;
      const id = isReply ? 'Q14-REPLY' : baseId;
      return {
        id,
        title: isReply ? '问题14：回答回传与局部更新' : heading.title,
        group: getGroup(id),
        prompt: match[1].trim(),
        optional: /可选/.test(heading.title) || /B$/.test(baseId) || isReply,
      };
    });
  });
};

const CANDIDATE_EVIDENCE_HOTFIX = [
  '【本轮引用边界热修】',
  'E编号只允许绑定当前[LOCKED-FACTS]事实包中的盘面FACT，并必须在末尾登记为“E编号=事实编号”。',
  '老师课程、讲义和NotebookLM原生来源标记不是盘面FACT：不得为课程解释创造E编号，也不得把原生引用序号改写成E编号。课程依据保留NotebookLM原生可点击引用；无法保留直接来源时标记PENDING_SOURCE并降低对应解释，不得虚构或补造E。',
  '提交前逐一删除所有无法绑定当前事实包的E；盘面事实仍须使用E，不得因本条省略。',
].join('\n');

const applyCandidateEvidenceHotfix = (items: AdvancedQuestionItem[]) => items.map(item => {
  if (!/^Q(?:[1-9]|1[0-5])B?$/.test(item.id)) return item;

  return {
    ...item,
    prompt: `${CANDIDATE_EVIDENCE_HOTFIX}\n\n${item.prompt}`,
  };
});

export type AdvancedQuestionGuide = {
  version: string;
  label: string;
  description: string;
  status: 'stable' | 'candidate';
  markdown: string;
  questions: AdvancedQuestionItem[];
};

const createAdvancedQuestionGuide = (
  markdown: string,
  label: string,
  description: string,
  status: AdvancedQuestionGuide['status'],
): AdvancedQuestionGuide => {
  const version = markdown.match(/^#\s+.+?\s+(v\d+\.\d+)/m)?.[1] ?? 'unknown';
  const questions = parseAdvancedQuestions(markdown);

  return {
    version,
    label,
    description,
    status,
    markdown,
    questions: version === 'v0.12' ? applyCandidateEvidenceHotfix(questions) : questions,
  };
};

export const advancedQuestionGuides = [
  createAdvancedQuestionGuide(
    advancedQuestionGuideV011,
    '稳定版',
    '当前稳定基线，保留原有论证组织。',
    'stable',
  ),
  createAdvancedQuestionGuide(
    advancedQuestionGuideV012,
    '候选版 · 引用热修',
    '新增全题资源与风险遗漏检查；课程引用不再占用E编号。',
    'candidate',
  ),
] satisfies AdvancedQuestionGuide[];

export const defaultAdvancedQuestionGuide = advancedQuestionGuides[0];
