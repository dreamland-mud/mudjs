/* Tools: the windows and keys brought over from the desktop client.
 *
 * A tool registers once: a label, its keys, a #command, and run(arg). It then
 * shows in the Tools menu (a button over the output, so phones reach it too),
 * answers its keys anywhere in the game, and runs from the command line as
 * #<hash>. The player's own macro on the same key always wins. */
import $ from 'jquery';
import Commands from '../components/SysCommands';
import { parseStringCmd } from '../components/sysCommandUtils';
import keycode from '../components/sysCommands/keycode';
import { macroFor } from '../macros.js';
import { isShown, screenReaderMode } from '../review';
import { t } from '../i18n';

const tools = [];
const byKey = new Map();
const subscribers = new Set();

/* The player's own keys for the tools (Settings, System actions): { id: [keys] }.
 * A tool not in it has its default keys; an empty list means no key at all.
 * Kept in this browser. */
const KEYS_KEY = 'mudjs.toolKeys';
let custom = (() => {
  try {
    return JSON.parse(localStorage.getItem(KEYS_KEY)) || {};
  } catch (e) {
    return {};
  }
})();

/* The first tool to claim a key keeps it, as in registerTool. */
function rebuildKeys() {
  byKey.clear();
  tools.forEach(tool =>
    tool.keys.forEach(k => {
      if (!byKey.has(k)) byKey.set(k, tool);
    })
  );
}

/* Give a tool these keys (null: back to its defaults). A key another tool had
 * is taken from it. Returns the tools that lost a key, for the caller to say. */
export function setToolKeys(id, keys) {
  const lost = [];
  if (keys) {
    keys.forEach(k => {
      const had = byKey.get(k);
      if (had && had.id !== id) {
        custom[had.id] = had.keys.filter(x => x !== k);
        lost.push(had);
      }
    });
    custom[id] = keys.slice();
  } else delete custom[id];
  try {
    localStorage.setItem(KEYS_KEY, JSON.stringify(custom));
  } catch (e) {
    /* storage blocked: for this page only */
  }
  rebuildKeys();
  subscribers.forEach(fn => fn());
  return lost;
}

/* The tool that has this key now, if any. */
export const toolForKey = key => byKey.get(key) || null;

/* All the client's own keys on or off (Settings, Macros: "Client keys"). On
 * by default in screen reader mode, off otherwise; off, the browser keeps its shortcuts (Ctrl+F, Ctrl+L and the
 * rest) and the tools still open from the Tools menu and their # commands. */
const KEYS_ON_KEY = 'mudjs.toolKeysOn';
export function toolKeysOn() {
  try {
    const v = localStorage.getItem(KEYS_ON_KEY);
    // Not chosen: on in screen reader mode (the game's setting or review
    // mode), off otherwise, so the browser keeps its shortcuts for everyone else.
    return v === null ? screenReaderMode() : v === '1';
  } catch (e) {
    return screenReaderMode();
  }
}
export function setToolKeysOn(on) {
  try {
    localStorage.setItem(KEYS_ON_KEY, on ? '1' : '0');
  } catch (e) {
    /* storage blocked: for this page only */
  }
  subscribers.forEach(fn => fn());
}

/* While Settings waits for a new key, no tool answers it. */
let capturing = false;
export function setCapturing(on) {
  capturing = !!on;
}

/* tool: { id, label: () => string, keys: ['ctrl+e'], hash: 'areas',
 *   run(arg), menu: true (listed in the Tools menu), inDialog: false (also
 *   answers its keys while a dialog is open), help: () => string } */
