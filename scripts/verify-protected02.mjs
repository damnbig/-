import {chromium} from 'playwright-core';
import {readFileSync,readdirSync} from 'node:fs';
import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=new URL('../../tmp/',import.meta.url);
const out=new URL('02-protected-publish/',root);
const source=JSON.parse(readFileSync(new URL('02-protected-private/documents.json',root),'utf8'));
const {password}=JSON.parse(readFileSync(new URL('02-protected-private/access.json',root),'utf8'));
for(const file of readdirSync(out)){const content=readFileSync(new URL(file,out),'utf8');assert(!content.includes(password));for(const doc of source.documents)assert(!content.includes(doc.text.slice(0,70)),`Plaintext leak: ${file}/${doc.id}`);}
const server=createServer((req,res)=>{const name=new URL(req.url,'http://localhost').pathname.split('/').pop()||'index.html';if(!['index.html','reader.js','reader.css','content.enc.json','report.md'].includes(name)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.json')?'application/json':name.endsWith('.md')?'text/plain;charset=utf-8':'text/html;charset=utf-8');res.end(readFileSync(new URL(name,out)));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
const context=await browser.newContext({viewport:{width:390,height:844},permissions:['clipboard-read','clipboard-write'],acceptDownloads:true});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(origin+'/r/39d8c650/');
await page.screenshot({path:fileURLToPath(new URL('02-protected-private/gate-mobile.png',root))});
assert(await page.locator('#gate').isVisible());assert(!(await page.locator('#workspace').isVisible()));
await page.locator('#password').fill('wrong-password');await page.locator('#unlock').click();await page.waitForFunction(()=>document.getElementById('gate-status').textContent.includes('密码不正确'));
assert.equal(await page.locator('#content').textContent(),'');
await page.locator('#password').fill(password);await page.locator('#unlock').click();await page.locator('#workspace').waitFor({state:'visible'});
for(const doc of source.documents){await page.evaluate(id=>{location.hash=id;},doc.id);await page.waitForFunction(title=>document.getElementById('article-title').textContent===title,doc.title);await page.locator('#copy').click();const copied=(await page.evaluate(()=>navigator.clipboard.readText())).replace(/\r\n/g,'\n');assert.equal(copied,doc.text.replace(/\r\n/g,'\n'));assert(await page.locator('#content').isVisible());}
await page.screenshot({path:fileURLToPath(new URL('02-protected-private/reading-mobile.png',root))});
await page.locator('#menu').click();assert(await page.locator('#sidebar').isVisible());await page.screenshot({path:fileURLToPath(new URL('02-protected-private/menu-mobile.png',root))});await page.locator('a.doc-link[data-id="sheng"]').click();await page.waitForFunction(()=>document.getElementById('article-title').textContent==='地风升');assert.equal(await page.locator('#menu').getAttribute('aria-expanded'),'false');
for(const width of [320,390,1440]){await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Overflow ${width}`);await page.screenshot({path:fileURLToPath(new URL(`02-protected-private/reading-${width}.png`,root))});}
const downloadPromise=page.waitForEvent('download');await page.locator('#download').click();const download=await downloadPromise;const content=readFileSync(await download.path(),'utf8');for(const doc of source.documents)assert(content.includes(doc.text));
await page.locator('#lock').click();assert(await page.locator('#gate').isVisible());assert.equal(await page.locator('#content').textContent(),'');assert.equal(await page.evaluate(()=>localStorage.length+sessionStorage.length),0);
await page.reload();assert(await page.locator('#gate').isVisible());assert.deepEqual(errors,[]);
console.log(JSON.stringify({wrongPasswordRejected:true,allFiveCopiedExactly:true,downloadComplete:true,lockClearsContent:true,noPersistentStorage:true,publicFilesContainNoPlaintext:true,viewports:[320,390,1440],errors}));
}finally{await browser.close();await new Promise(r=>server.close(r));}
