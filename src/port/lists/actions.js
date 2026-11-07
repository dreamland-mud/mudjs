/* What a row's action does, and the rows of a list as the window shows them. */
import $ from 'jquery';
import { t, fmt } from '../../i18n';
import { holdSpeech } from '../../components/terminal';
import { command } from '../game';
import { putInInput } from '../walk';
import { VERBS } from './kinds';
import { getState, setState } from './state';
import { speak } from './speak';

const WAIT_MS = 5000;
const REFRESH_WAIT_MS = 10000;
const ANSWER_WAIT_MS = 1500; // the action's answer, before the list is asked again
const HOLD_MS = 4000; // the longest the list's text is kept quiet

/* List frames the window itself asked for (a refresh, a group opened from
 * glist, a vault filter): one per request, for a while. Practising twice in
 * a row asks twice. */
let pending = 0;
let expectUntil = 0;

export const expected = () => pending > 0 && Date.now() < expectUntil;
export function expect(ms) {
  pending++;
  expectUntil = Date.now() + (ms || WAIT_MS);
}
export const took = () => (pending = Math.max(0, pending - 1));
export const forget = () => (pending = 0);

export const verbLabel = (verb, cmd) => (VERBS[verb] ? t(VERBS[verb][0]) : cmd);

/* The desktop client's row_label: skills get their level and cost, other
 * kinds their section. */
function rowLabel(row, kind) {
  let label = String(row.label || row.id || '');
  const data = row.data && typeof row.data === 'object' ? row.data : {};
  if (kind === 'skills') {
    if (data.level) label += ', ' + fmt('tl.level', data.level);
    if (data.mana) label += ', ' + fmt('tl.cost', data.mana);
    else if (data.moves) label += ', ' + fmt('tl.cost', fmt('tl.moves', data.moves));
  } else if (row.section) {
    label += ', ' + row.section;
  }
  return label;
}

/* LIST rows as FindView rows: key, label, actions [{verb, cmd}], details. */
export function viewRows(list) {
  const kind = list && list.kind;
  const seen = new Set();
  return ((list && list.rows) || [])
    .filter(r => r && typeof r === 'object')
    .map((r, i) => {
      // A key that stays the same when the list comes again after a practice.
      let key = kind + ':' + (r.id !== undefined && r.id !== '' ? r.id : i);
      if (seen.has(key)) key += ':' + i;
      seen.add(key);
      const actions = (Array.isArray(r.actions) ? r.actions : [])
        .filter(a => a && a.cmd)
        .map(a => ({ verb: String(a.verb || ''), cmd: String(a.cmd) }));
      const label = rowLabel(r, kind);
      const data = r.data && typeof r.data === 'object' ? r.data : {};
      return {
        key,
        label,
        actions,
        dim: data.available === false || data.usable === false,
        detail: () =>
          actions.length
            ? label + '. ' + fmt('tl.detail.actions', actions.map(a => verbLabel(a.verb, a.cmd)).join(', '))
            : label,
      };
    });
}

export function closeList() {
  forget();
  setState({ open: false });
}

/* Run one action of a row. */
export function runAction(row, verb) {
  const action = row.actions.find(a => a.verb === verb);
  if (!action) return;
  const { cmd } = action;
  const effect = VERBS[verb] ? VERBS[verb][2] : null;

  if (effect === 'target' || effect === 'input') {
    closeList();
    // After the sheet has given the focus back to the command line.
    setTimeout(() => {
      putInInput(cmd + ' ');
      speak(t(effect === 'target' ? 'tl.typetarget' : 'tl.typemessage'));
    }, 50);
    return;
  }

  command(cmd);

  if (effect === 'close') {
    closeList();
  } else if (effect === 'refresh') {
    // The list again, to show the change. The action's own answer (the
    // practice) is spoken; the list's text that follows it is not, since the
    // window shows it. Asked once the answer is in, so the two do not mix.
    const again = getState().command;
    setState({ selectKey: row.key });
    if (again) {
      expect(REFRESH_WAIT_MS);
      const terminal = $('.terminal');
      let sent = false;
      const ask = () => {
        if (sent) return;
        sent = true;
        clearTimeout(timer);
        terminal.off('output', onAnswer);
        holdSpeech(HOLD_MS);
        command(again);
      };
      const onAnswer = () => setTimeout(ask, 0);
      const timer = setTimeout(ask, ANSWER_WAIT_MS);
      terminal.one('output', onAnswer);
    }
  } else if (effect === 'open') {
    // The answer is the next list in this window; it refreshes with its own command.
    setState({ nextCommand: cmd });
    expect();
  }
}
