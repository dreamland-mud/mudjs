import { echo } from '../../input';
import { send } from '../../websock';
import { expandAliases } from '../../aliases.js';
import { parseStringCmd, echoHtml, clickableLink } from '../SysCommands';
import { parseUserVars } from './var';
import keycode from './keycode';
import { macroFor, allMacros, putMacro, deleteMacro, defaultScope, macrosOnServer } from '../../macros.js';

// TODO: List all accepted key codes, after testing all combinations.
export const hotkeyHelp = {
  title: `Присвоить команду для горячей клавиши, подробнее ${clickableLink(
    '#help hotkey'
  )}`,
  description: `Команда ${clickableLink(
    '#hotkey'
  )} позволяет назначать горячие клавиши для игровых команд.
Синтаксис:
#hotkey            - вывести список назначенных клавиш
#hotkey key action - привязать команду action к клавише key
#hotkey key        - показать все клавиши, начинающиеся с key
#hotkey key delete - удалить горячую клавишу

В качестве action могут использоваться любые игровые команды, в том числе перечисленные через разделитель команд |. 
Удобнее всего задавать клавиши в настройках: шестеренка вверху экрана, Расширения, Макросы. Там же их видно для персонажа и для всего аккаунта.
Если нужно задать более сложные реакции на нажатую клавишу с использованием JavaScript, используйте функцию keydown в редакторе настроек (шестеренка вверху экрана).

В качестве key можно использовать маленькие буквы, цифры, знаки препинания, функциональные клавиши f1-f12, клавиши кейпада kp0-kp9, kp*, kp-, kp+, kp., kp/, стрелки up down left right, клавиши ins del home end pgup pgdown.
Доступны комбинации с участием ctrl, alt, shift, в том числе нескольких сразу. Например: ctrl+a, alt+9, ctrl+shift+f1. Далеко не все клавиши и комбинации удобны к использованию в браузере.

Пример для стрелки "вниз" на кейпаде: просто стрелка -- идти на юг, alt+стрелка -- бежать до упора на юг, shift+стрелка -- пристально смотреть на юг.
#hotkey kp2 ю
#hotkey alt+kp2 бежать Ю
#hotkey shift+kp2 всмотр ю

Пример клавиши, выполняющей несколько команд сразу:
#hotkey f1 сбежать | сбежать | возврат

`,
};

const errHotkey = `Набери ${clickableLink('#help hotkey')} для справки.\n`;

const SCOPE_NAMES = { char: 'персонаж', acct: 'аккаунт', local: 'этот браузер' };
const listLine = m => `    ${m.key} : ${m.cmd}` + (macrosOnServer() ? ` (${SCOPE_NAMES[m.scope]})` : '') + '\n';

// Any key spelling resolves to the name a key press produces, so "#hotkey я"
// and "#hotkey z" bind the same key. A string that names no key stays as typed
// (lowercased), which keeps prefix lookups like "#hotkey kp" working.
const canonicalKey = rawKey => keycode.canonical(rawKey) || String(rawKey).toLowerCase().replace(/\s/g, '');

const checkKey = rawKey => {
  const key = keycode.canonical(rawKey);
  if (key) return { key, err: '' };
  const raw = String(rawKey).toLowerCase().replace(/\s/g, '');
  if (/^[^+]+\+./.test(raw) && !raw.split('+').slice(0, -1).every(p => keycode.MODIFIERS.includes(p)))
    return { key: raw, err: `В комбинации клавиш можно использовать только ctrl, alt и shift.\n` };
  return { key: raw, err: `Код клавиши ${raw} не найден. ${errHotkey}\n` };
};

const hotkeyCmdDelete = rawKey => {
  const key = canonicalKey(rawKey);
  if (deleteMacro(key)) return echoHtml(`Горячая клавиша ${key} удалена из списка.\n`);
  return echoHtml(`Такая горячая клавиша не задана.\n`);
};

const hotkeyCmdShow = rawKey => {
  const key = canonicalKey(rawKey);
  const buf = allMacros()
    .filter(m => m.key.startsWith(key))
    .map(listLine)
    .join('');

  if (buf.length > 0) {
    echoHtml(
      `Найдены такие горячие клавиши:\n${buf}Для удаления используй команду: #hotkey клавиша delete.\n`
    );
    return;
  }

  echoHtml(
    `Горячая клавиша ${key} не задана. Для просмотра всех горячих клавиш введи ${clickableLink(
      '#hotkey'
    )}.\n`
  );
};

const hotkeyCmdAdd = stringCmd => {
  const { key, err } = checkKey(stringCmd[0]);
  if (err) return echoHtml(err);

  if (macroFor(key) === undefined) {
    if (!putMacro(defaultScope(), key, stringCmd.slice(1).join(' ')))
      return echoHtml('Список горячих клавиш уже полон.\n');
    echoHtml('Команда для ' + key + ' добавлена.\n');
    return;
  }

  return echoHtml(
    `Этот ключ уже существует, набери <span class="builtin-cmd manip-link" data-action="#hotkey ${key} delete" data-echo="#hotkey ${key} delete">#hotkey ${key} delete</span> для удаления.\n`
  );
};

const hotkeyCmdList = () => {
  const all = allMacros();
  if (all.length === 0)
    return echoHtml(
      `Список горячих клавиш пуст. Набери ${clickableLink(
        '#help hotkey'
      )} для справки`
    );
  echoHtml('Список горячих клавиш: \n' + all.map(listLine).join('') + '\n');
};

const hotkeyCmd = value => {
  const stringCmd = parseStringCmd(value);
  if (!stringCmd[0]) return hotkeyCmdList();
  if (stringCmd.length === 1) return hotkeyCmdShow(stringCmd[0]);
  if (
    stringCmd.length === 2 &&
    (stringCmd[1] === 'delete' || stringCmd[1] === 'удалить')
  )
    return hotkeyCmdDelete(stringCmd[0]);

  return hotkeyCmdAdd(stringCmd);
};

// Translate keyboard event into a symbolic name for a hotkey and run it, if defined.
export function sendHotKeyCmd(e) {
  const hotkey = keycode.hotkey(e);
  if (!hotkey) return false;

  let cmd = macroFor(hotkey);
  const fallback = keycode.hotkeyFallback(e);
  if (!cmd && fallback) cmd = macroFor(fallback);
  if (cmd) {
    e.stopPropagation();
    e.preventDefault();
    const parsedCmd = parseUserVars(cmd);
    echo(parsedCmd);
    send(expandAliases(parsedCmd));
    return true;
  }

  return false;
}

export default hotkeyCmd;
