const MARK='data-bb-chat-ui-composer-viewport';
const EDITOR='[data-promptbox-editor-scroll]';
const MAX='--bb-chat-ui-editor-max-height';
const MENU='--bb-chat-ui-mention-max-height';

// Calculate editor and mention space within the visible pane.
export function composerViewportLimits(input:{paneTop:number;paneBottom:number;viewportTop:number;viewportHeight:number;overhead:number}) {
  const height=Math.max(0,Math.min(input.paneBottom,input.viewportTop+input.viewportHeight)-Math.max(input.paneTop,input.viewportTop));
  const room=Math.max(0,height-input.overhead);
  const reserve=Math.min(160,height*.35,room*.5);
  return {editor:Math.max(0,Math.min(Math.max(24,height*.5-48),room-reserve)),reserve};
}

export const composerViewportCss=`
[${MARK}] ${EDITOR} {
  min-height:min(68px,var(${MAX})) !important;
  max-height:var(${MAX}) !important;
  overflow-y:auto !important;
  overscroll-behavior:contain;
}
[${MARK}][data-promptbox-compact] ${EDITOR} { min-height:min(48px,var(${MAX})) !important; }
@container follow-up-composer style(--follow-up-composer-container-compact: true) {
  [data-follow-up-composer]:not([data-follow-up-composer-expanded]) [${MARK}] ${EDITOR} { min-height:min(48px,var(${MAX})) !important; }
}
[${MARK}] [class~="@container/mention-menu"] { max-height:var(${MENU}) !important; }
[${MARK}] [class~="@container/mention-menu"] > .overflow-y-auto { min-height:0; overscroll-behavior:contain; }
`;

