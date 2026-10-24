import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { attachInlineVisCollapse } from './inline-vis-collapse.ts';

const row = (id='assistant:item',file='demo.html') => `<div data-timeline-row-id="thread:${id}"><div data-markdown-preview><div data-inline-vis-frame style="height:196px"><iframe title="inline-vis: ${file}" srcdoc="<p>same document</p>"></iframe><div><a aria-label="Open ${file} in sidebar" href="/files/${file}">Open</a></div></div></div></div>`;
const fixture=()=>new JSDOM(`<body><main><div data-timeline-row-list="top-level">${row()}${row('user-seed:1','user.html')}</div></main></body>`,{url:'http://bb.local'});
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));

test('inline-vis collapses without replacing iframe or src, restores on expand and fully cleans up',async()=>{
 const dom=fixture(),d=dom.window.document,frame=d.querySelector('[data-inline-vis-frame]')!,iframe=frame.querySelector('iframe')!,native=iframe.outerHTML,style=frame.getAttribute('style'),stop=attachInlineVisCollapse(d);
 const button=frame.querySelector<HTMLButtonElement>('[data-bb-chat-ui-inline-vis-toggle]');
 assert.ok(button);assert.equal(button.type,'button');assert.equal(button.getAttribute('aria-expanded'),'true');assert.equal(button.getAttribute('aria-label'),'미리보기 접기');
 button.click();assert.ok(frame.hasAttribute('data-bb-chat-ui-inline-vis-collapsed'));assert.equal(button.getAttribute('aria-expanded'),'false');assert.equal(button.getAttribute('aria-label'),'미리보기 펼치기');
 assert.equal(frame.querySelector('iframe'),iframe);assert.equal(iframe.outerHTML,native);assert.equal(frame.getAttribute('style'),style);
 button.click();assert.equal(frame.hasAttribute('data-bb-chat-ui-inline-vis-collapsed'),false);assert.equal(button.getAttribute('aria-expanded'),'true');
 assert.equal(d.querySelector('[data-timeline-row-id*="user-seed"] [data-bb-chat-ui-inline-vis-toggle]'),null);
 button.click();stop();assert.equal(frame.querySelector('[data-bb-chat-ui-inline-vis-toggle]'),null);assert.equal(frame.hasAttribute('data-bb-chat-ui-inline-vis-collapsed'),false);button.click();assert.equal(frame.hasAttribute('data-bb-chat-ui-inline-vis-collapsed'),false);
 d.querySelector('[data-timeline-row-list]')!.insertAdjacentHTML('beforeend',row('assistant:late'));await tick();assert.equal(d.querySelector('[data-bb-chat-ui-inline-vis-toggle]'),null);dom.window.close();
});

test('sessionStorage survives row virtualization, action rerender, thread replacement and plugin remount without redundant writes',async()=>{
 const dom=fixture(),d=dom.window.document,list=d.querySelector('[data-timeline-row-list]')!,stop=attachInlineVisCollapse(d),store=dom.window.sessionStorage;
 let writes=0;const storageProto=Object.getPrototypeOf(store),set=storageProto.setItem,remove=storageProto.removeItem;
 storageProto.setItem=function(...args:Parameters<Storage['setItem']>){writes++;return set.apply(this,args);};storageProto.removeItem=function(...args:Parameters<Storage['removeItem']>){writes++;return remove.apply(this,args);};
 const first=d.querySelector<HTMLButtonElement>('[data-bb-chat-ui-inline-vis-toggle]')!;assert.ok(first);assert.equal(writes,0);first.click();assert.equal(writes,1);assert.equal(store.length,1);
 const frame=first.closest('[data-inline-vis-frame]')!,iframe=frame.querySelector('iframe')!,attrs=iframe.outerHTML;
 const paintCalls:string[]=[];const setter=frame.setAttribute.bind(frame);frame.setAttribute=(k,v)=>{paintCalls.push(k);setter(k,v);};
 frame.append(d.createElement('span'));await tick();assert.deepEqual(paintCalls,[]);assert.equal(writes,1);
 const actions=first.parentElement!;actions.replaceChildren(actions.querySelector('a')!);await tick();assert.equal(frame.querySelector('[data-bb-chat-ui-inline-vis-toggle]')?.getAttribute('aria-expanded'),'false');assert.equal(iframe.outerHTML,attrs);assert.equal(writes,1);
 list.innerHTML=row();await tick();assert.equal(list.querySelector('[data-bb-chat-ui-inline-vis-toggle]')?.getAttribute('aria-expanded'),'false');assert.equal(writes,1);
 const replacement=d.createElement('div');replacement.setAttribute('data-timeline-row-list','top-level');replacement.innerHTML=row('assistant:other');list.replaceWith(replacement);await tick();assert.equal(replacement.querySelector('[data-bb-chat-ui-inline-vis-toggle]')?.getAttribute('aria-expanded'),'true');
 replacement.innerHTML=row();await tick();assert.equal(replacement.querySelector('[data-bb-chat-ui-inline-vis-toggle]')?.getAttribute('aria-expanded'),'false');
 stop();const again=attachInlineVisCollapse(d);assert.equal(replacement.querySelector('[data-bb-chat-ui-inline-vis-toggle]')?.getAttribute('aria-expanded'),'false');assert.equal(writes,1);again();dom.window.close();
});

