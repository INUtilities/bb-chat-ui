const CARET = 'button[aria-label="Choose pull request merge method"]';
const OPEN_PR = '[data-bb-chat-ui-info-open="pullRequest"]';

// Keep BB's method menu and action callbacks. Only replace the immediate action
// on the left half of its split button with the existing menu trigger.
export function interceptPrMerge(stack: HTMLElement) {
  const view = stack.ownerDocument.defaultView!;
  const originals = new Map<HTMLElement, Map<string, string | null>>();
  const set = (node: HTMLElement, name: string, value: string | null) => {
    if (node.getAttribute(name) === value) return;
    let attrs = originals.get(node);
    if (!attrs) { attrs = new Map(); originals.set(node, attrs); }
    if (!attrs.has(name)) attrs.set(name, node.getAttribute(name));
    if (value === null) node.removeAttribute(name); else node.setAttribute(name, value);
  };
  const mainButton = (caret: Element) => {
    const main = caret.previousElementSibling;
    return main instanceof view.HTMLButtonElement ? main : null;
  };
  const onClick = (event: MouseEvent) => {
    const target = event.target instanceof view.Element ? event.target : null;
    const main = target?.closest('button');
    if (!main || !main.closest(OPEN_PR)) return;
    const caret = main.nextElementSibling;
    if (!(caret instanceof view.HTMLButtonElement) || !caret.matches(CARET)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (main.disabled || caret.disabled || main.getAttribute('aria-disabled') === 'true' || caret.getAttribute('aria-disabled') === 'true') return;
    caret.focus({ preventScroll:true });
    // Radix opens on ArrowDown; BB's compact trigger opens on click instead.
    // A handled key cancels its default, so exactly one path runs.
    const key = new view.KeyboardEvent('keydown', { key:'ArrowDown', bubbles:true, cancelable:true });
    if (caret.dispatchEvent(key)) caret.click();
  };
  stack.addEventListener('click', onClick, true);
  return {
    sync() {
      for (const node of originals.keys()) if (!node.isConnected) originals.delete(node);
      for (const caret of Array.from(stack.querySelectorAll<HTMLButtonElement>(`${OPEN_PR} ${CARET}`))) {
        const main = mainButton(caret);
        if (!main) continue;
        // The native menu trigger overlays the full pill. Its sibling is now
        // only the visible label, rather than a second keyboard/click target.
        set(main, 'tabindex', '-1');
        set(main, 'aria-hidden', 'true');
        set(main, 'aria-haspopup', 'menu');
        set(main, 'aria-expanded', caret.getAttribute('aria-expanded') ?? 'false');
        set(main, 'aria-controls', caret.getAttribute('aria-controls'));
        if (caret.getAttribute('aria-expanded') !== 'true') continue;
        const id = caret.getAttribute('aria-controls');
        const menu = id ? stack.ownerDocument.getElementById(id)
          : Array.from(stack.ownerDocument.querySelectorAll<HTMLElement>('[data-persistent-drawer-content][data-state="open"]'))
            .find(node => stack.ownerDocument.getElementById(node.getAttribute('aria-labelledby') ?? '')?.textContent === 'Merge pull request');
        if (!menu) continue;
        set(menu, 'data-bb-chat-ui-pr-menu', '');
        const layer = menu.closest<HTMLElement>('[data-radix-popper-content-wrapper]') ?? menu;
        set(layer, 'data-bb-chat-ui-pr-menu-layer', '');
        const backdrop = menu.previousElementSibling;
        if (backdrop instanceof view.HTMLElement && backdrop.hasAttribute('data-persistent-drawer-backdrop')) {
          set(backdrop, 'data-bb-chat-ui-pr-menu-backdrop', '');
        }
      }
    },
    cleanup() {
      stack.removeEventListener('click', onClick, true);
      for (const [node, attrs] of originals) for (const [name, value] of attrs) {
        if (value === null) node.removeAttribute(name); else node.setAttribute(name, value);
      }
      originals.clear();
    },
  };
}
