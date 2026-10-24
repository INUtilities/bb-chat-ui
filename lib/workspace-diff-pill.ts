import { pillStyle } from "./pill.ts";
import { composerDataChanged, readDiffData } from "./composer-data.ts";
const TOGGLE_ID = "thread-prompt-banner-git-toggle";
const BODY_ID = "thread-prompt-banner-git-body";
const STYLE_ID = "bb-chat-ui-diff-pill";
const FILES_MARK = "data-bb-chat-ui-files";
const CHEVRON_MARK = "data-bb-chat-ui-chevron";
const SOLO_MARK = "data-bb-chat-ui-solo";
const BRANCH_MARK = "data-bb-chat-ui-branch";
export const HEAD_DIFF_MARK = "data-bb-chat-ui-head-diff";
const MERGE_BASE = `#${TOGGLE_ID} ~ [data-promptbox-hide-compact][data-promptbox-hide-tiny]`;

const PILL_CSS = `
#${BODY_ID} {
  display: none !important;
}
${MERGE_BASE} {
  display: none !important;
}
#${TOGGLE_ID} [${CHEVRON_MARK}] {
  display: none !important;
}
#${TOGGLE_ID} {
${pillStyle.nativeNavigation}
}
#${TOGGLE_ID} [data-icon-root] {
${pillStyle.nativeNavigationIcon}
}
#${TOGGLE_ID} [${BRANCH_MARK}] {
  display: inline-flex;
  flex-shrink: 0;
  color: var(--color-purple-500, #a855f7);
}
section[${SOLO_MARK}] {
  justify-self: start;
  width: fit-content;
  min-height: 0 !important;
  border: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
}
section[${SOLO_MARK}] > .flex {
  padding: 0 !important;
}
`;

interface DiffStats {
  insertions: number;
  deletions: number;
  files: readonly unknown[];
  truncated?: boolean;
}

interface HeadWorkspace {
  branch: { currentBranch: string | null; defaultBranch: string };
  workingTree: DiffStats;
  mergeBase?: DiffStats | null;
}

export interface HeadDiffOptions {
  isWorktree?: boolean;
}

interface DiffFile { path:string; status:string; insertions:number | null; deletions:number | null; }
export interface DiffCommit { sha:string; shortSha:string; subject:string; authoredAt?:number; }
export interface DetailedWorkspace extends HeadWorkspace {
  workingTree: Omit<DiffStats, "files"> & { files:readonly DiffFile[] };
  mergeBase?: (Omit<DiffStats, "files"> & { files:readonly DiffFile[]; commits:readonly DiffCommit[]; baseRef:string | null; mergeBaseBranch:string }) | null;
}

export interface HeadDiffDetail {
  branch:string | null; basis:string; baseRef:string | null; files:readonly DiffFile[]; commits:readonly DiffCommit[];
  commitKind?:"pr" | "unpushed"; commitCount?:number | null; unpushedCount?:number | null; unpushedRef?:string | null;
  remoteBaseMissing?:boolean;
  truncated?:boolean;
}

function shortBranch(name: string): string {
  if (name.startsWith("refs/heads/")) return name.slice("refs/heads/".length);
  if (name.startsWith("refs/remotes/")) {
    const rest = name.slice("refs/remotes/".length);
    const slash = rest.indexOf("/");
    return slash === -1 ? rest : rest.slice(slash + 1);
  }
  if (name.startsWith("origin/")) return name.slice("origin/".length);
  return name;
}

export function headDiffSummary(workspace: HeadWorkspace, options: HeadDiffOptions = {}) {
  const { workingTree, branch } = workspace;
  const current = branch.currentBranch;
  const onDefault = current !== null && shortBranch(current) === shortBranch(branch.defaultBranch);
  return {
    insertions: workingTree.insertions,
    deletions: workingTree.deletions,
    files: workingTree.files.length,
    branch: current !== null && !onDefault ? current : null,
  };
}

// Build the detailed view from the current HEAD-relative workspace snapshot.
export function headDiffDetail(workspace: DetailedWorkspace, options: HeadDiffOptions = {}): HeadDiffDetail {
  const baseRef = workspace.mergeBase?.baseRef ?? workspace.mergeBase?.mergeBaseBranch ?? null;
  return {
    branch:workspace.branch.currentBranch,
    basis:"HEAD 대비 미커밋 변경",
    baseRef,
    files:workspace.workingTree.files,
    commits:workspace.mergeBase?.commits ?? [],
    ...(workspace.workingTree.truncated ? { truncated:true } : {}),
  };
}

