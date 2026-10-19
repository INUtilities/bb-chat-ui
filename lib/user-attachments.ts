import { PHONE_NARROW } from "./device-chrome.ts";

const STYLE_ID = "bb-chat-ui-user-attachments";
// Markers set by injectUserAttachments replace :has(): in transcript rows a :has() rule with a
// generic subject (.break-words, a, button, span) made every row insertion restyle the app.
const BUBBLE_MARK = "data-bb-chat-ui-attach-bubble";
const FILE_ROW = "data-bb-chat-ui-file-row";
const NO_BODY = "data-bb-chat-ui-attach-no-body";
const HAS_META = "data-bb-chat-ui-attach-meta";
const HAS_CLAMP = "data-bb-chat-ui-attach-clamp";
const BUBBLE_CANDIDATE = '[data-message-column] > .group\\/message.ml-auto > .flex > .rounded-xl';
const USER_BUBBLE = `${BUBBLE_CANDIDATE}[${BUBBLE_MARK}]`;
const FILE_CHIP = `${USER_BUBBLE} > .mt-2.space-y-2 > .flex[${FILE_ROW}] > :is(a, button, span)`;
// Lucide 0.300.0 icons/file.svg (ISC), black stroke for a CSS mask; see THIRD_PARTY_NOTICES.md.
const FILE_ICON = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>`,
);
const FILE_ICON_MASK = `url("data:image/svg+xml,${FILE_ICON}") center / contain no-repeat`;

export function userAttachmentsCss(): string {
  return `
${USER_BUBBLE} {
  display: contents;
}
${USER_BUBBLE} > .mt-2.space-y-2 {
  display: contents;
}
${USER_BUBBLE} > .mt-2.space-y-2 > .flex {
  order: -1;
  align-self: flex-end;
  max-width: 100%;
}
${USER_BUBBLE} > .mt-2.space-y-2 > .flex:last-child {
  margin-bottom: 8px;
}
${FILE_CHIP} {
  box-sizing: border-box;
  gap: 6px;
  min-height: 40px;
  padding: 6px 14px 6px 12px;
  border-radius: 12px;
  font-size: 0.875rem;
  line-height: 1.25;
}
${FILE_CHIP}::before {
  content: "";
  flex: 0 0 18px;
  width: 18px;
  height: 18px;
  background-color: currentColor;
  -webkit-mask: ${FILE_ICON_MASK};
  mask: ${FILE_ICON_MASK};
}
${USER_BUBBLE} > .break-words {
  box-sizing: border-box;
  width: fit-content;
  max-width: 100%;
  align-self: flex-end;
  background: var(--surface-recessed);
  border: 1px solid var(--border-seam);
  border-radius: calc(var(--radius) + 4px);
  padding: 0.625rem 1rem;
}
${USER_BUBBLE}[${NO_BODY}] > p {
  display: none;
}
${USER_BUBBLE}[${HAS_META}] > .break-words {
  padding-bottom: 1.75rem;
}
${USER_BUBBLE} > .mt-1 {
  align-self: flex-end;
  position: relative;
  z-index: 1;
  margin-top: -1.5rem;
  margin-right: 1rem;
  margin-bottom: 0.625rem;
}
${USER_BUBBLE}[${HAS_CLAMP}] > .break-words {
  padding-top: 1.75rem;
}
${USER_BUBBLE} > span.line-clamp-1 {
  align-self: flex-end;
  position: relative;
  z-index: 1;
  max-width: calc(100% - 2rem);
  margin-right: 1rem;
  margin-bottom: -1.5rem;
  margin-left: 1rem;
}
${USER_BUBBLE} > .break-words[style*="mask-image"] {
  position: relative;
  max-height: calc(15lh - 8px);
  mask-image: none !important;
  -webkit-mask-image: none !important;
}
${USER_BUBBLE} > .break-words[style*="mask-image"]::after {
  content: "";
  position: absolute;
  right: 1px;
  bottom: 1px;
  left: 1px;
  z-index: 1;
  height: calc(2.5rem + 1.75rem);
  background:
    linear-gradient(var(--surface-recessed), var(--surface-recessed)),
    var(--background);
  mask-image: linear-gradient(to bottom, transparent, black 2.5rem);
  -webkit-mask-image: linear-gradient(to bottom, transparent, black 2.5rem);
  pointer-events: none;
}
[data-thread-window][data-surface-tone="sidebar"] ${USER_BUBBLE} > .break-words[style*="mask-image"]::after {
  background:
    linear-gradient(var(--surface-recessed), var(--surface-recessed)),
    var(--sidebar);
}
${PHONE_NARROW} ${FILE_CHIP} {
  min-height: 64px;
  border-radius: 20px;
}
${PHONE_NARROW} ${FILE_CHIP}::before {
  flex: 0 0 28px;
  width: 28px;
  height: 28px;
}

