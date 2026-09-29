import $ from 'jquery';
import { send, rpccmd } from '../../websock';
import { parseStringCmd, echoHtml, clickableLink } from '../sysCommandUtils';

// Player-managed manual autobuff list, stored per browser in
// localStorage.autobuff as an array of { gate, cmd }. The '~' key (defaults.js)
// and the panel button both call runAutobuff(): it fires the server-side
// auto-buff (rpccmd 'autobuff', computed from the character's live practices and
// level, so it self-updates) and then each manual entry -- the things the server
// can't know: a pet's haste, a cross-class order. A manual entry is gated on an
// affect sysname the server publishes in mudprompt.affsn: it fires only while
// that affect is absent. Gate '*' fires every time.
//
// Those browser lines are the LEGACY path. The settings tab (AutobuffPage) keeps
// the player's own lines on the character, server-side, next to which buffs are
// switched off and in what order; the server runs them itself after the buffs.
// The tab offers to import the browser lines, which then empties this list.

export const autobuffHelp = {
  title: `Настроить свои строки автобаффа, подробнее ${clickableLink(
    '#help autobuff'
  )}`,
  description: `Кнопка автобаффа (по умолчанию клавиша ~) накладывает все доступные тебе усиления, которые ты знаешь на 50%+ и которых на тебе еще нет. Серверная часть считается сама и обновляется с уровнем и практикой -- ее настраивать не нужно.

Команда ${clickableLink(
    '#autobuff'
  )} добавляет ТВОИ строки, которые сервер знать не может: баф от питомца, приказ, что угодно.

Синтаксис:
#autobuff                     - показать свой список
#autobuff add аффект команда  - слать команду, пока этого аффекта нет на тебе
#autobuff add * команда       - слать команду всегда, по каждому нажатию
#autobuff del N               - удалить строку номер N
#autobuff clear               - очистить весь список

Аффект пишется английским системным именем заклинания, как в касте: haste, sanctuary, fly.

Примеры:
#autobuff add haste order rat c haste
#autobuff add sanctuary c sanctuary
#autobuff add * улыбнуться

Эти строки живут только в этом браузере. Удобнее настроить все во вкладке Настройки -> Расширения -> Автобафф: там можно выключить отдельные баффы, поменять порядок и добавить свои строки прямо персонажу, и они сработают с любого устройства и из команды 'buff'.

`,
};

const errAutobuff = `Набери ${clickableLink('#help autobuff')} для справки.\n`;

function loadList() {
  try {
    return localStorage.autobuff ? JSON.parse(localStorage.autobuff) : [];
  } catch (e) {
    return []; // corrupt or unavailable storage -- treat as empty
  }
}

function saveList(list) {
  try {
    localStorage.autobuff = JSON.stringify(list);
  } catch (e) {
    /* private mode / storage disabled -- entry just won't persist */
  }
}

// Used by the panel button to decide whether to show itself for a non-caster
// who nonetheless keeps manual entries (e.g. a warrior with a pet mage) -- in
// this browser or on the character.
export function autobuffHasEntries() {
  if (server && Array.isArray(server.custom) && server.custom.length > 0) return true;
  return loadList().length > 0;
}

// The legacy browser lines, for the settings tab's import offer.
export function legacyAutobuffLines() {
  return loadList();
}

export function setLegacyAutobuffLines(list) {
  saveList(list);
}

// --- Server-kept settings (autobuff_prefs RPC) ---
//
// The server answers 'list' and every 'set' with the whole list:
//   { who, spells: [{ sn, name, on }], custom: [{ gate, cmd, bad }] }
// A server without the RPC answers nothing, and the tab never appears. Asked
// once per character after the first prompt (so the panel button knows about
// server-side lines) and again whenever the settings window opens.
let server = null;
let asked = false;
const watchers = new Set();

export function autobuffServer() {
  return server;
}

export function watchAutobuff(fn) {
  watchers.add(fn);
  return () => watchers.delete(fn);
}

