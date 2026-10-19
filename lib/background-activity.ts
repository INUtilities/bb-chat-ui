import { heightTo } from "./motion.ts";
import { acceptJumpPulse, postHaptic, readHapticBridge } from "./send-haptic.ts";

export interface BackgroundActivity {
  id: string;
  description: string;
  lines: readonly string[];
}

interface AgentProgress {
  label?: string;
  state?: string;
  phaseTitle?: string;
  lastToolName?: string;
  lastToolSummary?: string;
  resultPreview?: string;
  error?: string;
}

interface RawCommand {
  id?: unknown;
  description?: unknown;
  taskStatus?: unknown;
  summary?: unknown;
  error?: unknown;
  workflow?: { agents?: AgentProgress[] } | null;
}

const TASK_STATUS: Record<string, string> = {
  pending: "대기",
  running: "실행 중",
  paused: "일시정지",
  completed: "완료",
  failed: "실패",
  killed: "중단됨",
  stopped: "중지",
};

const AGENT_STATE: Record<string, string> = {
  queued: "대기",
  running: "실행 중",
  done: "완료",
  failed: "실패",
  skipped: "건너뜀",
};

const ROW = '#thread-background-commands-card-body > div > div > div[class~="px-3"]';

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function named(map: Record<string, string>, value: string): string {
  return map[value] ?? value;
}

function agentDetail(agent: AgentProgress): string {
  if (agent.state === "failed") return text(agent.error);
  if (agent.state === "done") return text(agent.resultPreview) || text(agent.lastToolSummary);
  return text(agent.lastToolSummary);
}

export function agentProgressLine(agent: AgentProgress): string {
  const state = named(AGENT_STATE, text(agent.state));
  const head = [text(agent.phaseTitle), text(agent.label), state].filter(Boolean).join(" · ");
  const tool = agent.state === "running" || agent.state === "queued" ? text(agent.lastToolName) : "";
  const detail = agentDetail(agent);
  if (tool && detail) return `${head} · ${tool} — ${detail}`;
  if (tool) return `${head} · ${tool}`;
  if (detail) return head ? `${head} — ${detail}` : detail;
  return head;
}

function visibleAgents(agents: readonly AgentProgress[]): AgentProgress[] {
  const active = agents.filter(agent => agent.state === "running" || agent.state === "queued");
  if (active.length) return active;
  const notable = [...agents].reverse().find(agent => text(agent.error) || text(agent.resultPreview) || text(agent.lastToolSummary));
  if (notable) return [notable];
  return agents.length ? [agents[agents.length - 1]!] : [];
}

export function activityLines(command: RawCommand): readonly string[] {
  const lines = [named(TASK_STATUS, text(command.taskStatus) || "pending")];
  const agents = visibleAgents(command.workflow?.agents ?? []);
  if (agents.length) {
    lines.push(...agents.map(agentProgressLine).filter(Boolean));
    return lines;
  }
  const summary = text(command.summary);
  const error = text(command.error);
  if (summary) lines.push(summary);
  if (error && error !== summary) lines.push(error);
  if (lines.length === 1) lines.push("진행 내용 없음");
  return lines;
}

export function backgroundActivities(timeline: { activeBackgroundCommands?: readonly unknown[] } | null | undefined): BackgroundActivity[] {
  const commands = timeline?.activeBackgroundCommands ?? [];
  const activities: BackgroundActivity[] = [];
  for (const item of commands) {
    if (!item || typeof item !== "object") continue;
    const command = item as RawCommand;
    const id = text(command.id);
    const description = text(command.description);
    if (!id || !description) continue;
    activities.push({ id, description, lines: activityLines(command) });
  }
  return activities;
}

export function pairActivities(labels: readonly string[], activities: readonly BackgroundActivity[]): (BackgroundActivity | null)[] {
  const used = new Set<string>();
  return labels.map(label => {
    const match = activities.find(activity => activity.description === label && !used.has(activity.id));
    if (!match) return null;
    used.add(match.id);
    return match;
  });
}

function rowLabel(row: HTMLElement): string {
  for (const span of Array.from(row.querySelectorAll("span[title]"))) {
    const title = span.getAttribute("title")?.trim() ?? "";
    if (title && !title.startsWith("Model:")) return title;
  }
  return row.textContent?.trim() || "";
}

function headerCommand(host: HTMLElement): { row: HTMLElement; description: string; inDisclosure: boolean } | null {
  const body = host.querySelector("#thread-background-commands-card-body");
  for (const span of Array.from(host.querySelectorAll("span[title]"))) {
    if (body?.contains(span)) continue;
    const description = span.getAttribute("title")?.trim() ?? "";
    if (!description || description.startsWith("Model:")) continue;
    const row = span.closest("div");
    const HtmlElement = span.ownerDocument.defaultView?.HTMLElement;
    if (!HtmlElement || !(row instanceof HtmlElement)) continue;
    const inDisclosure = Boolean(row.closest("button") || row.querySelector("button[aria-expanded], button[aria-controls]"));
    return { row, description, inDisclosure };
  }
  return null;
}

interface BoundRow {
  cursor: string;
  onClick: (event: Event) => void;
  onKey: (event: KeyboardEvent) => void;
}

