import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { queueLiquid } from './queue-liquid.ts';

// 실제 입력과 전송 버튼을 구분하는 좌표와 제어 가능한 애니메이션을 준비한다.
function fixture(reduced=false) {
  const dom=new JSDOM('<div id="composer"><textarea>draft</textarea><button>Send</button></div><button id="pill">3</button>',{pretendToBeVisual:true});
  const {document}=dom.window,composer=document.getElementById('composer')!,pill=document.getElementById('pill')!;
  composer.getBoundingClientRect=()=>({left:40,top:160,right:440,bottom:260,width:400,height:100} as DOMRect);
  pill.getBoundingClientRect=()=>({left:60,top:80,right:120,bottom:112,width:60,height:32} as DOMRect);
  const records:{node:Element;frames:Keyframe[];options:KeyframeAnimationOptions;animation:Animation;cancelled:boolean}[]=[];
  dom.window.matchMedia=()=>({matches:reduced} as MediaQueryList);
  // Record animations so each test can finish or cancel the complete visual flight.
  dom.window.Element.prototype.animate=function(frames,options) {
    const record={node:this,frames:frames as Keyframe[],options:options as KeyframeAnimationOptions,animation:null as unknown as Animation,cancelled:false};
    record.animation={onfinish:null,oncancel:null,cancel(){record.cancelled=true;}} as unknown as Animation;
    records.push(record);return record.animation;
  };
  return{dom,document,composer,pill,records};
}

// One moving shape keeps the departure and absorption on the same uninterrupted clock.
test('one droplet starts below the pill and enters it without restarting its motion',()=>{
  const f=fixture(),motion=queueLiquid(f.composer,f.pill);
  const flights=f.records.filter(record=>record.node.getAttribute('data-liquid-part')==='flight');
  assert.equal(flights.length,1,'departure, travel and absorption share one droplet animation');
  const flight=flights[0];
  assert.equal(flight.options.duration,1000,'the droplet uses the duration selected in the tuner');
  assert.equal(flight.options.easing,'cubic-bezier(.22,1,.36,1)');
  const receiving=f.records.find(record=>record.node===f.pill)!;
  assert.ok(receiving,'the receiving pill reacts to the incoming message');
  assert.equal(receiving.options.duration,380);
  assert.equal(receiving.frames[1].transform,'scale(1.156,.87)','the selected receiving strength is 130 percent');
  assert.equal(receiving.frames[2].transform,'scale(.948,1.065)');
  assert.ok(Number(receiving.options.delay)>0&&Number(receiving.options.delay)<Number(flight.options.duration),'the pill reacts while the incoming droplet is still moving');
  assert.equal(receiving.frames[0].transformOrigin,'50% 100%','the absorption edge stays anchored');
  assert.equal(receiving.frames.at(-1)!.transform,'scale(1)');
  assert.equal(flight.options.delay,0);
  assert.equal(flight.frames.length,2,'no intermediate landing or stationary keyframe');
  assert.equal(flight.frames[0].transform,'translate(0,0)');
  assert.equal(flight.frames[1].transform,'translate(0px,-65px)','the same droplet travels from the composer surface into the pill');
  const sourceEdge=Number(f.document.querySelector('[data-liquid-edge="source"]')?.getAttribute('cy'))-9;
  const drop=f.document.querySelector('[data-liquid-part="flight"] circle')!;
  assert.ok(Number(drop.getAttribute('cy'))-Number(drop.getAttribute('r'))<sourceEdge,'the first frame already reaches outside the composer instead of travelling invisibly inside it');
  assert.equal(f.records.some(r=>r.node===f.composer||r.node===f.composer.querySelector('button')),false);
  assert.equal(f.document.querySelector('[data-liquid-edge="source"]')?.getAttribute('data-edge-y'),'160');
  assert.equal(f.document.querySelector('[data-liquid-edge="source"]')?.getAttribute('data-edge-x'),'90');
  assert.equal(f.document.querySelector('[data-liquid-edge="target"]')?.getAttribute('data-edge-y'),'112');
  assert.equal(f.composer.querySelector('textarea')!.value,'draft');
  motion.cancel();f.dom.window.close();
});

