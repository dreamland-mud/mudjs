import React, { useEffect, useRef, useState } from 'react';
import { t } from '../../i18n.js';
import {
  saveAutobuffPrefs,
  legacyAutobuffLines,
  setLegacyAutobuffLines,
} from '../sysCommands/autobuff.js';

// The autobuff tab: which of the character's buffs the button casts, in what
// order, and the player's own lines cast after them. Everything lives on the
// character (server-side), so it follows the player to any device and to the
// typed 'buff' command.
//
// Every change is sent at once as the whole state, and the server answers with
// the whole list it stored. The screen moves on the click, but while a change
// is in flight a stale answer to an earlier one is not allowed to drag it back:
// only the answer to the LAST change is taken.
//
// Reordering is by buttons, not drag: a screen reader can't drag, and a good
// share of the players use one.

const MAX_CUSTOM = 20;
const MAX_CMD = 200;

export default function AutobuffPage({ lang, data }) {
  const [spells, setSpells] = useState([]);
  const [custom, setCustom] = useState([]);
  const [gate, setGate] = useState('*');
  const [cmd, setCmd] = useState('');
  const [legacy, setLegacy] = useState(() => legacyAutobuffLines());
  const inFlight = useRef(0);
  const cmdInput = useRef(null);

  // The server's word replaces ours, unless a newer change of ours is still on
  // its way -- then this answer is to an older one and already out of date.
  useEffect(() => {
    if (!data) return;
    if (inFlight.current > 0) inFlight.current -= 1;
    if (inFlight.current > 0) return;
    setSpells(Array.isArray(data.spells) ? data.spells : []);
    setCustom(Array.isArray(data.custom) ? data.custom : []);
  }, [data]);

  const commit = (nextSpells, nextCustom) => {
    setSpells(nextSpells);
    setCustom(nextCustom);
    if (saveAutobuffPrefs(nextSpells, nextCustom)) inFlight.current += 1;
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
  };

  const remove = i => commit(spells, custom.filter((one, j) => j !== i));

  const add = e => {
    e.preventDefault();
    const g = gate.trim() || '*';
    const c = cmd.trim();
    if (!c || custom.length >= MAX_CUSTOM) return;
    commit(spells, custom.concat([{ gate: g, cmd: c, bad: 0 }]));
    setCmd('');
    setGate('*');
    if (cmdInput.current) cmdInput.current.focus();
  };

  // The old browser-only lines move onto the character, after the ones already
  // there, and leave the browser -- so they stop firing twice. Whatever does not
  // fit under the cap stays in the browser rather than being lost.
  const importLegacy = () => {
    const room = Math.max(MAX_CUSTOM - custom.length, 0);
    const moved = legacy
      .slice(0, room)
      .map(one => ({ gate: one.gate || '*', cmd: one.cmd, bad: 0 }));
    const rest = legacy.slice(room);
    commit(spells, custom.concat(moved));
    setLegacyAutobuffLines(rest);
    setLegacy(rest);
  };

  const gateLabel = g => (g === '*' ? t('ab.always', lang) : t('ab.unless', lang) + ' ' + g);

  return (
    <div className="ab">
      <div className="cfg-row-desc ab-intro">{t('ab.intro', lang)}</div>

      {spells.length ? (
        <ol className="ab-list" aria-label={t('ab.spells', lang)}>
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
        <ol className="ab-list" aria-label={t('ab.own', lang)}>
          {custom.map((one, i) => (
            <li key={i + ':' + one.gate + ':' + one.cmd} className="ab-item">
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

      {custom.length < MAX_CUSTOM ? (
        <form className="ab-add" onSubmit={add}>
          <label className="ab-field ab-field-gate">
            <span className="cfg-note">{t('ab.gate', lang)}</span>
            <input
              type="text"
              value={gate}
              maxLength={40}
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
              maxLength={MAX_CMD}
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
