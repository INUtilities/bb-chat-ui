import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { injectTranscriptComponents, transcriptComponentsCss } from "./transcript-components.ts";

const code = `<div class="bg-surface-recessed rounded-md"><div data-clipboard-ignore><span>js</span><div><button aria-label="Copy code">Copy</button><button aria-label="Wrap lines" aria-pressed="false">Wrap</button></div></div><pre class="bb-code-highlight"><code>const value = 1;</code></pre></div>`;
function fixture() {
  return new JSDOM(`<html><head><style>
  div.bg-surface-recessed.rounded-md { border-radius:6px; overflow:hidden; }
  div[data-clipboard-ignore] { padding:6px 6px 0 12px; }
  pre.bb-code-highlight { padding:4px 12px 12px; overflow-x:auto; }
  pre.bb-code-highlight code { font-size:12px; }
  button { width:20px; height:20px; border-radius:0; }
  blockquote { padding:6px 14px 6px 12px; border-radius:9999px; }
  </style></head><body>
  <section data-timeline-row-id="thread:assistant:item"><div data-markdown-preview>${code}<blockquote>Assistant quote</blockquote></div></section>
  <section data-timeline-row-id="thread:user-seed:1"><div data-markdown-preview>${code}<blockquote>User quote</blockquote></div></section>
  <div data-markdown-preview id="outside">${code}</div></body></html>`);
}

test("code block 2 styles only assistant output and preserves native controls, code size and overflow", () => {
  const dom=fixture(),d=dom.window.document,style=(selector:string)=>dom.window.getComputedStyle(d.querySelector(selector)!);
  const agent='[data-timeline-row-id*="assistant"]',user='[data-timeline-row-id*="user-seed"]';
  const controlBefore=style(`${agent} button`).cssText;
  const stop=injectTranscriptComponents(d);
  try {
    assert.equal(style(`${agent} div.rounded-md`).borderRadius,"12px");
    assert.equal(style(`${agent} div.rounded-md`).overflow,"hidden");
    assert.equal(style(`${agent} div[data-clipboard-ignore]`).minHeight,"32px");
    assert.equal(style(`${agent} div[data-clipboard-ignore]`).padding,"0px 6px 0px 12px");
    assert.equal(style(`${agent} pre`).padding,"12px 16px 14px");
    assert.equal(style(`${agent} pre`).overflowX,"auto");
    assert.equal(style(`${agent} pre code`).fontSize,"12px");
    assert.equal(style(`${agent} button`).cssText,controlBefore);
    assert.equal(style(`${user} div.rounded-md`).borderRadius,"6px");
    assert.equal(style(`${user} pre`).padding,"4px 12px 12px");
    assert.equal(style(`${user} blockquote`).borderRadius,"9999px");
    assert.equal(style(`${agent} blockquote`).borderRadius,"9999px");
    assert.equal(style('#outside div.rounded-md').borderRadius,"6px");
    assert.equal(d.querySelectorAll('#bb-chat-ui-transcript-components').length,1);
  } finally { stop(); }
  assert.equal(d.querySelector('#bb-chat-ui-transcript-components'),null);
  assert.equal(style(`${agent} div.rounded-md`).borderRadius,"6px");
  dom.window.close();
});

