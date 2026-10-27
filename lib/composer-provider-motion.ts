import { EASE } from './motion.ts';

const MARK = 'data-bb-chat-ui-provider-indicator';
const selectedClass = ['border', 'foreground'].join('-');

// Native provider tabs change their bottom border without moving it. Keep one
// visual indicator across both attribute updates and native row replacement.
export function injectComposerProviderMotion(card: HTMLElement): () => void {
  const view = card.ownerDocument.defaultView;
  if (!view) return () => {};
  const media = view.matchMedia?.('(prefers-reduced-motion: reduce)');
  const indicator = card.ownerDocument.createElement('span');
  indicator.setAttribute(MARK, '');
  indicator.setAttribute('aria-hidden', 'true');
  Object.assign(indicator.style, { position: 'absolute', left: '0', bottom: '0', width: '1px', height: '2px', background: 'var(--foreground)', transformOrigin: 'left', pointerEvents: 'none' });
  const borders = new Map<HTMLElement, [string, string]>();
  let row: HTMLElement | null = null, rowPosition = '', rowPriority = '';
  let target = '', key = '', motion: Animation | null = null, disposed = false;

  function cancel(): void { if (motion) { motion.onfinish = null; motion.cancel(); motion = null; } }
  function releaseRow(): void {
    if (!row) return;
    if (rowPosition) row.style.setProperty('position', rowPosition, rowPriority);
    else { row.style.removeProperty('position'); if (!row.style.length) row.removeAttribute('style'); }
  }
  function sync(): void {
    if (disposed) return;
    const buttons = Array.from(card.querySelectorAll<HTMLElement>('button[title]')).filter(button => button.parentElement?.matches('div[class~="bg-background"]'));
    const selected = buttons.find(button => button.getAttribute('aria-selected') === 'true' || button.classList.contains(selectedClass));
    if (!selected) { cancel(); indicator.remove(); return; }
    const nextRow = selected.parentElement!;
    const changedRow = nextRow !== row;
    if (changedRow) {
      releaseRow(); row = nextRow;
      rowPosition = row.style.getPropertyValue('position'); rowPriority = row.style.getPropertyPriority('position');
      if (view!.getComputedStyle(row).position === 'static' || !view!.getComputedStyle(row).position) row.style.setProperty('position', 'relative');
      row.append(indicator);
    }
    for (const button of buttons) {
      if (!borders.has(button)) borders.set(button, [button.style.getPropertyValue('border-bottom-color'), button.style.getPropertyPriority('border-bottom-color')]);
      button.style.setProperty('border-bottom-color', 'transparent', 'important');
    }
    // Measure only provider state/row/viewport transitions, never model list text.
    const bounds = selected.getBoundingClientRect(), parent = row!.getBoundingClientRect();
    const next = `translateX(${bounds.left - parent.left + row!.scrollLeft}px) scaleX(${bounds.width})`;
    const nextKey = selected.getAttribute('title') ?? '';
    if (!changedRow && next === target && nextKey === key) return;
    const from = motion ? view!.getComputedStyle(indicator).transform : target;
    cancel(); indicator.style.transform = next;
    if (target && !media?.matches && typeof indicator.animate === 'function') {
      motion = indicator.animate([{ transform: from || target }, { transform: next }], { duration: 260, easing: EASE.out });
      const current = motion;
      current.onfinish = () => { if (motion === current) { current.onfinish = null; current.cancel(); motion = null; } };
    }
    target = next; key = nextKey;
  }
  const observer = new view.MutationObserver(records => {
    if (records.some(record => {
      const element = record.target as Element;
      if (record.type === 'attributes') return element.matches('button[title]');
      return [...Array.from(record.addedNodes), ...Array.from(record.removedNodes)].some(node => node.nodeType === 1 && ((node as Element).matches('button[title]') || !!(node as Element).querySelector('button[title]')));
    })) sync();
  });
  observer.observe(card, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'aria-selected', 'title'] });
  const reduced = () => { if (media?.matches) cancel(); };
  media?.addEventListener?.('change', reduced);
  view.addEventListener('resize', sync);
  sync();
  return () => {
    disposed = true; observer.disconnect(); view.removeEventListener('resize', sync); media?.removeEventListener?.('change', reduced); cancel(); indicator.remove(); releaseRow();
    for (const [button, [value, priority]] of borders) {
      if (value) button.style.setProperty('border-bottom-color', value, priority);
      else { button.style.removeProperty('border-bottom-color'); if (!button.style.length) button.removeAttribute('style'); }
    }
    borders.clear();
  };
}