export function requestAutobuffList() {
  asked = true;
  rpccmd('autobuff_prefs', 'list');
}

// Tabs and newlines are the wire format's separators; a command can't carry them.
const flat = s => String(s || '').replace(/[\t\r\n]+/g, ' ').trim();

// Send the whole state; the server validates it and answers with the list it
// actually stored.
export function saveAutobuffPrefs(spells, custom) {
  const order = spells.map(one => one.sn).join(',');
  const off = spells.filter(one => !one.on).map(one => one.sn).join(',');
  const own = custom
    .map(one => flat(one.gate) + '\t' + flat(one.cmd))
    .join('\n');
  return rpccmd('autobuff_prefs', 'set', order, off, own);
}

$(document).on('rpc-autobuff_list', (e, b) => {
  server = b && typeof b === 'object' ? b : null;
  watchers.forEach(fn => fn(server));
});

// First prompt of a character: ask, so the panel button can show for a
// non-caster whose lines live on the server.
$(document).on('rpc-prompt', () => {
  if (!asked) requestAutobuffList();
});

// Entering or leaving the world (a character switch included): what is in hand
// belongs to somebody else.
$(document).on('rpc-config_state', () => {
  server = null;
  asked = false;
  watchers.forEach(fn => fn(server));
});

function listEntries() {
  const list = loadList();
  if (list.length === 0)
    return echoHtml(
      `Твой список автобаффа пуст. Набери ${clickableLink(
        '#help autobuff'
      )} для справки.\n`
    );
  let buf = 'Твои строки автобаффа:\n';
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    const when = e.gate === '*' ? 'всегда' : `если нет '${e.gate}'`;
    buf += `    ${i + 1}. [${when}] ${e.cmd}\n`;
  }
  echoHtml(buf + '\n');
}

function addEntry(s) {
  const gate = s[1];
  const cmd = s.slice(2).join(' ').trim();
  if (!gate || !cmd) return echoHtml(errAutobuff);

  const list = loadList();
  list.push({ gate: gate, cmd: cmd });
  saveList(list);

  const when = gate === '*' ? 'всегда' : `пока нет аффекта '${gate}'`;
  echoHtml(`Строка автобаффа добавлена (${when}): ${cmd}\n`);
}

function delEntry(s) {
  const n = parseInt(s[1], 10);
  const list = loadList();
  if (!n || n < 1 || n > list.length)
    return echoHtml(
      `Нет строки с таким номером. Набери ${clickableLink(
        '#autobuff'
      )} чтобы увидеть список.\n`
    );
  const removed = list.splice(n - 1, 1)[0];
  saveList(list);
  echoHtml(`Строка автобаффа удалена: ${removed.cmd}\n`);
}

function clearEntries() {
  saveList([]);
  echoHtml(`Список автобаффа очищен.\n`);
}

const autobuffCmd = value => {
  const s = parseStringCmd(value);
  if (!s[0]) return listEntries();
  const sub = s[0].toLowerCase();
  if (sub === 'add' || sub === 'добавить') return addEntry(s);
  if (sub === 'del' || sub === 'удалить') return delEntry(s);
  if (sub === 'clear' || sub === 'очистить') return clearEntries();
  return echoHtml(errAutobuff);
};

// The '~' key (defaults.js) and the panel button both call this.
export function runAutobuff() {
  // Server-side auto-buff: every buff you know >=50% and don't have up. This
  // reaches a dedicated RPC handler OUTSIDE the command interpreter, so there is
  // no typeable 'autobuff' command -- only the button/key can fire it.
  rpccmd('autobuff');

  // Then the player's own manual entries, each gated by active affect.
  const list = loadList();
  if (list.length === 0) return;

  const affsn =
    window.mudprompt && Array.isArray(window.mudprompt.affsn)
      ? window.mudprompt.affsn
      : [];

  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (e.gate && e.gate !== '*' && affsn.indexOf(e.gate) !== -1) continue;
    send(e.cmd);
  }
}

export default autobuffCmd;
