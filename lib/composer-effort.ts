import { mountEffortWave } from "./composer-effort-wave.ts";

const GROUP = '[role="radiogroup"][aria-label="Reasoning"]';
const SOURCE = "data-bb-chat-ui-effort-source";
const HEADING = "data-bb-chat-ui-effort-heading";
const GAUGE = "data-bb-chat-ui-effort";
const EFFORT_ORDER = ["none", "minimal", "low", "medium", "high", "extra high", "max", "ultra"];

type EffortState = { buttons: HTMLButtonElement[]; index: number };
type Gauge = { sync(group?: HTMLElement): boolean; stop(): void };

// Read the provider's real options and selected state without changing its settings.
function readEffort(group: HTMLElement): EffortState {
  const buttons = Array.from(group.querySelectorAll<HTMLButtonElement>('button[role="radio"]'));
  // Providers may supply descending steps. Keep the display ascending while
  // retaining native button identities; custom names keep their supplied order.
  const rank = (button: HTMLButtonElement) => EFFORT_ORDER.indexOf(label(button).toLowerCase());
  if (buttons.every(button => rank(button) >= 0)) buttons.sort((a, b) => rank(a) - rank(b));
  let index = -1;
  for (let i = 0; i < buttons.length; i++) if (buttons[i].getAttribute("aria-checked") === "true") index = i;
  return { buttons, index };
}

// Preserve the provider's accessible label, including custom effort names.
function label(button: HTMLButtonElement): string {
  return button.getAttribute("aria-label") || button.textContent?.trim() || "";
}

// Restore an attribute exactly as it was before enhancement.
function restoreAttribute(node: Element, name: string, value: string | null): void {
  if (value === null) node.removeAttribute(name);
  else node.setAttribute(name, value);
}

