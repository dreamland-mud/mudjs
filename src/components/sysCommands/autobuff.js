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
// who nonetheless keeps manual entries (e.g. a warrior with a pet mage).
export function autobuffHasEntries() {
  return loadList().length > 0;
}

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
