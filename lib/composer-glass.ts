import { PHONE_NARROW, NARROW_VIEWPORT, ROOMY_VIEWPORT, isDesktopChrome, hasSmallHitTarget } from "./device-chrome.ts";
import { DARK_GLASS_FACE, LIGHT_GLASS_FACE, glassSurfaceScopeCss } from "./glass-surface.ts";
import { COMPOSER_HANDOFF_RESIZING, injectComposerHandoff } from "./composer-handoff.ts";

const FOOTER = "[data-scroll-footer]:has(.chat-prompt-box)";
// JS-set markers replace :has() where the rule subject is generic (measured: those make every
// transcript row insertion restyle the whole app while scrolling).
const GLASS_MARK = "data-bb-chat-ui-glass";
const FOOTER_MARK = `[data-scroll-footer][${GLASS_MARK}]`;
const AGENTATION_SLOT = "data-bb-chat-ui-agentation-slot";
const COMPACT_MARK = "data-bb-chat-ui-compact-footer";
const HAS_IMAGE = "data-bb-chat-ui-has-image";
const DIFF_SECTION = "data-bb-chat-ui-diff-section";
const PLATE = ":scope > .relative";
const COMPOSER = "[data-promptbox]";
const FADE_HEIGHT = "--bb-chat-ui-fade-height";
const PLATE_HEIGHT = "--bb-chat-ui-plate-height";
const JUMP_BOTTOM = "--bb-chat-ui-jump-bottom";
const CONTROLS = "data-bb-chat-ui-controls";
const CONTROLS_MOTION = "data-bb-chat-ui-controls-motion";
const PILL = "#thread-prompt-banner-git-toggle";
const JUMP_BUTTON = 'button[aria-label="Scroll to latest event"]';
const STACK = "[data-promptbox-shell] > .grid";

const FACE = `${FOOTER_MARK} [data-promptbox],
${FOOTER_MARK} ${PILL},
${FOOTER_MARK} ${JUMP_BUTTON},
${FOOTER_MARK} [data-promptbox-shell] .agentation-staging-shell`;

const INK = "var(--ink, var(--foreground))";
const LIGHT_COMPOSER_EDGE = "color-mix(in oklab, white 60%, transparent)";
const DARK_COMPOSER_EDGE = "color-mix(in oklab, white 14%, transparent)";
const LIGHT_EDGE = "color-mix(in oklab, var(--popover) 35%, transparent)";
const LIGHT_SHADOW = "color-mix(in oklab, var(--ink, var(--foreground)) 22%, transparent)";
const DARK_EDGE = "color-mix(in oklab, var(--foreground) 8%, transparent)";
const DARK_SHADOW = "color-mix(in oklab, black 60%, transparent)";

function darkScope(selectors: string): string {
  return selectors
    .split(",\n")
    .map((selector) => `.dark ${selector}`)
    .join(",\n");
}

export const COMPOSER_GLASS_STYLE_ID = "bb-chat-ui-composer-glass";
const COMPOSER_HEIGHT_MS = 360;
const COMPOSER_COLLAPSE_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const HOST_HEIGHT_TRANSITION = /height\s+240ms\b(?:\s+(?:cubic-bezier\([^)]*\)|[a-z-]+))?/;
const PIN_RELEASE_PX = 8;
const WIDE_RADIUS = "1.375rem";
// The native compact line is 48px plus two 1px borders. A finite endpoint
// avoids the early clamping caused by interpolating towards 999px.
const PILL_RADIUS = "25px";
const SHADOW_TRANSITION = "box-shadow 320ms cubic-bezier(0.2, 0.8, 0.2, 1)";
const COLLAPSE_TRANSITION = `height ${COMPOSER_HEIGHT_MS}ms ${COMPOSER_COLLAPSE_EASE}, border-radius ${COMPOSER_HEIGHT_MS}ms ${COMPOSER_COLLAPSE_EASE}`;