// Build an accessible drag gauge that forwards changes to the original radio buttons.
function mountGauge(group: HTMLElement): Gauge | null {
  const document = group.ownerDocument;
  const view = document.defaultView;
  let state = readEffort(group);
  if (!view || state.buttons.length < 1 || state.index < 0) return null;
  let previousSource = group.getAttribute(SOURCE);
  let nativeHeading = group.previousElementSibling?.textContent?.trim() === "Reasoning" ? group.previousElementSibling : null;
  let previousHeading = nativeHeading?.getAttribute(HEADING) ?? null;
  const box = document.createElement("div");
  box.setAttribute(GAUGE, "");
  box.innerHTML = '<div data-effort-caption><span>Effort</span><output></output></div><div data-effort-track><input type="range" aria-label="Effort" min="0" step="1"></div>';
  const input = box.querySelector("input")!;
  const output = box.querySelector("output")!;
  const track = box.querySelector<HTMLElement>("[data-effort-track]")!;
  const wave = mountEffortWave(track);
  let pointer: number | null = null;
  let stopped = false;

  // Update only changed output so the gauge cannot observe its own render forever.
  function render(next: EffortState): void {
    state = next;
    const last = state.buttons.length - 1;
    const text = label(state.buttons[state.index]);
    const value = state.index;
    if (input.max !== String(last)) input.max = String(last);
    if (input.value !== String(value)) input.value = String(value);
    if (input.getAttribute("aria-valuetext") !== text) input.setAttribute("aria-valuetext", text);
    if (output.textContent !== text) output.textContent = text;
    input.disabled = group.getAttribute("aria-disabled") === "true" || state.buttons.every(button => button.disabled || button.getAttribute("aria-disabled") === "true");
    box.toggleAttribute("data-disabled", input.disabled);
    const single = state.buttons.length === 1;
    if (input.getAttribute('aria-readonly') !== String(single)) input.setAttribute('aria-readonly', String(single));
    track.style.cursor = single ? 'default' : '';
    const selectedClass = ["border", "foreground"].join("-");
    const card = group.closest('[data-bb-chat-ui-model-menu]');
    const provider = Array.from(card?.querySelectorAll<HTMLButtonElement>('button[title]') ?? []).find(button => button.classList.contains(selectedClass) || button.getAttribute('aria-selected') === 'true')?.title ?? '';
    wave.sync(state.buttons.map(label), value, provider);
  }

  // Test availability at the native boundary rather than inventing unsupported values.
  function enabled(index: number): boolean {
    const button = state.buttons[index];
    return !!button && !button.disabled && button.getAttribute("aria-disabled") !== "true";
  }

  // Commit a supported step through the native host's click handler exactly once.
  function choose(request: number, direction: number, seek: boolean): void {
    const next = readEffort(group);
    if (next.index < 0 || next.buttons.length < 2) return;
    state = next;
    if (input.disabled) { render(state); return; }
    const last = state.buttons.length - 1;
    let target = Math.max(0, Math.min(last, Math.round(request)));
    if (seek) {
      while (target >= 0 && target <= last && !enabled(target)) target += direction;
      if (target < 0 || target > last) target = state.index;
    } else if (!enabled(target)) {
      let found = -1;
      for (let distance = 1; distance <= last && found < 0; distance++) {
        for (const candidate of [target + distance * direction, target - distance * direction]) {
          if (enabled(candidate)) { found = candidate; break; }
        }
      }
      target = found < 0 ? state.index : found;
    }
    if (target === state.index) { render(state); return; }
    render({ buttons: state.buttons, index: target });
    state.buttons[target].click();
  }

  // Keep the indicator and host selection on the same supported step during dragging.
  function changed(): void {
    const value = Number(input.value);
    choose(value, value >= state.index ? 1 : -1, false);
  }

  // Move between enabled native steps with standard range keyboard controls.
  function keydown(event: KeyboardEvent): void {
    if (input.disabled) return;
    const index = readEffort(group).index;
    let target: number;
    let direction: number;
    switch (event.key) {
      case "ArrowRight": case "ArrowUp": target = index + 1; direction = 1; break;
      case "ArrowLeft": case "ArrowDown": target = index - 1; direction = -1; break;
      case "Home": target = 0; direction = 1; break;
      case "End": target = state.buttons.length - 1; direction = -1; break;
      default: return;
    }
    event.preventDefault();
    choose(target, direction, true);
  }

  // Map a drag position to a supported step on the fixed, inset ruler.
  function point(event: PointerEvent): void {
    const bounds = track.getBoundingClientRect();
    const width = bounds.width - 48;
    if (width <= 0) return;
    const value = (event.clientX - bounds.left - 24) / width * (state.buttons.length - 1);
    choose(value, value >= state.index ? 1 : -1, false);
  }

  // Start primary dragging and retain the native range's keyboard focus.
  function down(event: PointerEvent): void {
    if (state.buttons.length < 2 || input.disabled || pointer !== null || !event.isPrimary || event.button !== 0) return;
    pointer = event.pointerId;
    box.setAttribute("data-dragging", "");
    input.focus({ preventScroll: true });
    track.setPointerCapture?.(pointer);
    point(event);
  }

  // Follow only the active pointer while keeping native selection on discrete steps.
  function move(event: PointerEvent): void {
    if (event.pointerId === pointer) point(event);
  }

  // Release pointer capture and retain the host's committed effort when dragging ends.
  function settle(): void {
    const active = pointer;
    pointer = null;
    if (active !== null && track.hasPointerCapture?.(active)) track.releasePointerCapture(active);
    box.removeAttribute("data-dragging");
    const next = readEffort(group);
    if (next.index >= 0 && next.buttons.length > 0) render(next);
  }

  // Ignore another pointer's release while an effort drag is active.
  function up(event: PointerEvent): void {
    if (event.pointerId === pointer) settle();
  }

  // Follow provider state and replaced native options while preserving the active drag.
  function sync(nextGroup = group): boolean {
    const next = readEffort(nextGroup);
    if (next.index < 0 || next.buttons.length < 1) return false;
    if (nextGroup !== group) {
      settle();
      restoreAttribute(group, SOURCE, previousSource);
      if (nativeHeading) restoreAttribute(nativeHeading, HEADING, previousHeading);
      group = nextGroup;
      previousSource = group.getAttribute(SOURCE);
      nativeHeading = group.previousElementSibling?.textContent?.trim() === 'Reasoning' ? group.previousElementSibling : null;
      previousHeading = nativeHeading?.getAttribute(HEADING) ?? null;
      group.setAttribute(SOURCE, ''); nativeHeading?.setAttribute(HEADING, '');
    }
    if (box.previousElementSibling !== group) group.after(box);
    if (next.buttons.length !== state.buttons.length || next.buttons.some((button, i) => button !== state.buttons[i])) {
      settle();
    }
    render(next);
    return true;
  }

  // Remove only enhancement-owned UI and restore the native controls on unload.
  function stop(): void {
    if (stopped) return;
    stopped = true;
    const focused = document.activeElement === input;
    input.removeEventListener("input", changed);
    input.removeEventListener("keydown", keydown);
    track.removeEventListener("pointerdown", down);
    track.removeEventListener("lostpointercapture", up);
    view!.removeEventListener("pointermove", move);
    view!.removeEventListener("pointerup", up);
    view!.removeEventListener("pointercancel", up);
    view!.removeEventListener("blur", settle);
    wave.stop();
    box.remove();
    restoreAttribute(group, SOURCE, previousSource);
    if (nativeHeading) restoreAttribute(nativeHeading, HEADING, previousHeading);
    if (focused && group.isConnected) readEffort(group).buttons[readEffort(group).index]?.focus();
  }

  group.setAttribute(SOURCE, "");
  nativeHeading?.setAttribute(HEADING, "");
  group.after(box);
  input.addEventListener("input", changed);
  input.addEventListener("keydown", keydown);
  track.addEventListener("pointerdown", down);
  track.addEventListener("lostpointercapture", up);
  view.addEventListener("pointermove", move);
  view.addEventListener("pointerup", up);
  view.addEventListener("pointercancel", up);
  view.addEventListener("blur", settle);
  render(state);
  return { sync, stop };
}