export function registerTool(tool) {
  if (tools.some(x => x.id === tool.id)) return;
  // keys reads the player's own keys when there are any; defaultKeys keeps
  // the tool's own.
  tool.defaultKeys = (tool.keys || []).slice();
  Object.defineProperty(tool, 'keys', {
    get: () => (Object.prototype.hasOwnProperty.call(custom, tool.id) ? custom[tool.id] : tool.defaultKeys),
    configurable: true,
  });
  tools.push(tool);
  tool.keys.forEach(k => {
    if (!byKey.has(k)) byKey.set(k, tool);
  });
  if (tool.hash) {
    Commands[tool.hash] = {
      payload: value => {
        tool.run(parseStringCmd(value).join(' ').trim());
        afterRun();
      },
      // Getters: #help shows them in the language and state of the moment.
      help: {
        get title() {
          const keys = keyLabel(tool.keys);
          return `${tool.label()} (#${tool.hash}${keys ? ', ' + keys : ''})`;
        },
        get description() {
          return tool.help ? tool.help() : tool.label();
        },
      },
    };
  }
  subscribers.forEach(fn => fn());
}

export function listTools() {
  return tools.filter(x => x.menu !== false);
}

/* Every tool, also those kept out of the menu: the key list shows them all. */
export function allTools() {
  return tools.slice();
}

export function onToolsChanged(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

export function runTool(id, arg) {
  const tool = tools.find(x => x.id === id);
  if (tool) tool.run(arg || '');
  afterRun();
}

/* A tool whose window was already open, with the focus gone elsewhere, gets
 * the focus back (Sheet.jsx listens). */
function afterRun() {
  setTimeout(() => $(document).trigger('port:sheet-refocus'), 80);
}

/* The key's name as macros know it: "ctrl+e", "alt+1", "ctrl+shift+f". */
export function keyName(e) {
  return keycode.hotkey(e);
}

/* Spoken form of a key list for labels: "Ctrl+E". */
export function keyLabel(keys) {
  return (keys || [])
    .map(k => k.split('+').map(p => (p.length === 1 ? p.toUpperCase() : p[0].toUpperCase() + p.slice(1))).join('+'))
    .join(', ');
}

const DESTRUCTIVE = new Set(['ctrl+shift+r']);

const EDITABLE = 'input, textarea, select, [contenteditable="true"], .monaco-editor, .ace_editor';

/* Where a tool key is allowed: anywhere in the game, but not while typing in
 * some other field (a dialog's own search box keeps Ctrl+F and friends), and
 * not over another dialog unless the tool asks for it. The command line and
 * the output review are part of the game. */
const DIALOG = '[role="dialog"], [aria-modal="true"], .modal';

/* The window the focus is in, if it is one that is shown. Only the focus
 * counts: a window left in the page closed, or one the browser still thinks
 * has a size, does not take the keys away from the game. */
function focusDialog(el) {
  const dlg = el && el.closest && el.closest(DIALOG);
  return dlg && isShown(dlg) ? dlg : null;
}

function allowedHere(e, tool) {
  const el = e.target;
  if (!el || !el.closest) return true;
  if (focusDialog(el) && !tool.inDialog) return false;
  if (el.id === 'inputBox' || el.id === 'outputReview') return true;
  if (el.closest('.port-sheet') && tool.inDialog) return true;
  return !el.closest(EDITABLE);
}

window.addEventListener(
  'keydown',
  e => {
    if (e.defaultPrevented || e.metaKey || capturing || !toolKeysOn()) return;
    const name = keyName(e);
    if (!name) return;
    const tool = byKey.get(name);
    if (!tool) return;
    // The player's macro on this key wins: leave the key to the command line.
    if (macroFor(name)) return;
    if (!allowedHere(e, tool)) {
      // Not here. The key keeps its usual meaning (zoom, text selection),
      // except where that would drop the game: a hard reload.
      // Alt keys too: in Firefox they open the browser's menus, which helps
      // nobody in the game.
      if (DESTRUCTIVE.has(name) || e.altKey) e.preventDefault();
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    tool.run('', e);
    afterRun();
  },
  true
);

/* The Tools page of Settings (Accessibility): Alt+Shift+T and #tools. */

registerTool({
  id: 'menu',
  label: () => t('tools.menu'),
  hash: 'tools',
  keys: ['alt+shift+t'],
  menu: false,
  run: () => $(document).trigger('settings:open', ['tools']),
});
