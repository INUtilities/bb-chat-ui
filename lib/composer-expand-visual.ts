import {EASE} from './motion.ts';

/** phone 펼침: native layout은 즉시, frost 면과 내용만 같은 시계로 연다. */
export function injectPhoneExpansionVisual(composer:HTMLElement,durationMs=360):{expand(fromHeight:number):void;cancel():void;destroy():void}{
 const document=composer.ownerDocument,view=document.defaultView!,media=view.matchMedia?.('(prefers-reduced-motion: reduce)');
 const scroller=composer.closest<HTMLElement>('.thread-scrollbar');
 let lastScroll=scroller?.scrollTop??0,lastViewport=view.visualViewport?.height??view.innerHeight;
 const rememberScroll=()=>{
  if(document.documentElement.getAttribute('data-bb-chat-ui-root-device')!=='phone')return;
  const top=scroller?.scrollTop??lastScroll;
  if(state){
   const delta=top-state.scrollTop;state.scrollTop=top;
   const remaining=durationMs-(view.performance.now()-state.started);
   if(delta>0&&delta<=state.total+2&&remaining>0&&state.messageNode){
    const from=(state.messages?value(state.messages):0)+delta;stop(state.messages?.animation??null);
    const animation=state.messageNode.animate([{transform:`translateY(${from}px)`},{transform:'translateY(0px)'}],{duration:remaining,easing:EASE.out,fill:'both'});
    state.messages={animation,from,to:0};
   }
  }else if(composer.hasAttribute('data-promptbox-compact')){lastScroll=top;lastViewport=view.visualViewport?.height??view.innerHeight}
 };
 composer.addEventListener('focusin',rememberScroll);scroller?.addEventListener('scroll',rememberScroll,{passive:true});
 const mark='data-bb-chat-ui-expand-visual';
 const enabled='data-bb-chat-ui-phone-expand',originalEnabled=composer.getAttribute(enabled);
 const phone='html[data-bb-chat-ui-root-device="phone"]';
 const expanded=`[${enabled}]:not([data-promptbox-compact])`;
 const style=document.createElement('style');style.setAttribute('data-bb-chat-ui-expand-visual-style','');
 style.textContent=`${phone} ${expanded}{height:auto!important;transition:none!important}
${phone} ${expanded} > [data-promptbox-layout],${phone} ${expanded} [data-promptbox-main]{transition:none!important}
${phone} [data-follow-up-composer]:has(${expanded}) > [data-follow-up-composer-footer]{transition:none!important}
${phone} [${mark}]{background:transparent!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;box-shadow:none!important;isolation:isolate;overflow:visible!important}`;
 type Run={animation:Animation;from:number;to:number};
 let resize:ResizeObserver|null=null;
 let state:{face:HTMLElement;rect:DOMRect;clip:Run;content:Animation|null;footer:Animation|null;messages:Run|null;messageNode:HTMLElement|null;scrollTop:number;total:number;extension:number;bottomFrom:number;pills:HTMLElement|null;pill:Run|null;started:number;hadMark:boolean}|null=null,disposed=false;
 const progress=(run:Run)=>run.animation.effect?.getComputedTiming().progress??0;
 const value=(run:Run)=>run.from+(run.to-run.from)*progress(run);
 const stop=(animation:Animation|null)=>{if(animation){animation.onfinish=null;animation.oncancel=null;animation.cancel()}};
 function cancel(){resize?.disconnect();resize=null;if(!state)return;const old=state;state=null;stop(old.clip.animation);stop(old.content);stop(old.footer);stop(old.messages?.animation??null);lastViewport=view.visualViewport?.height??view.innerHeight;lastScroll=scroller?.scrollTop??lastScroll;stop(old.pill?.animation??null);old.face.remove();if(!old.hadMark)composer.removeAttribute(mark)}
 function expand(fromHeight:number){
  if(disposed)return;
  if(document.documentElement.getAttribute('data-bb-chat-ui-root-device')!=='phone'||media?.matches||typeof composer.animate!=='function'){cancel();return}
  const rect=composer.getBoundingClientRect();
  if(state&&Math.abs(rect.height-state.rect.height)<.5&&Math.abs(rect.top-state.rect.top)<.5)return;
  if(!state&&rect.height<=fromHeight+.5)return;
  const anchor=composer.closest('[data-follow-up-composer]');
  const extension=Math.max(0,(anchor?.getBoundingClientRect().bottom??rect.bottom)-rect.bottom);
  const now=view.performance.now();let footer:Animation|null,messages:Run|null,messageNode:HTMLElement|null,total:number,bottomFrom:number;let face:HTMLElement,pills:HTMLElement|null,content:Animation|null,from:number,pillFrom:number,started:number,hadMark:boolean;
  if(state){
   const old=state;face=old.face;pills=old.pills;content=old.content;footer=old.footer;messages=old.messages;messageNode=old.messageNode;total=old.total;started=old.started;hadMark=old.hadMark;
   from=Math.max(0,old.rect.top+value(old.clip)-rect.top);
   pillFrom=(old.pill?value(old.pill):0)+(old.rect.top-rect.top);
   const oldBottom=old.rect.bottom+old.extension-(old.bottomFrom+(old.extension-old.bottomFrom)*progress(old.clip));
   bottomFrom=Math.max(0,rect.bottom+extension-oldBottom);
   stop(old.clip.animation);stop(old.pill?.animation??null);
  }else{
   const css=view.getComputedStyle(composer);face=document.createElement('div');face.setAttribute('data-bb-chat-ui-expand-face','');face.setAttribute('aria-hidden','true');face.setAttribute('inert','');
   face.style.cssText='position:absolute;inset:0;z-index:-1;pointer-events:none;';
   face.style.background=css.background;face.style.backdropFilter=css.backdropFilter;face.style.setProperty('-webkit-backdrop-filter',css.getPropertyValue('-webkit-backdrop-filter')||css.backdropFilter);face.style.boxShadow=css.boxShadow;face.style.borderRadius=css.borderRadius;
   hadMark=composer.hasAttribute(mark);composer.setAttribute(mark,'');composer.append(face);
   from=Math.max(0,rect.height+extension-fromHeight);bottomFrom=0;pillFrom=from;started=now;
   const layout=composer.querySelector<HTMLElement>(':scope > [data-promptbox-layout]');
   content=layout?.animate([{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0px)'}],{duration:durationMs,easing:EASE.out,fill:'both'})??null;
   footer=anchor?.querySelector<HTMLElement>(':scope > [data-follow-up-composer-footer]')?.animate([{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0px)'}],{duration:durationMs,easing:EASE.out,fill:'both'})??null;
   const keyboard=Math.max(0,lastViewport-(view.visualViewport?.height??view.innerHeight));
   const displacement=Math.min(from,Math.max(0,(scroller?.scrollTop??lastScroll)-lastScroll-keyboard));
   messageNode=scroller?.querySelector<HTMLElement>(':scope > div > [data-scroll-attached],:scope > [data-scroll-attached]')??null;total=from;
   const messageAnimation=displacement>0?messageNode?.animate([{transform:`translateY(${displacement}px)`},{transform:'translateY(0px)'}],{duration:durationMs,easing:EASE.out,fill:'both'})??null:null;
   messages=messageAnimation?{animation:messageAnimation,from:displacement,to:0}:null;
   pills=composer.closest('[data-scroll-footer]')?.querySelector<HTMLElement>('[data-bb-chat-ui-info-bar]')??null;
  }
  face.style.bottom=`-${extension}px`;
  const remaining=Math.max(1,durationMs-(now-started));
  const animation=face.animate([{clipPath:`inset(${from}px 0px ${bottomFrom}px round 25px)`},{clipPath:`inset(0px 0px ${extension}px round 22px)`}],{duration:remaining,easing:EASE.out,fill:'both'});
  const pillAnimation=pills?.animate([{transform:`translateY(${pillFrom}px)`},{transform:'translateY(0px)'}],{duration:remaining,easing:EASE.out,fill:'both'})??null;
  state={face,rect,clip:{animation,from,to:0},content,footer,messages,messageNode,scrollTop:scroller?.scrollTop??lastScroll,total,extension,bottomFrom,pills,pill:pillAnimation?{animation:pillAnimation,from:pillFrom,to:0}:null,started,hadMark};
  animation.onfinish=()=>{if(state?.clip.animation===animation)cancel()};
  if(!resize&&typeof view.ResizeObserver==='function'){resize=new view.ResizeObserver(()=>{if(state)expand(state.rect.height)});resize.observe(composer);if(anchor)resize.observe(anchor);}
 }
 const restoreEnabled=()=>{if(originalEnabled===null)composer.removeAttribute(enabled);else composer.setAttribute(enabled,originalEnabled)};
 const syncDevice=()=>{
  if(document.documentElement.getAttribute('data-bb-chat-ui-root-device')==='phone'){
   composer.setAttribute(enabled,'');if(!style.isConnected)document.head.append(style);
  }else{cancel();restoreEnabled();style.remove()}
 };
 const deviceObserver=new view.MutationObserver(syncDevice);deviceObserver.observe(document.documentElement,{attributes:true,attributeFilter:['data-bb-chat-ui-root-device']});syncDevice();
 const reduced=()=>{if(media?.matches)cancel()};media?.addEventListener?.('change',reduced);
 return {expand,cancel,destroy(){if(disposed)return;disposed=true;deviceObserver.disconnect();cancel();restoreEnabled();composer.removeEventListener('focusin',rememberScroll);scroller?.removeEventListener('scroll',rememberScroll);media?.removeEventListener?.('change',reduced);style.remove()}};
}