const SHOW_PANEL_LABEL = "Show right panel";
const DIFF_PANEL_LABEL = "Show diff panel";

export function readChangedFileLabel(text: string): string | null {
  const match = text.match(/(\d+)\s+files?/);
  return match?.[0] ?? null;
}

export interface ChangesPanelButton {
  label: string;
  pressed: boolean;
  inert: boolean;
}

export type ChangesPanelAction = "show-panel" | "diff";

export function planChangesPanelClicks(
  buttons: readonly ChangesPanelButton[],
): ChangesPanelAction[] {
  const actions: ChangesPanelAction[] = [];
  const showPanel = buttons.find(
    (button) => labelMatches(button.label, SHOW_PANEL_LABEL) && !button.inert,
  );
  if (showPanel) actions.push("show-panel");
  const diff = buttons.find((button) =>
    labelMatches(button.label, DIFF_PANEL_LABEL),
  );
  if (diff && !diff.pressed && !diff.inert) actions.push("diff");
  return actions;
}

function labelMatches(name: string, label: string): boolean {
  return name === label || name.startsWith(`${label} (`);
}

export function injectWorkspaceDiffPill(document: Document): () => void {
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = PILL_CSS;
  document.head.append(style);

  const onClick = (event: Event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest(`#${TOGGLE_ID}`);
    if (!(button instanceof HTMLButtonElement)) return;
    if (button.getAttribute("aria-expanded") !== "true") {
      event.preventDefault();
      event.stopPropagation();
    }
    openChangesPanel(document);
  };
  document.addEventListener("click", onClick, true);

  const paint = () => {
    document.querySelectorAll(`#${TOGGLE_ID}`).forEach((button) => {
      if (button instanceof HTMLButtonElement) paintToggle(button);
    });
  };
  const observer = new MutationObserver(paint);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
  const onData = (event: Event) => {
    const source = event.target;
    if (!(source instanceof Element) || !source.hasAttribute(HEAD_DIFF_MARK)) return;
    source.closest(".chat-prompt-box")?.querySelectorAll<HTMLButtonElement>(`#${TOGGLE_ID}`).forEach(paintToggle);
  };
  document.addEventListener(composerDataChanged, onData);
  paint();

  return () => {
    observer.disconnect();
    document.removeEventListener(composerDataChanged, onData);
    document.removeEventListener("click", onClick, true);
    style.remove();
    document.querySelectorAll(`[${BRANCH_MARK}]`).forEach((node) => node.remove());
  };
}

function paintToggle(button: HTMLButtonElement) {
  // The information row renders its own SDK summary; do not also rewrite the hidden host card.
  if (button.closest("[data-bb-chat-ui-info-stack]")) return;
  const icons = Array.from(button.querySelectorAll("[data-icon-root]"))
    .filter((icon) => !icon.closest(`[${BRANCH_MARK}]`));
  const chevron = icons.length > 1 ? icons[icons.length - 1] : null;
  if (chevron && !chevron.hasAttribute(CHEVRON_MARK)) {
    chevron.setAttribute(CHEVRON_MARK, "");
  }
  for (const child of Array.from(button.children)) {
    if (child instanceof HTMLElement) rewriteLabel(child);
  }
  paintHeadSummary(button);
  const section = button.closest("section");
  const header = button.parentElement;
  if (!section || !header) return;
  const otherControl = Array.from(header.querySelectorAll("button")).some(
    (control) => control !== button && !control.closest(MERGE_BASE),
  );
  if (otherControl) {
    if (section.hasAttribute(SOLO_MARK)) section.removeAttribute(SOLO_MARK);
  } else if (!section.hasAttribute(SOLO_MARK)) {
    section.setAttribute(SOLO_MARK, "");
  }
}

function paintHeadSummary(button: HTMLButtonElement) {
  const source = button.closest(".chat-prompt-box")?.querySelector(`[${HEAD_DIFF_MARK}]`);
  const summary = readDiffData(source)?.value.summary;
  if (!summary) return;
  const files = button.querySelector(`[${FILES_MARK}]`);
  const label = files?.parentElement;
  if (!label) return;
  let tally = label.querySelector<HTMLElement>(".text-diff-added")?.parentElement;
  if (!tally) {
    tally = button.ownerDocument.createElement("span");
    for (const className of ["text-diff-added", "text-diff-removed"]) {
      const number = button.ownerDocument.createElement("span");
      number.className = className;
      tally.append(number);
    }
    label.prepend(tally, button.ownerDocument.createTextNode(" · "));
  }
  setText(tally.querySelector(".text-diff-added"), `+${summary.insertions}`);
  setText(tally.querySelector(".text-diff-removed"), ` -${summary.deletions}`);
  setText(files, `${summary.files} ${summary.files === 1 ? "file" : "files"}`);

  let icon = button.querySelector<HTMLElement>(`[${BRANCH_MARK}]`);
  if (!summary.branch) {
    icon?.remove();
    return;
  }
  if (!icon) {
    const template = source?.querySelector("[data-icon-root]");
    if (!template) return;
    icon = button.ownerDocument.createElement("span");
    icon.setAttribute(BRANCH_MARK, "");
    icon.setAttribute("role", "img");
    icon.append(template.cloneNode(true));
    button.append(icon);
  }
  if (icon.title !== summary.branch) icon.title = summary.branch;
  const labelText = `Branch: ${summary.branch}`;
  if (icon.getAttribute("aria-label") !== labelText) icon.setAttribute("aria-label", labelText);
}

