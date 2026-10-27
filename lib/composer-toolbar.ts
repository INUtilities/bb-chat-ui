import { EASE } from './motion.ts';

const TOOLBAR = '[data-promptbox-action-row] > [data-promptbox-standard-actions][data-promptbox-expanded-only]';
const GHOST = 'data-bb-chat-ui-toolbar-ghost';
type Pose = { opacity:number;y:number };

// Native compact mode unmounts this row. Keep only its inert exit visual while
// the existing composer height transition closes the space underneath it.
export function injectComposerToolbar(composer:HTMLElement,timing:{durationMs:number;startedAt():number|null}):()=>void {
  const view=composer.ownerDocument.defaultView;
  if(!view||typeof composer.animate!=='function')return()=>{};
  const media=view.matchMedia?.('(prefers-reduced-motion: reduce)');
  const parent=composer.closest('[data-follow-up-composer]');
  let source=composer.querySelector<HTMLElement>(TOOLBAR);
  const visible=(node:HTMLElement|null)=>!!node&&!composer.hasAttribute('data-promptbox-compact')&&view.getComputedStyle(node).display!=='none';
  let shown=visible(source),disposed=false;
  let active:{node:HTMLElement;animation:Animation;from:Pose;to:Pose}|null=null;

  // Read the animation clock, not layout, when a quick reversal interrupts a fade.
  function pose():Pose|null {
    if(!active)return null;
    const progress=active.animation.effect?.getComputedTiming().progress??0;
    return {opacity:active.from.opacity+(active.to.opacity-active.from.opacity)*progress,y:active.from.y+(active.to.y-active.from.y)*progress};
  }
  function cancel():void {
    if(!active)return;
    const old=active;active=null;
    old.animation.onfinish=null;old.animation.oncancel=null;old.animation.cancel();
    if(old.node.hasAttribute(GHOST))old.node.remove();
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
      animation.cancel();
      if(node.hasAttribute(GHOST))node.remove();
    };
    animation.onfinish=finish;animation.oncancel=finish;
    const start=timing.startedAt();
    if(start!==null)animation.currentTime=Math.min(timing.durationMs,Math.max(0,view!.performance.now()-start));
  }
  function outgoing(node:HTMLElement):HTMLElement {
    const clone=node.cloneNode(true)as HTMLElement;
    clone.setAttribute(GHOST,'');clone.setAttribute('aria-hidden','true');clone.setAttribute('inert','');
    for(const item of [clone,...Array.from(clone.querySelectorAll<HTMLElement>('*'))]){
      item.removeAttribute('id');item.removeAttribute('aria-live');item.removeAttribute('data-promptbox-expanded-only');
    }
    // Match native left/bottom padding without a per-keystroke geometry cache.
    // Inline important display escapes the host's container-query important layer.
    for(const[key,value]of Object.entries({display:'flex',position:'absolute',left:'.875rem',bottom:'.5rem',width:'max-content','max-width':'calc(100% - 1.75rem)','pointer-events':'none'}))clone.style.setProperty(key,value,'important');
    composer.append(clone);return clone;
  }
  function sync():void {
    if(disposed)return;
    const next=composer.querySelector<HTMLElement>(TOOLBAR);
    const nextShown=visible(next);
    if(composer.hasAttribute('data-promptbox-voice-active')){cancel();source=next;shown=nextShown;return;}
    if(nextShown===shown){
      if(active&&!active.node.isConnected)cancel();
      source=next;return;
    }
    const interrupted=pose();cancel();
    if(!media?.matches){
      if(nextShown&&next)animate(next,interrupted??{opacity:0,y:8},{opacity:1,y:0});
      else if(source)animate(outgoing(source),interrupted??{opacity:1,y:0},{opacity:0,y:8});
    }
    source=next;shown=nextShown;
  }
  // Ignore editor text and the enhancement's own output. Read display only at
  // actual compact/voice/toolbar transitions, including CSS-only parent state.
  const candidate=(node:Node)=>node instanceof view.Element&&!node.hasAttribute(GHOST)&&
    (node.matches('[data-promptbox-expanded-only][data-promptbox-standard-actions]')||!!node.querySelector('[data-promptbox-expanded-only][data-promptbox-standard-actions]'));
  const observer=new view.MutationObserver(records=>{
    if(records.some(r=>r.type==='attributes'||[...Array.from(r.addedNodes),...Array.from(r.removedNodes)].some(candidate)))sync();
  });
  observer.observe(composer,{childList:true,subtree:true,attributes:true,attributeFilter:['data-promptbox-compact','data-promptbox-voice-active']});
  if(parent)observer.observe(parent,{attributes:true,attributeFilter:['data-follow-up-composer-expanded']});
  const reduced=()=>{if(media?.matches)cancel();};
  media?.addEventListener?.('change',reduced);
  return()=>{if(disposed)return;disposed=true;observer.disconnect();media?.removeEventListener?.('change',reduced);cancel();};
}
