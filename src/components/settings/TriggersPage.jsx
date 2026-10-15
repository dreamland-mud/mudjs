import React, { useEffect, useMemo, useRef, useState } from 'react';
import { t } from '../../i18n.js';
import {
  getTriggers,
  watchTriggers,
  setTriggerList,
  compileTrigger,
  regexTooSlow,
  newTriggerId,
  MAX_PER_LIST,
} from '../../triggers.js';
import { loadLibrary, playSound, stopSound } from '../../sound.js';

// The triggers tab: the character's list and the account's, each trigger a
// pattern plus any of highlight / sound / commands. Lists live on the server
// (triggers.js); every change saves the whole list a moment later.
//
// One editor form, used both to add and to change a trigger. It has a test
// line: paste something the game said and see whether, and what, matches --
// regex is not something most players read, and %1 is easier to trust once
// you watch it catch a name.
//
// Old #action triggers from this browser move onto the server on their own
// (triggers.js), so there is nothing to import here.

// The terminal is a dark well in every skin, so these all read on it.
const SWATCHES = [
  ['#e6cd86', 'gold'],
  ['#c4674a', 'red'],
  ['#8fbf5a', 'green'],
  ['#6fa8dc', 'blue'],
  ['#bb86fc', 'violet'],
  ['#ffffff', 'white'],
];

const blank = scope => ({
  id: null,
  scope,
  pattern: '',
  regex: false,
  on: true,
  hlMode: '',
  hlColor: SWATCHES[0][0],
  sound: '',
  V: 100,
  cmd: '',
});

function toForm(trig, scope) {
  return {
    id: trig.id,
    scope,
    pattern: trig.pattern || '',
    regex: !!trig.regex,
    on: trig.on !== false,
    hlMode: trig.hl ? trig.hl.mode : '',
    hlColor: trig.hl && trig.hl.color ? trig.hl.color : SWATCHES[0][0],
    sound: trig.sound ? trig.sound.name : '',
    V: trig.sound && trig.sound.V !== undefined ? trig.sound.V : 100,
    cmd: trig.cmd || '',
    act: trig.act,
  };
}

function fromForm(f) {
  return {
    id: f.id || newTriggerId(),
    pattern: f.pattern,
    regex: f.regex,
    on: f.on,
    hl: f.hlMode ? { mode: f.hlMode, color: f.hlColor } : null,
    sound: f.sound ? { name: f.sound, V: Number(f.V) } : null,
    cmd: f.cmd.trim(),
    // Kept as typed in #action, for that command's own listing.
    ...(f.act ? { act: f.act } : {}),
  };
}

function soundLabel(s, lang) {
  if (!s) return '';
  return (s.label && (s.label[lang] || s.label.en)) || s.name;
}

/** What a test line shows: no match, or the match with its %N values. */
function testResult(form, line, lang) {
  if (!line || !form.pattern) return null;
  const re = compileTrigger(form);
  if (re instanceof Error) return { bad: true, text: t('tr.badre', lang) };
  if (form.regex && regexTooSlow(re)) return { bad: true, text: t('tr.slowre', lang) };
  const m = re.exec(line);
  if (!m) return { text: t('tr.test.no', lang) };
  const vars = form.regex
    ? m.slice(1).map((v, i) => '%' + (i + 1) + ' = ' + v)
    : (form.pattern.match(/%[1-9]/g) || []).map((p, i) => p + ' = ' + (m[i + 1] || ''));
  return { ok: true, text: t('tr.test.yes', lang) + (vars.length ? ': ' + vars.join(', ') : '') };
}

function Summary({ trig, library, lang }) {
  const parts = [];
  if (trig.hl) {
    parts.push(
      <span key="hl" className="trig-chip">
        <span className="trig-swatch" style={{ background: trig.hl.color }} aria-hidden="true" />
        {t(trig.hl.mode === 'line' ? 'tr.hl.line' : 'tr.hl.match', lang)}
      </span>
    );
  }
  if (trig.sound) {
    const s = library.find(x => x.name === trig.sound.name);
    parts.push(
      <span key="snd" className="trig-chip">
        {t('tr.sound', lang)}: {soundLabel(s, lang) || trig.sound.name}
      </span>
    );
  }
  if (trig.cmd) {
    parts.push(
      <span key="cmd" className="trig-chip trig-chip-cmd">
        {trig.cmd}
      </span>
    );
  }
  return <span className="trig-chips">{parts.length ? parts : t('tr.noaction', lang)}</span>;
}

