/** Search a single addition locally, or a shared parent once for a sibling batch. */
export function addedMutationRoots(records: readonly MutationRecord[]): Element[] {
  const additions = new Map<Node, Element[]>();
  for (const record of records) for (const node of Array.from(record.addedNodes)) {
    if (node.nodeType !== 1 || !node.isConnected) continue;
    let siblings = additions.get(record.target);
    if (!siblings) additions.set(record.target, siblings = []);
    siblings.push(node as Element);
  }
  const roots = new Set<Element>();
  for (const [parent, nodes] of additions) {
    if (nodes.length > 1 && parent.nodeType === 1 && parent.isConnected) roots.add(parent as Element);
    else for (const node of nodes) roots.add(node);
  }
  return Array.from(roots).filter(root => {
    for (let parent = root.parentElement; parent; parent = parent.parentElement) if (roots.has(parent)) return false;
    return true;
  });
}
