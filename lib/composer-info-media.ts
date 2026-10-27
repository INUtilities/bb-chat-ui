export interface ComposerInfoCssFragment { readonly detail?: string; readonly css: string; }

// Mount detail media in its original cascade positions and fall back to the complete active CSS.
export function installDetailMedia(style: HTMLStyleElement, fragments: readonly ComposerInfoCssFragment[], original: string) {
  style.textContent = fragments.map(fragment => fragment.detail ? `@media all {${fragment.css}\n}` : fragment.css).join("");
  style.ownerDocument.head.append(style);
  const sheet = style.sheet;
  let media: MediaList[] = [];
  let enabled = true;

  // Restore the original active stylesheet when conditional media cannot be controlled safely.
  function fallback() {
    media = [];
    enabled = true;
    style.textContent = original;
  }

  try {
    if (!sheet) throw new Error("Composer information CSSOM unavailable");
    media = Array.from(sheet.cssRules)
      .filter(rule => rule.type === 4 && (rule as CSSMediaRule).media.mediaText === "all")
      .map(rule => (rule as CSSMediaRule).media);
    if (media.length !== fragments.filter(fragment => fragment.detail).length) fallback();
  } catch { fallback(); }

  // Change all six groups synchronously and retain the original CSS if a setter or sheet changes.
  function setEnabled(next: boolean) {
    if (!media.length) return;
    if (style.sheet !== sheet) { fallback(); return; }
    if (enabled === next) return;
    const condition = next ? "all" : "not all";
    try {
      for (const list of media) {
        list.mediaText = condition;
        if (list.mediaText !== condition) throw new Error("Composer detail media setter unavailable");
      }
      enabled = next;
    } catch { fallback(); }
  }

  return setEnabled;
}
