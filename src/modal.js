/* A modal window keeps the rest of the page out of reach while it is open:
 * every sibling of the window and of each of its ancestors is made inert, so
 * a screen reader cannot swipe or arrow out of it into the game behind.
 *
 * Two things matter:
 * - Windows can stack (Settings, then a tool over it). Each element counts how
 *   many open windows want it inert, and only the last one to close frees it.
 * - Live regions keep speaking. An element that holds one (the game output's
 *   announcer sits deep in the game) is not made inert as a whole: its
 *   children are, except the path down to the live region. */
const LIVE = '[aria-live], #chatBufferAnnounce, .terminal-announcer';
const KEEP = '.port-scrim, .hs-scrim, .cfg-scrim, script';

function hold(el, made) {
  // Already inert on its own (a collapsed part of the page): the page keeps it
  // so; this is noted so that closing the window does not wake it.
  if (el.hasAttribute('inert') && !el.dataset.inertHolds) el.dataset.inertOwn = '1';
  const n = Number(el.dataset.inertHolds || 0) + 1;
  el.dataset.inertHolds = String(n);
  el.setAttribute('inert', '');
  made.push(el);
}

function release(el) {
  const n = Number(el.dataset.inertHolds || 0) - 1;
  if (n > 0) {
    el.dataset.inertHolds = String(n);
    return;
  }
  delete el.dataset.inertHolds;
  if (el.dataset.inertOwn) delete el.dataset.inertOwn;
  else el.removeAttribute('inert');
}

/* Make el inert, or, when a live region is inside it, everything in it but
 * the way to that region. */
function shut(el, made) {
  if (el.matches(KEEP) || el.matches(LIVE)) return;
  if (!el.querySelector(LIVE)) return hold(el, made);
  Array.from(el.children).forEach(child => shut(child, made));
}

export function inertAround(el) {
  const made = [];
  for (let node = el; node && node !== document.body; node = node.parentElement) {
    const parent = node.parentElement;
    if (!parent) break;
    Array.from(parent.children).forEach(sib => {
      if (sib !== node) shut(sib, made);
    });
  }
  return () => made.forEach(release);
}
