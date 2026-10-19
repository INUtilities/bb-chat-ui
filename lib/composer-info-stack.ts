import type { InfoKind } from './composer-info-settings.ts';

export function infoStack(keys: readonly InfoKind[], active: ReadonlySet<string>, visible: ReadonlySet<string>, showInactive = false): { icons:InfoKind[]; more:number; moreActive:boolean; width:number } {
  const collapsed=keys.filter(key=>!visible.has(key) && (showInactive || active.has(key)));
  const ordered=[...collapsed.filter(key=>active.has(key)),...collapsed.filter(key=>!active.has(key))];
  const icons=ordered.slice(0,3), rest=ordered.slice(3), circles=icons.length+(rest.length?1:0);
  return {icons,more:rest.length,moreActive:rest.some(key=>active.has(key)),width:circles?32+18*(circles-1):0};
}
