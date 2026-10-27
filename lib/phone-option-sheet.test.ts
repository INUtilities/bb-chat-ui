import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { injectPhoneSheet, phoneDrawerCss, PHONE_DRAWERS, PHONE_SHEET_STYLE_ID, SHEET } from "./phone-sheet.ts";

function fixture() {
  const dom = new JSDOM(`<html data-bb-chat-ui-root-device="phone"><head></head><body>
    <div data-thread-window><div data-bb-chat-ui-info-stack>
      <section id="goal" data-bb-chat-ui-info-unit data-bb-chat-ui-info-open="goal"><button data-bb-chat-ui-info-dismiss>Close</button><p>Goal body</p></section>
      <section id="all" data-bb-chat-ui-info-menu><button>Goal</button></section>
    </div><section id="quote" data-bb-chat-ui-quote-preview-card><p>Quoted text</p></section></div>
    <section id="plus" data-persistent-drawer-content data-bb-plugin="bb--composer" data-state="open"><div aria-label="Prompt actions"><button role="menuitem">Attach file</button></div></section>
    <section id="model" data-persistent-drawer-content data-bb-plugin="bb--composer" data-bb-chat-ui-model-menu data-state="open"><input placeholder="Search models"><button>Model A</button></section>
    <section id="send" data-persistent-drawer-content data-bb-plugin="bb--composer" data-state="open"><div aria-label="Send options"><button role="menuitem">Queue</button></div></section>
    <section id="merge" data-persistent-drawer-content data-bb-chat-ui-pr-menu data-state="open"><button>Squash merge</button></section>
    <section id="other" data-persistent-drawer-content data-bb-plugin="other-plugin" data-state="open"><button>Other plugin</button></section>
  </body></html>`, { pretendToBeVisual:true });
  const d = dom.window.document;
  return { dom, d, w:dom.window };
}

const contextClass='@container/'+'context-window',shadowClass='shadow'+'-md',trackClass='bg'+'-border',fillClass='bg'+'-current';

const flush = async (w:Window) => new Promise(resolve => w.requestAnimationFrame(resolve));

test("phone option sheets leave information pills, the catalog and quote previews in their native popovers", async () => {
  const f = fixture();
  const cards = ["goal", "all", "quote"].map(id => f.d.getElementById(id)!);
  const before = cards.map(card => card.outerHTML);
  const stop = injectPhoneSheet(f.d);
  try {
    await flush(f.w);
    for (let i=0;i<cards.length;i++) {
      assert.equal(cards[i].hasAttribute(SHEET), false, cards[i].id);
      assert.equal(cards[i].outerHTML, before[i], `${cards[i].id} retains its layout and controls`);
    }
    assert.doesNotMatch(f.d.getElementById(PHONE_SHEET_STYLE_ID)!.textContent!, /\[data-bb-chat-ui-sheet\]/,
      "the runtime installs only native option drawer styling");
    const sheet=f.d.getElementById(PHONE_SHEET_STYLE_ID) as HTMLStyleElement;
    for(const id of ['plus','model','send','merge']){
      const drawer=f.d.getElementById(id)!;
      const values:Record<string,string>={};
      for(const rule of Array.from(sheet.sheet!.cssRules)){
        const css=rule as CSSStyleRule;
        if(!css.selectorText||!drawer.matches(css.selectorText))continue;
        for(const key of ['--bb-chat-ui-card-menu-pad','--bb-chat-ui-card-menu-radius']){
          const value=css.style.getPropertyValue(key);if(value)values[key]=value;
        }
      }
      assert.equal(values['--bb-chat-ui-card-menu-pad'],'4px',id+' uses desktop option menu inset');
      assert.equal(values['--bb-chat-ui-card-menu-radius'],'10px',id+' uses desktop option row corners');
    }
  } finally { stop(); f.dom.window.close(); }
});

test("sheet styling covers composer option drawers and PR methods while excluding other plugin drawers", () => {
  const f = fixture();
  try {
    assert.deepEqual(Array.from(f.d.querySelectorAll(PHONE_DRAWERS)).map(el=>el.id), ["plus", "model", "send", "merge"]);
  } finally { f.dom.window.close(); }
});

test("phone model provider tabs are transparent on the drawer's single frost face", () => {
  const f = fixture();
  try {
    const tabs = f.d.createElement("div");
    tabs.className = "bg-background";
    const body = f.d.createElement("div");
    body.append(tabs);
    f.d.getElementById("model")!.append(body);
    const style = f.d.createElement("style");
    style.textContent = phoneDrawerCss();
    f.d.head.append(style);
    const rules = Array.from(style.sheet!.cssRules) as CSSStyleRule[];
    const rule = rules.find(rule => rule.selectorText && tabs.matches(rule.selectorText) && rule.style.background === "transparent");
    assert.ok(rule, "provider tabs must reveal the drawer face");
    assert.notEqual(rule.style.backdropFilter, "blur(24px) saturate(1.5)");
  } finally { f.dom.window.close(); }
});

