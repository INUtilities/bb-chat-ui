import assert from "node:assert/strict";
import test from "node:test";

import { DARK_GLASS_FACE, LIGHT_GLASS_FACE } from "./glass-surface.ts";
import {
  applyComposerRadius,
  applyFadeHeight,
  composerCollapseHeight,
  composerGlassCss,
  composerHeightTransition,
  composerRadiusChange,
  fadeHeight,
  composerControlsLayout,
  composerLift,
  desktopCollapseStick,
  nextPinnedScroll,
  planComposerHeight,
} from "./composer-glass.ts";

test("spreads a translucent footer fade above the composer without moving it", () => {
  const css = composerGlassCss;
  assert.equal(fadeHeight({ plateBottom: 640, composerTop: 560, composerHeight: 80 }), 144);
  assert.equal(fadeHeight({ plateBottom: 652, composerTop: 608, composerHeight: 32 }), 108);
  assert.doesNotMatch(css, /margin-top:\s*calc\(-1 \*/);
  assert.doesNotMatch(css, /scroll-bottom-anchor/);
  assert.match(css, /background:\s*transparent !important/);
  assert.match(css, /top:\s*auto !important/);
  assert.match(css, /bottom:\s*0 !important/);
  assert.match(
    css,
    /height:\s*var\(--bb-chat-ui-fade-height, 0px\) !important/,
  );
  assert.doesNotMatch(css, /100% \+ var\(--bb-chat-ui-plate-height/);
  assert.equal(
    fadeHeight({ plateBottom: 652, composerTop: 560, composerHeight: 80 }),
    156,
  );
  assert.equal(
    fadeHeight({ plateBottom: 100, composerTop: 90, composerHeight: 40 }),
    0,
  );
  assert.match(
    css,
    /linear-gradient\(\s*to bottom,\s*transparent[\s\S]*var\(--background\)/,
  );
  assert.doesNotMatch(
    css,
    /padding-bottom:\s*3\.5rem|0 16px 36px|0 16px 40px|blur\(16px\)|blur\(12px\) saturate\(1\.8\)|1\.5px|h-6|to-background|height:\s*auto/,
  );
});

test("keeps the expanded editor minimum height independent of banners", () => {
  assert.match(
    composerGlassCss,
    /\[data-scroll-footer\]\[data-bb-chat-ui-glass\] \[data-follow-up-composer-anchor\] \[data-promptbox\]:not\(\[data-promptbox-compact\]\) \[data-promptbox-editor-scroll\]\s*\{\s*min-height:\s*68px !important;\s*\}/,
  );
});

test("container-collapsed follow-up editors keep the native 48px line box", () => {
  // BB can collapse through a style container without data-promptbox-compact.
  assert.match(composerGlassCss,
    /@container follow-up-composer style\(--follow-up-composer-container-compact: true\)\s*\{\s*\[data-scroll-footer\]\[data-bb-chat-ui-glass\] \[data-follow-up-composer\]:not\(\[data-follow-up-composer-expanded\]\) \[data-promptbox\]:not\(\[data-promptbox-voice-active\]\) \[data-promptbox-editor-scroll\]\s*\{\s*min-height:48px !important;\s*\}/);
});

test("keeps the host canvas and uses each thread surface tone for the fade", () => {
  assert.doesNotMatch(composerGlassCss, /--bb-chat-ui-canvas|oklch\(0\./);
  assert.doesNotMatch(composerGlassCss, /main\[data-sidebar="inset"\]/);
  assert.match(composerGlassCss, /color-mix\(in srgb, var\(--background\) 12%, transparent\) 45%/);
  assert.match(composerGlassCss, /color-mix\(in srgb, var\(--background\) 35%, transparent\) 75%/);
  assert.match(composerGlassCss, /color-mix\(in srgb, var\(--background\) 65%, transparent\) 90%/);
  assert.match(composerGlassCss, /var\(--background\) 100%/);
  assert.match(composerGlassCss, /\[data-thread-window\]\[data-surface-tone="sidebar"\][^{]*\{[^}]*var\(--sidebar\) 100%/);
});

test("uses more translucent glass and soft highlights across composer controls", () => {
  const css = composerGlassCss;
  assert.match(
    css,
    /\[data-promptbox\],[\s\S]*#thread-prompt-banner-git-toggle,[\s\S]*button\[aria-label="Scroll to latest event"\],[\s\S]*\.agentation-staging-shell\s*\{[\s\S]*backdrop-filter:\s*blur\(14px\) saturate\(1\.25\);[\s\S]*-webkit-backdrop-filter:\s*blur\(14px\) saturate\(1\.25\);/,
  );
  assert.match(css, /oklch\(from var\(--bb-chat-ui-glass-base, var\(--background\)\) min\(1, calc\(l \+ 0\.075\)\) c h \/ 0\.68\)/);
  assert.match(
    css,
    /#thread-prompt-banner-git-toggle,\s*\[data-scroll-footer\]\[data-bb-chat-ui-glass\] button\[aria-label="Scroll to latest event"\],[\s\S]*\.agentation-staging-shell\s*\{[^}]*border-color:\s*transparent !important;/,
  );
  assert.match(
    css,
    /0 12px 32px -14px color-mix\(in oklab, var\(--ink, var\(--foreground\)\) 22%, transparent\),\s*inset 0 1px 3px color-mix\(in oklab, var\(--popover\) 35%, transparent\)/,
  );
  assert.match(
    css,
    /0 6px 18px -12px color-mix\(in oklab, var\(--ink, var\(--foreground\)\) 22%, transparent\)/,
  );
  assert.match(css, /oklch\(from var\(--bb-chat-ui-glass-base, var\(--background\)\) min\(1, calc\(l \+ 0\.075\)\) c h \/ 0\.76\)/);
  assert.match(
    css,
    /\.dark \[data-scroll-footer\]\[data-bb-chat-ui-glass\] #thread-prompt-banner-git-toggle,\s*\.dark \[data-scroll-footer\]\[data-bb-chat-ui-glass\] button\[aria-label="Scroll to latest event"\],[\s\S]*\.agentation-staging-shell\s*\{[^}]*border-color:\s*transparent !important;/,
  );
  assert.match(
    css,
    /inset 0 1px 3px color-mix\(in oklab, var\(--foreground\) 8%, transparent\)/,
  );
  assert.match(css, /color-mix\(in oklab, black 60%, transparent\)/);
  assert.doesNotMatch(css, /inset 0 1px 0/);
  assert.match(css, /\[data-promptbox\]\s*\{[^}]*border-color:\s*transparent !important;/);
  assert.match(
    css,
    /\[data-promptbox\]\s*\{[^}]*transition:\s*box-shadow 320ms cubic-bezier\(0\.2, 0\.8, 0\.2, 1\);/,
  );
  assert.doesNotMatch(css, /transition:[^;]*!important/);
  assert.match(
    css,
    /\[data-promptbox\]:focus-within\s*\{[^}]*border-color:\s*transparent !important;/,
  );
  assert.match(
    css,
    /html\[data-bb-chat-ui-root-device="phone"\]\[data-bb-chat-ui-root-viewport="narrow"\][\s\S]*\[data-promptbox\]\s*\{[^}]*box-shadow:\s*0 6px 16px -10px color-mix\(in oklab, var\(--ink, var\(--foreground\)\) 22%, transparent\),/,
  );
  assert.match(
    css,
    /html\[data-bb-chat-ui-root-device="phone"\]\[data-bb-chat-ui-root-viewport="narrow"\][\s\S]*\[data-promptbox\]:focus-within\s*\{[^}]*box-shadow:\s*0 8px 20px -12px color-mix\(in oklab, var\(--ink, var\(--foreground\)\) 34%, transparent\),/,
  );
  assert.match(
    css,
    /html\[data-bb-chat-ui-root-device="phone"\]\[data-bb-chat-ui-root-viewport="narrow"\][\s\S]*\.dark \[data-scroll-footer\]\[data-bb-chat-ui-glass\] \[data-promptbox\]\s*\{[^}]*box-shadow:\s*0 6px 16px -10px color-mix\(in oklab, black 60%, transparent\),/,
  );
  assert.match(
    css,
    /html\[data-bb-chat-ui-root-device="phone"\]\[data-bb-chat-ui-root-viewport="narrow"\][\s\S]*\.dark \[data-scroll-footer\]\[data-bb-chat-ui-glass\] \[data-promptbox\]:focus-within\s*\{[^}]*box-shadow:\s*0 8px 20px -12px color-mix\(in oklab, var\(--ink, var\(--foreground\)\) 34%, transparent\),/,
  );
  assert.match(
    css,
    /\.dark \[data-scroll-footer\]\[data-bb-chat-ui-glass\] \[data-promptbox\]\s*\{[^}]*border-color:\s*transparent !important;/,
  );
  assert.doesNotMatch(
    css,
    /\[data-promptbox\]:focus-within\s*\{[^}]*border-color:\s*color-mix/,
  );
  assert.match(css, /\[data-promptbox\]\s*\{[^}]*border-radius:\s*1\.375rem/);
  assert.match(
    css,
    /\[data-promptbox\]\[data-promptbox-compact\]\s*\{[^}]*border-radius:\s*999px/,
  );
  assert.match(
    css,
    /\[data-promptbox\]\[data-promptbox-compact\]:has\(\[aria-label="Exit handoff"\]\)\s*\{[^}]*border-radius:\s*1\.375rem !important;/,
  );
  assert.doesNotMatch(
    css,
    /#thread-prompt-banner-git-toggle\s*\{[^}]*border-radius:/,
  );
});

test("keeps the collapsing composer on the bottom edge", () => {
  const css = composerGlassCss;
  assert.match(
    css,
    /\[data-promptbox\]\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;[^}]*justify-content:\s*flex-end;/,
  );
  assert.match(
    css,
    /html\[data-bb-chat-ui-root-viewport="narrow"\][\s\S]*:has\(\[data-promptbox-compact\]\)[\s\S]*max-height:\s*100dvh;[\s\S]*\[data-promptbox-shell\] > \.grid\s*\{[^}]*overflow-y:\s*auto;/,
  );
  const desktop = css.slice(
    css.indexOf('html:is([data-bb-chat-ui-root-viewport="medium"], [data-bb-chat-ui-root-viewport="wide"])'),
    css.indexOf('html[data-bb-chat-ui-root-hit-target="small"]'),
  );
  assert.ok(desktop);
  assert.match(desktop, /:has\(\[data-promptbox-compact\]\)/);
  assert.match(desktop, /justify-content:\s*flex-end;/);
  assert.doesNotMatch(desktop, /100dvh|overflow-y:\s*auto/);
  assert.equal(
    desktopCollapseStick({
      desktop: false,
      scrollGap: 10,
      footerBottom: 800,
      scrollerBottom: 800,
    }),
    false,
  );
  assert.equal(
    desktopCollapseStick({
      desktop: true,
      scrollGap: 10,
      footerBottom: 796,
      scrollerBottom: 800,
    }),
    true,
  );
  assert.equal(composerLift({
    desktop: false,
    stick: true,
    scrollerBottom: 800,
    plateBottom: 780,
  }), null);
  assert.equal(composerLift({
    desktop: true,
    stick: true,
    scrollerBottom: 800,
    plateBottom: 780,
  }), "translateY(20px)");
  assert.equal(composerLift({
    desktop: true,
    stick: true,
    scrollerBottom: 800,
    plateBottom: 800,
  }), null);
});

test("eases composer height and corner with small hit targets", () => {
  const css = composerGlassCss;
  assert.match(css, /@keyframes bb-chat-ui-composer-radius/);
  assert.match(
    css,
    /html\[data-bb-chat-ui-root-hit-target="small"\][\s\S]*?\[data-promptbox\]\s*\{[^}]*height 360ms cubic-bezier\(0\.22, 1, 0\.36, 1\),\s*border-radius 480ms cubic-bezier\(0\.22, 1, 0\.36, 1\);/,
  );
  assert.match(
    css,
    /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?transition:\s*box-shadow 320ms cubic-bezier\(0\.2, 0\.8, 0\.2, 1\);/,
  );
  assert.deepEqual(
    composerRadiusChange({
      previousCompact: false,
      nextCompact: true,
      handoff: false,
      smallHitTarget: true,
      reducedMotion: false,
    }),
    { from: "1.375rem", to: "999px" },
  );
  assert.deepEqual(
    composerRadiusChange({
      previousCompact: true,
      nextCompact: false,
      handoff: false,
      smallHitTarget: true,
      reducedMotion: false,
    }),
    { from: "999px", to: "1.375rem" },
  );
  assert.equal(
    composerRadiusChange({
      previousCompact: false,
      nextCompact: true,
      handoff: true,
      smallHitTarget: true,
      reducedMotion: false,
    }),
    null,
  );
  assert.equal(
    composerRadiusChange({
      previousCompact: false,
      nextCompact: true,
      handoff: false,
      smallHitTarget: false,
      reducedMotion: false,
    }),
    null,
  );
  assert.equal(
    composerRadiusChange({
      previousCompact: false,
      nextCompact: true,
      handoff: false,
      smallHitTarget: true,
      reducedMotion: true,
    }),
    null,
  );

  const writes: string[] = [];
  const element = {
    style: {
      setProperty(name: string, value: string) {
        writes.push(`${name}:${value}`);
      },
      animation: "",
    },
    getBoundingClientRect() {
      writes.push("measure");
    },
  };
  applyComposerRadius(element, { from: "1.375rem", to: "999px" });
  assert.deepEqual(writes, [
    "--bb-chat-ui-radius-from:1.375rem",
    "--bb-chat-ui-radius-to:999px",
    "measure",
  ]);
  assert.equal(
    element.style.animation,
    "bb-chat-ui-composer-radius 480ms cubic-bezier(0.22, 1, 0.36, 1)",
  );
});

test("lengthens the host height flip and keeps a bottom scroll pinned", () => {
  const host = "height 240ms cubic-bezier(0.22, 1, 0.36, 1)";
  assert.equal(
    composerHeightTransition(host),
    "height 360ms cubic-bezier(0.22, 1, 0.36, 1)",
  );
  assert.equal(composerHeightTransition("height 480ms ease"), null);
  assert.equal(composerHeightTransition(""), null);

  const started = planComposerHeight({
    transition: host,
    height: "48px",
    now: 1_000,
    idleHeight: 120,
    motion: null,
  });
  assert.equal(started.rewrite?.from, 120);
  assert.equal(started.rewrite?.to, 48);
  assert.equal(
    started.rewrite?.transition,
    "height 360ms cubic-bezier(0.22, 1, 0.36, 1)",
  );
  assert.equal(started.resume, null);
  assert.deepEqual(started.motion, {
    from: 120,
    to: 48,
    startedAt: 1_000,
    durationMs: 360,
  });

  const cutOff = planComposerHeight({
    transition: "",
    height: "",
    now: 1_320,
    idleHeight: 120,
    motion: started.motion,
  });
  assert.ok(cutOff.resume);
  assert.equal(cutOff.resume?.from, 120);
  assert.equal(cutOff.resume?.to, 48);
  assert.equal(cutOff.resume?.remainingMs, 40);
  assert.match(cutOff.resume?.transition ?? "", /height 360ms/);
  assert.match(cutOff.resume?.transition ?? "", /-320ms/);
  assert.equal(cutOff.motion, started.motion);
  const resumedHeight = composerCollapseHeight({
    from: 120,
    to: 48,
    elapsedMs: 320,
    durationMs: 360,
  });
  assert.ok(resumedHeight < 60);
  assert.ok(resumedHeight > 48);

  const finished = planComposerHeight({
    transition: "",
    height: "",
    now: 1_360,
    idleHeight: 48,
    motion: started.motion,
  });
  assert.equal(finished.motion, null);
  assert.equal(finished.resume, null);

  assert.equal(composerCollapseHeight({
    from: 120,
    to: 48,
    elapsedMs: 0,
    durationMs: 480,
  }), 120);
  assert.equal(composerCollapseHeight({
    from: 120,
    to: 48,
    elapsedMs: 480,
    durationMs: 480,
  }), 48);

  assert.deepEqual(
    nextPinnedScroll({
      scrollTop: 400,
      scrollHeight: 500,
      clientHeight: 80,
      stick: true,
      lastPinned: null,
    }),
    { scrollTop: 420, stick: true },
  );
  assert.deepEqual(
    nextPinnedScroll({
      scrollTop: 420,
      scrollHeight: 500,
      clientHeight: 80,
      stick: true,
      lastPinned: 420,
    }),
    { scrollTop: null, stick: true },
  );
  assert.deepEqual(
    nextPinnedScroll({
      scrollTop: 300,
      scrollHeight: 500,
      clientHeight: 80,
      stick: true,
      lastPinned: 420,
    }),
    { scrollTop: null, stick: false },
  );
  assert.deepEqual(
    nextPinnedScroll({
      scrollTop: 10,
      scrollHeight: 80,
      clientHeight: 100,
      stick: false,
      lastPinned: null,
    }),
    { scrollTop: null, stick: false },
  );
});

test("rounds buttons inside the composer like the mobile composer", () => {
  const css = composerGlassCss;
  assert.match(
    css,
    /\[data-promptbox\] button:not\(:has\(img\)\),\s*\[data-scroll-footer\]\[data-bb-chat-ui-glass\] \[data-promptbox\] \[role="button"\]:not\(:has\(img\)\)\s*\{[^}]*border-radius:\s*999px !important;/,
  );
  assert.match(
    css,
    /\[data-promptbox-send-menu\]\s*\{[^}]*border-radius:\s*999px !important;/,
  );
  assert.doesNotMatch(
    css,
    /\[aria-label="Stop run"\]\s*\{[^}]*border-radius:\s*10px/,
  );
});

test("stacks each side independently above the to-do card", () => {
  const all = { width: 358, diffHeight: 32, agentation: true,
    agentationWidth: 160, queue: true, jumpHeight: 32, rightWidth: 32 };
  assert.deepEqual(composerControlsLayout(all), {
    height: 72, agentationBottom: 40, queueBottom: 40,
    agentationWidth: 318, queueWidth: 358,
  });
  assert.deepEqual(composerControlsLayout({ ...all, diffHeight: 0 }), {
    height: 72, agentationBottom: 0, queueBottom: 40,
    agentationWidth: 318, queueWidth: 358,
  });
  assert.deepEqual(composerControlsLayout({ ...all, jumpHeight: 0 }), {
    height: 72, agentationBottom: 40, queueBottom: 0,
    agentationWidth: 318, queueWidth: 190,
  });
  assert.deepEqual(composerControlsLayout({ ...all, queue: false, jumpHeight: 0, rightWidth: 0 }), {
    height: 72, agentationBottom: 40, queueBottom: 0,
    agentationWidth: 358, queueWidth: 358,
  });
  assert.equal(composerControlsLayout({ ...all, agentation: false }).height, 72);
  assert.equal(composerControlsLayout({ ...all, diffHeight: 48 }).queueBottom, 40);
  assert.equal(composerControlsLayout({ ...all, queue: false, rightWidth: 32 }).agentationWidth, 318);
});

test("anchors the actual Agentation box upward, including a contents plugin wrapper", () => {
  assert.match(composerGlassCss, /\[data-bb-chat-ui-agentation-slot\]\s*\{[^}]*position:\s*absolute;[^}]*height:\s*32px;/);
  assert.match(composerGlassCss, /\.agentation-staging-shell\s*\{[^}]*position:\s*absolute;[^}]*bottom:\s*0;/);
  assert.doesNotMatch(composerGlassCss, /repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(composerGlassCss, /section\[aria-label="To-do list"\]\s*\{[^}]*order:\s*2;/);
});

test("anchors jump-to-bottom by its bottom edge", () => {
  assert.match(composerGlassCss, /button\[aria-label="Scroll to latest event"\]\s*\{[^}]*position:\s*absolute;[^}]*top:\s*auto;[^}]*bottom:\s*var\(--bb-chat-ui-jump-bottom, 0px\);/);
  assert.doesNotMatch(composerGlassCss, /-mt-20/);
});

test("clears the bottom fade when there is no space below the composer", () => {
  const writes: string[] = [];
  const node = {
    style: {
      setProperty(_name: string, value: string) {
        writes.push(value);
      },
      removeProperty() {
        writes.push("cleared");
      },
    },
  };
  applyFadeHeight(node, 40.2);
  assert.deepEqual(writes, ["40px"]);
  applyFadeHeight(node, 0);
  assert.deepEqual(writes, ["40px", "cleared"]);
});


test("raises all composer controls over their own chat tone, including annotation staging", () => {
  assert.match(composerGlassCss, /\[data-thread-window\]\s*\{[^}]*--bb-chat-ui-glass-base:\s*var\(--background\)/);
  assert.match(composerGlassCss, /\[data-thread-window\]\[data-surface-tone="sidebar"\]\s*\{[^}]*--bb-chat-ui-glass-base:\s*var\(--sidebar\)/);
  assert.match(composerGlassCss, /\[data-promptbox-shell\] \.agentation-staging-shell[^{]*\{[^}]*background:/);
  assert.match(composerGlassCss, /\.agentation-staging-shell--expanded\s*\{[^}]*0 12px 32px -14px/);
});


test("strengthens only the composer specular highlight while keeping its soft edge", () => {
  const blocks = [...composerGlassCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, selector, body]) => selector.includes("[data-promptbox]") && !selector.includes(",") && body.includes("inset 0 1px"));
  assert.equal(blocks.length, 8);
  for (const [, selector, body] of blocks) {
    const strength = selector.includes(".dark") ? 14 : 60;
    assert.ok(body.includes(`inset 0 1px 3px color-mix(in oklab, white ${strength}%, transparent)`), selector);
  }
  const otherSurfaces = [...composerGlassCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, selector, body]) => (selector.includes(",") || selector.includes("agentation-staging-shell--expanded")) && body.includes("inset"));
  assert.equal(otherSurfaces.length, 4);
  for (const [, , body] of otherSurfaces) assert.ok(!body.includes("in oklab, white"));
});

