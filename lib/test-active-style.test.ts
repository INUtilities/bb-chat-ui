import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { activeStyleRules } from "./test-active-style.ts";

// Require real nested media, owner media and disabled state without replacing sheet identities.
test("active style lookup follows actual media ancestors and preserves native rule identities", () => {
  const dom = new JSDOM('<html><head><style>.base { color:inherit } @media all { .outer { display:grid } @media not all { .inner { display:flex } } }</style></head></html>');
  try {
    const document = dom.window.document, style = document.querySelector("style")!, sheet = style.sheet!;
    const text = style.textContent, outer = sheet.cssRules[1] as CSSMediaRule;
    const inner = outer.cssRules[1] as CSSMediaRule, outerMedia = outer.media;
    assert.deepEqual(activeStyleRules(document).rules, [sheet.cssRules[0], outer.cssRules[0]]);
    inner.media.mediaText = "all";
    assert.deepEqual(activeStyleRules(document).rules, [sheet.cssRules[0], outer.cssRules[0], inner.cssRules[0]]);
    outer.media.mediaText = "not all";
    assert.deepEqual(activeStyleRules(document).rules, [sheet.cssRules[0]]);
    outer.media.mediaText = "all"; style.media = "not all";
    assert.deepEqual(activeStyleRules(document).rules, []);
    style.media = "all"; sheet.disabled = true;
    assert.deepEqual(activeStyleRules(document).rules, []);
    assert.equal(style.sheet, sheet); assert.equal(outer.media, outerMedia); assert.equal(style.textContent, text);
  } finally { dom.window.close(); }
});

// Keep unavailable feature media explicit and prevent query-agnostic stubs from overriding all/not all.
test("active style lookup reports unknown conditions and excludes keyframe declarations", () => {
  const dom = new JSDOM('<html><head><style>@media all { .always { display:grid } } @media (min-width:1px) { .feature { display:flex } } @keyframes fixture { from { opacity:0 } to { opacity:1 } }</style></head></html>');
  try {
    const document = dom.window.document, sheet = document.querySelector("style")!.sheet!;
    const always = (sheet.cssRules[0] as CSSMediaRule).cssRules[0];
    const missing = activeStyleRules(document);
    assert.deepEqual(missing.rules, [always]);
    assert.deepEqual(missing.unknownConditions, ["(min-width:1px)"]);
    // Model the existing motion fixtures without substituting media constant semantics.
    function noFeatureMatches() { return { matches:false } as MediaQueryList; }
    Object.defineProperty(dom.window, "matchMedia", { value:noFeatureMatches });
    const evaluated = activeStyleRules(document);
    assert.deepEqual(evaluated.rules, [always]); assert.deepEqual(evaluated.unknownConditions, []);
  } finally { dom.window.close(); }
});
