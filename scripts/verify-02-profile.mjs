import {chromium} from 'playwright-core';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const html=readFileSync(new URL('../../tmp/02-profile-publish/index.html',import.meta.url),'utf8');
const source=JSON.parse(readFileSync(new URL('../../tmp/02-profile-source.json',import.meta.url),'utf8'));
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html;charset=utf-8');res.end(html);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try {
  const origin=`http://127.0.0.1:${server.address().port}`;
  const context=await browser.newContext({viewport:{width:390,height:844},permissions:['clipboard-read','clipboard-write']});
  const page=await context.newPage();
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin);
  await page.locator('a[href="#portrait"]').click();
  assert(await page.locator('#portrait').isVisible());
  assert((await page.locator('#portrait').boundingBox()).y>=0);
  await page.screenshot({path:fileURLToPath(new URL('../tmp/02-profile-mobile.png',import.meta.url))});
  await page.locator('[data-copy]').first().click();
  const copied=(await page.evaluate(()=>navigator.clipboard.readText())).replace(/\r\n/g,'\n');
  assert(copied.includes(source.portrait));assert(copied.includes(source.psyche));
  assert(copied.includes('问题12'));
  for(const width of [320,1440]) {await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({copyComplete:true,mobileAnchors:true,errors}));
} finally {await browser.close();await new Promise(r=>server.close(r));}
