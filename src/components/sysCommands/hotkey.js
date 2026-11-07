import { parseStringCmd, echoHtml, clickableLink } from '../SysCommands';
import { sendHotKeyCmd } from './hotkeySend';
import keycode from './keycode';
import { macroFor, allMacros, putMacro, deleteMacro, defaultScope, macrosOnServer } from '../../macros.js';
import { st } from './strings';
import { DELETE_WORDS } from '../sysCommandUtils';

// TODO: List all accepted key codes, after testing all combinations.
export const hotkeyHelp = {
  get title() { return st('sys.hk.title', clickableLink('#help hotkey')); },
  get description() { return st('sys.hk.desc', clickableLink('#hotkey')); },
};

const errHotkey = () => st('sys.forhelp', clickableLink('#help hotkey'));

const listLine = m => `    ${m.key} : ${m.cmd}` + (macrosOnServer() ? ` (${st('sys.hk.scope.' + m.scope)})` : '') + '\n';

// Any key spelling resolves to the name a key press produces, so "#hotkey я"
// and "#hotkey z" bind the same key. A string that names no key stays as typed
// (lowercased), which keeps prefix lookups like "#hotkey kp" working.
const canonicalKey = rawKey => keycode.canonical(rawKey) || String(rawKey).toLowerCase().replace(/\s/g, '');

const checkKey = rawKey => {
  const key = keycode.canonical(rawKey);
  if (key) return { key, err: '' };
  const raw = String(rawKey).toLowerCase().replace(/\s/g, '');
  if (/^[^+]+\+./.test(raw) && !raw.split('+').slice(0, -1).every(p => keycode.MODIFIERS.includes(p)))
    return { key: raw, err: st('sys.hk.mods') };
  return { key: raw, err: st('sys.hk.nokey', raw, errHotkey()) };
};

const hotkeyCmdDelete = rawKey => {
  const key = canonicalKey(rawKey);
  if (deleteMacro(key)) return echoHtml(st('sys.hk.deleted', key));
  return echoHtml(st('sys.hk.notset'));
};

const hotkeyCmdShow = rawKey => {
  const key = canonicalKey(rawKey);
  const buf = allMacros()
    .filter(m => m.key.startsWith(key))
    .map(listLine)
    .join('');

  if (buf.length > 0) {
    echoHtml(st('sys.hk.found', buf));
    return;
  }

  echoHtml(st('sys.hk.notdefined', key, clickableLink('#hotkey')));
};

const hotkeyCmdAdd = stringCmd => {
  const { key, err } = checkKey(stringCmd[0]);
  if (err) return echoHtml(err);

  if (macroFor(key) === undefined) {
    if (!putMacro(defaultScope(), key, stringCmd.slice(1).join(' ')))
      return echoHtml(st('sys.hk.full'));
    echoHtml(st('sys.hk.added', key));
    return;
  }

  return echoHtml(
    st('sys.hk.exists', `<span class="builtin-cmd manip-link" data-action="#hotkey ${key} delete" data-echo="#hotkey ${key} delete">#hotkey ${key} delete</span>`)
  );
};

const hotkeyCmdList = () => {
  const all = allMacros();
  if (all.length === 0) return echoHtml(st('sys.hk.empty', clickableLink('#help hotkey')));
  echoHtml(st('sys.hk.list') + all.map(listLine).join('') + '\n');
};

const hotkeyCmd = value => {
  const stringCmd = parseStringCmd(value);
  if (!stringCmd[0]) return hotkeyCmdList();
  if (stringCmd.length === 1) return hotkeyCmdShow(stringCmd[0]);
  if (stringCmd.length === 2 && DELETE_WORDS.includes(stringCmd[1]))
    return hotkeyCmdDelete(stringCmd[0]);

  return hotkeyCmdAdd(stringCmd);
};

// Translate keyboard event into a symbolic name for a hotkey and run it, if defined.
// Lives in the leaf module so the mapper can fire macros without the SysCommands cycle.
export { sendHotKeyCmd };

export default hotkeyCmd;
