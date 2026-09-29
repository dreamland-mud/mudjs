import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { t } from '../../i18n.js';
import {
  saveAutobuffPrefs,
  legacyAutobuffLines,
  setLegacyAutobuffLines,
  autobuffLineFits,
  AUTOBUFF_MAX_LINES,
  AUTOBUFF_MAX_GATE,
  AUTOBUFF_MAX_CMD,
} from '../sysCommands/autobuff.js';

// The autobuff tab: which of the character's buffs the button casts, in what
// order, and the player's own lines cast after them. Everything lives on the
// character (server-side), so it follows the player to any device and to the
// typed 'buff' command.
//
// Every change is sent at once as the whole state, and the screen moves on the
// click. The server answers with the whole list it stored; answers that are
// already out of date (to an earlier change, or to a plain list request) are
// filtered out in sysCommands/autobuff.js by seq, so what arrives here is
// always the answer to the latest change.
//
// Rows are reordered by dragging the grip, and the grip is also a button: a
// screen reader can't drag, and a good share of the players use one, so with
// the focus on a grip the up and down arrows move that row. The focus stays on
// the moved grip and a live region says where the row landed. Each row also
// carries hidden move up / move down buttons (SrMoves) for a screen reader in
// browse mode or on a phone, where no arrow key reaches the grip.
//
// An own line has no off state on the server: switching it off deletes it.

const lineKey = one => one.gate + '\t' + one.cmd;

// Most suggestions the gate lookup shows at once.
const LOOKUP_MAX = 8;

const moveItem = (list, from, to) => {
  const next = list.slice();
  const [one] = next.splice(from, 1);
  next.splice(to, 0, one);
  return next;
};

// Give each own line a stable id for React keys and focus. The server sends the
// lines back without ids after every save, so a line keeps the id of the first
// unclaimed line with the same text it had before.
let nextId = 1;
function withIds(lines, prev) {
  const pool = new Map();
  prev.forEach(one => {
    const k = lineKey(one);
    if (!pool.has(k)) pool.set(k, []);
    pool.get(k).push(one.id);
  });
  return lines.map(one => {
    const ids = pool.get(lineKey(one));
    return { ...one, id: ids && ids.length ? ids.shift() : nextId++ };
  });
}

// Affects matching what was typed, those whose name or sysname starts with it
// first.
function lookup(affects, text) {
  const q = text.trim().toLowerCase();
  if (!q) return [];
  const head = [];
  const rest = [];
  affects.forEach(one => {
    const name = String(one.name).toLowerCase();
    const sn = String(one.sn).toLowerCase();
    if (name.startsWith(q) || sn.startsWith(q)) head.push(one);
    else if (name.includes(q) || sn.includes(q)) rest.push(one);
  });
  return head.concat(rest).slice(0, LOOKUP_MAX);
}

// The sysname for what is in the gate box: an exact name or sysname match,
// else the text as typed (the server flags a gate that names no skill). Empty
// or '*' means every press, sent as '*'.
function resolveGate(affects, text) {
  const q = text.trim();
  if (!q || q === '*') return '*';
  const low = q.toLowerCase();
  const hit = affects.find(
    one => String(one.sn).toLowerCase() === low || String(one.name).toLowerCase() === low
  );
  return hit ? hit.sn : q;
}

// Nearest ancestor that scrolls, for scrolling the pane while a row is dragged
// past its edge.
function scrollParent(el) {
  for (let n = el && el.parentElement; n; n = n.parentElement) {
    const y = getComputedStyle(n).overflowY;
    if ((y === 'auto' || y === 'scroll') && n.scrollHeight > n.clientHeight) return n;
  }
  return null;
}

// How close to the pane's edge (px) the pointer has to be to scroll it, and
// how far one pointer move scrolls.
const EDGE = 40;
const EDGE_STEP = 12;

