import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import { injectUserAttachments } from "./user-attachments.ts";

function fixture() {
  const dom = new JSDOM(`<body><aside></aside><div data-message-column><div class="group/message ml-auto"><div class="flex"><div class="rounded-xl"><div class="break-words">Message</div><div id="meta"></div><span id="clamp"></span><div class="mt-2 space-y-2"><div class="flex"><a>file.txt</a></div></div></div></div></div></div></body>`);
  const document = dom.window.document;
  const bubble = document.querySelector<HTMLElement>('.rounded-xl')!;
  return {dom,document,bubble,tick:()=>new Promise<void>(r=>setImmediate(r))};
}

test("attachment markers follow metadata, clamp and body class changes", async () => {
  const f=fixture(),stop=injectUserAttachments(f.document);
  try {
    assert.ok(f.bubble.hasAttribute('data-bb-chat-ui-attach-bubble'));
    const meta=f.document.querySelector('#meta')!,clamp=f.document.querySelector('#clamp')!;
    meta.className='mt-1';clamp.className='line-clamp-1';await f.tick();
    assert.ok(f.bubble.hasAttribute('data-bb-chat-ui-attach-meta'));
    assert.ok(f.bubble.hasAttribute('data-bb-chat-ui-attach-clamp'));
    assert.equal(f.dom.window.getComputedStyle(f.bubble.querySelector('.break-words')!).paddingBottom,'28px');
    meta.className='';clamp.className='';f.bubble.querySelector('.break-words')!.className='';await f.tick();
    assert.equal(f.bubble.hasAttribute('data-bb-chat-ui-attach-meta'),false);
    assert.equal(f.bubble.hasAttribute('data-bb-chat-ui-attach-clamp'),false);
    assert.ok(f.bubble.hasAttribute('data-bb-chat-ui-attach-no-body'));
  } finally {stop();f.dom.window.close();}
});

test("attachment image and file transitions clean up obsolete markers", async () => {
  const f=fixture(),stop=injectUserAttachments(f.document);
  try {
    const row=f.bubble.querySelector('.mt-2 > .flex')!;
    assert.ok(row.hasAttribute('data-bb-chat-ui-file-row'));
    const img=f.document.createElement('img');row.append(img);await f.tick();
    assert.equal(row.hasAttribute('data-bb-chat-ui-file-row'),false);
    img.remove();await f.tick();assert.ok(row.hasAttribute('data-bb-chat-ui-file-row'));
    row.className='';await f.tick();assert.equal(row.hasAttribute('data-bb-chat-ui-file-row'),false);
    row.className='flex';await f.tick();assert.ok(row.hasAttribute('data-bb-chat-ui-file-row'));
    f.bubble.querySelector('.mt-2')!.className='';await f.tick();
    assert.equal(f.bubble.hasAttribute('data-bb-chat-ui-attach-bubble'),false);
    assert.equal(row.hasAttribute('data-bb-chat-ui-file-row'),false);
  } finally {stop();f.dom.window.close();}
});

test("attachment decoration stays local and releases its observer", async () => {
  const f=fixture(),stop=injectUserAttachments(f.document);
  try {
    let scans=0;const query=f.document.querySelectorAll.bind(f.document);
    f.document.querySelectorAll=((s:string)=>{scans++;return query(s);}) as typeof query;
    f.document.querySelector('aside')!.innerHTML='<div class="hovered">Sidebar</div>';
    await f.tick();assert.equal(scans,0);
    f.bubble.className='';await f.tick();
    assert.equal(f.bubble.hasAttribute('data-bb-chat-ui-attach-bubble'),false);
    f.bubble.className='rounded-xl';await f.tick();
    assert.ok(f.bubble.hasAttribute('data-bb-chat-ui-attach-bubble'));
    stop();assert.equal(f.document.querySelector('[data-bb-chat-ui-attach-bubble], [data-bb-chat-ui-file-row]'),null);
    f.document.querySelector('#meta')!.className='mt-1';await f.tick();
    assert.equal(f.bubble.hasAttribute('data-bb-chat-ui-attach-meta'),false);
  } finally {stop();f.dom.window.close();}
});
