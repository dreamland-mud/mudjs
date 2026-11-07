/* Ctrl+1 to Ctrl+0, as in the desktop client, and Ctrl+Shift+1 to
 * Ctrl+Shift+0: read the 1st to 10th line from the end of the output without
 * leaving the command line. Blank lines, a lone ">" and the echoed commands do
 * not count. Firefox lets the page have Ctrl with a digit; Chrome keeps it for
 * its tabs, so there only the Ctrl+Shift keys work. */
import { keyName, registerTool } from '../tools';
import { t } from '../../i18n';
import { lines } from './ring';
import { say } from './speak';

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
const KEYS = DIGITS.map(d => 'ctrl+' + d).concat(DIGITS.map(d => 'ctrl+shift+' + d));

export function readRecent(n) {
  const ring = lines();
  let seen = 0;
  for (let i = ring.length - 1; i >= 0; i--) {
    const line = ring[i];
    const text = line.text.trim();
    if (!text || text === '>' || line.echo) continue;
    if (++seen === n) return say(text);
  }
  say(t('out.recent.none'));
}

/* The digit of the key pressed: by its place on the keyboard, so it works
 * with any layout and with Shift held. A key changed on the System actions
 * page is no digit: its place among the tool's keys counts instead. */
function digitOf(e, tool) {
  const i = tool && e ? tool.keys.indexOf(keyName(e)) : -1;
  if (i >= 0 && !(tool.keys[i] || '').match(/[0-9]$/)) return (i % 10) + 1;
  const m = e && /^Digit(\d)$/.exec(e.code || '');
  if (m) return m[1] === '0' ? 10 : parseInt(m[1]);
  const w = e && e.which;
  if (w >= 48 && w <= 57) return w === 48 ? 10 : w - 48;
  return 1;
}

const recentTool = {
  id: 'out-recent',
  label: () => t('out.recent'),
  keys: KEYS,
  hash: 'recent',
  menu: false,
  help: () => t('out.recent') + ': #recent 1 .. #recent 10',
  run: (arg, e) => {
    const n = arg ? parseInt(arg) : digitOf(e, recentTool);
    readRecent(n > 0 ? n : 1);
  },
};
registerTool(recentTool);