// Drag a row by its grip. The list redraws in the dragged order while the
// pointer moves, and is saved once, on release; a cancelled gesture puts the
// row back. The move and release are heard on window, not on the grip: the
// redraw moves the dragged row's DOM node, and the browser drops the pointer
// capture of a node that leaves the document.
function useRowDrag(onDrop) {
  const [drag, setDrag] = useState(null); // { list, from, over }
  const rows = useRef({});
  const live = useRef({ drag: null, onDrop, pane: null, pointer: null });
  live.current.drag = drag;
  live.current.onDrop = onDrop;

  const start = (list, i) => e => {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    live.current.pane = scrollParent(e.currentTarget);
    live.current.pointer = e.pointerId;
    setDrag({ list, from: i, over: i });
  };

  const active = !!drag;
  useEffect(() => {
    if (!active) return undefined;

    // Only the pointer that grabbed the row: a second finger doesn't drop it.
    const mine = e => e.pointerId === live.current.pointer;

    const move = e => {
      const d = live.current.drag;
      if (!d || !mine(e)) return;
      const pane = live.current.pane;
      if (pane) {
        const r = pane.getBoundingClientRect();
        if (e.clientY < r.top + EDGE) pane.scrollTop -= EDGE_STEP;
        else if (e.clientY > r.bottom - EDGE) pane.scrollTop += EDGE_STEP;
      }
      // Rows are measured as drawn, the dragged one already at d.over. Its new
      // place is the number of the other rows whose middle the pointer is below.
      const els = rows.current[d.list] || [];
      let over = 0;
      for (let i = 0; i < els.length; i++) {
        const el = els[i];
        if (!el || i === d.over) continue;
        const r = el.getBoundingClientRect();
        if (e.clientY > r.top + r.height / 2) over++;
      }
      if (over !== d.over) setDrag({ ...d, over });
    };

    const up = e => {
      if (!mine(e)) return;
      const d = live.current.drag;
      setDrag(null);
      if (d && d.from !== d.over) live.current.onDrop(d.list, d.from, d.over);
    };

    const cancel = e => {
      if (mine(e)) setDrag(null);
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
    };
  }, [active]);

  // What a list looks like right now, the dragged row in its current place.
  const shown = (list, items) =>
    drag && drag.list === list && drag.from < items.length && drag.over < items.length
      ? moveItem(items, drag.from, drag.over)
      : items;

  const rowRef = (list, i) => el => {
    if (!rows.current[list]) rows.current[list] = [];
    rows.current[list][i] = el;
  };

  const dragging = (list, i) => !!drag && drag.list === list && drag.over === i;

  const cancel = () => setDrag(null);

  return { start, shown, rowRef, dragging, cancel, active };
}

function Grip({ label, hint, onPointerDown, onKeyDown, gripRef }) {
  return (
    <button
      type="button"
      ref={gripRef}
      className="ab-grip"
      aria-label={label}
      aria-description={hint}
      title={hint}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
    >
      <span className="ab-grip-lines" aria-hidden="true" />
    </button>
  );
}

// Move up / move down as plain buttons, hidden from the eye and out of the Tab
// order. Arrow keys on the grip don't reach it in a screen reader's browse
// mode, and a phone screen reader has no arrows at all, but both can find and
// press a button.
function SrMoves({ lang, name, first, last, onMove }) {
  return (
    <>
      <button
        type="button"
        tabIndex={-1}
        className="ab-sr"
        disabled={first}
        onClick={() => onMove(-1)}
      >
        {t('ab.up', lang) + ': ' + name}
      </button>
      <button
        type="button"
        tabIndex={-1}
        className="ab-sr"
        disabled={last}
        onClick={() => onMove(1)}
      >
        {t('ab.down', lang) + ': ' + name}
      </button>
    </>
  );
}

