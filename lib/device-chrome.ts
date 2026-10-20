import { createElement, useLayoutEffect, useRef } from "react";
import { useDeviceChrome } from "./use-device.ts";
import { mountDeviceRoot } from "./device-root.ts";

export const PHONE_NARROW = 'html[data-bb-chat-ui-root-device="phone"][data-bb-chat-ui-root-viewport="narrow"]';
export const NARROW_VIEWPORT = 'html[data-bb-chat-ui-root-viewport="narrow"]';
export const ROOMY_VIEWPORT = 'html:is([data-bb-chat-ui-root-viewport="medium"], [data-bb-chat-ui-root-viewport="wide"])';
export const SMALL_HIT_TARGET = 'html[data-bb-chat-ui-root-hit-target="small"]';
export const LARGE_HIT_TARGET = 'html[data-bb-chat-ui-root-hit-target="large"]';

export function DeviceChromeBridge() {
  const chrome = useDeviceChrome();
  const { device, orientation, viewport, hitTarget } = chrome;
  const lease = useRef<ReturnType<typeof mountDeviceRoot> | null>(null);
  useLayoutEffect(() => {
    lease.current = mountDeviceRoot(document, chrome);
    return () => {
      lease.current?.dispose(); lease.current = null;
    };
  }, []);
  useLayoutEffect(() => {
    lease.current?.update(chrome);
  }, [device, orientation, viewport, hitTarget]);
  return createElement("span", {
    hidden: true,
    "data-bb-chat-ui-device": device,
    "data-bb-chat-ui-orientation": orientation,
    "data-bb-chat-ui-viewport": viewport,
    "data-bb-chat-ui-hit-target": hitTarget,
  });
}

export function isDesktopChrome(document: Document): boolean {
  return document.querySelector('[data-bb-chat-ui-device="desktop"]') !== null;
}

export function hasSmallHitTarget(document: Document): boolean {
  return document.querySelector('[data-bb-chat-ui-hit-target="small"]') !== null;
}
