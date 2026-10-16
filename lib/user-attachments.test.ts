import assert from "node:assert/strict";
import test from "node:test";

import { userAttachmentsCss } from "./user-attachments.ts";

const USER_BUBBLE =
  String.raw`\[data-message-column\] > \.group\\/message\.ml-auto > \.flex > \.rounded-xl\[data-bb-chat-ui-attach-bubble\]`;

test("lifts user photos and files above the message bubble", () => {
  const css = userAttachmentsCss();
  assert.match(css, new RegExp(`${USER_BUBBLE}\\s*\\{[^}]*display:\\s*contents;`));
  assert.match(
    css,
    new RegExp(`${USER_BUBBLE} > \\.mt-2\\.space-y-2\\s*\\{[^}]*display:\\s*contents;`),
  );
  assert.match(
    css,
    new RegExp(
      `${USER_BUBBLE} > \\.mt-2\\.space-y-2 > \\.flex\\s*\\{[^}]*order:\\s*-1;`,
    ),
  );
  assert.match(
    css,
    new RegExp(
      `${USER_BUBBLE} > \\.mt-2\\.space-y-2 > \\.flex:last-child\\s*\\{[^}]*margin-bottom:\\s*8px;`,
    ),
  );
  assert.match(
    css,
    new RegExp(
      `${USER_BUBBLE} > \\.break-words\\s*\\{[^}]*background:\\s*var\\(--surface-recessed\\);`,
    ),
  );
  assert.match(
    css,
    new RegExp(
      `${USER_BUBBLE} > \\.break-words\\s*\\{[^}]*border:\\s*1px solid var\\(--border-seam\\);`,
    ),
  );
  assert.match(
    css,
    new RegExp(
      `${USER_BUBBLE} > \\.break-words\\s*\\{[^}]*border-radius:\\s*calc\\(var\\(--radius\\) \\+ 4px\\);`,
    ),
  );
  assert.match(
    css,
    new RegExp(
      `${USER_BUBBLE} > \\.break-words\\s*\\{[^}]*padding:\\s*0\\.625rem 1rem;`,
    ),
  );
  assert.match(
    css,
    new RegExp(`${USER_BUBBLE}\\[data-bb-chat-ui-attach-no-body\\] > p\\s*\\{[^}]*display:\\s*none;`),
  );
  assert.match(
    css,
    new RegExp(`${USER_BUBBLE}\\[data-bb-chat-ui-attach-meta\\] > \\.break-words\\s*\\{[^}]*padding-bottom:\\s*1\\.75rem;`),
  );
  assert.match(
    css,
    new RegExp(`${USER_BUBBLE} > \\.mt-1\\s*\\{[^}]*margin-top:\\s*-1\\.5rem;`),
  );
  assert.match(
    css,
    new RegExp(
      `${USER_BUBBLE} > \\.break-words\\[style\\*="mask-image"\\]\\s*\\{[^}]*mask-image:\\s*none !important;`,
    ),
  );
  assert.doesNotMatch(css, /var\(--radius-xl\)/);
  assert.doesNotMatch(css, /width < 48rem/);
});

test("thickens user file chips and paints a file icon", () => {
  const css = userAttachmentsCss();
  const chip = `${USER_BUBBLE} > \\.mt-2\\.space-y-2 > \\.flex\\[data-bb-chat-ui-file-row\\] > :is\\(a, button, span\\)`;
  assert.match(css, new RegExp(`${chip}\\s*\\{[^}]*min-height:\\s*64px;`));
  assert.match(css, new RegExp(`${chip}\\s*\\{[^}]*border-radius:\\s*20px;`));
  assert.match(
    css,
    new RegExp(`${chip}\\s*\\{[^}]*padding:\\s*6px 14px 6px 12px;`),
  );
  assert.match(css, new RegExp(`${chip}\\s*\\{[^}]*gap:\\s*6px;`));
  assert.match(css, new RegExp(`${chip}::before\\s*\\{[^}]*width:\\s*28px;`));
  assert.match(css, new RegExp(`${chip}::before\\s*\\{[^}]*height:\\s*28px;`));
  assert.match(css, new RegExp(`${chip}::before\\s*\\{[^}]*mask:`));
});

test("enlarges sent file chips only for phones with a narrow helper viewport", () => {
  const css = userAttachmentsCss();
  const chip = `${USER_BUBBLE} > \\.mt-2\\.space-y-2 > \\.flex\\[data-bb-chat-ui-file-row\\] > :is\\(a, button, span\\)`;
  const marker = 'html[data-bb-chat-ui-root-device="phone"][data-bb-chat-ui-root-viewport="narrow"]';
  const start = css.indexOf(marker);
  const base = css.slice(0, start);
  const touch = start < 0 ? "" : css.slice(start);
  assert.ok(touch);
  assert.match(base, new RegExp(`${chip}\\s*\\{[^}]*min-height:\\s*40px;`));
  assert.match(base, new RegExp(`${chip}\\s*\\{[^}]*border-radius:\\s*12px;`));
  assert.match(base, new RegExp(`${chip}::before\\s*\\{[^}]*width:\\s*18px;`));
  assert.match(touch, new RegExp(`${chip}\\s*\\{[^}]*min-height:\\s*64px;`));
  assert.match(touch, new RegExp(`${chip}\\s*\\{[^}]*border-radius:\\s*20px;`));
  assert.match(touch, new RegExp(`${chip}::before\\s*\\{[^}]*flex:\\s*0 0 28px;`));
  assert.match(touch, new RegExp(`${chip}::before\\s*\\{[^}]*width:\\s*28px;`));
  assert.match(touch, new RegExp(`${chip}::before\\s*\\{[^}]*height:\\s*28px;`));
});


test("composites clipped text against the host canvas or sidebar chat tone", () => {
  const css = userAttachmentsCss();
  assert.doesNotMatch(css, /--bb-chat-ui-canvas/);
  assert.match(css, /linear-gradient\(var\(--surface-recessed\), var\(--surface-recessed\)\),\s*var\(--background\)/);
  assert.match(css, /\[data-thread-window\]\[data-surface-tone="sidebar"\][^{]*::after\s*\{[^}]*var\(--sidebar\)/);
});
