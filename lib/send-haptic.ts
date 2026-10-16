const SEND_BUTTON = "[data-promptbox-submit-action][type='submit']";
const JUMP_BUTTON = 'button[aria-label="Scroll to latest event"]';
const QUESTION_CARD = ['tool-use-ask', 'plugin-request-banner', 'user-question-banner', 'plan-review-banner', 'approval-banner'].map(id => `[data-testid="${id}"]`).join(', ');
const WAIT_MS = 80;
const JUMP_GAP_MS = 400;

export type HapticKind = "success" | "impact-light" | "selection";

export const RESPONSE_FINISH_KIND: HapticKind = "success";
const STOP_BUTTON_LABEL = "Stop run";

export type ResponseWatchPhase = "wait-output" | "wait-finish";

export interface ResponseWatchState {
  phase: ResponseWatchPhase;
  sawWorking: boolean;
}

export function hasNewAssistantOutput(
  rowIds: readonly string[],
  baseline: ReadonlySet<string>,
): boolean {
  for (let index = 0; index < rowIds.length; index += 1) {
    const id = rowIds[index];
    if (id !== undefined && !baseline.has(id)) return true;
  }
  return false;
}

export function openResponseWatch(input: {
  respondingAtPress: boolean;
  hasNewOutput: boolean;
}): ResponseWatchState & { pulse: null } {
  if (input.hasNewOutput) {
    return {
      phase: "wait-finish",
      sawWorking: input.respondingAtPress,
      pulse: null,
    };
  }
  return {
    phase: "wait-output",
    sawWorking: input.respondingAtPress,
    pulse: null,
  };
}

export function reduceResponseWatch(
  watch: ResponseWatchState,
  working: boolean,
  hasNewOutput: boolean,
): { watch: ResponseWatchState | null; pulse: "finish" | null } {
  const sawWorking = watch.sawWorking || working;
  if (watch.phase === "wait-output") {
    if (!hasNewOutput) {
      return { watch: { phase: "wait-output", sawWorking }, pulse: null };
    }
    return { watch: { phase: "wait-finish", sawWorking }, pulse: null };
  }
  if (sawWorking && !working) return { watch: null, pulse: "finish" };
  return { watch: { phase: "wait-finish", sawWorking }, pulse: null };
}

export function shineMeansAgentResponse(
  text: string | null,
  ancestorOpacities: readonly string[],
): boolean {
  const value = text?.trim() ?? "";
  if (value !== "Working..." && value !== "Thinking…") return false;
  return !ancestorOpacities.includes("0");
}

export interface SendHapticState {
  armed: boolean;
  sawBusy: boolean;
}

export type SendHapticEvent = "press" | "busy" | "idle" | "timeout";

export const IDLE_SEND_HAPTIC: SendHapticState = {
  armed: false,
  sawBusy: false,
};

export interface HapticBridge {
  post(message: unknown): void;
  capabilities?: readonly string[];
}

export function reduceSendHaptic(
  state: SendHapticState,
  event: SendHapticEvent,
): { state: SendHapticState; pulse: boolean } {
  if (event === "press") {
    return { state: { armed: true, sawBusy: false }, pulse: false };
  }
  if (!state.armed) return { state, pulse: false };
  if (event === "busy") {
    return { state: { armed: true, sawBusy: true }, pulse: false };
  }
  if (event === "idle") {
    if (!state.sawBusy) return { state, pulse: false };
    return { state: IDLE_SEND_HAPTIC, pulse: true };
  }
  if (state.sawBusy) return { state, pulse: false };
  return { state: IDLE_SEND_HAPTIC, pulse: true };
}

export function postHaptic(
  bridge: HapticBridge | null,
  kind: HapticKind,
): boolean {
  if (!bridge?.capabilities?.includes("haptic")) return false;
  bridge.post({ type: "haptic", kind });
  return true;
}

