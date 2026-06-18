/**
 * Self-update: keep an open client from running a stale bundle after a deploy, so players
 * (and we) don't have to hard-refresh to see a new map/UI.
 *
 * Each build stamps a BUILD_ID into the bundle (__BUILD_ID__) and into a sibling version.json
 * (see vite.config.js). The running client polls version.json (with no-store, so the poll
 * itself is never cached) and, when it sees a newer build, reloads. A programmatic reload
 * revalidates index.html, which points at the new content-hashed assets — so the fresh bundle
 * loads without a manual hard-refresh.
 *
 * Reloading is idle-safe: it waits until the player isn't typing and isn't in combat, and
 * meanwhile shows a dismissable "new version" banner they can click to update right away.
 */

const POLL_MS = 3 * 60 * 1000; // how often to check for a new build
const IDLE_MS = 15 * 1000; // "idle" = no user input for at least this long
const SAFE_RETRY_MS = 5 * 1000; // re-check safety this often while a reload is pending
const RELOADED_KEY = 'mudjs.reloadedForBuild';

let lastInputAt = Date.now();
let pendingBuild = null; // the newer build we intend to reload into
let bannerShown = false;

function markInput() {
  lastInputAt = Date.now();
}

// webPrompt sends prompt.fight (>0 while fighting); prompt.js mirrors it onto window.mudprompt.
function inCombat() {
  return !!(window.mudprompt && window.mudprompt.fight > 0);
}

function isSafeToReload() {
  return Date.now() - lastInputAt > IDLE_MS && !inCombat();
}

function reload(target) {
  // Loop guard: if we already reloaded for this build and we're still on the old one, the
  // served bundle hasn't caught up (deploy/cache lag) — stop auto-reloading, keep the banner.
  try {
    if (sessionStorage.getItem(RELOADED_KEY) === target) return;
    sessionStorage.setItem(RELOADED_KEY, target);
  } catch (e) {
    /* sessionStorage may be unavailable (private mode) — reload anyway */
  }
  window.location.reload();
}

function reloadWhenSafe(target) {
  if (pendingBuild !== target) return; // superseded by an even newer build
  if (isSafeToReload()) {
    reload(target);
    return;
  }
  setTimeout(() => reloadWhenSafe(target), SAFE_RETRY_MS);
}

function showBanner(target) {
  if (bannerShown) return;
  bannerShown = true;
  const el = document.createElement('div');
  el.className = 'mudjs-update-banner';
  el.setAttribute('role', 'button');
  el.tabIndex = 0;
  el.textContent = 'Доступна новая версия клиента — нажми, чтобы обновить.';
  el.style.cssText =
    'position:fixed;left:0;right:0;bottom:0;z-index:99998;padding:8px 14px;' +
    'text-align:center;cursor:pointer;background:#1e1e1e;color:#BB86FC;' +
    'border-top:1px solid #BB86FC;font:13px/1.4 sans-serif';
  el.addEventListener('click', () => reload(target));
  el.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') reload(target);
  });
  (document.body || document.documentElement).appendChild(el);
}

function onNewBuild(target) {
  pendingBuild = target;
  showBanner(target); // immediate, dismissable affordance
  reloadWhenSafe(target); // auto-reload once the player is idle & out of combat
}

async function checkVersion() {
  try {
    const url = (import.meta.env.BASE_URL || '/') + 'version.json';
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    if (data && data.build && data.build !== __BUILD_ID__ && data.build !== pendingBuild) {
      onNewBuild(data.build);
    }
  } catch (e) {
    /* offline / transient — ignore and try again next tick */
  }
}

export function startAutoUpdate() {
  ['mousedown', 'keydown', 'input', 'touchstart', 'wheel'].forEach(ev =>
    document.addEventListener(ev, markInput, { passive: true, capture: true })
  );
  // A refocused tab is a natural moment to catch up on a deploy that happened while away.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkVersion();
  });
  setInterval(checkVersion, POLL_MS);
}
