/* The window a list from the game opens in: a searchable list with the row's
 * actions as buttons, each also on Alt with its letter. */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Sheet from '../Sheet';
import FindView from '../FindView';
import { registerView } from '../views';
import { t } from '../../i18n';
import { VERBS, TITLES } from './kinds';
import { getState, onState } from './state';
import { viewRows, runAction, verbLabel, closeList } from './actions';

/* One action per verb the list has, in the order they first appear; a row
 * shows only the verbs it has. The Alt letter goes to the first verb that
 * claims it. */
function listActions(rows) {
  const verbs = [];
  rows.forEach(r => r.actions.forEach(a => verbs.includes(a.verb) || verbs.push(a.verb)));
  const used = new Set();
  return verbs.map(verb => {
    let key = VERBS[verb] ? VERBS[verb][1] : null;
    if (key && used.has(key)) key = null;
    if (key) used.add(key);
    return {
      id: 'v-' + verb,
      key: key || undefined,
      label: VERBS[verb]
        ? verbLabel(verb)
        : row => verbLabel(verb, (row.actions.find(a => a.verb === verb) || {}).cmd),
      when: row => row.actions.some(a => a.verb === verb),
      run: row => runAction(row, verb),
    };
  });
}

function ListsView() {
  const [state, set] = useState(getState());
  const search = useRef(null);
  useEffect(() => onState(set), []);

  const { list } = state;
  const rows = useMemo(() => viewRows(list), [list]);
  const actions = useMemo(() => listActions(rows), [rows]);
  const title = (list && list.title) || t((list && TITLES[list.kind]) || 'tl.list');

  // A new list in the window, or a refresh without the focused row, takes the
  // focus away with the old elements: back to the search box, so the screen
  // reader stays in the window.
  useEffect(() => {
    if (!state.open) return undefined;
    const timer = setTimeout(() => {
      const box = search.current;
      const sheet = box && box.closest('.port-sheet');
      if (box && sheet && !sheet.contains(document.activeElement)) box.focus();
    }, 0);
    return () => clearTimeout(timer);
  }, [rows, state.seq, state.open]);

  return (
    <Sheet id="lists" open={state.open} onClose={closeList} title={title} initialFocus={search} wide>
      {state.open ? (
        <FindView
          key={state.seq}
          rows={rows}
          actions={actions}
          searchLabel={t('tl.search')}
          searchRef={search}
          selectKey={state.selectKey}
        />
      ) : null}
    </Sheet>
  );
}

registerView('lists', ListsView);
