/* Tool windows register their React component here; ToolsHost mounts them. */
const list = [];
const subscribers = new Set();

export function registerView(id, Component) {
  if (list.some(v => v.id === id)) return;
  list.push({ id, Component });
  subscribers.forEach(fn => fn());
}

export const views = () => list;

export function onViewsChanged(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}
