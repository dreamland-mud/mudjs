// Firing a player macro for a key press, split out of hotkey.js so callers outside the
// #-command system (the mapper) can use it without importing SysCommands. Keep this a
// leaf: SysCommands <-> hotkey.js is an init-order cycle (SysCommands reads hotkeyHelp
// at module load), so nothing here may import SysCommands or a sysCommands/* command.
import { echo } from '../../input';
import { send } from '../../websock';
import { expandAliases } from '../../aliases.js';
import keycode from './keycode';
import { macroFor } from '../../macros.js';

/** Replace $name with the #var value stored in localStorage.vars. */
export function parseUserVars(str) {
    const varsStorage = localStorage.vars ? JSON.parse(localStorage.vars) : {};
    const stringArr = str.split(/([^?=[\wа-яА-яёЁіІїЇєЄґҐ$\]])/)
    for (let i in stringArr) {
        if (stringArr[i].startsWith('$') && (varsStorage[stringArr[i].slice(1)])) {
                stringArr[i] = varsStorage[stringArr[i].slice(1)]
        }
    }
    return stringArr.join('')
}

/** Send the macro bound to this keydown, if any. True when it fired (the event is then
 *  stopped and default-prevented). */
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
