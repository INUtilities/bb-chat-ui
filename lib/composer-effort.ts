const GROUP = '[role="radiogroup"][aria-label="Reasoning"]';
const SOURCE = "data-bb-chat-ui-effort-source";
const HEADING = "data-bb-chat-ui-effort-heading";
const GAUGE = "data-bb-chat-ui-effort";

type EffortState = { buttons: HTMLButtonElement[]; index: number };
type Gauge = { sync(): boolean; stop(): void };

// Read the provider's real options and selected state without changing its settings.
function readEffort(group: HTMLElement): EffortState {
  const buttons = Array.from(group.querySelectorAll<HTMLButtonElement>('button[role="radio"]'));
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
  if (!view || state.buttons.length < 2 || state.index < 0) return null;
  const previousSource = group.getAttribute(SOURCE);
  const heading = group.previousElementSibling;
  const nativeHeading = heading?.textContent?.trim() === "Reasoning" ? heading : null;
  const previousHeading = nativeHeading?.getAttribute(HEADING) ?? null;
  const box = document.createElement("div");
  box.setAttribute(GAUGE, "");
  box.innerHTML = '<div data-effort-caption><span>Effort</span><output></output></div><div data-effort-track><span data-effort-fill></span><span data-effort-ticks aria-hidden="true"></span><span data-effort-cursor aria-hidden="true"><span data-effort-thumb></span></span><input type="range" aria-label="Effort" min="0" step="any"></div><div data-effort-ends aria-hidden="true"><span></span><span></span></div>';
  const input = box.querySelector("input")!;
  const output = box.querySelector("output")!;
  const ends = box.querySelector("[data-effort-ends]")!;
  const ticks = box.querySelector("[data-effort-ticks]")!;
  let pointer: number | null = null;
  let dragValue: number | null = null;
  let stopped = false;

  // Update only changed output so the gauge cannot observe its own render forever.
  function render(next: EffortState): void {
    state = next;
    const last = state.buttons.length - 1;
    const text = label(state.buttons[state.index]);
    const value = dragValue === null ? state.index : Math.min(last, Math.max(0, dragValue));
    if (input.max !== String(last)) input.max = String(last);
    if (input.value !== String(value)) input.value = String(value);
    if (input.getAttribute("aria-valuetext") !== text) input.setAttribute("aria-valuetext", text);
    if (output.textContent !== text) output.textContent = text;
    const progress = String(value / last);
    if (box.style.getPropertyValue("--bb-effort-progress") !== progress) box.style.setProperty("--bb-effort-progress", progress);
    input.disabled = group.getAttribute("aria-disabled") === "true" || state.buttons.every(button => button.disabled || button.getAttribute("aria-disabled") === "true");
    box.toggleAttribute("data-disabled", input.disabled);
    const firstLabel = label(state.buttons[0]);
    const lastLabel = label(state.buttons[last]);
    if (ends.children[0].textContent !== firstLabel) ends.children[0].textContent = firstLabel;
    if (ends.children[1].textContent !== lastLabel) ends.children[1].textContent = lastLabel;
    if (ticks.childElementCount !== state.buttons.length) {
      ticks.replaceChildren();
      for (let i = 0; i <= last; i++) {
        const tick = document.createElement("span");
        tick.style.left = `${i / last * 100}%`;
        ticks.append(tick);
      }
    }
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

  // Keep the thumb under the pointer while snapping persisted effort to supported steps.
  function changed(): void {
    const value = Number(input.value);
    if (pointer !== null) dragValue = value;
    choose(value, value >= state.index ? 1 : -1, false);
  }

  // Support discrete keyboard steps even though pointer dragging uses a continuous range.
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

  // Stretch the thumb during primary dragging without taking over native range capture.
  function down(event: PointerEvent): void {
    if (input.disabled || !event.isPrimary || event.button !== 0) return;
    pointer = event.pointerId;
    dragValue = Number(input.value);
    box.setAttribute("data-dragging", "");
  }

  // Settle the morph and align the thumb with the host's committed effort.
  function settle(): void {
    pointer = null;
    dragValue = null;
    box.removeAttribute("data-dragging");
    const next = readEffort(group);
    if (next.index >= 0 && next.buttons.length > 1) render(next);
  }

  // Ignore another pointer's release while an effort drag is active.
  function up(event: PointerEvent): void {
    if (event.pointerId === pointer) settle();
  }

  // Follow provider state and replaced native options while preserving the active drag.
  function sync(): boolean {
    const next = readEffort(group);
    if (next.index < 0 || next.buttons.length < 2) return false;
    if (next.buttons.length !== state.buttons.length || next.buttons.some((button, i) => button !== state.buttons[i])) {
      pointer = null;
      dragValue = null;
      box.removeAttribute("data-dragging");
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
    input.removeEventListener("pointerdown", down);
    view!.removeEventListener("pointerup", up);
    view!.removeEventListener("pointercancel", up);
    view!.removeEventListener("blur", settle);
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
  input.addEventListener("pointerdown", down);
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
    for (const [group, gauge] of gauges) {
      if (!card.contains(group) || !gauge.sync()) { gauge.stop(); gauges.delete(group); }
    }
    for (const group of Array.from(card.querySelectorAll<HTMLElement>(GROUP))) {
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
  observer?.observe(card, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-checked", "aria-disabled", "disabled", "aria-label"] });
  sync();
  // Disconnect provider observation and restore every native reasoning group.
  return () => {
    observer?.disconnect();
    for (const gauge of gauges.values()) gauge.stop();
    gauges.clear();
  };
}
