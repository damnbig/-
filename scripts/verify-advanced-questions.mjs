import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const guides = [
  {
    version: 'v0.11',
    requiredPhrases: [
      '支持 / 改向 / 减力 / 反证',
      '正规路径与自学、技能、作品、非学历认可之间存在竞争落象',
      '同一结构跨时间不得重复计票或以“双重能量”升级事件',
    ],
  },
  {
    version: 'v0.12',
    requiredPhrases: [
      '支持 / 改向 / 减力 / 反证',
      '正规路径与自学、技能、作品、非学历认可之间存在竞争落象',
      '同一结构跨时间不得重复计票或以“双重能量”升级事件',
      '全题覆盖与叙事完整性',
      '全题覆盖检查表',
      '不比较吉凶条数，不为平衡补造',
      '独立资源结构不能只用“尚有保护、也有贵人、不至于太差”附着在风险结论之后',
      '问题1的覆盖对象是“本命骨架结构链”',
      '不得提前写配偶互动、婚姻名分、继承置产、资产得失、考试成败等专题结果',
      '两端必须写到相近的具体程度',
      '正文约六至七成用于有限骨架结论',
      '每条主方法链至少给出一处可定位到具体课程文件或片段的NotebookLM直接引用',
      '全题覆盖只作用于整道题',
      '不得自行宣告网页PASS',
    ],
    forbiddenPhrases: [
      '机制主次与阴阳翻面',
      '未见足够翻面依据',
      '限制主题数量',
      '最后形成最多4条可证伪假设',
      '只筛选最多4条十年主题',
      '筛选3至6条',
      '输出3至6条',
      '通常3至6条',
      '只筛选1至3条年度主题',
    ],
  },
];

for (const guide of guides) {
  const markdown = readFileSync(
    resolve('content', `紫微单盘-进阶提问清单-${guide.version}.md`),
    'utf8',
  );

  const headings = Array.from(markdown.matchAll(/^(#{2,3})\s+(.+)$/gm)).map(match => ({
    index: match.index,
    level: match[1].length,
    title: match[2].replace(/^[一二三四五六七八九十]+、/, '').trim(),
  }));

  const flowHeadings = headings.filter(heading => (
    /问题(?:0|[1-9]|1[0-5])B?(?:[：:]|$)/.test(heading.title)
    || /CP-[A-D]-M(?:[：:]|$)/.test(heading.title)
  ));

  const copyItems = flowHeadings.flatMap(heading => {
    const boundary = headings.find(candidate => (
      candidate.index > heading.index && candidate.level <= heading.level
    ));
    const section = markdown.slice(heading.index, boundary?.index ?? markdown.length);
    return Array.from(section.matchAll(/```(?:text)?[ \t]*\r?\n([\s\S]*?)```/g));
  });

  if (copyItems.length !== 23) {
    throw new Error(`${guide.version}应生成23个复制项，实际为${copyItems.length}个。`);
  }

  if (guide.version === 'v0.12') {
    const coverageQuestions = flowHeadings.filter(heading => (
      /^问题(?:[1-9]|1[0-2])B?(?:[：:]|$)/.test(heading.title)
    ));

    if (coverageQuestions.length !== 14) {
      throw new Error(`v0.12应有14道全题覆盖分析题，实际为${coverageQuestions.length}道。`);
    }

    for (const heading of coverageQuestions) {
      const boundary = headings.find(candidate => (
        candidate.index > heading.index && candidate.level <= heading.level
      ));
      const section = markdown.slice(heading.index, boundary?.index ?? markdown.length);
      if (!section.includes('全题覆盖检查表')) {
        throw new Error(`v0.12的${heading.title}缺少全题覆盖检查表。`);
      }
      if (!section.includes('NotebookLM直接引用')) {
        throw new Error(`v0.12的${heading.title}缺少直接课程引用要求。`);
      }
      if (!section.includes('不得自行宣告网页PASS')) {
        throw new Error(`v0.12的${heading.title}缺少提交前编号与状态检查。`);
      }
    }
  }

  for (const phrase of guide.requiredPhrases) {
    if (!markdown.includes(phrase)) {
      throw new Error(`${guide.version}缺少关键规则：${phrase}`);
    }
  }

  for (const phrase of guide.forbiddenPhrases ?? []) {
    if (markdown.includes(phrase)) {
      throw new Error(`${guide.version}仍含已废弃规则：${phrase}`);
    }
  }
}

console.log('Advanced question regression passed: v0.11 and v0.12 each contain 23 copy items and required gates.');
