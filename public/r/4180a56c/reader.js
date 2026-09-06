'use strict';
const $ = id => document.getElementById(id);
let documents = [], activeId = '', fontSize = 18, busy = false, notificationTimer;
const allowedIds = ["report","portrait-original","psyche-original","portrait-deep","psyche-deep"];
const initialId = location.hash.slice(1);
function notify(message) { $('toast').textContent=message; $('toast').classList.add('show'); clearTimeout(notificationTimer); notificationTimer=setTimeout(()=>$('toast').classList.remove('show'),2400); }
function bytes(value) { return Uint8Array.from(atob(value),char=>char.charCodeAt(0)); }
function menu(open) { $('sidebar').classList.toggle('open',open); $('backdrop').hidden=!open; $('menu').setAttribute('aria-expanded',String(open)); document.body.classList.toggle('menu-open',open); if(open) $('close-menu').focus(); }
function progress() { const range=document.documentElement.scrollHeight-innerHeight; $('progress').style.width=(range>0?Math.min(100,scrollY/range*100):0)+'%'; }
function select(id, reset=true) {
  const doc=documents.find(item=>item.id===id); if(!doc)return;
  activeId=id; $('category').textContent=doc.group; $('article-title').textContent=doc.title; $('article-subtitle').textContent=doc.subtitle;
  $('content').innerHTML=doc.html;
  $('reading-count').textContent=`${documents.indexOf(doc)+1} / ${documents.length} 篇 · 约 ${doc.text.replace(/\s/g,'').length.toLocaleString('zh-CN')} 字`;
  $('chapters').replaceChildren();
  const headings=$('content').querySelectorAll('h2,h3');
  headings.forEach((heading,index)=>{heading.id='part-'+index; const a=document.createElement('a');a.href='#'+heading.id;a.textContent=heading.textContent;a.onclick=event=>{event.preventDefault();menu(false);heading.scrollIntoView({behavior:'smooth'});};$('chapters').append(a);});
  document.querySelectorAll('.doc-link').forEach(link=>{if(link.dataset.id===id)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});
  const index=documents.indexOf(doc);
  for(const [name,offset] of [['previous',-1],['next',1]]) {const item=documents[index+offset];$(name).hidden=!item;if(item){$(name).querySelector('span').textContent=item.title;$(name).onclick=()=>{location.hash=item.id;};}}
  menu(false); if(reset){scrollTo({top:0,behavior:'instant'});$('article-title').focus({preventScroll:true});} progress();
}
function mount(data) {
  if(!Array.isArray(data.documents)||data.documents.length!==allowedIds.length||data.documents.some((doc,index)=>doc.id!==allowedIds[index]||typeof doc.html!=='string'||typeof doc.text!=='string')) throw new Error('invalid data');
  documents=data.documents; $('documents').replaceChildren();
  let group='';for(const doc of documents){if(group!==doc.group){group=doc.group;const p=document.createElement('p');p.className='group-label';p.textContent=group;$('documents').append(p);}const a=document.createElement('a');a.className='doc-link';a.href='#'+doc.id;a.dataset.id=doc.id;const title=document.createElement('span');title.textContent=doc.title;const sub=document.createElement('small');sub.textContent=doc.label;a.append(title,sub);a.onclick=()=>{if(activeId===doc.id)menu(false);};$('documents').append(a);}
  $('gate').hidden=true;$('workspace').hidden=false;
  const id=allowedIds.includes(location.hash.slice(1))?location.hash.slice(1):(allowedIds.includes(initialId)?initialId:'report');history.replaceState(null,'','#'+id);select(id);
}
$('unlock-form').addEventListener('submit',async event=>{
  event.preventDefault();if(busy)return;
  if(!crypto.subtle){$('gate-status').textContent='当前浏览器不支持安全解锁，请用最新版 Safari 或 Chrome 打开 HTTPS 链接。';return;}
  busy=true;$('unlock').disabled=true;$('unlock').querySelector('span').textContent='正在解锁…';$('gate-status').textContent='';
  let password=$('password').value;
  try{
    let envelope;
    try{const response=await fetch('/r/4180a56c/content.enc.json',{cache:'no-store',signal:AbortSignal.timeout(20000)});if(!response.ok)throw new Error();envelope=await response.json();}catch{throw new Error('network');}
    if(envelope.version!==1||envelope.iterations!==600000)throw new Error('format');
    const keyMaterial=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);
    password='';$('password').value='';
    const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:bytes(envelope.salt),iterations:envelope.iterations,hash:'SHA-256'},keyMaterial,{name:'AES-GCM',length:256},false,['decrypt']);
    let plaintext;try{plaintext=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(envelope.iv)},key,bytes(envelope.data));}catch{throw new Error('password');}
    mount(JSON.parse(new TextDecoder().decode(plaintext)));
  }catch(error){$('gate-status').textContent=error.message==='network'?'资料暂时加载失败，请检查网络后重试。':error.message==='password'?'密码不正确，或加密资料已更新，请重新输入。':'资料格式异常，请联系分享者。';$('password').focus();}
  finally{password='';busy=false;$('unlock').disabled=false;$('unlock').querySelector('span').textContent='打开阅读室';}
});
$('reveal').onclick=()=>{const show=$('password').type==='password';$('password').type=show?'text':'password';$('reveal').setAttribute('aria-pressed',String(show));$('reveal').setAttribute('aria-label',show?'隐藏密码':'显示密码');$('reveal').title=show?'隐藏密码':'显示密码';};
$('menu').onclick=()=>menu(!$('sidebar').classList.contains('open'));$('close-menu').onclick=()=>{menu(false);$('menu').focus();};$('backdrop').onclick=()=>menu(false);
document.addEventListener('keydown',event=>{if(event.key==='Escape')menu(false);});
$('lock').onclick=()=>{documents=[];activeId='';$('content').replaceChildren();$('documents').replaceChildren();$('chapters').replaceChildren();$('article-title').textContent='';$('article-subtitle').textContent='';$('category').textContent='';$('reading-count').textContent='';for(const id of ['previous','next']){$(id).onclick=null;$(id).querySelector('span').textContent='';}menu(false);$('workspace').hidden=true;$('gate').hidden=false;$('password').value='';$('password').type='password';$('reveal').setAttribute('aria-pressed','false');$('gate-status').textContent='';history.replaceState(null,'',location.pathname);scrollTo(0,0);$('password').focus();};
$('copy').onclick=async()=>{const doc=documents.find(item=>item.id===activeId);if(!doc)return;try{await navigator.clipboard.writeText(doc.text);notify('当前篇已复制');}catch{notify('复制未成功，可长按正文选择文字。');}};
$('download').onclick=()=>{if(!documents.length)return;const blob=new Blob([documents.map(doc=>'# '+doc.title+'\n\n'+doc.text).join('\n\n---\n\n')],{type:'text/markdown;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='私人阅读资料.md';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);notify('已下载全文，请妥善保管');};
function resize(delta){fontSize=Math.max(16,Math.min(24,fontSize+delta));document.documentElement.style.setProperty('--size',fontSize+'px');$('font-value').textContent=fontSize;$('font-down').disabled=fontSize===16;$('font-up').disabled=fontSize===24;}
$('font-down').onclick=()=>resize(-1);$('font-up').onclick=()=>resize(1);$('theme').onclick=()=>{const dark=document.body.classList.toggle('dark');$('theme').setAttribute('aria-label',dark?'切换浅色阅读':'切换深色阅读');};
addEventListener('hashchange',()=>{if(documents.length)select(allowedIds.includes(location.hash.slice(1))?location.hash.slice(1):'report');});
addEventListener('scroll',progress,{passive:true});