export const composerGlassCss = `
${glassSurfaceScopeCss}
[${COMPOSER_HANDOFF_RESIZING}] { overflow:clip !important; }

${FOOTER_MARK} > .relative {
  background: transparent !important;
}
${FOOTER_MARK} [data-overflow-fade="above"] {
  top: auto !important;
  right: 0 !important;
  bottom: 0 !important;
  left: 0 !important;
  height: var(--bb-chat-ui-fade-height, 0px) !important;
  background-image: linear-gradient(
    to bottom,
    transparent,
    color-mix(in srgb, var(--background) 12%, transparent) 45%,
    color-mix(in srgb, var(--background) 35%, transparent) 75%,
    color-mix(in srgb, var(--background) 65%, transparent) 90%,
    var(--background) 100%
  ) !important;
}
[data-thread-window][data-surface-tone="sidebar"] ${FOOTER_MARK} [data-overflow-fade="above"] {
  background-image: linear-gradient(
    to bottom,
    transparent,
    color-mix(in srgb, var(--sidebar) 12%, transparent) 45%,
    color-mix(in srgb, var(--sidebar) 35%, transparent) 75%,
    color-mix(in srgb, var(--sidebar) 65%, transparent) 90%,
    var(--sidebar) 100%
  ) !important;
}
${FACE} {
  background: ${LIGHT_GLASS_FACE} !important;
  border-color: transparent !important;
  backdrop-filter: blur(14px) saturate(1.25);
  -webkit-backdrop-filter: blur(14px) saturate(1.25);
  box-shadow:
    0 6px 18px -12px ${LIGHT_SHADOW},
    inset 0 1px 3px ${LIGHT_EDGE};
}
[class~="@container/mention-menu"] {
  position: relative;
  isolation: isolate;
  background: transparent !important;
  border-color: transparent !important;
  border-radius: 18px !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  box-shadow:
    0 12px 32px -14px ${LIGHT_SHADOW},
    inset 0 1px 3px ${LIGHT_EDGE};
}
[class~="@container/mention-menu"]::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  z-index: -1;
  pointer-events: none;
  background: ${LIGHT_GLASS_FACE};
  backdrop-filter: blur(14px) saturate(1.25);
  -webkit-backdrop-filter: blur(14px) saturate(1.25);
}
.dark [class~="@container/mention-menu"]::before {
  background: ${DARK_GLASS_FACE};
}
${FOOTER_MARK} [data-promptbox-shell] .agentation-staging-shell--expanded {
  box-shadow:
    0 12px 32px -14px ${LIGHT_SHADOW},
    inset 0 1px 3px ${LIGHT_EDGE};
}
${FOOTER_MARK} [data-follow-up-composer-anchor] [data-promptbox]:not([data-promptbox-compact]) [data-promptbox-editor-scroll] {
  min-height: min(68px,var(--bb-chat-ui-editor-max-height,68px)) !important;
}
/* Container collapse can omit data-promptbox-compact. Keep its native
   48px viewport rather than applying the expanded minimum. */
@container follow-up-composer style(--follow-up-composer-container-compact: true) {
  ${FOOTER_MARK} [data-follow-up-composer]:not([data-follow-up-composer-expanded]) [data-promptbox]:not([data-promptbox-voice-active]) [data-promptbox-editor-scroll] {
    min-height:min(48px,var(--bb-chat-ui-editor-max-height,48px)) !important;
  }
}
${FOOTER_MARK} [data-promptbox] {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  border-color: transparent !important;
  border-radius: 1.375rem !important;
  transition: ${SHADOW_TRANSITION};
  box-shadow:
    0 12px 32px -14px ${LIGHT_SHADOW},
    inset 0 1px 3px ${LIGHT_COMPOSER_EDGE};
}
  ${NARROW_VIEWPORT} ${FOOTER_MARK}[${COMPACT_MARK}] {
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    max-height: 100dvh;
  }
  ${NARROW_VIEWPORT} ${FOOTER_MARK}[${COMPACT_MARK}] > .relative,
  ${NARROW_VIEWPORT} ${FOOTER_MARK}[${COMPACT_MARK}] .chat-prompt-box,
  ${NARROW_VIEWPORT} ${FOOTER_MARK}[${COMPACT_MARK}] [data-promptbox-shell] {
    display: flex;
    min-height: 0;
    max-height: 100%;
    flex-direction: column;
    justify-content: flex-end;
  }
  ${NARROW_VIEWPORT} ${FOOTER_MARK}[${COMPACT_MARK}] [data-promptbox-shell] > .grid {
    min-height: 0;
    overflow-y: auto;
  }
  ${NARROW_VIEWPORT} ${FOOTER_MARK}[${COMPACT_MARK}] [data-follow-up-composer-anchor] {
    flex-shrink: 0;
  }

  ${ROOMY_VIEWPORT} ${FOOTER_MARK}[${COMPACT_MARK}] {
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
  }
  ${ROOMY_VIEWPORT} ${FOOTER_MARK}[${COMPACT_MARK}] > .relative,
  ${ROOMY_VIEWPORT} ${FOOTER_MARK}[${COMPACT_MARK}] .chat-prompt-box,
  ${ROOMY_VIEWPORT} ${FOOTER_MARK}[${COMPACT_MARK}] [data-promptbox-shell] {
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
  }
  ${ROOMY_VIEWPORT} ${FOOTER_MARK}[${COMPACT_MARK}] [data-follow-up-composer-anchor] {
    flex-shrink: 0;
  }

  ${FOOTER_MARK} [data-promptbox] {
    transition:
      ${SHADOW_TRANSITION},
      ${COLLAPSE_TRANSITION};
  }

@media (prefers-reduced-motion: reduce) {
  ${FOOTER_MARK} [data-promptbox] {
    transition: ${SHADOW_TRANSITION};
  }
}
${FOOTER_MARK} [data-promptbox][data-promptbox-compact] {
  border-radius: ${PILL_RADIUS} !important;
}
${FOOTER_MARK} [data-promptbox][data-promptbox-compact]:has([aria-label="Exit handoff"]) {
  border-radius: 1.375rem !important;
}
${FOOTER_MARK} [data-promptbox] button:not([${HAS_IMAGE}]),
${FOOTER_MARK} [data-promptbox] [role="button"]:not([${HAS_IMAGE}]) {
  border-radius: 999px !important;
}
${FOOTER_MARK} [data-promptbox] [data-promptbox-send-menu] {
  border-radius: 999px !important;
}
${FOOTER_MARK} [data-promptbox]:focus-within {
  border-color: transparent !important;
  box-shadow:
    0 18px 44px -16px color-mix(in oklab, ${INK} 34%, transparent),
    inset 0 1px 3px ${LIGHT_COMPOSER_EDGE};
}
${darkScope(FACE)} {
  background: ${DARK_GLASS_FACE} !important;
  border-color: transparent !important;
  box-shadow:
    0 6px 18px -12px ${DARK_SHADOW},
    inset 0 1px 3px ${DARK_EDGE};
}
${FOOTER_MARK} [data-promptbox]:has([class~="@container/mention-menu"]) {
  background: transparent !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  isolation: isolate;
}
${FOOTER_MARK} [data-promptbox]:has([class~="@container/mention-menu"])::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  z-index: -1;
  background: ${LIGHT_GLASS_FACE};
  backdrop-filter: blur(14px) saturate(1.25);
  -webkit-backdrop-filter: blur(14px) saturate(1.25);
}
.dark ${FOOTER_MARK} [data-promptbox]:has([class~="@container/mention-menu"])::before {
  background: ${DARK_GLASS_FACE};
}
[class~="@container/mention-menu"] .sticky.bg-background {
  background: transparent !important;
  backdrop-filter: blur(14px) saturate(1.25);
  -webkit-backdrop-filter: blur(14px) saturate(1.25);
}
.dark [class~="@container/mention-menu"] {
  border-color: transparent !important;
  box-shadow:
    0 12px 32px -14px ${DARK_SHADOW},
    inset 0 1px 3px ${DARK_EDGE};
}
[class~="@container/mention-menu"] > .overflow-y-auto {
  overscroll-behavior: contain;
}
[class~="@container/mention-menu"] button:not(:disabled):not([aria-disabled="true"]) {
  cursor: pointer;
}
${darkScope(`${FOOTER_MARK} [data-promptbox-shell] .agentation-staging-shell--expanded`)} {
  box-shadow:
    0 12px 32px -14px ${DARK_SHADOW},
    inset 0 1px 3px ${DARK_EDGE};
}
${darkScope(`${FOOTER_MARK} [data-promptbox]`)} {
  border-color: transparent !important;
  box-shadow:
    0 12px 32px -14px ${DARK_SHADOW},
    inset 0 1px 3px ${DARK_COMPOSER_EDGE};
}
${darkScope(`${FOOTER_MARK} [data-promptbox]:focus-within`)} {
  border-color: transparent !important;
  box-shadow:
    0 18px 44px -16px color-mix(in oklab, ${INK} 34%, transparent),
    inset 0 1px 3px ${DARK_COMPOSER_EDGE};
}
  ${PHONE_NARROW} ${FOOTER_MARK} [data-promptbox] {
    box-shadow:
      0 6px 16px -10px ${LIGHT_SHADOW},
      inset 0 1px 3px ${LIGHT_COMPOSER_EDGE};
  }
  ${PHONE_NARROW} ${FOOTER_MARK} [data-promptbox]:focus-within {
    box-shadow:
      0 8px 20px -12px color-mix(in oklab, ${INK} 34%, transparent),
      inset 0 1px 3px ${LIGHT_COMPOSER_EDGE};
  }
  ${PHONE_NARROW}.dark ${FOOTER_MARK} [data-promptbox] {
    box-shadow:
      0 6px 16px -10px ${DARK_SHADOW},
      inset 0 1px 3px ${DARK_COMPOSER_EDGE};
  }
  ${PHONE_NARROW}.dark ${FOOTER_MARK} [data-promptbox]:focus-within {
    box-shadow:
      0 8px 20px -12px color-mix(in oklab, ${INK} 34%, transparent),
      inset 0 1px 3px ${DARK_COMPOSER_EDGE};
  }
${FOOTER_MARK} .chat-prompt-box {
  position: relative;
}
${FOOTER_MARK} ${JUMP_BUTTON} {
  position: absolute;
  width: 32px !important;
  height: 32px !important;
  min-width: 32px !important;
  min-height: 32px !important;
  margin-top: 0 !important;
  top: auto;
  bottom: var(${JUMP_BOTTOM}, 0px);
  right: 1rem;
  left: auto;
  transform: none;
  z-index: 21;
}
${FOOTER_MARK} ${STACK} {
  position: relative;
  grid-template-columns: minmax(0, 1fr);
  overflow: visible !important;
}
${FOOTER_MARK} ${STACK} > * {
  order: 0;
}
${FOOTER_MARK} ${STACK}[${CONTROLS}]::after {
  content: "";
  order: 1;
  height: var(--bb-chat-ui-controls-height);
}
${FOOTER_MARK} ${STACK} > section[aria-label="To-do list"] {
  order: 2;
}
${FOOTER_MARK} ${STACK} section[${DIFF_SECTION}] {
  position: absolute;
  bottom: var(--bb-chat-ui-controls-bottom, 0px);
  left: 0;
  max-width: var(--bb-chat-ui-agentation-width, 100%);
}
${FOOTER_MARK} ${STACK} [${AGENTATION_SLOT}] {
  position: absolute;
  bottom: calc(var(--bb-chat-ui-controls-bottom, 0px) + var(--bb-chat-ui-agentation-bottom, 0px));
  left: 0;
  width: var(--bb-chat-ui-agentation-width, 100%);
  min-width: 0;
  height: 32px;
  z-index: 40;
  overflow: visible;
}
${FOOTER_MARK} ${STACK} .agentation-staging-shell {
  position: absolute;
  bottom: 0;
  left: 0;
  max-width: 100%;
}
${FOOTER_MARK} ${STACK} .agentation-staging-shell:not(.agentation-staging-shell--expanded) {
  height: 32px;
  overflow: clip;
  justify-content: center;
}
${FOOTER_MARK} ${STACK} .agentation-staging-shell > .grid {
  position: relative;
}
${FOOTER_MARK} ${STACK} .agentation-staging-shell:not(.agentation-staging-shell--expanded) > div:first-child {
  padding-top: 4px;
  padding-bottom: 4px;
}
${FOOTER_MARK} ${STACK} .agentation-staging-shell--expanded {
  width: 100%;
  max-width: none;
}
${FOOTER_MARK} ${STACK} > section[aria-label="Queued messages"] {
  position: absolute !important;
  bottom: var(--bb-chat-ui-controls-bottom, 0px);
  transform: translateY(calc(-1 * var(--bb-chat-ui-queue-bottom, 0px)));
  right: 0;
  width: 100%;
}
${FOOTER_MARK} ${STACK}[${CONTROLS_MOTION}] [${AGENTATION_SLOT}] {
  transition: width 260ms cubic-bezier(0.16, 1, 0.3, 1);
}
${FOOTER_MARK} ${STACK}[${CONTROLS_MOTION}] > section[aria-label="Queued messages"] {
  transition: transform 260ms cubic-bezier(0.16, 1, 0.3, 1);
}
@media (prefers-reduced-motion: reduce) {
  ${FOOTER_MARK} ${STACK}[${CONTROLS_MOTION}] [${AGENTATION_SLOT}],
  ${FOOTER_MARK} ${STACK}[${CONTROLS_MOTION}] > section[aria-label="Queued messages"] {
    transition: none;
  }
}

`;