test('new-node observers skip whole-list rescans, attribute/text streams and unrelated user previews',async()=>{
 const dom=fixture(),d=dom.window.document,list=d.querySelector('[data-timeline-row-list]')!;
 const observations:{target:Node;options:MutationObserverInit}[]=[],MO=dom.window.MutationObserver;
 dom.window.MutationObserver=class extends MO{observe(target:Node,options:MutationObserverInit){observations.push({target,options});super.observe(target,options);}};
 const stop=attachInlineVisCollapse(d);assert.ok(observations.some(o=>o.target===list&&o.options.subtree&&o.options.childList));
 assert.ok(observations.every(o=>!o.options.attributes&&!o.options.characterData));assert.ok(observations.every(o=>o.target===list||!o.options.subtree));
 d.querySelectorAll=(()=>{throw Error('global rescan');}) as typeof d.querySelectorAll;list.querySelectorAll=(()=>{throw Error('whole-list rescan');}) as typeof list.querySelectorAll;
 const fragment=d.createElement('div');fragment.innerHTML=row('assistant:added','added.html');list.append(fragment);await tick();assert.ok(fragment.querySelector('[data-bb-chat-ui-inline-vis-toggle]'));
 const frame=fragment.querySelector('[data-inline-vis-frame]')!;frame.setAttribute('style','height:280px');frame.append(d.createTextNode('stream'));await tick();assert.equal(frame.querySelectorAll('[data-bb-chat-ui-inline-vis-toggle]').length,1);stop();dom.window.close();
});

test('mounting after initial navigation and inline fences keep independent stable session identities',async()=>{
 const dom=new JSDOM('<body><main></main></body>',{url:'http://bb.local'}),d=dom.window.document,stop=attachInlineVisCollapse(d),list=d.createElement('div');list.setAttribute('data-timeline-row-list','top-level');
 const fence=`<div data-inline-vis-frame><iframe title="inline-vis" srcdoc="<p>body</p>"></iframe><div><button aria-label="Show source">source</button></div></div>`;
 list.innerHTML=`<div data-timeline-row-id="thread:assistant:fences"><div data-markdown-preview>${fence}${fence}</div></div>`;d.querySelector('main')!.append(list);await tick();
 const buttons=list.querySelectorAll<HTMLButtonElement>('[data-bb-chat-ui-inline-vis-toggle]');assert.equal(buttons.length,2);buttons[0].click();assert.equal(buttons[1].getAttribute('aria-expanded'),'true');
 const html=list.innerHTML.replace(/<button[^>]*data-bb-chat-ui-inline-vis-toggle[^>]*>.*?<\/button>/g,'').replace(/ data-bb-chat-ui-inline-vis-collapsed=""/g,'');list.innerHTML=html;await tick();
 const restored=list.querySelectorAll('[data-bb-chat-ui-inline-vis-toggle]');assert.equal(restored[0].getAttribute('aria-expanded'),'false');assert.equal(restored[1].getAttribute('aria-expanded'),'true');stop();dom.window.close();
});

