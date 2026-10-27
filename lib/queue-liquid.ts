import { EASE } from './motion.ts';
import { DARK_GLASS_FACE, LIGHT_GLASS_FACE } from './glass-surface.ts';

let nextMask = 0;
export interface QueueLiquidMotion { source:HTMLElement;target:HTMLElement;cancel():void;finished:Promise<void>; }

// Start visibly at the composer edge and move one liquid shape through absorption without a phase handoff.
export function queueLiquid(from:HTMLElement,to:HTMLElement):QueueLiquidMotion {
  const document=from.ownerDocument,view=document.defaultView;
  if(!view||!from.isConnected||!to.isConnected||!from.animate||!to.animate||view.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
    return{source:from,target:to,cancel:()=>{},finished:Promise.resolve()};
  const a=from.getBoundingClientRect(),b=to.getBoundingClientRect();
  const tx=b.left+b.width/2,ty=b.bottom,inset=Math.min(24,a.width/2);
  const x=Math.max(a.left+inset,Math.min(tx,a.right-inset)),y=a.top;
  const left=Math.min(x,tx)-32,top=Math.min(y,ty)-24;
  const width=Math.abs(tx-x)+64,height=Math.abs(ty-y)+48;
  const sx=x-left,sy=y-top,ex=tx-left,ey=ty-top;
  const root=document.createElement('span');root.setAttribute('data-queue-liquid','');root.setAttribute('aria-hidden','true');
  Object.assign(root.style,{position:'fixed',inset:'0',pointerEvents:'none',zIndex:'54',overflow:'visible'});
  const base=view.getComputedStyle(from).getPropertyValue('--bb-chat-ui-glass-base');
  if(base)root.style.setProperty('--bb-chat-ui-glass-base',base);
  root.style.setProperty('--liquid-face',document.documentElement.classList.contains('dark')?DARK_GLASS_FACE:LIGHT_GLASS_FACE);
  const animations=new Set<Animation>();let closed=false,resolve!:()=>void;
  const finished=new Promise<void>(done=>{resolve=done;});
  // Remove only the animations and surfaces owned by this flight.
  const cancel=()=>{
    if(closed)return;closed=true;
    view.removeEventListener('resize',cancel);document.removeEventListener('scroll',cancel,true);
    for(const animation of animations){animation.onfinish=null;animation.oncancel=null;animation.cancel();}
    animations.clear();
    root.remove();resolve();
  };
  const id=`bb-queue-liquid-${++nextMask}`;
  const surface=document.createElement('span');
  Object.assign(surface.style,{position:'fixed',left:`${left}px`,top:`${top}px`,width:`${width}px`,height:`${height}px`,pointerEvents:'none'});
  // Mirrored stationary edges share one mask with the moving drop, including when their gap is very small.
  surface.innerHTML=`<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true" style="overflow:visible">
    <defs><filter id="${id}-goo" x="-50%" y="-50%" width="200%" height="200%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="3"/><feColorMatrix type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 22 -9"/></filter>
    <mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}" style="mask-type:alpha"><g fill="white" filter="url(#${id}-goo)">
      <ellipse data-liquid-edge="source" data-edge-x="${x}" data-edge-y="${y}" cx="${sx}" cy="${sy+9}" rx="24" ry="9"/>
      <ellipse data-liquid-edge="target" data-edge-x="${tx}" data-edge-y="${ty}" cx="${ex}" cy="${ey-9}" rx="24" ry="9"/>
      <g class="bbk-drop" data-liquid-part="flight" style="background:none;border:0"><circle cx="${sx}" cy="${sy+3}" r="7"/></g>
    </g></mask></defs><rect x="0" y="${Math.min(sy,ey)-6}" width="${width}" height="${Math.abs(sy-ey)+12}" fill="var(--liquid-face)" mask="url(#${id})"/></svg>`;
  root.append(surface);document.body.append(root);
  const drop=surface.querySelector('[data-liquid-part="flight"]')!;
  try{
    const duration=1000;
    const flight=root.animate.call(drop,[
      {transform:'translate(0,0)'},
      {transform:`translate(${tx-x}px,${ty-y-17}px)`},
    ],{duration,delay:0,easing:EASE.out,fill:'forwards'});
    animations.add(flight);
    // Invert the shared easing so the pill reacts when the leading edge reaches it, including across short gaps.
    const [x1,y1,x2,y2]=EASE.out.match(/-?\d*\.?\d+/g)!.map(Number);
    // Sample one coordinate of the shared cubic curve.
    const curve=(t:number,a:number,b:number)=>3*(1-t)**2*t*a+3*(1-t)*t**2*b+t**3;
    const distance=y+17-ty,hit=distance>0?Math.max(0,Math.min(1,(y-4-ty)/distance)):1;
    let low=0,high=1;
    for(let step=0;step<20;step++){const t=(low+high)/2;if(curve(t,y1,y2)<hit)low=t;else high=t;}
    const delay=duration*curve((low+high)/2,x1,x2)+100;
    // Apply the selected receiving strength while keeping its bottom contact edge fixed.
    const receiving=to.animate([
      {transform:'scale(1)',offset:0},
      {transform:'scale(1.156,.87)',offset:.35},
      {transform:'scale(.948,1.065)',offset:.7},
      {transform:'scale(1)',offset:1},
    ].map((frame,index)=>({...frame,transformOrigin:'50% 100%',...(index<3?{easing:EASE.droplet}:{})})),{duration:380,delay,fill:'none'});
    animations.add(receiving);
    // Remove the liquid surface after absorption while retaining any receiving response still in progress.
    flight.onfinish=()=>{animations.delete(flight);root.remove();if(!animations.size)cancel();};
    // Release only the receiving response owned by this incoming message.
    receiving.onfinish=()=>{animations.delete(receiving);if(!animations.size)cancel();};
    view.addEventListener('resize',cancel);document.addEventListener('scroll',cancel,true);
  }catch{cancel();}
  return{source:from,target:to,cancel,finished};
}