export interface PlateHeightTarget {
  style: {
    setProperty(name: string, value: string): void;
    removeProperty(name: string): void;
  };
}

export function fadeHeight(input: {
  plateBottom: number;
  composerTop: number;
  composerHeight: number;
}): number {
  const gap = input.plateBottom - (input.composerTop + input.composerHeight);
  if (!Number.isFinite(gap) || !Number.isFinite(input.composerHeight) || gap < 0 || input.composerHeight <= 0) return 0;
  // A soft tail starts above the composer and settles into the canvas at the bottom.
  return Math.round(input.composerHeight + gap + 64);
}

export function composerCornerRadius(compact: boolean, handoff: boolean): string {
  return compact && !handoff ? PILL_RADIUS : WIDE_RADIUS;
}

export function composerRadiusChange(input: {
  previousCompact: boolean;
  nextCompact: boolean;
  handoff: boolean;
  smallHitTarget: boolean;
  reducedMotion: boolean;
}): { from: string; to: string } | null {
  if (input.previousCompact === input.nextCompact) return null;
  if (input.reducedMotion) return null;
  const from = composerCornerRadius(input.previousCompact, input.handoff);
  const to = composerCornerRadius(input.nextCompact, input.handoff);
  if (from === to) return null;
  return { from, to };
}

