import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import { injectQuotePill } from "./quote-pill.ts";
import { injectQuoteMentions } from "./quote-mention.ts";
import { injectMentionPills } from "./mention-pill.ts";

// The native transaction maps an unrelated old cursor through deletion. The
// control must explicitly choose a valid text position in the resulting doc.
for (const kind of ["legacy", "mention"] as const) {
  for (const action of ["click", "Backspace", "Delete"] as const) {
    test(`${kind} ${action} leaves the caret at the deleted quote, using the resulting document`, () => {
      const dom = new JSDOM(`<div data-promptbox-editor-scroll><div data-promptbox-editor-content><div class="ProseMirror" contenteditable="true"><p>앞</p>${kind === "legacy" ? '<blockquote><p>인용</p></blockquote>' : '<p><span class="prompt-mention-pill" data-prompt-mention data-prompt-mention-resource=\'{"kind":"plugin","itemId":"quote:test","icon":"Quote"}\'>인용</span></p>'}<p>뒤의 긴 글</p></div></div></div>`, { pretendToBeVisual:true });
      const { document } = dom.window;
      const names = ["Node", "Element", "HTMLElement", "SVGElement", "MutationObserver"] as const;
      const old = names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const);
      for (const name of names) Object.defineProperty(globalThis, name, { configurable:true, value:dom.window[name] });
      const editor = document.querySelector<HTMLElement>(".ProseMirror")!;
      const quote = document.querySelector<HTMLElement>(kind === "legacy" ? "blockquote" : "[data-prompt-mention]")!;
      const from = 3, to = kind === "legacy" ? 9 : 4;
      const beforeDoc = { resolve(pos:number) { return { pos, document:"before" }; }, nodeAt() { return { isAtom:true, isInline:true, attrs:{resource:{}}, nodeSize:to-from }; } };
      const afterDoc = { resolve(pos:number) { return { pos:pos + (kind === "legacy" ? 1 : 0), document:"after" }; }, content:{size:16} };
      class Selection {
        static near(point:{pos:number;document:string}, bias:number) {
          assert.equal(point.document, "after", "selection must use the transaction doc after deletion");
          assert.equal(bias, 1, "prefer the following text at a removed block boundary");
          return { from:point.pos, to:point.pos, empty:true };
        }
      }
      let chosen: {from:number;to:number;empty:boolean} | undefined;
      let dispatched = 0, focused = 0;
      const tr = { doc:beforeDoc as unknown, delete(a:number,b:number) { assert.deepEqual([a,b],[from,to]); this.doc=afterDoc; return this; }, setSelection(selection:typeof chosen) { chosen=selection; return this; }, scrollIntoView() { return this; } };
      const view = { state:{doc:beforeDoc, selection:{from:action === "click" ? 20 : from+1,to:action === "click" ? 20 : from+1,empty:true,constructor:Selection},tr}, posAtDOM:()=>from, nodeDOM:()=>quote, dispatch(value:unknown) { assert.equal(value,tr); dispatched++; }, focus() { focused++; } };
      Object.assign(editor,{editor:{view}});
      Object.assign(quote,{pmViewDesc:{posBefore:from,posAfter:to,view}});
      const stopQuote = injectQuotePill(document), stopMentions = injectQuoteMentions(document), stopPills = injectMentionPills(document);
      try {
        if (action === "click") document.querySelector<HTMLButtonElement>(kind === "legacy" ? "[data-bb-chat-ui-legacy-quote-remove]" : "[data-bb-chat-ui-mention-remove]")!.click();
        else {
          const range = document.createRange(); range.selectNodeContents(quote); range.collapse(true);
          document.getSelection()!.addRange(range);
          quote.dispatchEvent(new dom.window.KeyboardEvent("keydown",{key:action,bubbles:true,cancelable:true}));
        }
        assert.equal(dispatched,1,"deletion and selection must share one undoable native transaction");
        assert.deepEqual(chosen,{from:kind === "legacy" ? from+1 : from,to:kind === "legacy" ? from+1 : from,empty:true});
        assert.equal(focused,1);
      } finally {
        stopPills(); stopMentions(); stopQuote(); dom.window.close();
        for (const [name,descriptor] of old) { if(descriptor) Object.defineProperty(globalThis,name,descriptor); else Reflect.deleteProperty(globalThis,name); }
      }
    });
  }
}