export function postSendHaptic(bridge: HapticBridge | null): boolean {
  return postHaptic(bridge, "selection");
}

export function acceptJumpPulse(lastAt: number | null, now: number): number | null {
  if (lastAt !== null && now - lastAt < JUMP_GAP_MS) return null;
  return now;
}

export function isStopRunButton(target: EventTarget | null): boolean {
  const element = asElement(target);
  if (element === null) return false;
  const button = element.closest("button");
  if (button === null || button.getAttribute("disabled") !== null) return false;
  return button.getAttribute("aria-label") === STOP_BUTTON_LABEL;
}

export function isFileDiffBlockToggle(target: EventTarget | null): boolean {
  const element = asElement(target);
  if (element === null) return false;
  const button = element.closest("button");
  if (button === null || button.getAttribute("disabled") !== null) return false;
  if (button.getAttribute("aria-expanded") === null) return false;
  const label = button.getAttribute("aria-label");
  return label?.startsWith("Expand ") === true || label?.startsWith("Collapse ") === true;
}

export function readHapticBridge(root: unknown): HapticBridge | null {
  if (typeof root !== "object" || root === null) return null;
  const native = (root as { bb?: { native?: Partial<HapticBridge> } }).bb
    ?.native;
  if (!native || typeof native.post !== "function") return null;
  return native as HapticBridge;
}

