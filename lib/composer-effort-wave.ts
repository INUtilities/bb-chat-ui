import { EASE } from './motion.ts';

type Item = { node: HTMLElement; x: number; from: number; to: number; alpha: number; fromAlpha: number; toAlpha: number };
type Bar = Item & { coordinate: number; major: boolean; mid: boolean; noise: number };

function grain(coordinate: number): number {
  const seed = Math.sin(coordinate * 127.1 + 19.7) * 43758.5453;
  return seed - Math.floor(seed);
}

// Evaluate the kit curve for a shared read-free animation clock.
const curve = EASE.out.match(/[\d.]+/g)!.map(Number);
function ease(progress: number): number {
  const [x1,y1,x2,y2] = curve;
  const axis = (t:number,a:number,b:number) => 3*(1-t)*(1-t)*t*a+3*(1-t)*t*t*b+t*t*t;
  let lo=0,hi=1;
  for(let i=0;i<16;i++){const mid=(lo+hi)/2;if(axis(mid,x1,x2)<progress)lo=mid;else hi=mid;}
  return axis((lo+hi)/2,y1,y2);
}

// Keep the ruler and matching labels alive when a provider changes its steps.
// Only transform/opacity vary per frame; geometry is read once per new scale.
export function mountEffortWave(track: HTMLElement) {
  const document=track.ownerDocument,view=document.defaultView!;
  const media=view.matchMedia?.('(prefers-reduced-motion: reduce)');
  const viewport=document.createElement('div');viewport.setAttribute('data-effort-viewport','');viewport.setAttribute('aria-hidden','true');
  viewport.innerHTML='<div data-effort-scale></div><div data-effort-pin><span data-effort-head></span></div>';track.prepend(viewport);
  const scale=viewport.querySelector<HTMLElement>('[data-effort-scale]')!,pin=viewport.querySelector<HTMLElement>('[data-effort-pin]')!,head=pin.firstElementChild as HTMLElement;
  const bars=new Map<string,Bar>(),labels=new Map<string,Item>();
  let names:string[]=[],index=-1,provider='',position=0,fromPosition=0,target=0,width=0,frame=0,started=0,stopped=false,pulse=false;
  const items=()=>[...bars.values(),...labels.values()];
  const point=(step:number,count:number)=>count===1?.5:step/(count-1);

  function paint(progress=1):void {
    const count=Math.max(1,names.length-1);
    for(const bar of bars.values()){
      const distance=(bar.x-position)*count,focus=Math.exp(-distance*distance/(2*.6*.6));
      const height=3+12*focus*(bar.major?1:.25+.75*bar.noise)+(bar.major?3:bar.mid?1:0)+(bar.major?0:bar.noise*1.8);
      bar.node.style.transform=`translateY(-50%) translateX(${(bar.x-bar.to)*width}px) scaleY(${height/24})`;
      bar.node.style.opacity=String(bar.alpha*(.15+.5*focus+(bar.major?.15:bar.noise*.07))*(pulse?.8+.2*progress:1));
    }
    for(const item of labels.values()){
      item.node.style.transform=`translateX(calc(-50% + ${(item.x-item.to)*width}px))`;
      item.node.style.opacity=String(item.alpha*(pulse?.8+.2*progress:1));
    }
    pin.style.transform=`translateX(${position*100}%)`;
    head.style.opacity=String(pulse?.6+.4*progress:1);
  }
  function cancel():void {view.cancelAnimationFrame(frame);frame=0;}
  function finish():void {
    position=target;
    for(const collection of [bars,labels])for(const [key,item]of collection){
      item.x=item.to;item.alpha=item.toAlpha;
      if(!item.toAlpha){item.node.remove();collection.delete(key);}
    }
    pulse=false;paint();
  }
  function animate(now:number):void {
    if(stopped)return;
    const progress=Math.min(1,Math.max(0,(now-started)/320)),eased=ease(progress);
    position=fromPosition+(target-fromPosition)*eased;
    for(const item of items()){item.x=item.from+(item.to-item.from)*eased;item.alpha=item.fromAlpha+(item.toAlpha-item.fromAlpha)*eased;}
    paint(eased);
    if(progress<1)frame=view.requestAnimationFrame(animate);else{frame=0;finish();}
  }
  function item(node:HTMLElement,x:number,initial:boolean):Item {return{node,x,from:x,to:x,alpha:initial?1:0,fromAlpha:initial?1:0,toAlpha:1};}
  function rebuild(next:string[],initial:boolean):void {
    width=scale.getBoundingClientRect().width;
    scale.style.setProperty('--bb-effort-intervals',String(Math.max(1,next.length-1)));
    for(const existing of items())existing.toAlpha=0;
    const last=next.length-1;
    for(let step=0;step<next.length;step++){
      const name=next[step],key=JSON.stringify([name,next.slice(0,step).filter(n=>n===name).length]),x=point(step,next.length);
      let label=labels.get(key);
      if(!label){const node=document.createElement('span');node.setAttribute('data-effort-label','');node.textContent=name;scale.append(node);label=item(node,x,initial);labels.set(key,label);}
      label.to=x;label.toAlpha=1;label.node.style.left=`${x*100}%`;
      // Assign each minor tick to its nearest named step, preserving its identity.
      const start=step===0?-12:-10,end=12;
      for(let offset=start;offset<=end;offset+=2){
        const coordinate=step*24+offset,tickKey=key+':'+offset,tickX=last?coordinate/(last*24):.5+offset/24;
        let bar=bars.get(tickKey);
        if(!bar){const node=document.createElement('i');node.setAttribute('data-effort-tick','');node.toggleAttribute('data-major',offset===0);node.style.height='24px';scale.prepend(node);bar={...item(node,tickX,initial),coordinate,major:offset===0,mid:Math.abs(offset)===12,noise:grain(coordinate)};bars.set(tickKey,bar);}
        bar.to=tickX;bar.toAlpha=1;bar.node.style.left=`${tickX*100}%`;
      }
    }
  }
  function sync(next:string[],selected:number,nextProvider=''):void {
    if(stopped||!next.length)return;
    const initial=index<0,changed=next.length!==names.length||next.some((name,i)=>name!==names[i]);
    if(!initial&&!changed&&selected===index&&nextProvider===provider)return;
    cancel();fromPosition=position;
    if(changed)rebuild(next,initial);
    names=[...next];index=selected;target=point(selected,names.length);pulse=!initial&&(changed||nextProvider!==provider);provider=nextProvider;
    for(const item of items()){item.from=item.x;item.fromAlpha=item.alpha;}
    // Existing labels can be reordered, so determine selection by the new name.
    for(const [key,item]of labels)item.node.toggleAttribute('data-current',item.toAlpha===1&&key===JSON.stringify([names[selected],names.slice(0,selected).filter(n=>n===names[selected]).length]));
    if(initial||media?.matches){finish();return;}
    started=view.performance.now();paint(0);frame=view.requestAnimationFrame(animate);
  }
  const reduced=()=>{if(media?.matches){cancel();finish();}};
  const resize=()=>{width=scale.getBoundingClientRect().width;paint();};
  media?.addEventListener?.('change',reduced);view.addEventListener('resize',resize);
  return {sync,stop(){stopped=true;cancel();media?.removeEventListener?.('change',reduced);view.removeEventListener('resize',resize);viewport.remove();}};
}