export default function AutobuffPage({ lang, data }) {
  const [spells, setSpells] = useState([]);
  const [custom, setCustom] = useState([]);
  const [affects, setAffects] = useState([]);
  const [gate, setGate] = useState('');
  const [cmd, setCmd] = useState('');
  const [picked, setPicked] = useState(null); // the suggestion chosen, while the box still shows it
  const [picks, setPicks] = useState([]);
  const [pick, setPick] = useState(-1);
  const [legacy, setLegacy] = useState(() => legacyAutobuffLines());
  const [said, setSaid] = useState('');
  const [refocus, setRefocus] = useState(null);
  const grips = useRef({});
  const cmdInput = useRef(null);
  const gateInput = useRef(null);
  const picksList = useRef(null);

  useEffect(() => {
    if (!data) return;
    setSpells(Array.isArray(data.spells) ? data.spells : []);
    setCustom(prev => withIds(Array.isArray(data.custom) ? data.custom : [], prev));
    if (Array.isArray(data.affects)) setAffects(data.affects);
  }, [data]);

  // Keep the focus on the grip of the row that just moved, or after a delete
  // on the next row's switch.
  useLayoutEffect(() => {
    if (!refocus) return;
    const el = grips.current[refocus];
    if (el) el.focus();
    else if (cmdInput.current) cmdInput.current.focus();
    setRefocus(null);
  }, [refocus]);

  const commit = (nextSpells, nextCustom) => {
    setSpells(nextSpells);
    setCustom(nextCustom);
    saveAutobuffPrefs(nextSpells, nextCustom);
  };

  // An affect's name for a row, with the sysname added when another affect
  // shares that name (two UA skills are both "стійкість").
  const affectName = sn => {
    const hit = affects.find(one => one.sn === sn);
    if (!hit) return sn;
    const twin = affects.some(one => one.name === hit.name && one.sn !== sn);
    return twin ? hit.name + ' (' + sn + ')' : hit.name;
  };

  const reorder = (list, from, to) => {
    if (list === 'spells') {
      commit(moveItem(spells, from, to), custom);
      return spells[from];
    }
    commit(spells, moveItem(custom, from, to));
    return custom[from];
  };

  const announce = (name, to, total) =>
    setSaid(
      t('ab.moved', lang)
        .replace('%s', name)
        .replace('%d', String(to + 1))
        .replace('%t', String(total))
    );

  const drag = useRowDrag((list, from, to) => {
    const one = reorder(list, from, to);
    const items = list === 'spells' ? spells : custom;
    announce(list === 'spells' ? one.name : one.cmd, to, items.length);
  });

  // A server answer replaces the lists under a drag that is still indexing
  // into the old ones: drop the drag rather than move the wrong row.
  useEffect(() => {
    drag.cancel();
  }, [data]);

  // One step up or down, from the grip's arrows or the screen-reader buttons.
  // The focus lands on the moved row's grip.
  const moveBy = (list, i, by) => {
    const items = list === 'spells' ? spells : custom;
    const j = i + by;
    if (j < 0 || j >= items.length) return;
    const one = reorder(list, i, j);
    setRefocus(list === 'spells' ? 's:' + one.sn : 'c:' + one.id);
    announce(list === 'spells' ? one.name : one.cmd, j, items.length);
  };

  const keyMove = (list, i) => e => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    moveBy(list, i, e.key === 'ArrowUp' ? -1 : 1);
  };

  const toggle = i =>
    commit(
      spells.map((one, j) => (j === i ? { ...one, on: one.on ? 0 : 1 } : one)),
      custom
    );

  // Switching an own line off deletes it. The focus goes to the next line's
  // switch, or the command box when it was the last one.
  const remove = i => {
    const gone = custom[i];
    const next = custom.filter((one, j) => j !== i);
    commit(spells, next);
    const after = next[i] || next[i - 1];
    setRefocus(after ? 'x:' + after.id : 'none');
    setSaid(t('ab.removed', lang).replace('%s', gone.cmd));
  };

  const add = e => {
    e.preventDefault();
    // Localized names can repeat (two UA skills are both "стійкість"), so a
    // picked suggestion is saved by its own sysname, not looked up by name.
    const sn = picked && picked.name === gate ? picked.sn : resolveGate(affects, gate);
    const line = { gate: sn, cmd: cmd.trim(), bad: 0 };
    if (!line.cmd || custom.length >= AUTOBUFF_MAX_LINES) return;
    commit(spells, custom.concat([{ ...line, id: nextId++ }]));
    setCmd('');
    setGate('');
    setPicked(null);
    setPicks([]);
    setPick(-1);
    if (gateInput.current) gateInput.current.focus();
  };

  // On a phone the keyboard covers the bottom of the pane, where the
  // suggestions open: bring them into view.
  const hasPicks = picks.length > 0;
  useEffect(() => {
    if (hasPicks && picksList.current && picksList.current.scrollIntoView)
      picksList.current.scrollIntoView({ block: 'nearest' });
  }, [hasPicks]);

  const typeGate = text => {
    setGate(text);
    setPicked(null);
    const found = lookup(affects, text);
    setPicks(found);
    setPick(-1);
  };

  const choose = one => {
    setGate(one.name);
    setPicked(one);
    setPicks([]);
    setPick(-1);
  };

  const gateKeys = e => {
    if (!picks.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setPick((pick + 1) % picks.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setPick(pick <= 0 ? picks.length - 1 : pick - 1);
    } else if (e.key === 'Enter' && pick >= 0) {
      e.preventDefault();
      choose(picks[pick]);
    } else if (e.key === 'Escape') {
      // Close the suggestions only, not the settings sheet behind them.
      e.preventDefault();
      e.nativeEvent.stopPropagation();
      setPicks([]);
      setPick(-1);
    }
  };

  // The old browser-only lines move onto the character after the ones already
  // there and leave the browser, so they stop firing twice. A line the
  // character already has (imported from another browser) is not added again.
  // Whatever doesn't fit -- the line cap, or the server's length limits --
  // stays in the browser rather than being lost.
  const importLegacy = () => {
    const have = new Set(custom.map(lineKey));
    const moved = [];
    const rest = [];
    legacy.forEach(one => {
      const line = { gate: String(one.gate || '*').trim(), cmd: String(one.cmd || '').trim(), bad: 0 };
      if (have.has(lineKey(line))) return;
      if (!autobuffLineFits(line) || custom.length + moved.length >= AUTOBUFF_MAX_LINES) {
        rest.push(one);
        return;
      }
      have.add(lineKey(line));
      moved.push({ ...line, id: nextId++ });
    });
    if (moved.length) commit(spells, custom.concat(moved));
    setLegacyAutobuffLines(rest);
    setLegacy(rest);
  };

  const gateLabel = g =>
    g === '*' ? t('ab.always', lang) : t('ab.unless', lang) + ' ' + affectName(g);

  const gripHint = t('ab.grip.hint', lang);
  const shownSpells = drag.shown('spells', spells);
  const shownCustom = drag.shown('custom', custom);
  const listId = 'ab-gate-list';

  return (
    <div className={drag.active ? 'ab ab-dragging' : 'ab'}>
      <div className="cfg-row-desc ab-intro">{t('ab.intro', lang)}</div>

      <div className="ab-sr" aria-live="polite">
        {said}
      </div>

      {shownSpells.length ? (
        <ol className="ab-list" role="list" aria-label={t('ab.spells', lang)}>
          {shownSpells.map((one, i) => {
            let cls = one.on ? 'ab-item' : 'ab-item ab-item-off';
            if (drag.dragging('spells', i)) cls += ' ab-item-drag';
            return (
              <li key={one.sn} ref={drag.rowRef('spells', i)} className={cls}>
                <Grip
                  label={t('ab.grip', lang) + ': ' + one.name}
                  hint={gripHint}
                  gripRef={el => {
                    grips.current['s:' + one.sn] = el;
                  }}
                  onPointerDown={drag.start('spells', i)}
                  onKeyDown={keyMove('spells', i)}
                />
                <SrMoves
                  lang={lang}
                  name={one.name}
                  first={i === 0}
                  last={i === shownSpells.length - 1}
                  onMove={by => moveBy('spells', i, by)}
                />
                <span className="ab-name">{one.name}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={!!one.on}
                  aria-label={one.name}
                  className={one.on ? 'cfg-switch cfg-switch-on' : 'cfg-switch'}
                  onClick={() => toggle(i)}
                >
                  <span className="cfg-switch-knob" />
                </button>
              </li>
            );
          })}
        </ol>
      ) : null}

      <div className="ab-h">{t('ab.own', lang)}</div>
      <div className="cfg-row-desc">{t('ab.own.hint', lang)}</div>

      {shownCustom.length ? (
        <ol className="ab-list" role="list" aria-label={t('ab.own', lang)}>
          {shownCustom.map((one, i) => (
            <li
              key={one.id}
              ref={drag.rowRef('custom', i)}
              className={drag.dragging('custom', i) ? 'ab-item ab-item-drag' : 'ab-item'}
            >
              <Grip
                label={t('ab.grip', lang) + ': ' + one.cmd}
                hint={gripHint}
                gripRef={el => {
                  grips.current['c:' + one.id] = el;
                }}
                onPointerDown={drag.start('custom', i)}
                onKeyDown={keyMove('custom', i)}
              />
              <SrMoves
                lang={lang}
                name={one.cmd}
                first={i === 0}
                last={i === shownCustom.length - 1}
                onMove={by => moveBy('custom', i, by)}
              />
              <span className="ab-name">
                <span className="ab-cmd">{one.cmd}</span>
                <span className={one.bad ? 'ab-gate ab-gate-bad' : 'ab-gate'}>
                  {one.bad ? t('ab.badgate', lang) + ' ' + one.gate : gateLabel(one.gate)}
                </span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked="true"
                ref={el => {
                  grips.current['x:' + one.id] = el;
                }}
                aria-label={one.cmd}
                aria-description={t('ab.offremoves', lang)}
                title={t('ab.offremoves', lang)}
                className="cfg-switch cfg-switch-on"
                onClick={() => remove(i)}
              >
                <span className="cfg-switch-knob" />
              </button>
            </li>
          ))}
        </ol>
      ) : null}

      {custom.length < AUTOBUFF_MAX_LINES ? (
        <form className="ab-add" onSubmit={add}>
          {/* A div, not a label: the listbox would otherwise be read as part
              of the box's name. */}
          <div className="ab-field ab-field-gate">
            <span className="cfg-note" id="ab-gate-label">
              {t('ab.gate', lang)}
            </span>
            <input
              ref={gateInput}
              type="text"
              role="combobox"
              aria-labelledby="ab-gate-label"
              aria-autocomplete="list"
              aria-expanded={picks.length > 0}
              aria-controls={picks.length ? listId : undefined}
              aria-activedescendant={pick >= 0 ? listId + '-' + pick : undefined}
              autoComplete="off"
              value={gate}
              maxLength={AUTOBUFF_MAX_GATE}
              spellCheck={false}
              placeholder={t('ab.always', lang)}
              onChange={e => typeGate(e.target.value)}
              onKeyDown={gateKeys}
              onBlur={() => setPicks([])}
            />
            {picks.length ? (
              <ul className="ab-picks" id={listId} role="listbox" ref={picksList}>
                {picks.map((one, i) => (
                  <li
                    key={one.sn}
                    id={listId + '-' + i}
                    role="option"
                    aria-selected={i === pick}
                    className={i === pick ? 'ab-pick ab-pick-on' : 'ab-pick'}
                    // mousedown, not click: a click lands after the input's blur
                    // has already closed the list.
                    onMouseDown={e => {
                      e.preventDefault();
                      choose(one);
                    }}
                  >
                    {one.name}
                    {one.name !== one.sn ? <span className="ab-pick-sn">{one.sn}</span> : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <label className="ab-field ab-field-cmd">
            <span className="cfg-note">{t('ab.cmd', lang)}</span>
            <input
              ref={cmdInput}
              type="text"
              value={cmd}
              maxLength={AUTOBUFF_MAX_CMD}
              spellCheck={false}
              placeholder="order rat c haste"
              onChange={e => setCmd(e.target.value)}
            />
          </label>
          <button type="submit" className="cfg-button cfg-button-main" disabled={!cmd.trim()}>
            {t('ab.add', lang)}
          </button>
        </form>
      ) : (
        <div className="cfg-note">{t('ab.full', lang)}</div>
      )}

      {legacy.length ? (
        <div className="ab-legacy">
          <div className="cfg-row-desc">
            {t('ab.legacy', lang).replace('%d', String(legacy.length))}
          </div>
          <button type="button" className="cfg-button" onClick={importLegacy}>
            {t('ab.import', lang)}
          </button>
        </div>
      ) : null}
    </div>
  );
}