export function injectSendHaptic(document: Document): () => void {
  let state = IDLE_SEND_HAPTIC;
  let armedButton: HTMLButtonElement | null = null;
  let armedWindow: HTMLElement | null = null;
  let respondingAtPress = false;
  let outputBaseline = new Set<string>();
  let timer: number | null = null;
  let lastJumpAt: number | null = null;
  let lastDiffToggleAt: number | null = null;
  let lastStopAt: number | null = null;
  const responseWatch = new Map<
    HTMLElement,
    ResponseWatchState & { baseline: ReadonlySet<string> }
  >();
  const view = document.defaultView;

  const syncResponse = () => {
    for (const [root, phase] of responseWatch) {
      if (!root.isConnected) {
        responseWatch.delete(root);
        continue;
      }
      const next = reduceResponseWatch(
        phase,
        agentResponseVisible(root),
        hasNewAssistantOutput(assistantOutputIds(root), phase.baseline),
      );
      if (next.watch === null) responseWatch.delete(root);
      else responseWatch.set(root, { ...next.watch, baseline: phase.baseline });
      if (next.pulse === "finish") {
        postHaptic(readHapticBridge(view), RESPONSE_FINISH_KIND);
      }
    }
  };

  const watchResponse = (
    root: HTMLElement | null,
    wasRespondingAtPress: boolean,
    baseline: ReadonlySet<string>,
  ) => {
    if (root === null) return;
    const opened = openResponseWatch({
      respondingAtPress: wasRespondingAtPress,
      hasNewOutput: hasNewAssistantOutput(assistantOutputIds(root), baseline),
    });
    responseWatch.set(root, {
      phase: opened.phase,
      sawWorking: opened.sawWorking,
      baseline,
    });
    syncResponse();
  };

  const apply = (event: SendHapticEvent) => {
    const root = armedWindow;
    const wasRespondingAtPress = respondingAtPress;
    const baseline = outputBaseline;
    const next = reduceSendHaptic(state, event);
    state = next.state;
    if (!state.armed) {
      armedButton = null;
      armedWindow = null;
      respondingAtPress = false;
      outputBaseline = new Set();
    }
    if (!next.pulse) return;
    postSendHaptic(readHapticBridge(view));
    watchResponse(root, wasRespondingAtPress, baseline);
  };

  const arm = (button: HTMLButtonElement) => {
    // Without a haptic bridge (desktop, web) the response watch can never pulse; skip its scans.
    if (!readHapticBridge(view)?.capabilities?.includes("haptic")) return;
    armedButton = button;
    const root = button.closest("[data-thread-window]");
    armedWindow = root instanceof HTMLElement ? root : null;
    respondingAtPress =
      armedWindow !== null && agentResponseVisible(armedWindow);
    outputBaseline = new Set(assistantOutputIds(armedWindow));
    apply("press");
    if (timer !== null) view?.clearTimeout(timer);
    timer =
      view?.setTimeout(() => {
        timer = null;
        apply("timeout");
      }, WAIT_MS) ?? null;
  };

  const syncBusy = () => {
    if (!armedButton) return;
    if (!armedButton.isConnected) {
      apply("idle");
      return;
    }
    apply(
      armedButton.getAttribute("aria-busy") === "true" ? "busy" : "idle",
    );
  };

  const pulseJump = () => {
    const now = view?.performance?.now() ?? Date.now();
    const next = acceptJumpPulse(lastJumpAt, now);
    if (next === null) return;
    lastJumpAt = next;
    postHaptic(readHapticBridge(view), "impact-light");
  };

  const pulseDiffToggle = () => {
    const now = view?.performance?.now() ?? Date.now();
    const next = acceptJumpPulse(lastDiffToggleAt, now);
    if (next === null) return;
    lastDiffToggleAt = next;
    postHaptic(readHapticBridge(view), "impact-light");
  };

  const pulseStop = () => {
    const now = view?.performance?.now() ?? Date.now();
    const next = acceptJumpPulse(lastStopAt, now);
    if (next === null) return;
    lastStopAt = next;
    postHaptic(readHapticBridge(view), "selection");
  };

  const onPointerUp = (event: PointerEvent) => {
    // Information controls use click for touch, mouse and keyboard alike.
    if (composerInfoButtonFrom(event.target) || questionButtonFrom(event.target)) return;
    if (isFileDiffBlockToggle(event.target)) {
      pulseDiffToggle();
      return;
    }
    if (isStopRunButton(event.target)) {
      const stop = stopButtonFrom(event.target);
      if (stop !== null && event.isPrimary && releasedInside(stop, event)) {
        pulseStop();
      }
      return;
    }
    if (event.pointerType !== "touch" || !event.isPrimary) return;
    const jump = jumpButtonFrom(event.target);
    if (jump && releasedInside(jump, event)) {
      pulseJump();
      return;
    }
    const button = sendButtonFrom(event.target);
    if (!button || !releasedInside(button, event)) return;
    arm(button);
  };

  const onJumpClick = (event: MouseEvent) => {
    const question = questionButtonFrom(event.target);
    if (question) {
      if (event.isTrusted && !question.hasAttribute('disabled') && question.getAttribute('aria-disabled') !== 'true') {
        postHaptic(readHapticBridge(view), 'selection');
      }
      return;
    }
    const info = composerInfoButtonFrom(event.target);
    if (info) {
      // Disclosures also forward synthetic clicks to the original host controls.
      if (event.isTrusted && !info.hasAttribute("disabled") && info.getAttribute("aria-disabled") !== "true") {
        postHaptic(readHapticBridge(view), "impact-light");
      }
      return;
    }
    if (isFileDiffBlockToggle(event.target)) {
      pulseDiffToggle();
      return;
    }
    if (isStopRunButton(event.target)) {
      pulseStop();
      return;
    }
    if (!jumpButtonFrom(event.target)) return;
    pulseJump();
  };

  const onSubmit = (event: SubmitEvent) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (!form.matches("[data-promptbox]")) return;
    const submitter = event.submitter;
    if (!(submitter instanceof HTMLButtonElement)) return;
    if (!submitter.matches(SEND_BUTTON) || submitter.disabled) return;
    if (submitter.getAttribute("aria-busy") === "true") return;
    arm(submitter);
  };

  let observer: MutationObserver | null = null;
  if (document.body && typeof MutationObserver !== "undefined") {
    observer = new MutationObserver(() => {
      syncBusy();
      syncResponse();
    });
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["aria-busy", "style"],
      characterData: true,
      childList: true,
      subtree: true,
    });
  }

  document.addEventListener("pointerup", onPointerUp, true);
  document.addEventListener("click", onJumpClick, true);
  document.addEventListener("submit", onSubmit, true);

  return () => {
    document.removeEventListener("pointerup", onPointerUp, true);
    document.removeEventListener("click", onJumpClick, true);
    document.removeEventListener("submit", onSubmit, true);
    observer?.disconnect();
    if (timer !== null) view?.clearTimeout(timer);
  };
}