function setText(node: Element | null | undefined, text: string) {
  if (node && node.textContent !== text) node.textContent = text;
}

function rewriteLabel(span: HTMLElement) {
  if (span.hasAttribute(BRANCH_MARK)) return;
  if (span.hasAttribute(FILES_MARK) || span.querySelector(`[${FILES_MARK}]`)) {
    return;
  }
  const files = readChangedFileLabel(span.textContent ?? "");
  if (!files) return;
  const tally = Array.from(span.children).find(
    (child) =>
      child instanceof HTMLElement &&
      child.querySelector(".text-diff-added, .text-diff-removed"),
  );
  const fileLabel = span.ownerDocument.createElement("span");
  fileLabel.setAttribute(FILES_MARK, "");
  fileLabel.textContent = files;
  span.replaceChildren();
  if (tally) {
    span.append(tally);
    span.append(document.createTextNode(" · "));
  }
  span.append(fileLabel);
}

interface LiveChangesPanelButton extends ChangesPanelButton {
  element: HTMLButtonElement;
}

export function openChangesPanel(document: Document, scope?: Element) {
  const buttons = readChangesPanelButtons(document, scope);
  for (const action of planChangesPanelClicks(buttons)) {
    buttonForAction(buttons, action)?.element.click();
  }
  if (!buttons.some((button) => labelMatches(button.label, SHOW_PANEL_LABEL))) {
    return;
  }
  let attempts = 0;
  const retryDiff = () => {
    attempts += 1;
    const live = readChangesPanelButtons(document, scope);
    const diff = live.find((button) =>
      labelMatches(button.label, DIFF_PANEL_LABEL),
    );
    if (!diff || diff.pressed) return;
    if (!diff.inert) {
      diff.element.click();
      return;
    }
    if (attempts < 8) document.defaultView?.requestAnimationFrame(retryDiff);
  };
  document.defaultView?.requestAnimationFrame(retryDiff);
}

function readChangesPanelButtons(document: Document, scope?: Element): LiveChangesPanelButton[] {
  const toggle = document.getElementById(TOGGLE_ID);
  const pane = scope?.closest("[data-split-pane-id]") ?? toggle?.closest("[data-split-pane-id]") ?? null;
  const buttons = Array.from(document.querySelectorAll("button[aria-label]")).flatMap(
    (node) => {
      if (!(node instanceof HTMLButtonElement)) return [];
      const label = node.getAttribute("aria-label") ?? "";
      if (
        !labelMatches(label, SHOW_PANEL_LABEL) &&
        !labelMatches(label, DIFF_PANEL_LABEL)
      ) {
        return [];
      }
      if (!isVisible(node)) return [];
      return [
        {
          label,
          pressed: node.getAttribute("aria-pressed") === "true",
          inert: node.closest("[inert]") !== null,
          element: node,
          samePane: pane === null || pane.contains(node),
        },
      ];
    },
  );
  const inPane = buttons.filter((button) => button.samePane);
  return inPane.length > 0 ? inPane : buttons;
}

function buttonForAction(
  buttons: readonly LiveChangesPanelButton[],
  action: ChangesPanelAction,
): LiveChangesPanelButton | undefined {
  const label = action === "show-panel" ? SHOW_PANEL_LABEL : DIFF_PANEL_LABEL;
  return buttons.find(
    (button) =>
      labelMatches(button.label, label) && (action === "diff" || !button.inert),
  );
}

function isVisible(button: HTMLButtonElement): boolean {
  const view = button.ownerDocument.defaultView;
  const style = view?.getComputedStyle(button);
  if (!style || style.display === "none" || style.visibility === "hidden") {
    return false;
  }
  return button.getClientRects().length > 0;
}
