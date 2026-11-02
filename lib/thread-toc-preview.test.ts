import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { paintTocReply, clearTocReplies, TOC_REPLY_MARK } from "./thread-toc-preview.ts";

interface Fiber {
  key?: string;
  memoizedProps?: unknown;
  return?: Fiber;
  alternate?: Fiber;
  child?: Fiber;
  sibling?: Fiber;
  stateNode?: { current: Fiber };
}

function fixture(sharedChild = false) {
  const dom = new JSDOM('<div data-thread-toc><ul><li><button><span>Question</span></button></li></ul></div>');
  const doc = dom.window.document, root = doc.querySelector<HTMLElement>("[data-thread-toc]")!, item = root.querySelector<HTMLElement>("li")!;
  const previous = Object.getOwnPropertyDescriptor(globalThis, "HTMLElement");
  Object.defineProperty(globalThis, "HTMLElement", { configurable: true, value: dom.window.HTMLElement });
  const user = { kind: "conversation", id: "u1", threadId: "current", role: "user", text: "Question" };
  const rows = (text: string) => [user, { ...user, id: "a1", role: "assistant", text }];
  const props = {}, host: Fiber = { memoizedProps: props }, alternateHost: Fiber = sharedChild ? host : { memoizedProps: props, alternate: host };
  if (!sharedChild) host.alternate = alternateHost;
  const owner: Fiber = { memoizedProps: { threadId: "current", timelineRows: rows("old reply") }, child: host };
  const alternateOwner: Fiber = { memoizedProps: { threadId: "current", timelineRows: rows("current reply") }, child: alternateHost, alternate: owner };
  owner.alternate = alternateOwner;
  const tree: Fiber = { child: owner }, alternateTree: Fiber = { child: alternateOwner, alternate: tree };
  tree.alternate = alternateTree;
  const mounted = { current: tree }; tree.stateNode = alternateTree.stateNode = mounted;
  owner.return = tree; alternateOwner.return = alternateTree;
  host.return = owner; if (!sharedChild) alternateHost.return = alternateOwner;
  const itemProps = {};
  Object.assign(root, { __reactFiber$test: host, __reactProps$test: props });
  Object.assign(item, { __reactFiber$test: { key: "u1", memoizedProps: itemProps }, __reactProps$test: itemProps });
  return { root, item, owner, alternateOwner, tree, alternateTree, mounted,
    read() { paintTocReply(root, item); return root.querySelector(`[${TOC_REPLY_MARK}]`)?.textContent; },
    cleanup() { clearTocReplies(root); dom.window.close(); if (previous) Object.defineProperty(globalThis, "HTMLElement", previous); else Reflect.deleteProperty(globalThis, "HTMLElement"); } };
}

test("TOC replies use the committed tree when both host fibers share DOM props", () => {
  const f = fixture();
  try {
    assert.equal(f.read(), "old reply");
    f.mounted.current = f.alternateTree;
    assert.equal(f.read(), "current reply");
    f.mounted.current = f.tree;
    assert.equal(f.read(), "old reply");
  } finally { f.cleanup(); }
});

test("a shared host child reads its current owner instead of the stale return pointer", () => {
  const f = fixture(true);
  try {
    f.mounted.current = f.alternateTree;
    assert.equal(f.read(), "current reply");
    f.alternateOwner.memoizedProps = { threadId: "current", timelineRows: [
      { kind: "conversation", id: "u1", threadId: "current", role: "user" },
      { kind: "conversation", id: "a1", threadId: "current", role: "assistant", text: "new reply" },
    ] };
    assert.equal(f.read(), "new reply");
  } finally { f.cleanup(); }
});

test("unmounted or inconsistent trees never fall back to an old reply", () => {
  const f = fixture();
  try {
    f.mounted.current = {};
    assert.equal(f.read(), "응답 미리보기를 불러오지 못했습니다.");
    f.mounted.current = f.tree;
    f.tree.child = {};
    assert.equal(f.read(), "응답 미리보기를 불러오지 못했습니다.");
  } finally { f.cleanup(); }
});

test("current reply data cannot cross thread, user or unloaded-turn boundaries", () => {
  const f = fixture(true);
  try {
    f.mounted.current = f.alternateTree;
    for (const row of [
      { kind: "conversation", id: "a1", threadId: "other", role: "assistant", text: "wrong thread" },
      { kind: "turn", id: "unloaded" },
    ]) {
      f.alternateOwner.memoizedProps = { threadId: "current", timelineRows: [
        { kind: "conversation", id: "u1", threadId: "current", role: "user" }, row,
        { kind: "conversation", id: "a2", threadId: "current", role: "assistant", text: "later reply" },
      ] };
      assert.equal(f.read(), "응답 미리보기를 불러오지 못했습니다.");
    }
    f.alternateOwner.memoizedProps = { threadId: "current", timelineRows: [
      { kind: "conversation", id: "u1", threadId: "current", role: "user" },
      { kind: "conversation", id: "u2", threadId: "current", role: "user" },
      { kind: "conversation", id: "a2", threadId: "current", role: "assistant", text: "another turn" },
    ] };
    assert.equal(f.read(), "표시할 응답이 없습니다.");
  } finally { f.cleanup(); }
});