const ASSISTANT_OUTPUT = '[data-message-column].group\\/message';

function assistantOutputIds(root: ParentNode | null): string[] {
  if (root === null) return [];
  const nodes = root.querySelectorAll(ASSISTANT_OUTPUT);
  const ids: string[] = [];
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes.item(index);
    if (!(node instanceof HTMLElement)) continue;
    if ((node.textContent ?? "").trim() === "") continue;
    const id = node
      .closest("[data-timeline-row-id]")
      ?.getAttribute("data-timeline-row-id");
    if (id != null && id !== "") ids.push(id);
  }
  return ids;
}

function agentResponseVisible(root: ParentNode): boolean {
  const nodes = root.querySelectorAll(".animate-shine");
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes.item(index);
    if (!(node instanceof HTMLElement)) continue;
    if (shineMeansAgentResponse(node.textContent, ancestorOpacities(node))) {
      return true;
    }
  }
  return false;
}

function ancestorOpacities(node: HTMLElement): string[] {
  const opacities: string[] = [];
  let current: HTMLElement | null = node;
  while (current) {
    if (current.style.opacity !== "") opacities.push(current.style.opacity);
    current = current.parentElement;
  }
  return opacities;
}

function asElement(target: EventTarget | null): Element | null {
  if (target === null || typeof target !== "object" || !("closest" in target)) return null;
  if (typeof target.closest !== "function") return null;
  return target as Element;
}

function composerInfoButtonFrom(target: EventTarget | null): Element | null {
  const button = asElement(target)?.closest("button");
  // The latest-event proxy forwards to the host jump, which owns that haptic.
  if (button?.closest("[data-bb-chat-ui-info-jump]")) return null;
  return button?.closest("[data-bb-chat-ui-info-bar], [data-bb-chat-ui-info-unit]") ? button : null;
}

function questionButtonFrom(target: EventTarget | null): Element | null {
  const button = asElement(target)?.closest('button');
  return button?.closest(QUESTION_CARD)?.closest('[data-bb-chat-ui-info-stack]') ? button : null;
}

function jumpButtonFrom(target: EventTarget | null): HTMLButtonElement | null {
  if (!(target instanceof Element)) return null;
  const button = target.closest(JUMP_BUTTON);
  if (!(button instanceof HTMLButtonElement)) return null;
  if (button.disabled || button.classList.contains("invisible")) return null;
  return button;
}

function stopButtonFrom(target: EventTarget | null): HTMLElement | null {
  const element = asElement(target);
  if (element === null) return null;
  const button = element.closest("button");
  if (button === null || !isStopRunButton(button)) return null;
  return button as HTMLElement;
}

function sendButtonFrom(target: EventTarget | null): HTMLButtonElement | null {
  if (!(target instanceof Element)) return null;
  const button = target.closest(SEND_BUTTON);
  if (!(button instanceof HTMLButtonElement)) return null;
  if (button.disabled || button.getAttribute("aria-busy") === "true") {
    return null;
  }
  return button;
}

function releasedInside(button: HTMLElement, event: PointerEvent): boolean {
  const bounds = button.getBoundingClientRect();
  return (
    event.clientX >= bounds.left &&
    event.clientX < bounds.right &&
    event.clientY >= bounds.top &&
    event.clientY < bounds.bottom
  );
}