// Keep an open provider card's gauges synchronized across native provider rerenders.
export function injectComposerEffort(card: HTMLElement): () => void {
  const view = card.ownerDocument.defaultView;
  const gauges = new Map<HTMLElement, Gauge>();

  // Discover new native groups and release gauges whose source was replaced.
  function sync(): void {
    const groups = Array.from(card.querySelectorAll<HTMLElement>(GROUP));
    for (const [group, gauge] of gauges) {
      const replacement = groups.find(next => !gauges.has(next));
      if (!card.contains(group) && replacement && gauge.sync(replacement)) {
        gauges.delete(group); gauges.set(replacement, gauge);
      } else if (!card.contains(group) || !gauge.sync()) { gauge.stop(); gauges.delete(group); }
    }
    for (const group of groups) {
      if (gauges.has(group)) continue;
      const gauge = mountGauge(group);
      if (gauge) gauges.set(group, gauge);
    }
  }

  // Ignore the gauge's own output changes while retaining every native state update.
  function changed(records: MutationRecord[]): void {
    for (const record of records) {
      const target = record.target.nodeType === 1 ? record.target as Element : record.target.parentElement;
      if (!target?.closest(`[${GAUGE}]`)) { sync(); return; }
    }
  }

  const observer = view ? new view.MutationObserver(changed) : null;
  observer?.observe(card, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-checked", "aria-disabled", "disabled", "aria-label", "class", "aria-selected"] });
  sync();
  // Disconnect provider observation and restore every native reasoning group.
  return () => {
    observer?.disconnect();
    for (const gauge of gauges.values()) gauge.stop();
    gauges.clear();
  };
}
