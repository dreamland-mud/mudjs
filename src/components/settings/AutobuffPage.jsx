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
// Reordering is by buttons, not drag: a screen reader can't drag, and a good
// share of the players use one. After a move the focus follows the moved buff
// and a live region says where it landed.

const lineKey = one => one.gate + '\t' + one.cmd;

export default function AutobuffPage({ lang, data }) {
  const [spells, setSpells] = useState([]);
  const [custom, setCustom] = useState([]);
  const [gate, setGate] = useState('*');
  const [cmd, setCmd] = useState('');
  const [legacy, setLegacy] = useState(() => legacyAutobuffLines());
  const [said, setSaid] = useState('');
  const [refocus, setRefocus] = useState(null);
  const buttons = useRef({});
  const cmdInput = useRef(null);

  useEffect(() => {
    if (!data) return;
    setSpells(Array.isArray(data.spells) ? data.spells : []);
    setCustom(Array.isArray(data.custom) ? data.custom : []);
  }, [data]);

  // Keep the focus on the buff that just moved: on the same arrow while it can
  // still go that way, on the other one once it hit the end (a disabled button
  // would drop the focus to the page).
  useLayoutEffect(() => {
    if (!refocus) return;
    const same = buttons.current[refocus.sn + ':' + refocus.dir];
    const other = buttons.current[refocus.sn + ':' + (refocus.dir === 'up' ? 'down' : 'up')];
    const target = same && !same.disabled ? same : other;
    if (target) target.focus();
    setRefocus(null);
  }, [refocus]);

  const commit = (nextSpells, nextCustom) => {
    setSpells(nextSpells);
    setCustom(nextCustom);
    saveAutobuffPrefs(nextSpells, nextCustom);
  };

  const toggle = i =>
    commit(
      spells.map((one, j) => (j === i ? { ...one, on: one.on ? 0 : 1 } : one)),
      custom
    );

  const move = (i, by) => {
    const j = i + by;
    if (j < 0 || j >= spells.length) return;
    const next = spells.slice();
    [next[i], next[j]] = [next[j], next[i]];
    commit(next, custom);
    setRefocus({ sn: spells[i].sn, dir: by < 0 ? 'up' : 'down' });
    setSaid(
      t('ab.moved', lang)
        .replace('%s', spells[i].name)
        .replace('%d', String(j + 1))
        .replace('%t', String(spells.length))
    );
  };

  const remove = i => commit(spells, custom.filter((one, j) => j !== i));

  const add = e => {
    e.preventDefault();
    const line = { gate: gate.trim() || '*', cmd: cmd.trim(), bad: 0 };
    if (!line.cmd || custom.length >= AUTOBUFF_MAX_LINES) return;
    commit(spells, custom.concat([line]));
    setCmd('');
    setGate('*');
    if (cmdInput.current) cmdInput.current.focus();
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
      moved.push(line);
    });
    if (moved.length) commit(spells, custom.concat(moved));
    setLegacyAutobuffLines(rest);
    setLegacy(rest);
  };

  const gateLabel = g => (g === '*' ? t('ab.always', lang) : t('ab.unless', lang) + ' ' + g);

  return (
    <div className="ab">
      <div className="cfg-row-desc ab-intro">{t('ab.intro', lang)}</div>

      <div className="ab-sr" aria-live="polite">
        {said}
      </div>

      {spells.length ? (
        <ol className="ab-list" role="list" aria-label={t('ab.spells', lang)}>
          {spells.map((one, i) => (
            <li key={one.sn} className={one.on ? 'ab-item' : 'ab-item ab-item-off'}>
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
              <span className="ab-name">{one.name}</span>
              <span className="ab-moves">
                <button
                  type="button"
                  ref={el => {
                    buttons.current[one.sn + ':up'] = el;
                  }}
                  className="cfg-button ab-move"
                  aria-label={t('ab.up', lang) + ': ' + one.name}
                  title={t('ab.up', lang)}
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  ref={el => {
                    buttons.current[one.sn + ':down'] = el;
                  }}
                  className="cfg-button ab-move"
                  aria-label={t('ab.down', lang) + ': ' + one.name}
                  title={t('ab.down', lang)}
                  disabled={i === spells.length - 1}
                  onClick={() => move(i, 1)}
                >
                  ↓
                </button>
              </span>
            </li>
          ))}
        </ol>
      ) : null}

      <div className="ab-h">{t('ab.own', lang)}</div>
      <div className="cfg-row-desc">{t('ab.own.hint', lang)}</div>

      {custom.length ? (
        <ol className="ab-list" role="list" aria-label={t('ab.own', lang)}>
          {custom.map((one, i) => (
            <li key={i + ':' + lineKey(one)} className="ab-item">
              <span className="ab-name">
                <span className="ab-cmd">{one.cmd}</span>
                <span className={one.bad ? 'ab-gate ab-gate-bad' : 'ab-gate'}>
                  {one.bad ? t('ab.badgate', lang) + ' ' + one.gate : gateLabel(one.gate)}
                </span>
              </span>
              <button
                type="button"
                className="cfg-button ab-move"
                aria-label={t('ab.remove', lang) + ': ' + one.cmd}
                title={t('ab.remove', lang)}
                onClick={() => remove(i)}
              >
                ✕
              </button>
            </li>
          ))}
        </ol>
      ) : null}

      {custom.length < AUTOBUFF_MAX_LINES ? (
        <form className="ab-add" onSubmit={add}>
          <label className="ab-field ab-field-gate">
            <span className="cfg-note">{t('ab.gate', lang)}</span>
            <input
              type="text"
              value={gate}
              maxLength={AUTOBUFF_MAX_GATE}
              spellCheck={false}
              onChange={e => setGate(e.target.value)}
            />
          </label>
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