test("option drawer handles pulse once per press with phone-only 400ms throttling", async () => {
  const f = fixture();
  const pulses: unknown[] = [];
  let now = 1000;
  Object.defineProperty(f.w.performance, "now", { value: () => now });
  (f.w as any).bb = { native: { capabilities: ["haptic"], post: (message: unknown) => pulses.push(message) } };
  const handles = ["plus", "model", "send", "merge", "other"].map(id => {
    const handle = f.d.createElement("div");
    handle.setAttribute("data-persistent-drawer-handle", "");
    f.d.getElementById(id)!.prepend(handle);
    return handle;
  });
  const stop = injectPhoneSheet(f.d);
  const press = (el: Element) => el.dispatchEvent(new f.w.MouseEvent("pointerdown", { bubbles: true, button: 0 }));
  try {
    await flush(f.w);
    for (const handle of handles.slice(0, 4)) { press(handle); now += 400; }
    assert.deepEqual(pulses, Array(4).fill({ type: "haptic", kind: "impact-light" }));
    press(handles[0]); press(handles[0]);
    assert.equal(pulses.length, 5);
    now += 400; press(handles[4]);
    f.d.documentElement.setAttribute("data-bb-chat-ui-root-device", "desktop");
    press(handles[0]);
    assert.equal(pulses.length, 5);
    stop();
    f.d.documentElement.setAttribute("data-bb-chat-ui-root-device", "phone");
    now += 400; press(handles[0]);
    assert.equal(pulses.length, 5);
  } finally { stop(); f.dom.window.close(); }
});

test("device changes and disposal restore option drawer styling without touching native actions", async () => {
  const f = fixture();
  const before = f.d.body.innerHTML;
  let clicked = 0;
  f.d.querySelector("#plus button")!.addEventListener("click", () => clicked++);
  const stop = injectPhoneSheet(f.d);
  try {
    await flush(f.w);
    assert.ok(f.d.getElementById(PHONE_SHEET_STYLE_ID));
    (f.d.querySelector("#plus button") as HTMLElement).click();
    assert.equal(clicked, 1);
    assert.equal(f.d.body.innerHTML, before);
    f.d.documentElement.setAttribute("data-bb-chat-ui-root-device", "desktop");
    await flush(f.w);
    assert.equal(f.d.getElementById(PHONE_SHEET_STYLE_ID), null);
    f.d.documentElement.setAttribute("data-bb-chat-ui-root-device", "phone");
    await flush(f.w);
    assert.equal(f.d.querySelectorAll(`#${PHONE_SHEET_STYLE_ID}`).length, 1);
    stop();
    assert.equal(f.d.getElementById(PHONE_SHEET_STYLE_ID), null);
    assert.equal(f.d.body.innerHTML, before);
  } finally { stop(); f.dom.window.close(); }
});

test('native handoff handle stays transparent when the host adds a solid full-width header',()=>{
 const f=fixture();try{
  const card=f.d.getElementById('model')!,handle=f.d.createElement('div');
  handle.setAttribute('data-persistent-drawer-handle','');handle.className='bg-background';card.prepend(handle);
  const style=f.d.createElement('style');style.textContent=phoneDrawerCss();f.d.head.append(style);
  const matches=(Array.from(style.sheet!.cssRules)as CSSStyleRule[]).filter(r=>r.selectorText&&handle.matches(r.selectorText));
  assert.ok(matches.some(r=>r.style.background==='transparent'&&r.style.getPropertyPriority('background')==='important'),'native handoff handle cannot add another opaque surface');
 }finally{f.dom.window.close();}
});


