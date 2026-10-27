import { EASE } from './motion.ts';

const TOOLBAR = '[data-promptbox-action-row] > [data-promptbox-standard-actions][data-promptbox-expanded-only]';
const GHOST = 'data-bb-chat-ui-toolbar-ghost';
type Pose = { opacity:number;y:number };

// Native compact mode unmounts this row. Retain its inert exit visual and,
// on phone, an entry visual outside the clipped native grid during height motion.
export function injectComposerToolbar(composer:HTMLElement,timing:{durationMs:number;startedAt():number|null}):()=>void {
  const view=composer.ownerDocument.defaultView;
  if(!view||typeof composer.animate!=='function')return()=>{};
  const media=view.matchMedia?.('(prefers-reduced-motion: reduce)');
  const parent=composer.closest('[data-follow-up-composer]');
  let source=composer.querySelector<HTMLElement>(TOOLBAR);
  const visible=(node:HTMLElement|null)=>!!node&&!composer.hasAttribute('data-promptbox-compact')&&view.getComputedStyle(node).display!=='none';
  const phone=()=>composer.ownerDocument.documentElement.getAttribute('data-bb-chat-ui-root-device')==='phone';
  let snapshot=phone()&&source?source.cloneNode(true) as HTMLElement:null;
  let entry:{node:HTMLElement;finished:boolean}|null=null;
  let hidden:{node:HTMLElement;value:string;priority:string;hadStyle:boolean}|null=null;
  let shown=visible(source),disposed=false;

  function restoreNative():void {
    if(!hidden)return;
    const {node,value,priority,hadStyle}=hidden;hidden=null;
    if(value)node.style.setProperty('visibility',value,priority);else node.style.removeProperty('visibility');
    if(!hadStyle&&!node.style.length)node.removeAttribute('style');
  }
  function cleanSnapshot(node:HTMLElement):HTMLElement {
    const copy=node.cloneNode(true) as HTMLElement;
    if(hidden?.node===node){
      if(hidden.value)copy.style.setProperty('visibility',hidden.value,hidden.priority);else copy.style.removeProperty('visibility');
      if(!hidden.hadStyle&&!copy.style.length)copy.removeAttribute('style');
    }
    return copy;
  }
  function handover():void {
    if(!entry?.finished||!source?.isConnected||!visible(source))return;
    entry.node.remove();entry=null;restoreNative();
  }
  let active:{node:HTMLElement;animation:Animation;from:Pose;to:Pose}|null=null;

  // Read the animation clock, not layout, when a quick reversal interrupts a fade.
  function pose():Pose|null {
    if(!active)return null;
    const progress=active.animation.effect?.getComputedTiming().progress??0;
    return {opacity:active.from.opacity+(active.to.opacity-active.from.opacity)*progress,y:active.from.y+(active.to.y-active.from.y)*progress};
  }
  function cancel():void {
    if(active){
      const old=active;active=null;
      old.animation.onfinish=null;old.animation.oncancel=null;old.animation.cancel();
      if(old.node.hasAttribute(GHOST))old.node.remove();
    }
    entry?.node.remove();entry=null;restoreNative();
  }
  function animate(node:HTMLElement,from:Pose,to:Pose):void {
    const animation=node.animate([
      {opacity:from.opacity,transform:`translateY(${from.y}px)`},
      {opacity:to.opacity,transform:`translateY(${to.y}px)`},
    ],{duration:timing.durationMs,easing:EASE.out,fill:'both'});
    active={node,animation,from,to};
    const finish=()=>{
      if(active?.animation!==animation)return;
      active=null;animation.onfinish=null;animation.oncancel=null;
      if(entry?.node===node){
        entry.finished=true;node.style.opacity='1';node.style.transform='translateY(0px)';
        animation.cancel();handover();
      }else{animation.cancel();if(node.hasAttribute(GHOST))node.remove();}
    };
    animation.onfinish=finish;animation.oncancel=finish;
    let elapsed:number|null=null;
    if(entry?.node===node){
      // Read once at the transition boundary. CSS can begin painting after the
      // wall-clock start, or resume with a negative delay after native cleanup.
      const height=composer.getAnimations?.().find(candidate=>(candidate as CSSTransition).transitionProperty==='height');
      if(typeof height?.currentTime==='number')elapsed=height.currentTime-(height.effect?.getTiming().delay??0);
    }
    const start=timing.startedAt();
    if(elapsed===null&&start!==null)elapsed=view!.performance.now()-start;
    if(elapsed!==null)animation.currentTime=Math.min(timing.durationMs,Math.max(0,elapsed));
  }
  function visual(node:HTMLElement):HTMLElement {
    const clone=cleanSnapshot(node);
    clone.setAttribute(GHOST,'');clone.setAttribute('aria-hidden','true');clone.setAttribute('inert','');
    for(const item of [clone,...Array.from(clone.querySelectorAll<HTMLElement>('*'))]){
      item.removeAttribute('id');item.removeAttribute('aria-live');item.removeAttribute('data-promptbox-expanded-only');
    }
    // Match native left/bottom padding without a per-keystroke geometry cache.
    // Inline important display escapes the host's container-query important layer.
    for(const[key,value]of Object.entries({display:'flex',position:'absolute',left:'.875rem',bottom:'.5rem',width:'max-content','max-width':'calc(100% - 1.75rem)','pointer-events':'none'}))clone.style.setProperty(key,value,'important');
    return clone;
  }
  function outgoing(node:HTMLElement):HTMLElement {const clone=visual(node);composer.append(clone);return clone;}
  // Native phone grid/main clips the real row below the growing form. This
  // absolute visual shares the form's bottom and clock, outside that inner clip.
  function bindEntrySource(node:HTMLElement):void {
    if(!entry)return;
    snapshot=cleanSnapshot(node);
    const next=visual(snapshot);
    entry.node.className=next.className;
    entry.node.replaceChildren(...Array.from(next.childNodes));
    if(entry.finished){handover();return;}
    if(hidden?.node!==node){
      restoreNative();
      hidden={node,value:node.style.getPropertyValue('visibility'),priority:node.style.getPropertyPriority('visibility'),hadStyle:node.hasAttribute('style')};
      node.style.setProperty('visibility','hidden','important');
    }
  }
  function beginEntry(node:HTMLElement|null,from:Pose):void {
    const template=node??snapshot;if(!template)return;
    const proxy=outgoing(template);entry={node:proxy,finished:false};
    if(node)bindEntrySource(node);
    animate(proxy,from,{opacity:1,y:0});
  }
  function sync():void {
    if(disposed)return;
    const next=composer.querySelector<HTMLElement>(TOOLBAR);
    const isPhone=phone();
    const nextShown=isPhone&&!next ? !composer.hasAttribute('data-promptbox-compact') : visible(next);
    if(composer.hasAttribute('data-promptbox-voice-active')){cancel();source=next;shown=nextShown;return;}
    if(entry&&!isPhone)cancel();
    if(nextShown===shown){
      const previous=source;source=next;
      if(isPhone&&nextShown&&next){
        if(entry)bindEntrySource(next);
        else if(!previous&&!media?.matches)beginEntry(next,{opacity:0,y:8});
      }
      if(active&&!active.node.isConnected)cancel();
      return;
    }
    const previous=source,interrupted=pose();cancel();
    if(isPhone&&previous)snapshot=cleanSnapshot(previous);
    source=next;shown=nextShown;
    if(!media?.matches){
      if(nextShown){
        if(isPhone)beginEntry(next,interrupted??{opacity:0,y:8});
        else if(next)animate(next,interrupted??{opacity:0,y:8},{opacity:1,y:0});
      }else if(previous||(isPhone&&snapshot))animate(outgoing(previous??snapshot!),interrupted??{opacity:1,y:0},{opacity:0,y:8});
    }
  }
  // Ignore editor text and the enhancement's own output. Read display only at
  // actual compact/voice/toolbar transitions, including CSS-only parent state.
  const candidate=(node:Node)=>node instanceof view.Element&&!node.hasAttribute(GHOST)&&
    (node.matches('[data-promptbox-expanded-only][data-promptbox-standard-actions]')||!!node.querySelector('[data-promptbox-expanded-only][data-promptbox-standard-actions]'));
  const observer=new view.MutationObserver(records=>{
    if(records.some(r=>r.type==='attributes'||(entry&&r.target instanceof view.Element&&r.target.closest(TOOLBAR))||[...Array.from(r.addedNodes),...Array.from(r.removedNodes)].some(candidate)))sync();
  });
  observer.observe(composer,{childList:true,subtree:true,attributes:true,attributeFilter:['data-promptbox-compact','data-promptbox-voice-active']});
  if(parent)observer.observe(parent,{attributes:true,attributeFilter:['data-follow-up-composer-expanded']});
  observer.observe(composer.ownerDocument.documentElement,{attributes:true,attributeFilter:['data-bb-chat-ui-root-device']});
  const reduced=()=>{if(media?.matches)cancel();};
  media?.addEventListener?.('change',reduced);
  return()=>{if(disposed)return;disposed=true;observer.disconnect();media?.removeEventListener?.('change',reduced);cancel();};
}
