import assert from "node:assert/strict";
import test from "node:test";
import { readDevice, readOrientation, readViewport, type DeviceSignals } from "./device.ts";
import { quotePillCss } from "./quote-pill.ts";
import { userAttachmentsCss } from "./user-attachments.ts";
import { composerGlassCss } from "./composer-glass.ts";

const desktop: DeviceSignals = {
  hoverNone: false, pointerCoarse: false, pointerFine: true, anyPointerCoarse: false,
  screenWidth: 1920, screenHeight: 1080, maxTouchPoints: 0,
  userAgent: "Electron", platform: "MacIntel",
};
const phone: DeviceSignals = {
  hoverNone: true, pointerCoarse: true, pointerFine: false, anyPointerCoarse: true,
  screenWidth: 390, screenHeight: 844, maxTouchPoints: 5,
  userAgent: "iPhone", platform: "iPhone",
};

test("the same narrow viewport keeps phone and desktop as distinct devices", () => {
  assert.equal(readViewport(390), "narrow");
  assert.equal(readDevice(desktop), "desktop");
  assert.equal(readDevice(phone), "phone");
  assert.equal(readDevice({ ...desktop, pointerCoarse: true, anyPointerCoarse: true }), "desktop");
});

test("rotating a phone keeps its identity and its existing viewport layout", () => {
  assert.equal(readDevice({ ...phone, screenWidth: 844, screenHeight: 390 }), "phone");
  assert.equal(readOrientation(false), "landscape");
  assert.equal(readViewport(844), "medium");
  assert.equal(readViewport(667), "narrow");
});

test("phone sizing consumes helper axes and composer motion shares a timeline across devices", () => {
  const phoneNarrow = 'html[data-bb-chat-ui-root-device="phone"][data-bb-chat-ui-root-viewport="narrow"]';
  for (const css of [userAttachmentsCss(), composerGlassCss]) {
    assert.ok(css.includes(phoneNarrow));
    assert.doesNotMatch(css, /@media[^\{]*(?:width|pointer|hover)/);
  }
  assert.match(quotePillCss(), /html\[data-bb-chat-ui-root-device="phone"\]/);
  assert.doesNotMatch(quotePillCss(), /@media[^\{]*(?:width|pointer|hover)/);
  assert.match(composerGlassCss, /\[data-scroll-footer\]\[data-bb-chat-ui-glass\] \[data-promptbox\]\s*\{[^}]*height 360ms cubic-bezier\(0\.22, 1, 0\.36, 1\),\s*border-radius 360ms cubic-bezier\(0\.22, 1, 0\.36, 1\)/);
  assert.doesNotMatch(composerGlassCss, /html\[data-bb-chat-ui-root-hit-target="small"\][^}]*height 360ms/);
});
