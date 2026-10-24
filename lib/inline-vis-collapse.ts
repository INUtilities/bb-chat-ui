import { acceptJumpPulse, postHaptic, readHapticBridge } from "./send-haptic.ts";

const LIST = '[data-timeline-row-list="top-level"]';
const FRAME = '[data-timeline-row-id*=":assistant:"] [data-markdown-preview] div[data-inline-vis-frame]';
const TOGGLE = 'data-bb-chat-ui-inline-vis-toggle';
const COLLAPSED = 'data-bb-chat-ui-inline-vis-collapsed';
const STORAGE = 'bb-chat-ui:inline-vis:collapsed:';

function previewKey(frame: Element): string | null {
  const row = frame.closest('[data-timeline-row-id]');
  if (!row) return null;
  const link = frame.querySelector('a[aria-label^="Open "]');
  const iframe = frame.querySelector('iframe');
  const source = link?.getAttribute('href') || iframe?.getAttribute('src');
  if (source) return STORAGE + JSON.stringify([row.getAttribute('data-timeline-row-id'), source]);
  if (!iframe) return null;
  // Inline fences have the same title. Their element path is stable across a native row remount;
  // srcdoc includes theme/font payloads and must not be hashed or used as a session key.
  const path: number[] = [];
  for (let node: Element | null = frame; node && node !== row; node = node.parentElement) {
    let index = 0;
    for (let sibling = node.previousElementSibling; sibling; sibling = sibling.previousElementSibling) index++;
    path.push(index);
  }
  return STORAGE + JSON.stringify([row.getAttribute('data-timeline-row-id'), iframe.getAttribute('title'), path]);
}

/** Observe additions inside row lists; only the mount ancestor chain watches list replacement. */
export function attachInlineVisCollapse(document: Document): () => void {
  const view = document.defaultView;
  if (!view || !document.body) return () => {};
  const lists = new Map<Element, () => void>();
  const memory = new Map<string, boolean>();
  let storage: Storage | undefined;
  try { storage = view.sessionStorage; } catch { /* Session storage can be unavailable in embedded clients. */ }
  const read = (key: string): boolean => {
    if (memory.has(key)) return memory.get(key)!;
    let collapsed = false;
    try { collapsed = storage?.getItem(key) === '1'; } catch { /* Use memory when browser storage is denied. */ }
    memory.set(key, collapsed);
    return collapsed;
  };
  const save = (key: string, collapsed: boolean) => {
    memory.set(key, collapsed);
    try {
      if (collapsed) { if (storage?.getItem(key) !== '1') storage?.setItem(key, '1'); }
      else if (storage?.getItem(key) !== null) storage?.removeItem(key);
    } catch { /* Keep the current generation usable if browser storage is denied. */ }
  };
  const element = (node: Node): node is Element => node.nodeType === 1;

  function attachList(list: Element) {
    if (lists.has(list)) return;
    const bindings = new Map<Element, { button: HTMLButtonElement; stop: () => void }>();
    function bind(frame: Element) {
      if (!frame.matches(FRAME)) return;
      const actions = Array.from(frame.children).find(e => e.tagName === 'DIV');
      if (!actions) return;
      const previous = bindings.get(frame);
      if (previous) {
        if (previous.button.parentElement !== actions) actions.append(previous.button);
        return;
      }
      const key = previewKey(frame);
      if (!key) return;
      let collapsed = read(key);
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute(TOGGLE, '');
      const paint = () => {
        if (frame.hasAttribute(COLLAPSED) !== collapsed) {
          if (collapsed) frame.setAttribute(COLLAPSED, '');
          else frame.removeAttribute(COLLAPSED);
        }
        const expanded = String(!collapsed), label = collapsed ? '미리보기 펼치기' : '미리보기 접기';
        if (button.getAttribute('aria-expanded') !== expanded) button.setAttribute('aria-expanded', expanded);
        if (button.getAttribute('aria-label') !== label) button.setAttribute('aria-label', label);
        if (button.title !== label) button.title = label;
      };
      let lastHapticAt: number | null = null;
      const toggle = (event: Event) => {
        event.preventDefault(); event.stopPropagation();
        collapsed = !collapsed; save(key, collapsed); paint();
        const secondaryTouch = 'pointerType' in event && event.pointerType === 'touch'
          && 'isPrimary' in event && !event.isPrimary;
        if (!secondaryTouch && document.documentElement.getAttribute('data-bb-chat-ui-root-device') === 'phone') {
          const next = acceptJumpPulse(lastHapticAt, view!.performance.now());
          if (next !== null && postHaptic(readHapticBridge(view), 'impact-light')) lastHapticAt = next;
        }
      };
      button.addEventListener('click', toggle);
      paint(); actions.append(button);
      bindings.set(frame, { button, stop: () => {
        button.removeEventListener('click', toggle); button.remove();
        if (frame.hasAttribute(COLLAPSED)) frame.removeAttribute(COLLAPSED);
      } });
    }
    function added(node: Node) {
      if (!element(node)) return;
      const enclosing = node.closest('div[data-inline-vis-frame]');
      if (enclosing) bind(enclosing);
      if (node.matches(FRAME)) bind(node);
      for (const frame of Array.from(node.querySelectorAll(FRAME))) bind(frame);
    }
    const observer = new view!.MutationObserver(records => {
      for (const record of records) {
        for (const removed of Array.from(record.removedNodes)) {
          for (const [frame, binding] of bindings) if (!list.contains(frame) && (removed === frame || removed.contains(frame))) {
            binding.stop(); bindings.delete(frame);
          }
        }
        for (const node of Array.from(record.addedNodes)) added(node);
        // React may replace only the action host. Reuse our button and its listener/state.
        if (element(record.target)) {
          const frame = record.target.closest('div[data-inline-vis-frame]');
          if (frame && list.contains(frame)) bind(frame);
        }
      }
    });
    observer.observe(list, { childList: true, subtree: true });
    lists.set(list, () => {
      observer.disconnect();
      for (const binding of bindings.values()) binding.stop();
      bindings.clear();
    });
    added(list); // One initial scan; subsequent searches are restricted to added nodes.
  }

  function discover(node: Node) {
    if (!element(node)) return;
    if (node.matches(LIST)) attachList(node);
    else if (!node.closest(LIST)) for (const list of Array.from(node.querySelectorAll(LIST))) attachList(list);
  }
  function watchMounts() {
    mounts.disconnect();
    if (lists.size === 0) {
      // Before a thread exists, discover only newly mounted list subtrees, then stop this broad watch.
      mounts.observe(document.body, { childList: true, subtree: true });
      return;
    }
    const ancestors = new Set<Element>();
    for (const list of lists.keys()) for (let parent = list.parentElement; parent; parent = parent.parentElement) {
      ancestors.add(parent);
      if (parent === document.body) break;
    }
    for (const parent of ancestors) mounts.observe(parent, { childList: true });
  }
  const mounts = new view.MutationObserver(records => {
    let changed = false;
    for (const [list, stop] of lists) if (!list.isConnected) { stop(); lists.delete(list); changed = true; }
    const size = lists.size;
    for (const record of records) for (const node of Array.from(record.addedNodes)) discover(node);
    if (changed || size !== lists.size) watchMounts();
  });
  for (const list of Array.from(document.querySelectorAll(LIST))) attachList(list);
  watchMounts();
  return () => {
    mounts.disconnect();
    for (const stop of lists.values()) stop();
    lists.clear(); memory.clear();
  };
}
