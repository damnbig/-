import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { renderReportHtml, renderReportMarkdown } from './report-markdown.mjs';

const routes = ['6c2f9d81', '5fd8e05d', 'a74e19c3', '3334298d'];
const oldBottomButton = '<button class="tool-btn" type="button" id="bottomShareBtn"><span class="symbol">↗</span><span>分享</span></button>';
const newBottomButton = '<button class="tool-btn" type="button" id="copyFullBtn"><span class="symbol">⧉</span><span>复制全文</span></button>';
const oldCopyFunction = "async function copyText(text,message) { try{await navigator.clipboard.writeText(text);showToast(message);}catch{showToast('复制失败，请在浏览器中重试');} }";
const newCopyFunction = `function reportText() {
      const lines=[REPORT.title,'',REPORT.subtitle,'','阅读之前','',document.querySelector('[data-block-id="reading-note"]')?.textContent||''];
      REPORT.chapters.forEach(function(chapter,index){
        lines.push('','第 '+(index+1)+' 章 '+chapter.title,'',chapter.intro);
        chapter.sections.forEach(function(section){
          lines.push('',section.title);
          if(section.answer)lines.push('',section.answer);
          if(section.reasoning)lines.push('','论盘依据',section.reasoning);
          if(section.synthesis)lines.push('','合参结果',section.synthesis);
          if(section.boundary)lines.push('','边界与补充',section.boundary);
        });
      });
      return lines.filter(function(line,index){return line!==undefined&&line!==null&&(line!==''||lines[index-1]!=='');}).join('\\n').trim()+'\\n';
    }
    async function copyText(text,message) {
      try {
        if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(text);}else{throw new Error('Clipboard API unavailable');}
        showToast(message);
      } catch {
        const area=document.createElement('textarea');area.value=text;area.setAttribute('readonly','');area.style.cssText='position:fixed;left:-9999px;top:0;opacity:0';document.body.appendChild(area);area.select();area.setSelectionRange(0,area.value.length);
        try{if(!document.execCommand('copy'))throw new Error('Copy failed');showToast(message);}catch{showToast('复制失败，请长按正文后全选复制');}finally{area.remove();}
      }
    }`;
const oldBinding = "document.getElementById('topShareBtn').addEventListener('click',sharePage);document.getElementById('bottomShareBtn').addEventListener('click',sharePage);";
const newBinding = "document.getElementById('topShareBtn').addEventListener('click',sharePage);document.getElementById('copyFullBtn').addEventListener('click',function(){copyText(reportText(),'全文已复制');});";

for (const route of routes) {
  const routeDir = path.resolve(`public/r/${route}`);
  const htmlPath = path.join(routeDir, 'index.html');
  let html = await readFile(htmlPath, 'utf8');

  if (!html.includes('id="copyFullBtn"')) {
    if (!html.includes(oldBottomButton) || !html.includes(oldCopyFunction) || !html.includes(oldBinding)) {
      throw new Error(`Unexpected reading page structure: ${route}`);
    }
    html = html
      .replace(oldBottomButton, newBottomButton)
      .replace(oldCopyFunction, newCopyFunction)
      .replace(oldBinding, newBinding);
    await writeFile(htmlPath, html, 'utf8');
  }

  const reportMatch = html.match(/const REPORT = (.*?);\r?\n\s*const STORAGE_KEY/s);
  if (!reportMatch) throw new Error(`Cannot locate REPORT data: ${route}`);
  const report = JSON.parse(reportMatch[1]);
  html = html.replace(
    /<article id="reportBody">[\s\S]*?<\/article>/,
    `<article id="reportBody">${renderReportHtml(report)}</article>`,
  );
  await writeFile(htmlPath, html, 'utf8');
  await writeFile(
    path.join(routeDir, 'report.md'),
    renderReportMarkdown(report, `https://www.nageclub.cn/r/${route}/`),
    'utf8',
  );
}

console.log(`Upgraded ${routes.length} published reports.`);