function unitBezier(p1: number, p2: number, t: number): number {
  const rest = 1 - t;
  return 3 * rest * rest * t * p1 + 3 * rest * t * t * p2 + t * t * t;
}

function collapseProgress(elapsedMs: number, durationMs: number): number {
  if (!(durationMs > 0)) return 1;
  const x = Math.min(1, Math.max(0, elapsedMs / durationMs));
  if (x === 0 || x === 1) return x;
  let low = 0;
  let high = 1;
  for (let step = 0; step < 24; step += 1) {
    const mid = (low + high) / 2;
    if (unitBezier(0.22, 0.36, mid) < x) low = mid;
    else high = mid;
  }
  return unitBezier(1, 1, (low + high) / 2);
}

export function composerCollapseHeight(input: {
  from: number;
  to: number;
  elapsedMs: number;
  durationMs: number;
}): number {
  const progress = collapseProgress(input.elapsedMs, input.durationMs);
  return input.from + (input.to - input.from) * progress;
}

export function composerHeightTransition(current: string): string | null {
  if (!HOST_HEIGHT_TRANSITION.test(current)) return null;
  return `${current.replace(HOST_HEIGHT_TRANSITION, `height ${COMPOSER_HEIGHT_MS}ms ${COMPOSER_COLLAPSE_EASE}`)}, border-radius ${COMPOSER_HEIGHT_MS}ms ${COMPOSER_COLLAPSE_EASE}`;
}

