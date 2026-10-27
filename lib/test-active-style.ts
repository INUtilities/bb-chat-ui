export interface ActiveStyleRules {
  rules: CSSStyleRule[];
  unknownConditions: string[];
}

// Read actual active style leaves without rewriting their stylesheet or media objects.
export function activeStyleRules(document: Document): ActiveStyleRules {
  const rules: CSSStyleRule[] = [], unknown = new Set<string>();
  const owners = Array.from(document.querySelectorAll<HTMLStyleElement | HTMLLinkElement>('style, link[rel="stylesheet"]'));
  const view = document.defaultView;

  // Preserve a false ancestor and retain unsupported conditions as unknown.
  function and(left: boolean | undefined, right: boolean | undefined) {
    return left === false || right === false ? false : left === undefined || right === undefined ? undefined : true;
  }

  // Resolve constant media before consulting a fixture's optional feature-query evaluator.
  function media(text: string): boolean | undefined {
    const query = text.trim().toLowerCase().replace(/\s+/g, " ");
    if (!query || query === "all") return true;
    if (query === "not all") return false;
    const result = view?.matchMedia?.(text).matches;
    if (typeof result === "boolean") return result;
    unknown.add(text);
    return undefined;
  }

  // Traverse actual grouping rules in source order and exclude inactive or unknown leaves.
  function walk(list: CSSRuleList, enabled: boolean | undefined) {
    if (enabled === false) return;
    for (const rule of Array.from(list)) {
      if (rule.type === 7 || rule.type === 8) continue;
      if (rule.type === 1) {
        if (enabled === true) rules.push(rule as CSSStyleRule);
        continue;
      }
      const group = rule as CSSGroupingRule;
      if (!group.cssRules) continue;
      let active: boolean | undefined = enabled;
      if (rule.type === 4) active = and(active, media((rule as CSSMediaRule).media.mediaText));
      else if (rule.constructor.name !== "CSSLayerBlockRule") {
        unknown.add(rule.cssText.slice(0, rule.cssText.indexOf("{")));
        active = and(active, undefined);
      }
      walk(group.cssRules, active);
    }
  }

  for (const sheet of Array.from(document.styleSheets)) {
    if (sheet.disabled) continue;
    // Find the connected DOM owner even when JSDOM omits CSSStyleSheet.ownerNode.
    function ownsSheet(node: HTMLStyleElement | HTMLLinkElement) { return node.sheet === sheet; }
    const owner = owners.find(ownsSheet);
    if (owner && !owner.isConnected) continue;
    const enabled = and(media(owner?.media ?? ""), media(sheet.media?.mediaText ?? ""));
    walk(sheet.cssRules, enabled);
  }
  return { rules, unknownConditions: Array.from(unknown) };
}