test("frosts only the shared slash and at candidate box", () => {
  const blocks = [...composerGlassCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => ({
    selector: selector.trim(),
    body,
  }));
  const menus = blocks.filter((block) =>
    block.selector === '[class~="@container/mention-menu"]' || block.selector === '.dark [class~="@container/mention-menu"]',
  );
  assert.deepEqual(
    menus.map((block) => block.selector),
    ['[class~="@container/mention-menu"]', '.dark [class~="@container/mention-menu"]'],
  );
  const light = menus[0]?.body ?? "";
  const dark = menus[1]?.body ?? "";
  assert.ok(light.includes("background: transparent !important"));
  assert.ok(light.includes("border-color: transparent !important"));
  assert.ok(light.includes("border-radius: 18px !important"));
  assert.equal(light.includes(LIGHT_GLASS_FACE), false);
  assert.equal(light.includes("blur(14px)"), false);
  assert.ok(light.includes("0 12px 32px -14px color-mix(in oklab, var(--ink, var(--foreground)) 22%, transparent)"));
  assert.ok(light.includes("inset 0 1px 3px color-mix(in oklab, var(--popover) 35%, transparent)"));
  assert.equal(light.includes("white"), false);
  assert.equal(/\b(?:width|max-height|z-index)\s*:/.test(light), false);
  assert.equal(dark.includes(DARK_GLASS_FACE), false);
  assert.ok(dark.includes("border-color: transparent !important"));
  assert.ok(dark.includes("0 12px 32px -14px color-mix(in oklab, black 60%, transparent)"));
  assert.ok(dark.includes("inset 0 1px 3px color-mix(in oklab, var(--foreground) 8%, transparent)"));
  assert.equal(dark.includes("white"), false);
  assert.equal(blocks.some((block) => block.selector.includes("data-promptbox-typeahead-menu")), false);
  assert.equal(
    blocks.some((block) => /listbox|monaco-menu|plugin-interaction|ResponsiveDrawer/.test(block.selector)),
    false,
  );
});