`;
}

function toggle(node: Element, name: string, on: boolean): void {
  if (node.hasAttribute(name) !== on) node.toggleAttribute(name, on);
}

function decorate(bubble: Element): void {
  const children = Array.from(bubble.children);
  const attachments = bubble.matches(BUBBLE_CANDIDATE)
    ? children.find((child) => child.matches(".mt-2.space-y-2")) : undefined;
  toggle(bubble, BUBBLE_MARK, attachments !== undefined);
  toggle(bubble, NO_BODY, attachments !== undefined && !children.some((child) => child.matches(".break-words")));
  toggle(bubble, HAS_META, attachments !== undefined && children.some((child) => child.matches(".mt-1")));
  toggle(bubble, HAS_CLAMP, attachments !== undefined && children.some((child) => child.matches("span.line-clamp-1")));
  const rows = new Set(attachments ? Array.from(attachments.children).filter(row => row.matches(".flex")) : []);
  for (const row of Array.from(bubble.querySelectorAll(`[${FILE_ROW}]`))) if (!rows.has(row)) row.removeAttribute(FILE_ROW);
  for (const row of rows) toggle(row, FILE_ROW, row.querySelector("img") === null);
}

export function injectUserAttachments(document: Document): () => void {
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = userAttachmentsCss();
  document.head.append(style);
  const decorateIn = (root: ParentNode) => {
    for (const bubble of Array.from(root.querySelectorAll(BUBBLE_CANDIDATE))) decorate(bubble);
  };
  // Only added user rows and changes inside a user bubble are looked at; no layout is read.
  const observer = new document.defaultView!.MutationObserver((records) => {
    const bubbles = new Set<Element>();
    for (const record of records) {
      const target = record.target.nodeType === 1 ? record.target as Element : record.target.parentElement;
      const bubble = target?.closest(`${BUBBLE_CANDIDATE}, [${BUBBLE_MARK}]`);
      if (bubble) bubbles.add(bubble);
      if (record.type === "attributes" && !bubble && target?.closest("[data-message-column]")) {
        for (const found of Array.from(target.querySelectorAll(`${BUBBLE_CANDIDATE}, [${BUBBLE_MARK}]`))) bubbles.add(found);
      }
      for (const node of Array.from(record.addedNodes)) {
        if (node.nodeType !== 1) continue;
        const element = node as Element;
        if (element.matches(BUBBLE_CANDIDATE)) bubbles.add(element);
        else if (element.querySelector(".rounded-xl")) for (const found of Array.from(element.querySelectorAll(BUBBLE_CANDIDATE))) bubbles.add(found);
      }
    }
    for (const bubble of bubbles) if (bubble.isConnected) decorate(bubble);
  });
  observer.observe(document.body, { childList: true, subtree: true, attributes:true, attributeFilter:["class"] });
  decorateIn(document);
  return () => {
    observer.disconnect();
    for (const name of [BUBBLE_MARK, FILE_ROW, NO_BODY, HAS_META, HAS_CLAMP]) {
      for (const node of Array.from(document.querySelectorAll(`[${name}]`))) node.removeAttribute(name);
    }
    style.remove();
  };
}
