import { CARD, cardSlot, cardStyle, infoCardCss } from './info-card.ts';
import { isQuoteMentionResource } from './quote-text.ts';
import { acceptJumpPulse, postHaptic, readHapticBridge } from './send-haptic.ts';
import { popoverRise } from './motion.ts';
import {COMPOSER_LEGACY_QUOTE,LEGACY_QUOTE_OPEN,legacyQuoteFromPreview,legacyQuotePreviewControl} from './legacy-quote-controls.ts';

export const QUOTE_PREVIEW_MARK='data-bb-chat-ui-quote-preview';
const MARK=QUOTE_PREVIEW_MARK, PANEL=MARK+'-card';
const LEGACY='[data-message-column] > .group\\/message blockquote, [data-promptbox-editor-scroll] [data-promptbox-editor-content] .ProseMirror blockquote';
const REMOVE='[data-bb-chat-ui-mention-remove], [data-bb-chat-ui-legacy-quote-remove]';
const before=new WeakMap<HTMLElement,Map<string,string|null>>();
type Reader=(id:string)=>Promise<string|null>;
const readers=new WeakMap<Document,Set<Reader>>();
export interface QuotePreviewOptions {readQuote?:Reader;}
export function registerQuoteReader(doc:Document,reader:Reader):()=>void {
 let set=readers.get(doc);if(!set)readers.set(doc,set=new Set());set.add(reader);
 return()=>{set!.delete(reader);if(!set!.size)readers.delete(doc);};
}
function resource(node:Element):Record<string,unknown>|null {try{const value:unknown=JSON.parse(node.getAttribute('data-prompt-mention-resource')??'null');return value&&typeof value==='object'?value as Record<string,unknown>:null;}catch{return null;}}
function isQuote(node:HTMLElement):boolean {return !!legacyQuoteFromPreview(node)||node.matches(LEGACY)||isQuoteMentionResource(resource(node));}
export function decorateQuotePreview(node:HTMLElement):void {
 if(!isQuote(node)||node.matches(COMPOSER_LEGACY_QUOTE))return;
 if(!before.has(node))before.set(node,new Map(['tabindex','role','aria-haspopup','aria-expanded',MARK].map(a=>[a,node.getAttribute(a)])));
 for(const[a,v]of Object.entries({[MARK]:'',tabindex:'0',role:'button','aria-haspopup':'dialog'}))if(node.getAttribute(a)!==v)node.setAttribute(a,v);
 if(!node.hasAttribute('aria-expanded'))node.setAttribute('aria-expanded','false');
}
export function clearQuotePreview(node:HTMLElement):void {const saved=before.get(node);if(!saved)return;for(const[a,v]of saved){if(v===null)node.removeAttribute(a);else node.setAttribute(a,v);}before.delete(node);}
export function quoteDomText(node:HTMLElement):string {
 const block=(n:Node)=>n.nodeType===1&&/^(P|DIV|PRE|LI|BLOCKQUOTE)$/.test((n as Element).tagName);
 const visit=(n:Node):string=>{if(n.nodeType===3)return n.nodeValue??'';if(n.nodeType!==1)return'';const e=n as Element;
  if(e.matches('button,svg,[data-bb-chat-ui-legacy-quote-controls]'))return'';if(e.tagName==='BR')return'\n';
  return Array.from(e.childNodes).map((child,i,all)=>(i>0&&(block(child)||block(all[i-1]))?'\n':'')+visit(child)).join('');};
 return visit(node);
}

export const quotePreviewCss=`
${infoCardCss(`[${PANEL}]`)}
[${MARK}] { cursor:pointer; pointer-events:auto; transition-property:background-color,color !important; }
[${LEGACY_QUOTE_OPEN}] { position:absolute; display:block; pointer-events:auto; transform:translateY(-50%); margin:0; padding:0; border:0; border-radius:999px; background:transparent; cursor:pointer; }
[${LEGACY_QUOTE_OPEN}]:focus-visible, [${MARK}]:focus-visible { outline:2px solid var(--ring); outline-offset:2px; }
[${PANEL}] { position:fixed; z-index:100; display:flex; flex-direction:column; max-height:var(--bb-chat-ui-info-max-height,min(50dvh,26rem)); }
[${PANEL}] > [${cardSlot.head}] { flex-shrink:0; }
[${PANEL}] > [${cardSlot.body}] { overflow:auto; min-height:0; overscroll-behavior:contain; }
[${PANEL}] [data-bb-chat-ui-quote-text] { ${cardStyle.prose} white-space:pre-wrap; overflow-wrap:anywhere; }
[${PANEL}] [data-bb-chat-ui-quote-text][data-code] { font-family:var(--font-mono,ui-monospace,monospace); }
[${PANEL}] [${cardSlot.meta}] { ${cardStyle.meta} margin:0 0 var(--bb-chat-ui-card-gap); }
`;