export default function TriggersPage({ lang }) {
  const [data, setData] = useState(getTriggers);
  const [library, setLibrary] = useState([]);
  const [form, setForm] = useState(null);
  const [formKey, setFormKey] = useState(0);
  const [testLine, setTestLine] = useState('');
  const [said, setSaid] = useState('');
  const [slowRe, setSlowRe] = useState(false);
  const patternInput = useRef(null);
  const open = next => {
    setForm(next);
    setSlowRe(false);
    setFormKey(k => k + 1);
  };

  useEffect(() => watchTriggers(setData), []);
  useEffect(() => {
    loadLibrary().then(setLibrary);
  }, []);
  // Focus the pattern when the form opens, and only then: moving focus on any
  // later change (the scope select) throws a keyboard user out of the control.
  useEffect(() => {
    if (formKey && patternInput.current) patternInput.current.focus();
  }, [formKey]);

  const set = patch => setForm(f => ({ ...f, ...patch }));
  const test = useMemo(() => (form ? testResult(form, testLine, lang) : null), [form, testLine, lang]);
  const bad = form && form.pattern && compileTrigger(form) instanceof Error;

  const save = e => {
    e.preventDefault();
    if (!form.pattern.trim() || bad) return;
    if (form.regex && regexTooSlow(compileTrigger(form))) {
      setSlowRe(true);
      return;
    }
    const trig = fromForm(form);
    // Moving between lists: out of the old one, onto the end of the new one.
    for (const scope of ['char', 'acct']) {
      const list = data[scope];
      const at = list.findIndex(x => x.id === trig.id);
      if (scope === form.scope) {
        if (at >= 0) setTriggerList(scope, list.map(x => (x.id === trig.id ? trig : x)));
        else setTriggerList(scope, list.concat([trig]));
      } else if (at >= 0) {
        setTriggerList(scope, list.filter(x => x.id !== trig.id));
      }
    }
    setSaid(t('tr.saved', lang));
    open(null);
    setTestLine('');
  };

  const remove = () => {
    for (const scope of ['char', 'acct']) {
      const list = data[scope];
      if (list.some(x => x.id === form.id))
        setTriggerList(scope, list.filter(x => x.id !== form.id));
    }
    setSaid(t('tr.removed', lang));
    open(null);
  };

  const toggle = (scope, id) =>
    setTriggerList(
      scope,
      data[scope].map(x => (x.id === id ? { ...x, on: x.on === false } : x))
    );

  const statusText = scope => {
    const st = data.status[scope];
    if (st === 'saving') return t('tr.saving', lang);
    if (st && st.startsWith('error:')) {
      const why = st.slice(6);
      const known = ['offline', 'too_big', 'rate', 'no_account'].includes(why);
      return t('tr.error', lang) + ': ' + t(known ? 'tr.err.' + why : 'tr.err.other', lang);
    }
    return '';
  };

  const list = scope => {
    const items = data[scope];
    return (
      <>
        <div className="ab-h">{t(scope === 'char' ? 'tr.char' : 'tr.acct', lang)}</div>
        {scope === 'acct' && !data.account ? (
          <div className="cfg-row-desc">{t('tr.noaccount', lang)}</div>
        ) : items.length ? (
          <ol className="ab-list" role="list" aria-label={t(scope === 'char' ? 'tr.char' : 'tr.acct', lang)}>
            {items.map(one => (
              <li key={one.id} className={one.on === false ? 'ab-item ab-item-off' : 'ab-item'}>
                <span className="ab-name">
                  <span className="trig-pattern">{one.pattern}</span>
                  <Summary trig={one} library={library} lang={lang} />
                </span>
                <button
                  type="button"
                  className="cfg-button"
                  aria-label={t('tr.edit', lang) + ': ' + one.pattern}
                  onClick={() => open(toForm(one, scope))}
                >
                  {t('tr.edit', lang)}
                </button>
                <button
                  type="button"
                  role="switch"
                  aria-checked={one.on !== false}
                  aria-label={one.pattern}
                  className={one.on === false ? 'cfg-switch' : 'cfg-switch cfg-switch-on'}
                  onClick={() => toggle(scope, one.id)}
                >
                  <span className="cfg-switch-knob" />
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <div className="cfg-note">{t('tr.empty', lang)}</div>
        )}
        {statusText(scope) ? (
          <div className="cfg-note" role="status">
            {statusText(scope)}
          </div>
        ) : null}
      </>
    );
  };

  if (data.unsupported) return <div className="cfg-note">{t('tr.unsupported', lang)}</div>;
  if (!data.known) return <div className="cfg-note">{t('tr.loading', lang)}</div>;

  const types = [...new Set(library.map(s => s.type))];

  return (
    <div className="ab trig">
      <div className="cfg-row-desc ab-intro">{t('tr.intro', lang)}</div>
      <div className="ab-sr" aria-live="polite">
        {said}
      </div>

      {form ? (
        <form className="ab-add trig-form" onSubmit={save} aria-label={t(form.id ? 'tr.editing' : 'tr.adding', lang)}>
          <div className="ab-h">{t(form.id ? 'tr.editing' : 'tr.adding', lang)}</div>

          <label className="ab-field" htmlFor="trig-pattern">
            <span className="cfg-note">{t('tr.pattern', lang)}</span>
            <input
              id="trig-pattern"
              ref={patternInput}
              type="text"
              value={form.pattern}
              spellCheck={false}
              placeholder={t('tr.pattern.ph', lang)}
              aria-invalid={bad ? 'true' : 'false'}
              onChange={e => {
                set({ pattern: e.target.value });
                setSlowRe(false);
              }}
            />
            <span className="cfg-note">{t(form.regex ? 'tr.pattern.re' : 'tr.pattern.hint', lang)}</span>
          </label>
          {bad || slowRe ? (
            <div className="cfg-note trig-bad" role="alert">
              {t(bad ? 'tr.badre' : 'tr.slowre', lang)}
            </div>
          ) : null}
          <label className="trig-check" htmlFor="trig-regex">
            <input
              id="trig-regex"
              type="checkbox"
              checked={form.regex}
              onChange={e => {
                set({ regex: e.target.checked });
                setSlowRe(false);
              }}
            />
            {t('tr.regex', lang)}
          </label>

          <label className="ab-field" htmlFor="trig-test">
            <span className="cfg-note">{t('tr.test', lang)}</span>
            <input
              id="trig-test"
              type="text"
              value={testLine}
              spellCheck={false}
              placeholder={t('tr.test.ph', lang)}
              onChange={e => setTestLine(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') e.preventDefault();
              }}
            />
          </label>
          <div className={'cfg-note ' + (test && test.ok ? 'trig-ok' : '')} role="status">
            {test && !test.bad ? test.text : ''}
          </div>

          <label className="ab-field" htmlFor="trig-scope">
            <span className="cfg-note">{t('tr.scope', lang)}</span>
            <select id="trig-scope" value={form.scope} onChange={e => set({ scope: e.target.value })}>
              <option value="char">{t('tr.char', lang)}</option>
              <option value="acct" disabled={!data.account}>
                {t('tr.acct', lang)}
              </option>
            </select>
          </label>

          <fieldset className="trig-group">
            <legend className="cfg-note">{t('tr.hl', lang)}</legend>
            <select
              id="trig-hl"
              aria-label={t('tr.hl', lang)}
              value={form.hlMode}
              onChange={e => set({ hlMode: e.target.value })}
            >
              <option value="">{t('tr.hl.none', lang)}</option>
              <option value="line">{t('tr.hl.line', lang)}</option>
              <option value="match">{t('tr.hl.match', lang)}</option>
            </select>
            {form.hlMode ? (
              <span className="trig-swatches" role="radiogroup" aria-label={t('tr.color', lang)}>
                {SWATCHES.map(([c, name]) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={form.hlColor === c}
                    aria-label={t('tr.c.' + name, lang)}
                    title={t('tr.c.' + name, lang)}
                    tabIndex={form.hlColor === c || (!SWATCHES.some(x => x[0] === form.hlColor) && c === SWATCHES[0][0]) ? 0 : -1}
                    className={'trig-swatch-btn' + (form.hlColor === c ? ' trig-swatch-on' : '')}
                    style={{ background: c }}
                    onClick={() => set({ hlColor: c })}
                    onKeyDown={e => {
                      const at = SWATCHES.findIndex(x => x[0] === c);
                      const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
                      if (!step) return;
                      e.preventDefault();
                      const next = SWATCHES[(at + step + SWATCHES.length) % SWATCHES.length][0];
                      set({ hlColor: next });
                      const box = e.currentTarget.parentNode;
                      setTimeout(() => {
                        const el = box.querySelector('[aria-checked="true"]');
                        if (el) el.focus();
                      });
                    }}
                  />
                ))}
              </span>
            ) : null}
            {form.hlMode ? (
                <input
                  id="trig-color"
                  type="color"
                  aria-label={t('tr.color.own', lang)}
                  value={form.hlColor}
                  onChange={e => set({ hlColor: e.target.value })}
                />
            ) : null}
          </fieldset>

          <fieldset className="trig-group">
            <legend className="cfg-note">{t('tr.sound', lang)}</legend>
            {library.length ? (
              <>
                <select
                  id="trig-sound"
                  aria-label={t('tr.sound', lang)}
                  value={form.sound}
                  onChange={e => set({ sound: e.target.value })}
                >
                  <option value="">{t('tr.sound.none', lang)}</option>
                  {types.map(type => (
                    <optgroup key={type} label={t('snd.type.' + type, lang)}>
                      {library
                        .filter(s => s.type === type)
                        .map(s => (
                          <option key={s.name} value={s.name}>
                            {soundLabel(s, lang)}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
                {form.sound ? (
                  <>
                    <button
                      type="button"
                      className="cfg-button"
                      onClick={() => {
                        stopSound();
                        playSound(form.sound, { V: form.V, P: 100 });
                      }}
                    >
                      {t('tr.sound.play', lang)}
                    </button>
                    <label className="trig-volume" htmlFor="trig-volume">
                      {t('tr.volume', lang)}
                      <input
                        id="trig-volume"
                        type="range"
                        min="10"
                        max="100"
                        step="10"
                        value={form.V}
                        onChange={e => set({ V: e.target.value })}
                      />
                    </label>
                  </>
                ) : null}
              </>
            ) : (
              <span className="cfg-note">{t('tr.sound.empty', lang)}</span>
            )}
          </fieldset>

          <label className="ab-field" htmlFor="trig-cmd">
            <span className="cfg-note">{t('tr.cmd', lang)}</span>
            <input
              id="trig-cmd"
              type="text"
              value={form.cmd}
              spellCheck={false}
              placeholder={t('tr.cmd.ph', lang)}
              onChange={e => set({ cmd: e.target.value })}
            />
            <span className="cfg-note">{t('tr.cmd.hint', lang)}</span>
          </label>

          <div className="trig-buttons">
            {form.id ? (
              <button type="button" className="cfg-button trig-delete" onClick={remove}>
                {t('tr.delete', lang)}
              </button>
            ) : null}
            <button type="button" className="cfg-button" onClick={() => open(null)}>
              {t('tr.cancel', lang)}
            </button>
            <button type="submit" className="cfg-button cfg-button-main" disabled={!form.pattern.trim() || bad}>
              {t('tr.save', lang)}
            </button>
          </div>
        </form>
      ) : (
        <div>
          <button
            type="button"
            className="cfg-button cfg-button-main"
            disabled={data.char.length >= MAX_PER_LIST}
            onClick={() => open(blank('char'))}
          >
            {t('tr.add', lang)}
          </button>
        </div>
      )}

      {list('char')}
      {list('acct')}

    </div>
  );
}
