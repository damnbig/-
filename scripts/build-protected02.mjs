import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {randomBytes,webcrypto,createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import * as icons from 'lucide-react';
import {Marked} from '../../tmp/protected-reader-deps/node_modules/marked/lib/marked.esm.js';
import assert from 'node:assert/strict';
const root=new URL('../../',import.meta.url);
const out=new URL('tmp/02-protected-publish/',root);
const privateDir=new URL('tmp/02-protected-private/',root);
mkdirSync(out,{recursive:true});mkdirSync(privateDir,{recursive:true});
const repo=fileURLToPath(new URL('tmp/deploy-repo',root));
const git=args=>execFileSync('git',['-c',`safe.directory=${repo.replaceAll('\\','/')}`,...args],{cwd:repo,encoding:'utf8'}).trimEnd();
const base=git(['rev-parse','FETCH_HEAD']);
const oldHtml=git(['show',`${base}:public/r/39d8c650/index.html`]);
const oldMd=git(['show',`${base}:public/r/39d8c650/report.md`]);
const reportText=oldMd.split('\n\n# 人物画像')[0];
assert(reportText.includes('问题12'));
const article=oldHtml.match(/<article id="original-report">([\s\S]*?)<\/article>/)?.[1];
assert(article,'Expected published original report');
assert(!/<script|<iframe|\son\w+=/i.test(article));
const earlier=JSON.parse(readFileSync(new URL('tmp/02-profile-source.json',root),'utf8'));
const sheng=readFileSync('F:/AItools/CODEX/占卜/地风升.txt','utf8').replace(/^\uFEFF/,'');
const jiaren=readFileSync('F:/AItools/CODEX/占卜/风火家人.txt','utf8').replace(/^\uFEFF/,'');
const escape=text=>text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const marked=new Marked({gfm:true,renderer:{html(token){return escape(token.text);},link(token){const text=this.parser.parseInline(token.tokens);return /^https?:\/\//i.test(token.href)?`<a href="${escape(token.href)}" target="_blank" rel="noopener noreferrer">${text}</a>`:text;}}});
const documents=[
 {id:'report',group:'命盘研究',title:'命盘报告',label:'原始十二问',subtitle:'早期十二问原始研究记录。',text:reportText,html:article},
 {id:'portrait',group:'命盘研究',title:'人物画像',label:'早期对话原文',subtitle:'基于命理资料的人物推演，保留早期对话原文。',text:earlier.portrait,html:marked.parse(earlier.portrait)},
 {id:'psyche',group:'命盘研究',title:'精神分析',label:'内在动力与关系模式',subtitle:'基于资料的心理解释假设，并非临床诊断。',text:earlier.psyche,html:marked.parse(earlier.psyche)},
 {id:'sheng',group:'占卜记录',title:'地风升',label:'学业 · 考研是否顺利',subtitle:'占问：会考研吗，是否顺利？本篇保留占卜原文。',text:sheng,html:marked.parse(sheng)},
 {id:'jiaren',group:'占卜记录',title:'风火家人',label:'居住 · 10月房屋转租',subtitle:'占问：10月房子是否能转租出去？本篇保留占卜原文。',text:jiaren,html:marked.parse(jiaren)}
];
const credentialPath=new URL('access.json',privateDir);
const password=existsSync(credentialPath)?JSON.parse(readFileSync(credentialPath,'utf8')).password:randomBytes(12).toString('base64url');
const salt=randomBytes(16),iv=randomBytes(12),iterations=600000;
const material=await webcrypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);
const key=await webcrypto.subtle.deriveKey({name:'PBKDF2',salt,iterations,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt']);
const data=await webcrypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(JSON.stringify({documents})));
const envelope={version:1,iterations,salt:salt.toString('base64'),iv:iv.toString('base64'),data:Buffer.from(data).toString('base64')};
writeFileSync(new URL('content.enc.json',out),JSON.stringify(envelope));
let html=readFileSync(new URL('./protected-reader/index.html',import.meta.url),'utf8');
html=html.replace(/\{\{(\w+)\}\}/g,(_,name)=>{assert(icons[name],name);return renderToStaticMarkup(createElement(icons[name],{'aria-hidden':'true',focusable:'false',strokeWidth:1.7}));});
writeFileSync(new URL('index.html',out),html);
for(const file of ['reader.css','reader.js'])writeFileSync(new URL(file,out),readFileSync(new URL('./protected-reader/'+file,import.meta.url)));
writeFileSync(new URL('report.md',out),'# 私人阅读室\n\n此资料已改为密码访问。请打开 https://www.nageclub.cn/r/39d8c650/ 解锁后复制或下载。\n');
writeFileSync(credentialPath,JSON.stringify({url:'https://www.nageclub.cn/r/39d8c650/',password},null,2));
writeFileSync(new URL('documents.json',privateDir),JSON.stringify({documents},null,2));
writeFileSync(new URL('base.txt',privateDir),base);
writeFileSync(new URL('verification.json',privateDir),JSON.stringify({base,documents:documents.map(d=>({id:d.id,chars:d.text.length,sha256:createHash('sha256').update(d.text).digest('hex')})),files:['index.html','reader.css','reader.js','content.enc.json','report.md']},null,2));
console.log(JSON.stringify({base,documents:documents.length,encrypted:true,passwordStoredPrivately:true}));