test("lifts only an open mention composer face onto its before layer", () => {
  const blocks = [...composerGlassCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => ({
    selector: selector.trim().replace(/\s+/g, " "),
    body,
  }));
  const liftSelector = '[data-scroll-footer][data-bb-chat-ui-glass] [data-promptbox]:has([class~="@container/mention-menu"])';
  const lift = blocks.find((block) => block.selector === liftSelector);
  assert.ok(lift, "open mention composer");
  assert.match(lift.body, /background:\s*transparent !important;/);
  assert.match(lift.body, /backdrop-filter:\s*none !important;/);
  assert.match(lift.body, /-webkit-backdrop-filter:\s*none !important;/);
  assert.match(lift.body, /isolation:\s*isolate;/);
  assert.equal(lift.body.includes("box-shadow"), false);
  const darkFaceAt = composerGlassCss.indexOf(".dark [data-scroll-footer][data-bb-chat-ui-glass] [data-promptbox]");
  const liftAt = composerGlassCss.indexOf(`${liftSelector} {`);
  assert.ok(darkFaceAt >= 0 && liftAt > darkFaceAt);

  const before = blocks.find((block) => block.selector === `${liftSelector}::before`);
  assert.ok(before, "composer ::before");
  assert.match(before.body, /content:\s*"";/);
  assert.match(before.body, /position:\s*absolute;/);
  assert.match(before.body, /inset:\s*0;/);
  assert.match(before.body, /border-radius:\s*inherit;/);
  assert.match(before.body, /pointer-events:\s*none;/);
  assert.match(before.body, /z-index:\s*-1;/);
  assert.ok(before.body.includes(`background: ${LIGHT_GLASS_FACE};`));
  assert.match(before.body, /backdrop-filter:\s*blur\(14px\) saturate\(1\.25\);/);
  assert.match(before.body, /-webkit-backdrop-filter:\s*blur\(14px\) saturate\(1\.25\);/);
  assert.equal(before.body.includes("box-shadow"), false);

  const darkBefore = blocks.find((block) => block.selector === `.dark ${liftSelector}::before`);
  assert.ok(darkBefore, "dark composer ::before");
  assert.ok(darkBefore.body.includes(`background: ${DARK_GLASS_FACE};`));
  assert.equal(darkBefore.body.includes("0.68"), false);

  const header = blocks.find((block) => block.selector === '[class~="@container/mention-menu"] .sticky.bg-background');
  assert.ok(header, "sticky section header");
  assert.match(header.body, /background:\s*transparent !important;/);
  assert.match(header.body, /backdrop-filter:\s*blur\(14px\) saturate\(1\.25\);/);
  assert.match(header.body, /-webkit-backdrop-filter:\s*blur\(14px\) saturate\(1\.25\);/);
  assert.equal(header.body.includes(LIGHT_GLASS_FACE), false);
  assert.equal(header.body.includes(DARK_GLASS_FACE), false);

  assert.deepEqual(
    blocks.filter((block) => block.selector.includes("@container/mention-menu")).map((block) => block.selector),
    [
      '[class~="@container/mention-menu"]',
      '[class~="@container/mention-menu"]::before',
      '.dark [class~="@container/mention-menu"]::before',
      liftSelector,
      `${liftSelector}::before`,
      `.dark ${liftSelector}::before`,
      '[class~="@container/mention-menu"] .sticky.bg-background',
      '.dark [class~="@container/mention-menu"]',
      '[class~="@container/mention-menu"] > .overflow-y-auto',
      '[class~="@container/mention-menu"] button:not(:disabled):not([aria-disabled="true"])',
    ],
  );
  const closed = blocks.find((block) => block.selector.startsWith("[data-scroll-footer][data-bb-chat-ui-glass] [data-promptbox],"));
  assert.ok(closed);
  assert.ok(closed.body.includes(`background: ${LIGHT_GLASS_FACE} !important;`));
  assert.match(closed.body, /backdrop-filter:\s*blur\(14px\) saturate\(1\.25\);/);
  assert.equal(blocks.some((block) => /typeahead-menu|plugin-interaction|ResponsiveDrawer/.test(block.selector)), false);
});

