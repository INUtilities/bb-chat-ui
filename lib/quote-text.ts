export const QUOTE_PROVIDER_ID = "quote";
export const QUOTE_LABEL_MAX = 42;
export const QUOTE_CODE_ICON = "FileDiff";
export const QUOTE_SELECTION_ICON = "Quote";
export const QUOTE_WHOLE_ICON = "MessageSquare";
export const QUOTE_GESTURE_ATTR = "data-bb-chat-ui-quote-gesture";

export type QuoteGesture = "message" | "selection";

export function quoteStorageKey(id: string): string {
  return `quote:${id}`;
}

export function isQuoteMentionResource(resource: unknown): boolean {
  if (typeof resource !== "object" || resource === null) return false;
  const record = resource as { kind?: unknown; itemId?: unknown; pluginId?: unknown; provider?: unknown };
  if (record.kind !== "plugin") return false;
  if (typeof record.itemId === "string") return record.itemId.startsWith(`${QUOTE_PROVIDER_ID}:`);
  // BB 0.47 (SDK 0.6.80) node.attrs.mention: { kind, pluginId, provider, id }.
  return record.pluginId === "bb-chat-ui" && record.provider === QUOTE_PROVIDER_ID;
}

export function quoteMentionIcon(
  body: string,
  gesture: QuoteGesture | null = null,
): string {
  const line = body
    .split("\n")
    .map((part) => part.trim())
    .find((part) => part.length > 0);
  if (line?.startsWith("diff --git ")) return QUOTE_CODE_ICON;
  if (gesture === "message") return QUOTE_WHOLE_ICON;
  return QUOTE_SELECTION_ICON;
}

export function quoteGestureFromControl(control: {
  role: string | null;
  ariaLabel: string | null;
  text: string;
}): QuoteGesture | null {
  const aria = normalizeControlText(control.ariaLabel);
  const text = normalizeControlText(control.text);
  if (control.role === "menuitem" && text === "Add to chat") return "message";
  if (aria === "Add to chat") return "message";
  if (text === "Add to chat") return "selection";
  return null;
}

export function readQuoteGesture(value: string | null): QuoteGesture | null {
  return value === "message" || value === "selection" ? value : null;
}

function normalizeControlText(value: string | null): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

export function quoteLabel(body: string): string | null {
  const line = body
    .split("\n")
    .map((part) => part.trim())
    .find((part) => part.length > 0);
  if (!line) return null;
  const file = quoteCodeFileName(line);
  if (file) {
    const firstFile = body.split(/\n(?=diff --git )/, 1)[0] ?? body;
    const ranges = Array.from(firstFile.matchAll(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gm))
      .map((match) => {
        const removed = Number(match[4] ?? 1) === 0;
        const start = Number(removed ? match[1] : match[3]);
        const count = Number((removed ? match[2] : match[4]) ?? 1);
        if (start < 1 || count < 1) return null;
        return count === 1 ? `${start}` : `${start}–${start + count - 1}`;
      })
      .filter((range): range is string => range !== null);
    return ranges.length > 0 ? `${file}:${Array.from(new Set(ranges)).join(", ")}` : file;
  }
  // The host parses Markdown markers before mentions, so labels must be plain text.
  let flat = line;
  while (true) {
    const plain = flat
      .replace(/^(?:(?:#{1,6}|>+|[-*+]|\d+[.)])\s+)+/u, "")
      .replace(/(\*\*|__|`+)(.+?)\1/gu, "$2")
      .replace(/(^|[^\p{L}\p{N}])([_*])([^_*]+)\2(?=$|[^\p{L}\p{N}])/gu, "$1$3");
    if (plain === flat) break;
    flat = plain;
  }
  flat = flat.replace(/\s+/g, " ").trim();
  if (!flat) return null;
  if (flat.length <= QUOTE_LABEL_MAX) return flat;
  const clipped = flat.slice(0, QUOTE_LABEL_MAX - 1).trimEnd();
  return `${clipped}…`;
}

function quoteCodeFileName(line: string): string | null {
  if (!line.startsWith("diff --git ")) return null;
  const paths = gitPaths(line.slice("diff --git ".length));
  const from = stripGitSide(paths[0], "a/");
  const to = stripGitSide(paths[1], "b/");
  const path = to && to !== "/dev/null" ? to : from;
  if (!path || path === "/dev/null") return null;
  const name = path.split("/").pop();
  return name && name.length > 0 ? name : null;
}

function gitPaths(rest: string): string[] {
  const paths: string[] = [];
  let index = 0;
  while (index < rest.length && paths.length < 2) {
    while (rest[index] === " ") index += 1;
    if (index >= rest.length) break;
    if (rest[index] === '"') {
      let end = index + 1;
      let value = "";
      while (end < rest.length && rest[end] !== '"') {
        if (rest[end] === "\\" && end + 1 < rest.length) {
          value += rest[end + 1];
          end += 2;
          continue;
        }
        value += rest[end];
        end += 1;
      }
      paths.push(value);
      index = end + 1;
      continue;
    }
    const next = rest.indexOf(" ", index);
    const token = next === -1 ? rest.slice(index) : rest.slice(index, next);
    if (token.length === 0) break;
    paths.push(token);
    index = next === -1 ? rest.length : next + 1;
  }
  return paths;
}

function stripGitSide(path: string | undefined, prefix: string): string | null {
  if (!path) return null;
  return path.startsWith(prefix) ? path.slice(prefix.length) : path;
}

export function quoteItemId(seed = crypto.randomUUID()): string {
  return seed.replace(/-/g, "");
}

export function quoteMentionAttrs(
  pluginId: string,
  id: string,
  label: string,
): {
  resource: {
    kind: "plugin";
    pluginId: string;
    itemId: string;
    label: string;
    icon: null;
  };
  serializedText: string;
} {
  return {
    resource: {
      kind: "plugin",
      pluginId,
      itemId: `${QUOTE_PROVIDER_ID}:${id}`,
      label,
      icon: null,
    },
    serializedText: label,
  };
}