test("transcript CSS stays assistant-scoped with specific subjects, tokens, and no expensive selectors or effects", () => {
  assert.ok(transcriptComponentsCss.trim());
  assert.doesNotMatch(transcriptComponentsCss,/:has\(|backdrop-filter|#[\da-f]{3,8}\b|\b(?:oklch|rgba?|hsla?)\(/i);
  assert.doesNotMatch(transcriptComponentsCss,/data-bb-chat-ui-transcript|button\[|blockquote/);
  const dom=new JSDOM(''),sheet=new dom.window.CSSStyleSheet();sheet.replaceSync(transcriptComponentsCss);
  const walk=(rules:CSSRuleList)=>{for(const rule of Array.from(rules)){
    const css=rule as CSSStyleRule & CSSGroupingRule;
    if(css.cssRules)walk(css.cssRules);
    if(!css.selectorText)continue;
    for(const selector of css.selectorText.split(',')){
      assert.ok(selector.trim().startsWith('[data-timeline-row-id*=":assistant:"] [data-markdown-preview] '),selector);
      const subject=selector.trim().split(/\s+>\s+|\s+/).at(-1)!;
      assert.match(subject,/^(div|span|pre|table|thead|th|td|\[data-clipboard-ignore\])/);
    }
  }};
  walk(sheet.cssRules);dom.window.close();
});

test("transcript styling is registered as a content script with its cleanup", () => {
  const app=readFileSync(new URL('../app.tsx',import.meta.url),'utf8');
  assert.match(app,/id:\s*"transcript-components"[\s\S]*?mount\(\)\s*\{\s*return injectTranscriptComponents\(document\);/);
});

test("table 1 keeps native semantics, alignment and scroll wrapper while only assistant cells change", () => {
  const markup=`<div class="scroll"><table><thead><tr><th style="text-align:right">Name</th><th>Value</th></tr></thead><tbody><tr><td>A</td><td>1</td></tr><tr><td>B</td><td>2</td></tr></tbody></table></div>`;
  const dom=new JSDOM(`<html><head><style>.scroll{max-width:100%;overflow-x:auto}table{border-collapse:collapse}th,td{padding:4px 8px;border:1px solid currentColor;font-size:13px}thead{background-color:var(--surface-recessed)}</style></head><body><section data-timeline-row-id="thread:assistant:item"><div data-markdown-preview>${markup}</div></section><section data-timeline-row-id="thread:user-seed:1"><div data-markdown-preview>${markup}</div></section></body></html>`);
  const d=dom.window.document,agent='[data-timeline-row-id*="assistant"]',user='[data-timeline-row-id*="user-seed"]',style=(s:string)=>dom.window.getComputedStyle(d.querySelector(s)!);
  const scrollBefore=d.querySelector(`${agent} .scroll`)!.outerHTML,stop=injectTranscriptComponents(d);
  try {
    assert.equal(style(`${agent} table`).borderCollapse,"separate");
    assert.equal(style(`${agent} table`).borderSpacing,"0px");
    assert.equal(style(`${agent} table`).borderRadius,"10px");
    assert.equal(style(`${agent} th`).padding,"5px 12px");
    assert.equal(style(`${agent} th`).fontSize,"12px");
    assert.equal(style(`${agent} th`).lineHeight,"18px");
    assert.equal(style(`${agent} th`).fontWeight,"500");
    assert.equal(style(`${agent} th`).textAlign,"right");
    assert.equal(style(`${agent} th`).whiteSpace,"nowrap");
    assert.equal(style(`${agent} td`).wordBreak,"keep-all");
    assert.equal(style(`${agent} td`).fontSize,"13px");
    assert.equal(style(`${agent} td`).borderRightWidth,"0px");
    assert.equal(style(`${agent} tbody tr:last-child td`).borderBottomWidth,"0px");
    assert.equal(style(`${agent} thead`).backgroundColor,"rgba(0, 0, 0, 0)");
    assert.equal(style(`${agent} .scroll`).overflowX,"auto");
    assert.equal(d.querySelector(`${agent} .scroll`)!.outerHTML,scrollBefore);
    assert.equal(style(`${user} table`).borderCollapse,"collapse");
    assert.equal(style(`${user} th`).padding,"4px 8px");
    assert.equal(style(`${user} th`).fontSize,"13px");
    const sheet=new dom.window.CSSStyleSheet();sheet.replaceSync(transcriptComponentsCss);
    const narrow=Array.from(sheet.cssRules).find(rule=>rule.cssText.startsWith('@container page')) as CSSGroupingRule;
    assert.ok(narrow,'actual BB page container controls density');
    assert.match(narrow.cssText,/@container page \(width < 36rem\)/);
    assert.match(narrow.cssText,/padding-inline:\s*8px/);
  } finally {stop();}
  assert.equal(style(`${agent} table`).borderCollapse,"collapse");
  dom.window.close();
});