test("lifts the mention menu face onto its own before layer", () => {
  const blocks = [...composerGlassCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => ({
    selector: selector.trim().replace(/\s+/g, " "),
    body,
  }));
  const root = blocks.find((block) => block.selector === '[class~="@container/mention-menu"]');
  assert.ok(root, "mention root");
  assert.match(root.body, /position:\s*relative;/);
  assert.match(root.body, /isolation:\s*isolate;/);
  assert.match(root.body, /background:\s*transparent !important;/);
  assert.match(root.body, /backdrop-filter:\s*none !important;/);
  assert.match(root.body, /-webkit-backdrop-filter:\s*none !important;/);
  assert.match(root.body, /border-radius:\s*18px !important;/);
  assert.ok(root.body.includes("0 12px 32px -14px color-mix(in oklab, var(--ink, var(--foreground)) 22%, transparent)"));
  assert.ok(root.body.includes("inset 0 1px 3px color-mix(in oklab, var(--popover) 35%, transparent)"));
  assert.equal(root.body.includes(LIGHT_GLASS_FACE), false);
  assert.equal(root.body.includes("blur(14px)"), false);

  const before = blocks.find((block) => block.selector === '[class~="@container/mention-menu"]::before');
  assert.ok(before, "mention ::before");
  assert.match(before.body, /content:\s*"";/);
  assert.match(before.body, /position:\s*absolute;/);
  assert.match(before.body, /inset:\s*0;/);
  assert.match(before.body, /border-radius:\s*inherit;/);
  assert.match(before.body, /pointer-events:\s*none;/);
  assert.match(before.body, /z-index:\s*-1;/);
  assert.ok(before.body.includes(`background: ${LIGHT_GLASS_FACE};`));
  assert.match(before.body, /backdrop-filter:\s*blur\(14px\) saturate\(1\.25\);/);
  assert.match(before.body, /-webkit-backdrop-filter:\s*blur\(14px\) saturate\(1\.25\);/);
  assert.equal(before.body.includes("box-shadow"), false);
  assert.equal(before.body.includes("18px"), false);

  const darkBefore = blocks.find((block) => block.selector === '.dark [class~="@container/mention-menu"]::before');
  assert.ok(darkBefore, "dark mention ::before");
  assert.ok(darkBefore.body.includes(`background: ${DARK_GLASS_FACE};`));
  assert.equal(darkBefore.body.includes("0.68"), false);
  assert.equal(darkBefore.body.includes("box-shadow"), false);

  const darkRoot = blocks.find((block) => block.selector === '.dark [class~="@container/mention-menu"]');
  assert.ok(darkRoot, "dark mention root");
  assert.equal(darkRoot.body.includes(DARK_GLASS_FACE), false);
  assert.equal(darkRoot.body.includes("backdrop-filter"), false);
  assert.ok(darkRoot.body.includes("0 12px 32px -14px color-mix(in oklab, black 60%, transparent)"));
  assert.ok(darkRoot.body.includes("inset 0 1px 3px color-mix(in oklab, var(--foreground) 8%, transparent)"));
});

test("points at enabled mention menu buttons", () => {
  const blocks = [...composerGlassCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => ({
    selector: selector.trim().replace(/\s+/g, " "),
    body,
  }));
  const pointed = blocks.filter((block) => /cursor\s*:/.test(block.body));
  assert.deepEqual(
    pointed.map((block) => block.selector),
    ['[class~="@container/mention-menu"] button:not(:disabled):not([aria-disabled="true"])'],
  );
  assert.match(pointed[0]?.body ?? "", /cursor:\s*pointer;/);
});

test("contains overscroll only on the mention candidate scroller", () => {
  const blocks = [...composerGlassCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => ({
    selector: selector.trim().replace(/\s+/g, " "),
    body,
  }));
  const contained = blocks.filter((block) => /overscroll-behavior\s*:/.test(block.body));
  assert.deepEqual(
    contained.map((block) => block.selector),
    ['[class~="@container/mention-menu"] > .overflow-y-auto'],
  );
  assert.match(contained[0]?.body ?? "", /overscroll-behavior:\s*contain;/);
  assert.equal(/addEventListener|onWheel|new MutationObserver|new IntersectionObserver/.test(composerGlassCss), false);
});