test('collapsed CSS hides only iframe and uses common 20/24px icon targets with reduced-motion focus rules',async()=>{
 const {injectTranscriptComponents,transcriptComponentsCss}=await import('./transcript-components.ts');
 const {infoCardCss}=await import('./info-card.ts');const {resolvedStyle}=await import('./test-style.ts');
 for(const phone of [false,true]){
  const dom=fixture(),d=dom.window.document;d.documentElement.setAttribute('data-bb-chat-ui-root-device',phone?'phone':'desktop');const tokens=d.createElement('style');tokens.textContent=infoCardCss();d.head.append(tokens);
  const stop=injectTranscriptComponents(d),button=d.querySelector<HTMLButtonElement>('[data-bb-chat-ui-inline-vis-toggle]')!,frame=button.closest('[data-inline-vis-frame]')!,iframe=frame.querySelector('iframe')!;
  assert.equal(resolvedStyle(button).width,phone?'24px':'20px');assert.equal(resolvedStyle(button).height,phone?'24px':'20px');assert.equal(resolvedStyle(button).borderRadius,'999px');
  button.click();assert.equal(dom.window.getComputedStyle(iframe).display,'none');assert.equal(frame.getAttribute('style'),'height:196px');button.click();assert.notEqual(dom.window.getComputedStyle(iframe).display,'none');
  assert.match(transcriptComponentsCss,/button\[data-bb-chat-ui-inline-vis-toggle\]:focus-visible\s*\{\s*outline:2px solid var\(--ring\)/);
  assert.match(transcriptComponentsCss,/@media \(prefers-reduced-motion:reduce\)[\s\S]*button\[data-bb-chat-ui-inline-vis-toggle\].*transition:none !important/s);
  stop();assert.equal(d.querySelector('#bb-chat-ui-transcript-components'),null);assert.equal(frame.hasAttribute('data-bb-chat-ui-inline-vis-collapsed'),false);dom.window.close();
 }
});

test('a full sessionStorage retains current-generation state in memory without interrupting collapse',async()=>{
 const dom=fixture(),d=dom.window.document,proto=Object.getPrototypeOf(dom.window.sessionStorage);proto.setItem=()=>{throw new dom.window.DOMException('full','QuotaExceededError');};
 const stop=attachInlineVisCollapse(d),list=d.querySelector('[data-timeline-row-list]')!,button=list.querySelector<HTMLButtonElement>('[data-bb-chat-ui-inline-vis-toggle]')!;button.click();list.innerHTML=row();await tick();assert.equal(list.querySelector('[data-bb-chat-ui-inline-vis-toggle]')?.getAttribute('aria-expanded'),'false');stop();dom.window.close();
});

for (const [device,supported,expected] of [['phone',true,1],['phone',false,0],['desktop',true,0],['',true,0]] as const) {
 test(`inline-vis disclosure haptic: device=${device||'absent'}, capability=${supported}`,()=>{
  const dom=fixture(),d=dom.window.document,messages:unknown[]=[];
  if(device)d.documentElement.setAttribute('data-bb-chat-ui-root-device',device);
  Object.assign(dom.window,{bb:{native:{capabilities:supported?['haptic']:[],post:(message:unknown)=>messages.push(message)}}});
  const stop=attachInlineVisCollapse(d),button=d.querySelector<HTMLButtonElement>('[data-bb-chat-ui-inline-vis-toggle]')!;
  button.click();assert.equal(button.getAttribute('aria-expanded'),'false');
  assert.deepEqual(messages,expected?[{type:'haptic',kind:'impact-light'}]:[]);
  stop();button.click();assert.equal(messages.length,expected,'unloaded buttons cannot pulse');dom.window.close();
 });
}

test('inline-vis suppresses repeated haptics on the same button for 400ms while keeping both toggles',()=>{
 const dom=fixture(),d=dom.window.document,messages:unknown[]=[];let now=1000;
 d.documentElement.setAttribute('data-bb-chat-ui-root-device','phone');
 Object.defineProperty(dom.window.performance,'now',{value:()=>now});
 Object.assign(dom.window,{bb:{native:{capabilities:['haptic'],post:(message:unknown)=>messages.push(message)}}});
 const stop=attachInlineVisCollapse(d),button=d.querySelector<HTMLButtonElement>('[data-bb-chat-ui-inline-vis-toggle]')!;
 button.click();now=1399;button.click();assert.equal(messages.length,1);assert.equal(button.getAttribute('aria-expanded'),'true');
 now=1400;button.click();assert.equal(messages.length,2,'400ms boundary permits a new impact-light');stop();dom.window.close();
});

test('inline-vis ignores secondary touch haptics and accepts primary touch and keyboard activation',()=>{
 const dom=fixture(),d=dom.window.document,messages:unknown[]=[];let now=1000;
 d.documentElement.setAttribute('data-bb-chat-ui-root-device','phone');
 Object.defineProperty(dom.window.performance,'now',{value:()=>now});
 Object.assign(dom.window,{bb:{native:{capabilities:['haptic'],post:(message:unknown)=>messages.push(message)}}});
 const stop=attachInlineVisCollapse(d),button=d.querySelector<HTMLButtonElement>('[data-bb-chat-ui-inline-vis-toggle]')!;
 const click=(primary:boolean)=>{const event=new dom.window.MouseEvent('click',{bubbles:true});Object.defineProperties(event,{pointerType:{value:'touch'},isPrimary:{value:primary}});button.dispatchEvent(event);};
 click(false);assert.equal(messages.length,0);click(true);assert.deepEqual(messages,[{type:'haptic',kind:'impact-light'}]);
 now=1400;button.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true,detail:0}));assert.equal(messages.length,2,'native button keyboard click uses the same capability and cooldown rules');
 stop();dom.window.close();
});

test('inline-vis haptic cooldown belongs to each button, not the whole transcript',()=>{
 const dom=fixture(),d=dom.window.document,messages:unknown[]=[];
 d.documentElement.setAttribute('data-bb-chat-ui-root-device','phone');
 d.querySelector('[data-timeline-row-list]')!.insertAdjacentHTML('beforeend',row('assistant:second','second.html'));
 Object.assign(dom.window,{bb:{native:{capabilities:['haptic'],post:(message:unknown)=>messages.push(message)}}});
 const stop=attachInlineVisCollapse(d),buttons=d.querySelectorAll<HTMLButtonElement>('[data-bb-chat-ui-inline-vis-toggle]');
 buttons[0].click();buttons[1].click();assert.equal(messages.length,2);stop();dom.window.close();
});