// Bind platform-independent viewport sizing and contained composer scrolling.
export function injectComposerViewport(document:Document):()=>void {
  const view=document.defaultView;
  if(!view)return ()=>{};
  const style=document.createElement('style');style.textContent=composerViewportCss;document.head.append(style);
  const bindings=new Map<HTMLElement,{footer:Element;pane:Element|null;editor:HTMLElement;stop:()=>void}>();
  // Resolve the layout owner so moving an existing composer can rebind its observers.
  const paneOf=(composer:Element)=>composer.closest('[data-page-scroll-viewport], .thread-scrollbar')??composer.closest('[data-thread-window]');
  let frame=0,stopped=false,refreshAll=true;
  const dirtyFooters=new Set<Element>();
  // Write a size only when its rounded value changes; all reads run first.
  const set=(node:HTMLElement,key:string,value:number)=>{
    const next=`${Math.floor(value)}px`;
    if(node.style.getPropertyValue(key)!==next)node.style.setProperty(key,next);
  };
  // Coalesce local footer changes while viewport events invalidate every pane.
  const schedule=(footer?:Element)=>{
    if(stopped)return;
    if(footer)dirtyFooters.add(footer);else refreshAll=true;
    if(!frame)frame=view.requestAnimationFrame(()=>{frame=0;sync();});
  };
  // Reserve full refreshes for window and visual viewport changes.
  const onViewport=()=>schedule();
  // Watch the owning pane without remeasuring independent composers.
  const bind=(composer:HTMLElement)=>{
    const footer=composer.closest('[data-scroll-footer]')!,pane=paneOf(composer);
    const sizes=typeof view.ResizeObserver==='function'?new view.ResizeObserver(()=>schedule(footer)):null;
    const editor=composer.querySelector<HTMLElement>(EDITOR)!;
    const scroller=(target:EventTarget|null,dx:number,dy:number)=>{
      for(let n=target instanceof view.Element?target:null;n&&composer.contains(n);n=n.parentElement){
        if(!(n instanceof view.HTMLElement))continue;
        const css=view.getComputedStyle(n);
        if((dy&&/auto|scroll/.test(css.overflowY)&&n.scrollHeight>n.clientHeight)
          ||(dx&&/auto|scroll/.test(css.overflowX)&&n.scrollWidth>n.clientWidth))return n;
      }
      return editor;
    };
    const wheel=(e:WheelEvent)=>{
      if(e.ctrlKey)return;
      e.stopPropagation();
      if(e.defaultPrevented)return;
      e.preventDefault();
      const target=scroller(e.target,e.deltaX,e.deltaY);
      const scale=e.deltaMode===1?16:e.deltaMode===2?target.clientHeight:1;
      target.scrollTop=Math.max(0,Math.min(target.scrollHeight-target.clientHeight,target.scrollTop+e.deltaY*scale));
      target.scrollLeft=Math.max(0,Math.min(target.scrollWidth-target.clientWidth,target.scrollLeft+e.deltaX*scale));
    };
    let touch:{x:number;y:number}|null=null;
    const start=(e:TouchEvent)=>{touch=e.touches.length===1?{x:e.touches[0].clientX,y:e.touches[0].clientY}:null;};
    const move=(e:TouchEvent)=>{
      if(!touch||e.touches.length!==1)return;
      const next={x:e.touches[0].clientX,y:e.touches[0].clientY};
      const dx=touch.x-next.x,dy=touch.y-next.y,target=scroller(e.target,dx,dy);
      touch=next;e.stopPropagation();
      const inside=target.contains(e.target as Node);
      if(!inside){e.preventDefault();target.scrollTop=Math.max(0,Math.min(target.scrollHeight-target.clientHeight,target.scrollTop+dy));}
      else if(Math.abs(dy)>=Math.abs(dx)&&(dy<0?target.scrollTop<=0:target.scrollTop+target.clientHeight>=target.scrollHeight-1))e.preventDefault();
    };
    const end=()=>{touch=null;};
    composer.addEventListener('wheel',wheel,{passive:false});
    composer.addEventListener('touchstart',start,{passive:true});
    composer.addEventListener('touchmove',move,{passive:false});
    composer.addEventListener('touchend',end);composer.addEventListener('touchcancel',end);
    sizes?.observe(footer);if(pane)sizes?.observe(pane);
    composer.setAttribute(MARK,'');
    return {footer,pane,editor,stop:()=>{
      sizes?.disconnect();
      composer.removeAttribute(MARK);composer.style.removeProperty(MAX);composer.style.removeProperty(MENU);
      composer.removeEventListener('wheel',wheel);composer.removeEventListener('touchstart',start);composer.removeEventListener('touchmove',move);composer.removeEventListener('touchend',end);composer.removeEventListener('touchcancel',end);
    }};
  };
  // Measure affected composers together before applying any viewport CSS values.
  const sync=()=>{
    const all=refreshAll,dirty=new Set(dirtyFooters);refreshAll=false;dirtyFooters.clear();
    const updates:{composer:HTMLElement;editor:number;menu:number}[]=[];
    const dirtyPanes=new Set(Array.from(dirty,paneOf).filter(Boolean));
    const current=new Set(Array.from(document.querySelectorAll<HTMLElement>('[data-scroll-footer] .chat-prompt-box [data-promptbox]')));
    for(const [node,binding]of bindings)if(!current.has(node)||!node.isConnected){binding.stop();bindings.delete(node);}
    const measure:HTMLElement[]=[];
    for(const composer of current){
      const editor=composer.querySelector<HTMLElement>(EDITOR);
      if(!editor||composer.closest('[data-queued-message-inline-editor]'))continue;
      const footer=composer.closest('[data-scroll-footer]')!,pane=paneOf(composer),binding=bindings.get(composer);
      const fresh=!binding||binding.footer!==footer||binding.pane!==pane||binding.editor!==editor;
      if(fresh){binding?.stop();bindings.set(composer,bind(composer));}
      if(all||fresh||dirty.has(footer)||(pane&&dirtyPanes.has(pane)))measure.push(composer);
    }
    for(const composer of measure){
      const {footer,pane,editor}=bindings.get(composer)!;
      const rect=pane?.getBoundingClientRect();
      const viewport=view.visualViewport;
      const top=viewport?.offsetTop??0,height=viewport?.height??view.innerHeight;
      const overhead=Math.max(0,footer.getBoundingClientRect().height-editor.getBoundingClientRect().height);
      const limits=composerViewportLimits({paneTop:rect?.top??top,paneBottom:rect?.bottom??top+height,viewportTop:top,viewportHeight:height,overhead});
      updates.push({composer,editor:limits.editor,menu:Math.max(0,composer.getBoundingClientRect().top-Math.max(rect?.top??top,top)-8)});
    }
    for(const {composer,editor,menu} of updates){set(composer,MAX,editor);set(composer,MENU,menu);}
  };
  // Route existing footer changes locally and still discover nested new composers.
  const mutations=new view.MutationObserver(records=>{
    let discover=false;
    for(const record of records){
      const footer=record.target instanceof view.Element?record.target.closest('[data-scroll-footer]'):null;
      if(footer)schedule(footer);else discover=true;
    }
    if(discover){
      const current=new Set(Array.from(document.querySelectorAll<HTMLElement>('[data-scroll-footer] .chat-prompt-box [data-promptbox]')));
      for(const node of current){
        const binding=bindings.get(node),footer=node.closest('[data-scroll-footer]')!;
        const moved=records.some(record=>Array.from(record.addedNodes).some(added=>added.contains(node)));
        // Moving between panes also invalidates the remaining composers in the old pane.
        if(binding&&binding.pane!==paneOf(node))schedule();
        else if(!binding||binding.footer!==footer||moved)schedule(footer);
      }
      for(const [node,binding]of bindings)if(!current.has(node)){binding.stop();bindings.delete(node);schedule();}
    }
    for(const [node,binding] of bindings)if(!node.isConnected){binding.stop();bindings.delete(node);}
  });
  mutations.observe(document.body,{childList:true,subtree:true});
  view.addEventListener('resize',onViewport);view.visualViewport?.addEventListener('resize',onViewport);view.visualViewport?.addEventListener('scroll',onViewport);
  sync();
  return ()=>{
    stopped=true;view.cancelAnimationFrame(frame);mutations.disconnect();
    view.removeEventListener('resize',onViewport);view.visualViewport?.removeEventListener('resize',onViewport);view.visualViewport?.removeEventListener('scroll',onViewport);dirtyFooters.clear();
    for(const binding of bindings.values())binding.stop();bindings.clear();style.remove();
  };
}
