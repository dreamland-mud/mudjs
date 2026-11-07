/* Lists from the game as windows. With the option on, the client asks the
 * game for its list frames (list_subscribe); a frame opens a window only when
 * the player typed the command for that list a moment ago, or the window
 * itself asked for it. The game text prints as usual either way. */
import $ from 'jquery';
import { rpccmd } from '../../websock.js';
import { expandAliases } from '../../aliases.js';
import { dialogOpen } from '../../review';
import { t } from '../../i18n';
import { registerTool } from '../tools';
import { kindsOf } from './kinds';
import { getState, setState } from './state';
import { expected, took } from './actions';
import { speak } from './speak';
import './strings';
import './ListsView';

const KEY = 'mudjs.serverLists';
const TYPED_MS = 5000;

export function listsOn() {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch (e) {
    return false;
  }
}

function setListsOn(on) {
  try {
    localStorage.setItem(KEY, on ? '1' : '0');
  } catch (e) {
    /* private mode: for this tab only */
  }
  rpccmd('list_subscribe', ...(on ? [] : ['off']));
  if (!on) setState({ open: false });
  speak(t(on ? 'tl.on' : 'tl.off'));
}

// kind -> { at, cmd }: the last typed command for each kind of list.
const typed = new Map();

function noteTyped(text) {
  const line = String(text == null ? '' : text);
  String(expandAliases(line) || line)
    .split(/[|\n]/)
    .map(s => s.trim())
    .filter(Boolean)
    .forEach(cmd => kindsOf(cmd).forEach(kind => typed.set(kind, { at: Date.now(), cmd })));
}

function onList(e, list) {
  if (!listsOn() || !list || typeof list !== 'object' || !Array.isArray(list.rows)) return;
  const state = getState();
  const asked = typed.get(list.kind);
  const fresh = asked && Date.now() - asked.at < TYPED_MS;
  if (state.open && expected()) {
    // The window's own refresh, or the next list it opened.
    took();
    const next = state.nextCommand;
    const sameKind = state.list && state.list.kind === list.kind && !next;
    setState({
      list,
      command: next || state.command,
      nextCommand: '',
      selectKey: sameKind ? state.selectKey : undefined,
      seq: sameKind ? state.seq : state.seq + 1,
    });
    return;
  }
  if (!fresh) return;
  typed.delete(list.kind);
  // Not over the help sheet, settings or another window.
  if (!state.open && dialogOpen()) return;
  setState({
    open: true,
    list,
    command: asked.cmd,
    nextCommand: '',
    selectKey: undefined,
    seq: state.seq + 1,
  });
}

$(document).ready(() => {
  $('#triggers').on('input.port-lists', (e, text) => {
    if (listsOn()) noteTyped(text);
  });
  $('#rpc-events')
    .on('rpc-list.port-lists', onList)
    // Asked again on every new socket, after its codepage answer.
    .on('rpc-version.port-lists', () => {
      if (listsOn()) rpccmd('list_subscribe');
    });
});

registerTool({
  id: 'lists',
  label: () => t('tl.toggle'),
  hash: 'lists',
  help: () => t('tl.help.cmd'),
  run: arg => {
    const a = String(arg || '').toLowerCase();
    setListsOn(a === 'on' ? true : a === 'off' ? false : !listsOn());
  },
});
