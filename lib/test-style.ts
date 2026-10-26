const sheets = new WeakMap<HTMLStyleElement, { original: string; resolved: string }>();

/** Substitute numeric root card and reference-pill tokens before JSDOM parses shorthand geometry (var() is unsupported there). */
function resolveCardSheets(element: Element): void {
  const document = element.ownerDocument;
  const root = document.defaultView!.getComputedStyle(document.documentElement);
  for (const sheet of Array.from(document.querySelectorAll<HTMLStyleElement>('style'))) {
    const current = sheet.textContent ?? '';
    const saved = sheets.get(sheet);
    const original = saved && saved.resolved === current ? saved.original : current;
    const resolved = original.replace(/var\((--bb-chat-ui-(?:(?:card|pill-reference)-[\w-]+|info-row-gap))(?:,\s*[^)]+)?\)/g, (match, token: string) => {
      const value = root.getPropertyValue(token).trim();
      return /^-?[\d.]+px(?: -?[\d.]+px)?$/.test(value) ? value : match;
    }).replace(/calc\(-1 \* ([\d.]+)px\)/g, (_, value) => `${-Number(value)}px`)
      .replace(/calc\(100% \+ 2 \* ([\d.]+)px\)/g, (_, value) => `calc(100% + ${2 * Number(value)}px)`);
    sheets.set(sheet, { original, resolved });
    if (resolved !== current) sheet.textContent = resolved;
  }
}

/** JSDOM preserves var() in computed typography; resolve the actual root tokens for assertions. */
export function resolvedStyle(element: Element): CSSStyleDeclaration {
  resolveCardSheets(element);
  const view = element.ownerDocument.defaultView!;
  const style = view.getComputedStyle(element);
  const root = view.getComputedStyle(element.ownerDocument.documentElement);
  const resolve = (value: string): string => value.replace(/var\((--[\w-]+)\)/g, (_, token: string) => {
    const result = root.getPropertyValue(token).trim();
    if (!result) throw new Error(`Missing root typography token: ${token}`);
    return result;
  });
  return new Proxy(style, {
    get(target, property) {
      if (property === "fontSize" || property === "lineHeight") return resolve(target[property]);
      if (property === "getPropertyValue") return (name: string) => {
        const value = target.getPropertyValue(name);
        return name === "font-size" || name === "line-height" ? resolve(value) : value;
      };
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
