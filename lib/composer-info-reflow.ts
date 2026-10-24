import { EASE } from "./motion.ts";
const MARK = 'data-bb-chat-ui-info';
const KEY = `${MARK}-reflow-key`;
const GHOST = `${MARK}-reflow-ghost`;
type Box = {left:number;top:number;width:number;height:number};
interface Picture {key:string;node:HTMLElement;clone:HTMLElement;box:Box;opacity:number;html:string;ghost:boolean;}
interface Snapshot {pictures:Picture[];jump:{transform:string;opacity:number};}

// Only jump state changes take snapshots. Animated overlays never occupy a flex slot.
export function composerInfoReflow(bar:HTMLElement, jump:HTMLElement) {
  const view=bar.ownerDocument.defaultView!;
  const animations=new Set<Animation>(), ghosts=new Set<HTMLElement>();
  let layer:HTMLElement|null=null, generation=0, startFrame=0;
  const jumpStyles=['transition','translate','scale','transform','visibility'] as const;
  const original=new Map(jumpStyles.map(key=>[key,jump.style.getPropertyValue(key)]));
  const restoreJump=()=>{for(const key of jumpStyles){const value=original.get(key)!;if(value)jump.style.setProperty(key,value);else jump.style.removeProperty(key);}};
  const keyOf=(node:HTMLElement)=>node.getAttribute(KEY) ?? (node.hasAttribute(`${MARK}-trigger`)?`pill:${node.getAttribute(`${MARK}-trigger`)}`:node.hasAttribute(`${MARK}-stack-kind`)?`stack:${node.getAttribute(`${MARK}-stack-kind`)}`:'stack:all');
  const nodes=()=>Array.from(bar.querySelectorAll<HTMLElement>(`[${MARK}-trigger]:not([${MARK}-exiting]),[${MARK}-stack-kind],[${MARK}-all]`)).filter(n=>!n.closest('[hidden]')&&!n.closest(`[${MARK}-reflow-layer]`));
  const box=(node:HTMLElement):Box=>{const r=node.getBoundingClientRect();return{left:r.left,top:r.top,width:r.width||node.offsetWidth||32,height:r.height||32};};
  const cancel=()=>{
    generation++;
    if(startFrame)view.cancelAnimationFrame(startFrame);startFrame=0;
    for(const a of [...animations])a.cancel();animations.clear();
    for(const node of ghosts)node.remove();ghosts.clear();layer?.remove();layer=null;restoreJump();
  };
  const picture=(node:HTMLElement,ghost=false):Picture=>{
    const css=view.getComputedStyle(node),clone=node.cloneNode(true) as HTMLElement;
    // Keep the native frost and typography when a trigger moves into the overlay.
    for(const name of ['font','color','background','border','border-radius','box-shadow','backdrop-filter','padding','gap','display','align-items','justify-content'])clone.style.setProperty(name,css.getPropertyValue(name));
    return{key:keyOf(node),node,clone,box:box(node),opacity:Number(css.opacity||1),html:node.innerHTML,ghost};
  };
  const capture=():Snapshot|null=>{
    if(!bar.animate||view.matchMedia?.('(prefers-reduced-motion: reduce)').matches){cancel();return null;}
    const css=view.getComputedStyle(jump),translate=css.translate==='none'||!css.translate?['0px','0px']:css.translate.split(' ');
    const transform=`translate(${translate[0]},${translate[1]??'0px'}) scale(${css.scale==='none'||!css.scale?'1':css.scale}) ${css.transform==='none'?'':css.transform}`;
    const snapshot={pictures:[...nodes().map(n=>picture(n)),...Array.from(ghosts,n=>picture(n,true))],jump:{transform,opacity:Number(css.opacity||0)}};
    cancel();return snapshot;
  };
  const play=(before:Snapshot,shown:boolean)=>{
    const token=generation,duration=shown?460:340,easing=shown?EASE.out:EASE.exit;
    const origin=bar.getBoundingClientRect(),after=nodes().map(n=>picture(n)),targets=new Map(after.map(p=>[p.key,p]));
    const consumed=new Set<Picture>();
    const pair=(key:string)=>key.startsWith('pill:')?key.replace('pill:','stack:'):key.replace('stack:','pill:');
    const anchor=(key:string,list:Picture[])=>list.find(p=>p.key===pair(key))??list.find(p=>p.key==='stack:all')??list.find(p=>p.key.startsWith('stack:'));
    const pose=(from:Box,to:Box,scaleX=from.width/to.width,scaleY=from.height/to.height)=>`translate(${from.left+from.width/2-to.left-to.width/2}px,${from.top+from.height/2-to.top-to.height/2}px) scale(${scaleX},${scaleY})`;
    const run=(node:HTMLElement,frames:Keyframe[],finish?:()=>void)=>{
      const a=node.animate(frames,{duration,easing,fill:'both'});a.pause();a.currentTime=0;animations.add(a);
      const done=()=>{animations.delete(a);finish?.();if(!ghosts.size){layer?.remove();layer=null;}};
      a.onfinish=()=>{if(token!==generation)return;done();a.cancel();};a.oncancel=()=>{animations.delete(a);if(token===generation)done();};
    };
    for(const next of after){
      next.node.setAttribute(KEY,next.key);
      const same=before.pictures.find(p=>p.key===next.key&&!p.ghost);
      const source=same??anchor(next.key,before.pictures);
      if(!source)continue;
      const unchanged=!!same&&same.html===next.html;
      if(unchanged)consumed.add(same);
      const scale=same?undefined:Math.min(.8,source.box.width/next.box.width);
      run(next.node,[{transform:pose(source.box,next.box,scale,scale),opacity:unchanged?source.opacity:0},{transform:'none',opacity:1}]);
    }
    for(const old of before.pictures){
      if(consumed.has(old)||old.opacity<.001)continue;
      const destination=targets.get(old.key)??anchor(old.key,after);
      if(!destination)continue;
      if(!layer){layer=bar.ownerDocument.createElement('div');layer.setAttribute(`${MARK}-reflow-layer`,'');Object.assign(layer.style,{position:'absolute',inset:'0',pointerEvents:'none',zIndex:'3'});layer.inert=true;bar.append(layer);}
      const node=old.clone;node.hidden=false;node.setAttribute(GHOST,'');node.setAttribute(KEY,old.key);node.setAttribute('aria-hidden','true');node.removeAttribute('id');node.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));node.tabIndex=-1;
      Object.assign(node.style,{position:'absolute',left:`${old.box.left-origin.left}px`,top:`${old.box.top-origin.top}px`,width:`${old.box.width}px`,height:`${old.box.height}px`,minWidth:'0',maxWidth:'none',margin:'0',pointerEvents:'none',transformOrigin:'center',translate:'none',scale:'none'});
      layer.append(node);ghosts.add(node);
      const ratio=targets.has(old.key)?1:Math.min(.8,destination.box.width/old.box.width);
      const target=pose(destination.box,old.box,ratio,ratio);
      run(node,[{transform:'none',opacity:old.opacity},{transform:target,opacity:0}],()=>{node.remove();ghosts.delete(node);});
    }
    Object.assign(jump.style,{transition:'none',translate:'none',scale:'none',visibility:'visible'});
    run(jump,[before.jump,{transform:shown?'none':'translateY(10px) scale(.92)',opacity:shown?1:0}],restoreJump);
    // Paint the complete old pose once before starting the compositor animations.
    // Slow layout/paint must not consume the transition before its first frame.
    startFrame=view.requestAnimationFrame(()=>{
      startFrame=0;const start=view.performance.now();
      for(const animation of animations){animation.play();animation.startTime=start;}
    });
  };
  return{capture,play,cancel};
}