// Finishing the droplet and receiving pill releases both owned animations without changing content.
test('arrival removes every temporary surface and cancellation never changes the counter',async()=>{
  const f=fixture(),motion=queueLiquid(f.composer,f.pill);
  const completed=[...f.records];
  const receiving=completed.find(record=>record.node===f.pill)!;
  receiving.animation.onfinish?.(new f.dom.window.Event('finish') as unknown as AnimationPlaybackEvent);
  assert.ok(f.document.querySelector('[data-queue-liquid]'),'the receiving response finishing early must not remove the still moving droplet');
  completed.find(record=>record!==receiving)!.animation.onfinish?.(new f.dom.window.Event('finish') as unknown as AnimationPlaybackEvent);
  await motion.finished;
  assert.equal(f.document.querySelector('[data-queue-liquid]'),null);
  assert.equal(f.pill.textContent,'3');
  const next=queueLiquid(f.composer,f.pill);next.cancel();await next.finished;
  assert.equal(f.document.querySelector('[data-queue-liquid]'),null);
  assert.ok(completed.every(record=>!record.cancelled),'completed animations are no longer tracked');
  assert.ok(f.records.filter(record=>!completed.includes(record)).every(record=>record.cancelled));f.dom.window.close();
});

// Receiving contact must follow geometry rather than wait for the whole flight to finish.
test('receiving reaction begins earlier for a nearby pill and cancels with the droplet',()=>{
  const delays:number[]=[];
  for(const gap of [8,48,120]){
    const f=fixture();
    // Position the same pill at increasing distances above the composer.
    f.pill.getBoundingClientRect=()=>({left:60,top:128-gap,right:120,bottom:160-gap,width:60,height:32} as DOMRect);
    const motion=queueLiquid(f.composer,f.pill);
    const receiving=f.records.find(record=>record.node===f.pill)!;
    const hit=Math.max(0,(gap-4)/(gap+17)),t=1-Math.cbrt(1-hit);
    const contactTime=1000*(3*(1-t)**2*t*.22+3*(1-t)*t**2*.36+t**3);
    assert.ok(Math.abs(Number(receiving.options.delay)-contactTime-100)<.01,'the response starts 100ms after geometric contact on the selected curve');
    delays.push(Number(receiving.options.delay));
    motion.cancel();
    assert.ok(f.records.every(record=>record.cancelled),'the owned pill response and droplet both cancel');
    assert.equal(f.pill.getAttribute('style'),null,'the reaction does not leave a transform origin or scale on the pill');
    f.dom.window.close();
  }
  assert.ok(delays[0]<delays[1]&&delays[1]<delays[2]);
  assert.ok(delays.every(delay=>delay>=100&&delay<1000));
});

// Very close surfaces must keep upward travel instead of overshooting and returning.
test('a narrow gap keeps one upward path and an outside pill keeps the origin on the composer',()=>{
  const f=fixture();
  f.pill.getBoundingClientRect=()=>({left:60,top:120,right:120,bottom:152,width:60,height:32} as DOMRect);
  const short=queueLiquid(f.composer,f.pill);
  assert.equal(f.records[0].frames[1].transform,'translate(0px,-25px)');
  short.cancel();
  f.pill.getBoundingClientRect=()=>({left:-40,top:80,right:0,bottom:112,width:40,height:32} as DOMRect);
  const outside=queueLiquid(f.composer,f.pill);
  assert.equal(f.document.querySelector('[data-liquid-edge="source"]')?.getAttribute('data-edge-x'),'64');
  outside.cancel();f.dom.window.close();
});

test('scrolling cancels a flight instead of leaving a fixed-position ghost',async()=>{
  const f=fixture(),motion=queueLiquid(f.composer,f.pill);
  f.document.dispatchEvent(new f.dom.window.Event('scroll'));await motion.finished;
  assert.equal(f.document.querySelector('[data-queue-liquid]'),null);
  f.dom.window.close();
});

test('reduced motion, detached targets and missing WAAPI create no visual work',()=>{
  for(const mode of ['reduced','detached','unsupported']){
    const f=fixture(mode==='reduced');
    if(mode==='detached')f.pill.remove();
    if(mode==='unsupported')Object.defineProperty(f.dom.window.Element.prototype,'animate',{value:undefined});
    queueLiquid(f.composer,f.pill);
    assert.equal(f.records.length,0);assert.equal(f.document.querySelector('[data-queue-liquid]'),null);
    assert.equal(f.pill.textContent,'3');f.dom.window.close();
  }
});