test("permissions and context native drawers share phone geometry and handle haptics without matching foreign dialogs",async()=>{
 const f=fixture(),pulses:unknown[]=[];let now=1000;
 Object.defineProperty(f.w.performance,'now',{value:()=>now});
 (f.w as any).bb={native:{capabilities:['haptic'],post:(message:unknown)=>pulses.push(message)}};
 const footer=f.d.createElement('div');footer.setAttribute('data-scroll-footer','');footer.innerHTML='<button aria-label="Permission mode">Approve for me</button><button aria-label="Context window 23% used">23%</button>';f.d.body.append(footer);
 const nodes=['Permission mode','Context window','Other'].map(title=>{const n=f.d.createElement('section');n.setAttribute('data-persistent-drawer-content','');n.innerHTML=`<div data-persistent-drawer-handle><div></div></div><h2>${title}</h2><div><button>Native content</button></div>`;f.d.body.append(n);return n});
 const stop=injectPhoneSheet(f.d);try{
  await flush(f.w);
  for(const n of nodes.slice(0,2)){
   assert.ok(n.matches(PHONE_DRAWERS),'footer option drawer must be included');
   const rules=Array.from((f.d.getElementById(PHONE_SHEET_STYLE_ID)as HTMLStyleElement).sheet!.cssRules)as CSSStyleRule[];
   assert.ok(rules.some(r=>r.selectorText&&n.matches(r.selectorText)&&r.style.getPropertyValue('border-radius')==='var(--bb-chat-ui-sheet-radius)'));
   n.firstElementChild!.dispatchEvent(new f.w.MouseEvent('pointerdown',{bubbles:true,button:0}));now+=400;
  }
  assert.equal(pulses.length,2);assert.ok(!nodes[2].matches(PHONE_DRAWERS));
  f.d.documentElement.setAttribute('data-bb-chat-ui-root-device','desktop');await flush(f.w);
  assert.ok(!nodes[0].matches(PHONE_DRAWERS));assert.equal(f.d.getElementById(PHONE_SHEET_STYLE_ID),null);
  f.d.documentElement.setAttribute('data-bb-chat-ui-root-device','phone');await flush(f.w);
  const replacement=nodes[1].cloneNode(true)as HTMLElement;replacement.removeAttribute('data-bb-chat-ui-option-menu');nodes[1].replaceWith(replacement);await flush(f.w);await flush(f.w);
  assert.ok(replacement.matches(PHONE_DRAWERS),'React replacement is recognized');stop();assert.ok(!replacement.matches(PHONE_DRAWERS));
 }finally{stop();f.dom.window.close()}
});

test('phone context is recognized from its native content when keyboard collapse has removed the footer trigger',async()=>{
 const f=fixture();const drawer=f.d.createElement('section');drawer.setAttribute('data-persistent-drawer-content','');drawer.innerHTML=`<div data-persistent-drawer-handle><div></div></div><h2>Context window</h2><div><div class="${contextClass} bg-popover ${shadowClass}"><div>Context window</div><div class="${trackClass}"><div class="${fillClass}"></div></div></div></div>`;f.d.body.append(drawer);
 const foreign=drawer.cloneNode(true)as HTMLElement;foreign.setAttribute('data-bb-plugin','other-plugin');f.d.body.append(foreign);
 const stop=injectPhoneSheet(f.d);try{await flush(f.w);assert.ok(drawer.matches(PHONE_DRAWERS),'native context body must suffice without a live trigger');assert.ok(!foreign.matches(PHONE_DRAWERS));const card=drawer.querySelector(`[class~="${contextClass}"]`)!;const rules=Array.from((f.d.getElementById(PHONE_SHEET_STYLE_ID)as HTMLStyleElement).sheet!.cssRules)as CSSStyleRule[];assert.ok(rules.some(r=>r.selectorText&&card.matches(r.selectorText)&&r.style.background==='transparent'&&r.style.getPropertyPriority('background')==='important'),'context card cannot obscure the outer frost at wider phone viewports');assert.ok(rules.some(r=>r.selectorText&&card.matches(r.selectorText)&&r.style.getPropertyValue('backdrop-filter')==='none'),'only the outer drawer owns frost');assert.ok(!rules.some(r=>r.selectorText&&drawer.querySelector(`.${trackClass}`)!.matches(r.selectorText)&&r.style.background==='transparent'),'the gauge keeps its track');}finally{stop();f.dom.window.close()}
});

test('Claude Estimated context is enhanced during keyboard dismissal just like the Context window drawer',async()=>{
 const f=fixture(),vv=new f.w.EventTarget();Object.defineProperty(f.w,'visualViewport',{value:vv});const stop=injectPhoneSheet(f.d);try{await flush(f.w);const drawer=f.d.createElement('section');drawer.setAttribute('data-persistent-drawer-content','');drawer.setAttribute('data-state','open');drawer.innerHTML=`<div data-persistent-drawer-handle><div></div></div><h2>Estimated context</h2><div><div class="${contextClass} bg-popover"><span>48% used</span><button>Show details</button></div></div>`;f.d.body.append(drawer);vv.dispatchEvent(new f.w.Event('resize'));await flush(f.w);await flush(f.w);assert.ok(drawer.matches(PHONE_DRAWERS),'Estimated context title is a native context variant, even without the footer trigger');const style=f.d.getElementById(PHONE_SHEET_STYLE_ID)as HTMLStyleElement;const rules=Array.from(style.sheet!.cssRules)as CSSStyleRule[];assert.ok(rules.some(r=>r.selectorText&&drawer.matches(r.selectorText)&&r.style.getPropertyValue('border-radius')==='var(--bb-chat-ui-sheet-radius)'));let clicked=0;drawer.querySelector('button')!.addEventListener('click',()=>clicked++);drawer.querySelector('button')!.click();assert.equal(clicked,1,'native detail disclosure survives')}finally{stop();f.dom.window.close()}
});
