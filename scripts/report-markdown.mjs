export function renderReportMarkdown(report, pageUrl) {
  const lines = [
    `# ${report.title}`,
    '',
    report.subtitle,
    '',
    `> 网页阅读版：${pageUrl}`,
    '',
  ];

  report.chapters.forEach((chapter, chapterIndex) => {
    lines.push(`## 第${chapterIndex + 1}章 ${chapter.title}`, '', chapter.intro, '');
    chapter.sections.forEach(section => {
      lines.push(`### ${section.title}`, '');
      if (section.answer) lines.push(section.answer, '');
      if (section.reasoning) lines.push('**论盘依据**', '', section.reasoning, '');
      if (section.synthesis) lines.push('**合参结果**', '', section.synthesis, '');
      if (section.boundary) lines.push('**边界与补充**', '', section.boundary, '');
    });
  });

  return `${lines.join('\n').replace(/\n{4,}/g, '\n\n\n').trimEnd()}\n`;
}

const escapeHtml = value => String(value).replace(
  /[&<>"']/g,
  character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character],
);

export function renderReportHtml(report) {
  return report.chapters.map((chapter, chapterIndex) => {
    const chapterId = `chapter-${String(chapter.question).toLowerCase()}`;
    const sections = chapter.sections.map(section => (
      `<section class="topic" id="${escapeHtml(section.id.toLowerCase())}">` +
      `<h3>${escapeHtml(section.title)}</h3>` +
      (section.answer ? `<p class="lead" data-block-id="${escapeHtml(section.id)}-answer">${escapeHtml(section.answer)}</p>` : '') +
      (section.reasoning ? `<div class="analysis-label">论盘依据</div><p class="reasoning" data-block-id="${escapeHtml(section.id)}-reasoning">${escapeHtml(section.reasoning)}</p>` : '') +
      (section.synthesis ? `<div class="analysis-label">合参结果</div><p class="synthesis" data-block-id="${escapeHtml(section.id)}-synthesis">${escapeHtml(section.synthesis)}</p>` : '') +
      (section.boundary ? `<p class="boundary" data-block-id="${escapeHtml(section.id)}-boundary">${escapeHtml(section.boundary)}</p>` : '') +
      '</section>'
    )).join('');
    return `<section class="chapter" id="${chapterId}">` +
      `<p class="chapter-label">第 ${chapterIndex + 1} 章</p>` +
      `<h2>${escapeHtml(chapter.title)}</h2>` +
      `<details class="method"><summary>本章取法</summary><p>${escapeHtml(chapter.intro)}</p></details>` +
      sections +
      '</section>';
  }).join('');
}