export function injectQuotePreview(doc:Document,options:QuotePreviewOptions={}):()=>void {
 const rootView=doc.defaultView;if(!rootView)return()=>{};const view=rootView;
 const sheet=doc.createElement('style');sheet.id='bb-chat-ui-quote-preview';sheet.textContent=quotePreviewCss;doc.head.append(sheet);
 for(const node of Array.from(doc.querySelectorAll<HTMLElement>(`${LEGACY}, .prompt-mention-pill[data-prompt-mention-resource]`)))decorateQuotePreview(node);
 let active:{trigger:HTMLElement;card:HTMLElement;text:HTMLElement}|null=null,disposed=false;
 const pulses=new WeakMap<HTMLElement,number>();
 const secondary=(event:Event)=>'pointerType'in event&&event.pointerType==='touch'&&'isPrimary'in event&&!event.isPrimary;
 const pulse=(trigger:HTMLElement,event?:Event)=>{if((event&&secondary(event))||doc.documentElement.getAttribute('data-bb-chat-ui-root-device')!=='phone')return;
  const at=acceptJumpPulse(pulses.get(trigger)??null,view.performance.now());if(at!==null&&postHaptic(readHapticBridge(view),'impact-light'))pulses.set(trigger,at);};
 const fromTarget=(target:EventTarget|null):HTMLElement|null=>{if(!(target instanceof Element)||target.closest(REMOVE))return null;const control=target.closest<HTMLButtonElement>(`[${LEGACY_QUOTE_OPEN}]`);if(control&&legacyQuoteFromPreview(control))return control;const node=target.closest<HTMLElement>(`[${MARK}], blockquote, .prompt-mention-pill`);return node?.matches(COMPOSER_LEGACY_QUOTE)?legacyQuotePreviewControl(node):node&&isQuote(node)?node:null;};
 const close=(feedback=true,restore=true,event?:Event)=>{if(!active)return;const{trigger,card}=active;active=null;trigger.setAttribute('aria-expanded','false');card.remove();view.removeEventListener('resize',place);doc.removeEventListener('scroll',onScroll,true);view.removeEventListener('popstate',onNavigation);if(feedback)pulse(trigger,event);if(restore&&trigger.isConnected)trigger.focus({preventScroll:true});};
 const onScroll=(event:Event)=>{if(active&&event.target instanceof Node&&!active.card.contains(event.target))close(false,false);};
 const onNavigation=()=>close(false,false);
 function place(){if(!active)return;const{trigger,card}=active;if(!trigger.isConnected){close(false,false);return;}
  const phone=doc.documentElement.getAttribute('data-bb-chat-ui-root-device')==='phone';
  const composer=phone?(trigger.closest('[data-promptbox]')??(trigger.closest('[data-thread-window]')??doc).querySelector('[data-scroll-footer] [data-promptbox]')):null;
  const r=(composer??trigger).getBoundingClientRect(),width=phone?Math.max(0,view.innerWidth-32):Math.min(420,Math.max(0,view.innerWidth-32));
  card.style.width=`${width}px`;card.style.left=`${phone?16:Math.max(16,Math.min(r.left,view.innerWidth-width-16))}px`;
  const above=r.top>=112,available=Math.max(64,above?r.top-24:view.innerHeight-r.bottom-24);
  card.style.maxHeight=`min(var(--bb-chat-ui-info-max-height,min(50dvh,26rem)), ${available}px)`;
  card.style.top=above?'auto':`${Math.max(16,r.bottom+8)}px`;card.style.bottom=above?`${Math.max(16,view.innerHeight-r.top+8)}px`:'auto';
 }
 async function open(trigger:HTMLElement,event:Event){if(active?.trigger===trigger){close(true,true,event);return;}close(false,false);decorateQuotePreview(trigger);
  const card=doc.createElement('section');card.setAttribute(PANEL,'');card.setAttribute(CARD,'');card.setAttribute('role','dialog');card.setAttribute('aria-label','인용 원문');card.setAttribute('aria-busy','true');
  const head=doc.createElement('header');head.setAttribute(cardSlot.head,'');const title=doc.createElement('span');title.setAttribute(cardSlot.title,'');title.textContent='인용 원문';head.append(title);
  const button=doc.createElement('button');button.type='button';button.setAttribute(cardSlot.close,'');button.setAttribute('aria-label','인용 원문 닫기');button.textContent='×';
  const body=doc.createElement('div');body.setAttribute(cardSlot.body,'');const meta=doc.createElement('p');meta.setAttribute(cardSlot.meta,'');
  const source=legacyQuoteFromPreview(trigger)??trigger;
  const data=resource(source),label=typeof data?.label==='string'?data.label:null;meta.textContent=label?`표시 이름: ${label} · 원문 위치 정보 없음`:'원문 위치 정보 없음';
  const text=doc.createElement('div');text.setAttribute('data-bb-chat-ui-quote-text','');text.setAttribute(cardSlot.prose,'');text.tabIndex=0;text.textContent='불러오는 중…';
  body.append(meta,text);card.append(head,button,body);doc.body.append(card);const current={trigger,card,text};active=current;trigger.setAttribute('aria-expanded','true');place();button.focus({preventScroll:true});pulse(trigger,event);popoverRise(card);
  view.addEventListener('resize',place);doc.addEventListener('scroll',onScroll,{capture:true,passive:true});view.addEventListener('popstate',onNavigation);
  try{
   let content:string|null;
   if(source.matches(LEGACY))content=quoteDomText(source);
   else{const id=typeof data?.itemId==='string'?data.itemId.slice('quote:'.length):'';const read=options.readQuote??[...(readers.get(doc)??[])].at(-1);if(!read)throw Error('reader unavailable');content=await read(id);}
   if(disposed||active!==current)return;if(!trigger.isConnected){close(false,false);return;}
   text.textContent=content??'인용 원문을 찾지 못했습니다.';
   if(data?.icon==='FileDiff'||source.querySelector('pre,code')||content?.startsWith('diff --git ')||content?.startsWith('```'))text.setAttribute('data-code','');
  }catch{if(active===current)text.textContent='인용 원문을 불러오지 못했습니다.';}
  finally{if(active===current)card.setAttribute('aria-busy','false');}
 }
 const onClick=(event:MouseEvent)=>{if(event.target instanceof Element&&active?.card.contains(event.target)){if(event.target.closest(`[${cardSlot.close}]`)){event.preventDefault();event.stopPropagation();close(true,true,event);}return;}
  const trigger=fromTarget(event.target);if(!trigger||secondary(event))return;event.preventDefault();event.stopPropagation();void open(trigger,event);};
 const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape'&&active){event.preventDefault();event.stopPropagation();close(true,true,event);return;}if(event.key!=='Enter'&&event.key!==' ')return;
  const trigger=fromTarget(event.target);if(!trigger)return;event.preventDefault();event.stopPropagation();void open(trigger,event);};
 const onOutside=(event:Event)=>{if(!active||!(event.target instanceof Node)||active.card.contains(event.target)||active.trigger.contains(event.target))return;const other=!!fromTarget(event.target);close(!other,!other,event);};
 doc.addEventListener('click',onClick,true);doc.addEventListener('keydown',onKey,true);doc.addEventListener('pointerdown',onOutside,true);
 return()=>{if(disposed)return;disposed=true;close(false,false);doc.removeEventListener('click',onClick,true);doc.removeEventListener('keydown',onKey,true);doc.removeEventListener('pointerdown',onOutside,true);for(const n of Array.from(doc.querySelectorAll<HTMLElement>(`[${MARK}]`)))clearQuotePreview(n);sheet.remove();};
}