function parsePx(value: string): number | null {
  if (!value.endsWith("px")) return null;
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

export interface ComposerHeightMotion {
  from: number;
  to: number;
  startedAt: number;
  durationMs: number;
}

export function planComposerHeight(input: {
  transition: string;
  height: string;
  now: number;
  idleHeight: number;
  motion: ComposerHeightMotion | null;
}): {
  motion: ComposerHeightMotion | null;
  rewrite: { from: number; to: number; transition: string } | null;
  resume: { from: number; to: number; remainingMs: number; transition: string } | null;
} {
  const none = { motion: input.motion, rewrite: null, resume: null };
  const lengthened = composerHeightTransition(input.transition);
  if (lengthened) {
    const to = parsePx(input.height);
    if (to == null || !(input.idleHeight > 0)) return none;
    return {
      motion: {
        from: input.idleHeight,
        to,
        startedAt: input.now,
        durationMs: COMPOSER_HEIGHT_MS,
      },
      rewrite: { from: input.idleHeight, to, transition: lengthened },
      resume: null,
    };
  }
  if (!input.motion || input.height !== "") return none;
  const elapsed = input.now - input.motion.startedAt;
  if (elapsed >= input.motion.durationMs) {
    return { motion: null, rewrite: null, resume: null };
  }
  return {
    motion: input.motion,
    rewrite: null,
    resume: {
      from: input.motion.from,
      to: input.motion.to,
      remainingMs: input.motion.durationMs - elapsed,
      transition: `height ${input.motion.durationMs}ms ${COMPOSER_COLLAPSE_EASE} -${elapsed}ms, border-radius ${input.motion.durationMs}ms ${COMPOSER_COLLAPSE_EASE} -${elapsed}ms`,
    },
  };
}

const VISUAL_BOTTOM_PX = 8;

export function desktopCollapseStick(input: {
  desktop: boolean;
  scrollGap: number;
  footerBottom: number;
  scrollerBottom: number;
}): boolean {
  if (input.scrollGap <= 4) return true;
  if (!input.desktop) return false;
  return Math.abs(input.scrollerBottom - input.footerBottom) <= VISUAL_BOTTOM_PX;
}

export function composerLift(input: {
  desktop: boolean;
  stick: boolean;
  scrollerBottom: number;
  plateBottom: number;
}): string | null {
  if (!input.desktop || !input.stick) return null;
  const delta = input.scrollerBottom - input.plateBottom;
  if (Math.abs(delta) < 1) return null;
  return `translateY(${delta}px)`;
}

export function nextPinnedScroll(input: {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  stick: boolean;
  lastPinned: number | null;
}): { scrollTop: number | null; stick: boolean } {
  if (!input.stick) return { scrollTop: null, stick: false };
  const max = Math.max(0, input.scrollHeight - input.clientHeight);
  const userMovedUp =
    input.lastPinned != null &&
    input.scrollTop < input.lastPinned - PIN_RELEASE_PX &&
    input.scrollTop < max - 1;
  if (userMovedUp) return { scrollTop: null, stick: false };
  if (Math.abs(max - input.scrollTop) < 1) return { scrollTop: null, stick: true };
  return { scrollTop: max, stick: true };
}

// Establish both starting values before one layout flush. Native inline height
// cleanup resumes this same pair with the same negative delay, including on phone.
export function applyComposerRadius(
  element: {
    style: {
      setProperty(name: string, value: string, priority?: string): void;
      height: string;
      transition: string;
    };
    getBoundingClientRect(): unknown;
  },
  change: { from: string; to: string },
  height?: { from: number; to: number; transition: string },
): void {
  element.style.transition = "none";
  if (height) element.style.height = `${height.from}px`;
  element.style.setProperty("border-radius", change.from, "important");
  element.getBoundingClientRect();
  element.style.transition = height?.transition ?? `border-radius ${COMPOSER_HEIGHT_MS}ms ${COMPOSER_COLLAPSE_EASE}`;
  if (height) element.style.height = `${height.to}px`;
  element.style.setProperty("border-radius", change.to, "important");
}

export function applyFadeHeight(node: PlateHeightTarget, height: number): void {
  if (!Number.isFinite(height) || height <= 0) {
    node.style.removeProperty(FADE_HEIGHT);
    return;
  }
  node.style.setProperty(FADE_HEIGHT, `${Math.round(height)}px`);
}

export function composerControlsLayout(input: {
  width: number;
  diffHeight: number;
  agentation: boolean;
  agentationWidth: number;
  queue: boolean;
  jumpHeight: number;
  rightWidth: number;
}): {
  height: number;
  agentationBottom: number;
  queueBottom: number;
  agentationWidth: number;
  queueWidth: number;
} {
  const agentationBottom = input.diffHeight > 0 ? input.diffHeight + 8 : 0;
  const queueBottom = input.jumpHeight > 0 ? input.jumpHeight + 8 : 0;
  const leftHeight = input.agentation ? agentationBottom + 32 : input.diffHeight;
  const rightHeight = input.queue ? queueBottom + 32 : input.jumpHeight;
  const queueOverlapsAgentation = input.queue && input.agentation &&
    agentationBottom + 32 > queueBottom + 32 + 8;
  return {
    height: Math.max(leftHeight, rightHeight),
    agentationBottom,
    queueBottom,
    agentationWidth: Math.max(0, input.width - (input.rightWidth > 0 ? input.rightWidth + 8 : 0)),
    queueWidth: Math.max(0, input.width - (queueOverlapsAgentation ? input.agentationWidth + 8 : 0)),
  };
}

// Mount composer glass styling and scoped native layout transitions.
export function injectComposerGlass(document: Document): () => void {
  const style = document.createElement("style");
  style.id = COMPOSER_GLASS_STYLE_ID;
  style.textContent = composerGlassCss;
  document.head.append(style);

  let observed: Element | null = null;
  let observer: ResizeObserver | null = null;
  const stackWatches = new Map<HTMLElement, { stack:Element; observer:MutationObserver }>();
  const radiusWatches = new Map<HTMLElement, () => void>();
  const idleHeights = new WeakMap<HTMLElement, number>();
  const animating = new WeakSet<HTMLElement>();

  // Bind native compact sizing and handoff motion to each composer lifecycle.
  const bindComposerRadius = (composer: HTMLElement) => {
    if (radiusWatches.has(composer) || typeof MutationObserver === "undefined") return;
    const stopHandoff = injectComposerHandoff(composer);
    let compact = composer.hasAttribute("data-promptbox-compact");
    let radiusMotion: { from: string; to: string; startedAt: number } | null = null;
    let motion: ComposerHeightMotion | null = null;
    let finishTimer = 0;
    let pinFrame = 0;
    let pinning = false;
    let lastPinned: number | null = null;
    let anchorHold: { node: HTMLElement; previous: string } | null = null;
    let liftPlate: HTMLElement | null = null;
    let radiusEnd: ((event: TransitionEvent) => void) | null = null;
    const viewOf = () => composer.ownerDocument.defaultView;

    const clearDesktopHold = () => {
      if (anchorHold) {
        anchorHold.node.style.overflowAnchor = anchorHold.previous;
        anchorHold = null;
      }
      if (liftPlate) {
        liftPlate.style.transform = "";
        liftPlate = null;
      }
    };

    const stopPin = () => {
      const view = viewOf();
      if (pinFrame && view) view.cancelAnimationFrame(pinFrame);
      pinFrame = 0;
      pinning = false;
      lastPinned = null;
      clearDesktopHold();
    };

    const stopFinish = () => {
      const view = viewOf();
      if (finishTimer && view) view.clearTimeout(finishTimer);
      finishTimer = 0;
    };

    const scrollerOf = () => {
      const scroller = composer.closest(".thread-scrollbar");
      return scroller instanceof HTMLElement ? scroller : null;
    };

    const keepScroll = (scroller: HTMLElement | null, scrollTop: number | null) => {
      if (scroller && scrollTop != null) scroller.scrollTop = scrollTop;
    };

    const startPin = () => {
      const view = viewOf();
      const scroller = scrollerOf();
      stopPin();
      if (!view || !scroller) return;
      const desktop = isDesktopChrome(document);
      const footer = composer.closest("[data-scroll-footer]");
      const footerEl = footer instanceof HTMLElement ? footer : null;
      const scrollerBottom = scroller.getBoundingClientRect().bottom;
      const stick = desktopCollapseStick({
        desktop,
        scrollGap: scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop,
        footerBottom: footerEl?.getBoundingClientRect().bottom ?? scrollerBottom,
        scrollerBottom,
      });
      if (!stick) return;
      if (desktop) {
        const content = scroller.firstElementChild;
        if (content instanceof HTMLElement) {
          anchorHold = { node: content, previous: content.style.overflowAnchor };
          content.style.overflowAnchor = "none";
        }
        const plate = footerEl?.querySelector(":scope > .relative");
        if (plate instanceof HTMLElement) liftPlate = plate;
      }
      pinning = true;
      lastPinned = scroller.scrollTop;
      const tick = () => {
        pinFrame = 0;
        if (!pinning) return;
        const node = scrollerOf();
        if (!node) {
          pinning = false;
          clearDesktopHold();
          return;
        }
        const planned = nextPinnedScroll({
          scrollTop: node.scrollTop,
          scrollHeight: node.scrollHeight,
          clientHeight: node.clientHeight,
          stick: true,
          lastPinned,
        });
        if (!planned.stick) {
          pinning = false;
          lastPinned = null;
          clearDesktopHold();
          return;
        }
        if (planned.scrollTop != null) node.scrollTop = planned.scrollTop;
        lastPinned = node.scrollTop;
        if (liftPlate) {
          const previousLift = liftPlate.style.transform;
          liftPlate.style.transform = "none";
          const plateBottom = liftPlate.getBoundingClientRect().bottom;
          liftPlate.style.transform = previousLift;
          const lift = composerLift({
            desktop: true,
            stick: true,
            scrollerBottom: node.getBoundingClientRect().bottom,
            plateBottom,
          });
          liftPlate.style.transform = lift ?? "";
        }
        pinFrame = view.requestAnimationFrame(tick);
      };
      pinFrame = view.requestAnimationFrame(tick);
    };

    const clearRadius = () => {
      if (radiusEnd) composer.removeEventListener("transitionend", radiusEnd);
      radiusEnd = null;
      if (radiusMotion) composer.style.removeProperty("border-radius");
      radiusMotion = null;
    };

    const finishMotion = () => {
      motion = null;
      animating.delete(composer);
      composer.style.transition = "none";
      composer.style.height = "";
      clearRadius();
      const height = composer.getBoundingClientRect().height;
      if (height > 0) idleHeights.set(composer, height);
      composer.style.transition = "";
      composer.style.willChange = "";
      composer.style.overflow = "";
      stopPin();
    };

    const changes = new MutationObserver(() => {
      const nextCompact = composer.hasAttribute("data-promptbox-compact");
      const view = viewOf();
      const now = view?.performance.now() ?? 0;
      const handoff = composer.querySelector('[aria-label="Exit handoff"]') != null;
      const change = composerRadiusChange({
        previousCompact: compact,
        nextCompact,
        handoff,
        smallHitTarget: hasSmallHitTarget(document),
        reducedMotion:
          view?.matchMedia("(prefers-reduced-motion: reduce)").matches ?? false,
      });
      compact = nextCompact;
      const footer = composer.closest("[data-scroll-footer]");
      if (footer) {
        const compact = footer.querySelector("[data-promptbox-compact]") !== null;
        toggleMark(footer, COMPACT_MARK, compact);
        if (compact) markerNodes.get(COMPACT_MARK)!.add(footer);
        else markerNodes.get(COMPACT_MARK)!.delete(footer);
      }
      if (change != null) {
        // Native transition:none can already have snapped the computed radius to its
        // old target. Sample our shared curve instead, without per-frame layout reads.
        const px = (value: string) => Number.parseFloat(value) * (value.endsWith("rem")
          ? Number.parseFloat(view?.getComputedStyle(document.documentElement).fontSize ?? "") || 16 : 1);
        radiusMotion = {
          from: radiusMotion ? `${composerCollapseHeight({
            from: px(radiusMotion.from), to: px(radiusMotion.to),
            elapsedMs: now - radiusMotion.startedAt, durationMs: COMPOSER_HEIGHT_MS,
          })}px` : change.from,
          to: change.to,
          startedAt: now,
        };
        if (radiusEnd) composer.removeEventListener("transitionend", radiusEnd);
        const onEnd = (event: TransitionEvent) => {
          if (event.target !== composer || !event.propertyName.startsWith("border-")) return;
          if (!motion) {
            clearRadius();
            composer.style.transition = "";
          }
        };
        radiusEnd = onEnd;
        composer.addEventListener("transitionend", onEnd);
      }

      const reducedMotion = view?.matchMedia("(prefers-reduced-motion: reduce)").matches ?? false;
      if (reducedMotion && (motion || HOST_HEIGHT_TRANSITION.test(composer.style.transition))) {
        stopFinish();
        finishMotion();
        composer.style.transition = "none";
        return;
      }
      const plan = planComposerHeight({
        transition: composer.style.transition,
        height: composer.style.height,
        now,
        idleHeight: motion && change ? composer.getBoundingClientRect().height : idleHeights.get(composer) ?? 0,
        motion,
      });
      if (plan.rewrite) {
        stopFinish();
        motion = plan.motion;
        animating.add(composer);
        const scroller = scrollerOf();
        const savedScroll = scroller?.scrollTop ?? null;
        radiusMotion ??= {
          from: composerCornerRadius(compact, handoff),
          to: composerCornerRadius(compact, handoff),
          startedAt: now,
        };
        applyComposerRadius(composer, radiusMotion, plan.rewrite);
        keepScroll(scroller, savedScroll);
        startPin();
        return;
      }
      if (plan.resume) {
        motion = plan.motion;
        animating.add(composer);
        const scroller = scrollerOf();
        const savedScroll = scroller?.scrollTop ?? null;
        radiusMotion ??= {
          from: composerCornerRadius(compact, handoff),
          to: composerCornerRadius(compact, handoff),
          startedAt: now,
        };
        applyComposerRadius(composer, radiusMotion, plan.resume);
        composer.style.overflow = "hidden";
        composer.style.willChange = "height";
        keepScroll(scroller, savedScroll);
        if (!view) return;
        stopFinish();
        finishTimer = view.setTimeout(() => {
          finishTimer = 0;
          finishMotion();
        }, plan.resume.remainingMs);
        return;
      }
      if (change && radiusMotion) applyComposerRadius(composer, radiusMotion);
      if (motion && !plan.motion) {
        stopFinish();
        finishMotion();
      }
    });
    changes.observe(composer, {
      attributes: true,
      attributeFilter: ["data-promptbox-compact", "style"],
    });
    radiusWatches.set(composer, () => {
      stopHandoff();
      changes.disconnect();
      clearRadius();
      stopFinish();
      if (motion) finishMotion();
      else stopPin();
      animating.delete(composer);
    });
  };

  const releaseDetachedComposers = () => {
    for (const [composer, stop] of radiusWatches) {
      if (composer.isConnected) continue;
      stop();
      radiusWatches.delete(composer);
    }
  };

  // Layout reads inside mutation callbacks force a full style+layout per React commit.
  // Coalesce every trigger into one frame-aligned sync instead.
  let syncFrame = 0;
  const scheduleSync = () => {
    const view = document.defaultView;
    if (syncFrame || !view) return;
    syncFrame = view.requestAnimationFrame(() => { syncFrame = 0; sync(); });
  };
  const glassFooters = new Set<HTMLElement>();
  const markerNodes = new Map<string, Set<Element>>([COMPACT_MARK, HAS_IMAGE, DIFF_SECTION].map(name => [name, new Set<Element>()]));
  const releaseDetachedMarkers = () => {
    for (const [name, nodes] of markerNodes) for (const node of nodes) if (!node.isConnected || !node.closest(FOOTER)) {
      node.removeAttribute(name); nodes.delete(node);
    }
  };
  const syncFooterMarkers = (footers: Iterable<HTMLElement>) => {
    const compact = new Set<Element>(), images = new Set<Element>(), sections = new Set<Element>();
    for (const footer of footers) {
      if (footer.querySelector("[data-promptbox-compact]")) compact.add(footer);
      for (const button of Array.from(footer.querySelectorAll('[data-promptbox] button, [data-promptbox] [role="button"]'))) if (button.querySelector("img")) images.add(button);
      const section = footer.querySelector(STACK)?.querySelector(PILL)?.closest("section");
      if (section) sections.add(section);
    }
    // Reconcile all footers together: a node moved between them keeps its new marker.
    for (const [name, current] of [[COMPACT_MARK, compact], [HAS_IMAGE, images], [DIFF_SECTION, sections]] as const) {
      for (const node of markerNodes.get(name)!) if (!current.has(node)) toggleMark(node, name, false);
      for (const node of current) toggleMark(node, name, true);
      markerNodes.set(name, current);
    }
  };
  const sync = () => {
    releaseDetachedComposers();
    const footers = document.querySelectorAll(FOOTER);
    const currentFooters = new Set(Array.from(footers).filter((node): node is HTMLElement => node instanceof HTMLElement));
    syncFooterMarkers(currentFooters);
    for (let index = 0; index < footers.length; index += 1) {
      const footerNode = footers.item(index);
      if (!(footerNode instanceof HTMLElement)) continue;
      currentFooters.add(footerNode);
      if (!footerNode.hasAttribute(GLASS_MARK)) footerNode.setAttribute(GLASS_MARK, "");
      // Read before writes; the fade belongs to its leaf, not the whole composer subtree.
      const fade = readFade(footerNode);
      const composers = footerNode.querySelectorAll(COMPOSER);
      for (let composerIndex = 0; composerIndex < composers.length; composerIndex += 1) {
        const composer = composers.item(composerIndex);
        if (!(composer instanceof HTMLElement)) continue;
        bindComposerRadius(composer);
        if (!animating.has(composer)) {
          const height = composer.getBoundingClientRect().height;
          if (height > 0) idleHeights.set(composer, height);
        }
      }
      alignComposerControls(footerNode);
      if (fade) applyFadeHeight(fade.target, fade.height);
    }
    for (const node of glassFooters) if (!currentFooters.has(node)) node.removeAttribute(GLASS_MARK);
    glassFooters.clear();
    for (const node of currentFooters) glassFooters.add(node);
    bindStacks(currentFooters);
    const footer = document.querySelector(FOOTER);
    if (footer === observed || typeof ResizeObserver === "undefined") return;
    observer?.disconnect();
    observer = null;
    observed = footer;
    if (footer instanceof HTMLElement) {
      observer = new ResizeObserver(() => {
        scheduleSync();
      });
      observer.observe(footer);
    }
  };

  const releaseDetachedStacks = () => {
    for (const [footer, watch] of stackWatches) if (!footer.isConnected || !footer.matches(FOOTER) || !watch.stack.isConnected) {
      watch.observer.disconnect(); stackWatches.delete(footer);
    }
  };
  const bindStacks = (footers: Iterable<HTMLElement>) => {
    releaseDetachedStacks();
    for (const footer of footers) {
      const stack = footer.querySelector(STACK);
      const old = stackWatches.get(footer);
      if (old?.stack === stack) continue;
      old?.observer.disconnect(); stackWatches.delete(footer);
      if (!stack || typeof MutationObserver === "undefined") continue;
      const observer = new MutationObserver(scheduleSync);
      observer.observe(footer, {
        childList: true, subtree: true, attributes: true,
        attributeFilter: ["class", "role", "id", "data-queued-messages-mode"],
      });
      stackWatches.set(footer, { stack, observer });
    }
  };

  let mutations: MutationObserver | null = null;
  if (document.body && typeof MutationObserver !== "undefined") {
    mutations = new MutationObserver((records) => {
      if (records.some(record => record.removedNodes.length > 0)) {
        releaseDetachedComposers();
        releaseDetachedMarkers();
        if (observed && (!observed.isConnected || !observed.matches(FOOTER))) { observer?.disconnect(); observer = null; observed = null; }
        releaseDetachedStacks();
        for (const node of glassFooters) if (!node.isConnected || !node.matches(FOOTER)) { node.removeAttribute(GLASS_MARK); glassFooters.delete(node); }
        if (!document.querySelector(FOOTER)) {
          if (syncFrame) document.defaultView?.cancelAnimationFrame(syncFrame);
          syncFrame = 0;
          return;
        }
      }
      // Discover once; bind motion now without forcing deferred geometry work.
      let addedComposer = false;
      const discovery = `${COMPOSER}, [data-scroll-footer], .chat-prompt-box`;
      for (const record of records) for (const node of Array.from(record.addedNodes)) {
        if (!(node instanceof HTMLElement)) continue;
        const matches = [...(node.matches(discovery) ? [node] : []), ...Array.from(node.querySelectorAll<HTMLElement>(discovery))];
        if (matches.length) addedComposer = true;
        for (const candidate of matches) if (candidate.matches(COMPOSER) && candidate.closest(FOOTER)) bindComposerRadius(candidate);
      }
      if (observed instanceof HTMLElement && observed.isConnected && stackWatches.has(observed) && !addedComposer) return;
      scheduleSync();
    });
    mutations.observe(document.body, { childList: true, subtree: true });
  }
  sync();

  return () => {
    if (syncFrame) document.defaultView?.cancelAnimationFrame(syncFrame);
    for (const node of glassFooters) node.removeAttribute(GLASS_MARK);
    glassFooters.clear();
    for (const [name, nodes] of markerNodes) { for (const node of nodes) node.removeAttribute(name); nodes.clear(); }
    for (const node of Array.from(document.querySelectorAll(`[${AGENTATION_SLOT}]`))) node.removeAttribute(AGENTATION_SLOT);
    mutations?.disconnect();
    for (const watch of stackWatches.values()) watch.observer.disconnect();
    stackWatches.clear();
    observer?.disconnect();
    for (const stop of radiusWatches.values()) stop();
    radiusWatches.clear();
    style.remove();
    const frames = document.querySelectorAll("[data-thread-window]");
    for (let index = 0; index < frames.length; index += 1) {
      const frame = frames.item(index);
      if (frame instanceof HTMLElement) frame.style.removeProperty(PLATE_HEIGHT);
    }
    const plates = document.querySelectorAll(`${FOOTER} [data-overflow-fade="above"]`);
    for (let index = 0; index < plates.length; index += 1) {
      const plate = plates.item(index);
      if (plate instanceof HTMLElement) plate.style.removeProperty(FADE_HEIGHT);
    }
    for (const stack of Array.from(document.querySelectorAll(STACK))) {
      stack.removeAttribute(CONTROLS);
      stack.removeAttribute(CONTROLS_MOTION);
      if (!(stack instanceof HTMLElement)) continue;
      for (const name of ["controls-height", "controls-bottom", "agentation-bottom", "queue-bottom", "agentation-width", "queue-width"]) {
        stack.style.removeProperty(`--bb-chat-ui-${name}`);
      }
    }
    const columns = document.querySelectorAll(".chat-prompt-box");
    for (let index = 0; index < columns.length; index += 1) {
      const column = columns.item(index);
      if (column instanceof HTMLElement) column.style.removeProperty(JUMP_BOTTOM);
    }
  };
}

function toggleMark(node: Element, name: string, on: boolean): void {
  if (node.hasAttribute(name) !== on) node.toggleAttribute(name, on);
}

function readFade(footer: HTMLElement): { target: HTMLElement; height: number } | null {
  const plate = footer.querySelector(PLATE);
  const target = footer.querySelector('[data-overflow-fade="above"]');
  if (!(plate instanceof HTMLElement) || !(target instanceof HTMLElement)) return null;
  const composer = footer.querySelector(COMPOSER);
  if (!(composer instanceof HTMLElement)) {
    return { target, height: 0 };
  }
  const plateRect = plate.getBoundingClientRect();
  const composerRect = composer.getBoundingClientRect();
  return { target, height: fadeHeight({
    plateBottom: plateRect.bottom,
    composerTop: composerRect.top,
    composerHeight: composerRect.height,
  }) };
}

function alignComposerControls(footer: HTMLElement): void {
  const column = footer.querySelector(".chat-prompt-box");
  const stack = footer.querySelector(STACK);
  if (!(column instanceof HTMLElement) || !(stack instanceof HTMLElement)) return;
  // Marks the parent of the staging shell (was `:has(> .agentation-staging-shell)` in CSS).
  const slot = stack.querySelector(".agentation-staging-shell")?.parentElement ?? null;
  for (const node of Array.from(stack.querySelectorAll(`[${AGENTATION_SLOT}]`))) if (node !== slot) node.removeAttribute(AGENTATION_SLOT);
  if (slot && !slot.hasAttribute(AGENTATION_SLOT)) slot.setAttribute(AGENTATION_SLOT, "");
  if (stack.hasAttribute("data-bb-chat-ui-info-stack")) {
    stack.removeAttribute(CONTROLS);
    const anchor = footer.querySelector("[data-follow-up-composer-anchor]") ?? stack;
    const base = anchor.getBoundingClientRect().top - 8;
    const bottom = `${Math.round(column.getBoundingClientRect().bottom - base)}px`;
    if (column.style.getPropertyValue(JUMP_BOTTOM) !== bottom) column.style.setProperty(JUMP_BOTTOM, bottom);
    return;
  }
  const button = footer.querySelector(JUMP_BUTTON);
  const jumpVisible = button instanceof HTMLElement && !button.classList.contains("invisible");
  const jumpHeight = button instanceof HTMLElement ? button.getBoundingClientRect().height : 0;
  const pill = stack.querySelector(PILL)?.closest("section");
  const agentation = stack.querySelector(".agentation-staging-shell");
  const queue = stack.querySelector('section[aria-label="Queued messages"]');
  const width = stack.getBoundingClientRect().width;
  const input = {
    width,
    diffHeight: pill?.getBoundingClientRect().height ?? 0,
    agentation: agentation !== null,
    agentationWidth: agentation?.getBoundingClientRect().width ?? 0,
    queue: queue !== null,
    jumpHeight: jumpVisible ? jumpHeight : 0,
    rightWidth: queue ? 32 : jumpVisible ? button.getBoundingClientRect().width : 0,
  };
  const layout = composerControlsLayout(input);
  // Hiding the mounted jump button must not change the scrollable content height.
  const height = composerControlsLayout({ ...input, jumpHeight }).height;
  if (height > 0) stack.setAttribute(CONTROLS, "");
  else stack.removeAttribute(CONTROLS);
  const values = {
    "--bb-chat-ui-controls-height": height,
    "--bb-chat-ui-agentation-bottom": layout.agentationBottom,
    "--bb-chat-ui-queue-bottom": layout.queueBottom,
    "--bb-chat-ui-agentation-width": layout.agentationWidth,
    "--bb-chat-ui-queue-width": layout.queueWidth,
  };
  for (const [name, value] of Object.entries(values)) {
    const next = `${Math.round(value)}px`;
    if (stack.style.getPropertyValue(name) !== next) stack.style.setProperty(name, next);
  }
  const todo = stack.querySelector('section[aria-label="To-do list"]');
  const anchor = todo ?? footer.querySelector("[data-follow-up-composer-anchor]");
  if (!(anchor instanceof HTMLElement)) return;
  const base = anchor.getBoundingClientRect().top - 8;
  const bottom = `${Math.round(stack.getBoundingClientRect().bottom - base)}px`;
  if (stack.style.getPropertyValue("--bb-chat-ui-controls-bottom") !== bottom) {
    stack.style.setProperty("--bb-chat-ui-controls-bottom", bottom);
  }
  const jumpBottom = `${Math.round(column.getBoundingClientRect().bottom - base)}px`;
  if (column.style.getPropertyValue(JUMP_BOTTOM) !== jumpBottom) {
    column.style.setProperty(JUMP_BOTTOM, jumpBottom);
  }
  if (!stack.hasAttribute(CONTROLS_MOTION)) {
    // Resolve the initial geometry before enabling transitions.
    stack.getBoundingClientRect();
    stack.setAttribute(CONTROLS_MOTION, "");
  }
}