export function createBackgroundAccordions(document: Document) {
  const mark = "data-bb-chat-ui-info";
  const bound = new Map<HTMLElement, BoundRow>();
  let currentActivities: readonly BackgroundActivity[] = [];
  let openId: string | null = null;
  let panel: HTMLElement | null = null;
  let animation: Animation | null = null;
  const lastPulse = new Map<string, number>();

  const finishMotion = (node: HTMLElement) => {
    animation?.cancel();
    animation = null;
    node.style.height = "";
    node.style.overflow = "";
  };

  const removePanel = () => {
    if (!panel) return;
    const node = panel;
    panel = null;
    openId = null;
    finishMotion(node);
    node.remove();
  };

  const release = (row: HTMLElement) => {
    const saved = bound.get(row);
    if (!saved) return;
    row.removeEventListener("click", saved.onClick);
    row.removeEventListener("keydown", saved.onKey);
    row.removeAttribute(`${mark}-activity`);
    row.removeAttribute("role");
    row.removeAttribute("tabindex");
    row.removeAttribute("aria-expanded");
    row.removeAttribute("aria-controls");
    if (saved.cursor) row.style.cursor = saved.cursor;
    else row.style.removeProperty("cursor");
    bound.delete(row);
  };

  const writePanel = (activity: BackgroundActivity) => {
    if (!panel) return;
    const current = Array.from(panel.children, child => child.textContent);
    if (current.length === activity.lines.length && current.every((line, index) => line === activity.lines[index])) return;
    panel.replaceChildren(...activity.lines.map(line => {
      const item = document.createElement("div");
      item.textContent = line;
      return item;
    }));
  };

  const mountPanel = (row: HTMLElement, node: HTMLElement) => {
    if (row.closest("#thread-background-commands-card-body")) row.after(node);
    else (row.parentElement ?? row).after(node);
  };

  const pulse = (id: string) => {
    const now = document.defaultView?.performance?.now() ?? Date.now();
    const next = acceptJumpPulse(lastPulse.get(id) ?? null, now);
    if (next === null) return;
    lastPulse.set(id, next);
    postHaptic(readHapticBridge(document.defaultView), "impact-light");
  };

  const toggle = (row: HTMLElement, activity: BackgroundActivity) => {
    pulse(activity.id);
    if (openId === activity.id) {
      const node = panel;
      openId = null;
      row.setAttribute("aria-expanded", "false");
      row.removeAttribute("aria-controls");
      if (!node) return;
      panel = null;
      const height = node.getBoundingClientRect().height || node.scrollHeight;
      animation?.cancel();
      animation = heightTo(node, height, 0);
      if (!animation) node.remove();
      else {
        node.style.overflow = "hidden";
        animation.onfinish = () => { if (panel !== node) node.remove(); };
      }
      return;
    }
    for (const other of bound.keys()) if (other !== row) other.setAttribute("aria-expanded", "false");
    removePanel();
    const next = document.createElement("div");
    next.id = `bb-chat-ui-activity-${activity.id}`;
    next.setAttribute(`${mark}-activity-panel`, activity.id);
    panel = next;
    openId = activity.id;
    writePanel(activity);
    mountPanel(row, next);
    row.setAttribute("aria-expanded", "true");
    row.setAttribute("aria-controls", next.id);
    const height = next.scrollHeight;
    next.style.height = "0px";
    next.style.overflow = "hidden";
    animation = heightTo(next, 0, height);
    if (!animation) finishMotion(next);
    else animation.onfinish = () => { if (panel === next) finishMotion(next); };
  };

  return {
    sync(host: HTMLElement | null, activities: readonly BackgroundActivity[]) {
      currentActivities = activities;
      const header = host ? headerCommand(host) : null;
      const pool = activities.slice();
      if (header?.inDisclosure) {
        const claimed = pool.findIndex(activity => activity.description === header.description);
        if (claimed >= 0) pool.splice(claimed, 1);
      }
      const listed = host ? Array.from(host.querySelectorAll<HTMLElement>(ROW)) : [];
      const rows = header && !header.inDisclosure && !listed.includes(header.row) ? [header.row, ...listed] : listed;
      const paired = pairActivities(rows.map(rowLabel), pool);
      const live = new Set(rows);
      for (const row of bound.keys()) if (!live.has(row)) release(row);
      if (!host) { removePanel(); return; }
      rows.forEach((row, index) => {
        const activity = paired[index];
        if (!activity) {
          if (openId && row.getAttribute(`${mark}-activity`) === openId) removePanel();
          release(row);
          return;
        }
        let saved = bound.get(row);
        if (!saved) {
          const currentActivity = () => currentActivities.find(item => item.id === row.getAttribute(`${mark}-activity`));
          const onClick = (event: Event) => {
            const current = currentActivity();
            if (!current) return;
            event.preventDefault();
            toggle(row, current);
          };
          const onKey = (event: KeyboardEvent) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            if (event.repeat) return;
            const current = currentActivity();
            if (!current) return;
            event.preventDefault();
            toggle(row, current);
          };
          saved = { cursor: row.style.cursor, onClick, onKey };
          row.addEventListener("click", onClick);
          row.addEventListener("keydown", onKey);
          bound.set(row, saved);
        }
        row.setAttribute(`${mark}-activity`, activity.id);
        row.setAttribute("role", "button");
        row.tabIndex = 0;
        row.style.cursor = "pointer";
        const expanded = openId === activity.id;
        row.setAttribute("aria-expanded", String(expanded));
        if (expanded && panel) {
          row.setAttribute("aria-controls", panel.id);
          const anchor = row.closest("#thread-background-commands-card-body") ? row : (row.parentElement ?? row);
          if (panel.previousElementSibling !== anchor) mountPanel(row, panel);
          writePanel(activity);
        } else row.removeAttribute("aria-controls");
      });
      if (openId && !Array.from(bound.keys()).some(row => row.getAttribute(`${mark}-activity`) === openId)) removePanel();
    },
    stop() {
      removePanel();
      for (const row of Array.from(bound.keys())) release(row);
    },
  };
}
