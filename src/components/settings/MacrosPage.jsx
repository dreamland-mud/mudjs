import React, { useEffect, useRef, useState } from 'react';
import { t } from '../../i18n.js';
import keycode from '../sysCommands/keycode.js';
import {
  getMacros,
  watchMacros,
  allMacros,
  saveMacro,
  removeMacro,
  MAX_PER_LIST,
} from '../../macros.js';
import {
  getAliases,
  watchAliases,
  setCharAlias,
  setAcctAliases,
  badName,
  fitsLine,
} from '../../aliases.js';

// The macros tab: a key combination that sends commands, in the character's
// list or the account's (macros.js). Before the server keeps macros, the one
// list is this browser's old #hotkey list.
//
// Adding opens a dialog that waits for a key press, shows the combination as
// key caps, then asks for the commands. The same dialog edits a macro, and the
// Aliases page opens it to turn an alias into a macro. A macro turns into an
// alias from inside the dialog: same commands, a word instead of a key, the
// same list (a browser-only macro becomes a character alias).

const KEY_LABELS = {
  ctrl: 'Ctrl', alt: 'Alt', shift: 'Shift', space: 'Space', pgup: 'PgUp', pgdn: 'PgDn',
  end: 'End', home: 'Home', left: '←', up: '↑', right: '→', down: '↓',
  ins: 'Ins', del: 'Del', esc: 'Esc', enter: 'Enter', backspace: 'Backspace',
};

/** The parts of a combination as the player reads them: ["Ctrl", "Shift", "F1"]. */
export function keyCaps(key) {
  if (!key) return [];
  const parts = key.split('+');
  // "kp+" ends in an empty part: the + is the key.
  if (parts[parts.length - 1] === '' && parts[parts.length - 2] === 'kp') {
    parts.splice(-2, 2, 'kp+');
  }
  return parts.map(p => {
    if (KEY_LABELS[p]) return KEY_LABELS[p];
    if (/^kp./.test(p)) return 'Num ' + p.slice(2);
    if (/^f\d+$/.test(p)) return p.toUpperCase();
    return p.length === 1 ? p.toUpperCase() : p;
  });
}

export function KeyCaps({ value }) {
  const caps = keyCaps(value);
  return (
    <span className="mc-caps" aria-label={caps.join(' + ')}>
      {caps.map((c, i) => (
        <React.Fragment key={i}>
          {i ? <span className="mc-plus" aria-hidden="true">+</span> : null}
          <kbd className="mc-cap" aria-hidden="true">{c}</kbd>
        </React.Fragment>
      ))}
    </span>
  );
}

/** Keys the game's input needs for itself: binding one takes it away there. */
function takesFromInput(key) {
  if (!key) return '';
  const parts = key.split('+');
  const k = parts[parts.length - 1] || 'kp+';
  const mods = parts.slice(0, -1);
  if (mods.includes('ctrl') || mods.includes('alt')) return '';
  if (k === 'up' || k === 'down') return 'mc.warn.history';
  if (k.length === 1 || k === 'space') return 'mc.warn.typing';
  return '';
}

/** A press as a combination name, or '' while only modifiers are held. Esc
 *  never gets here: in the dialog it cancels, and a button assigns it. */
function pressName(e) {
  return keycode.hotkey(e) || '';
}

/**
 * The add / edit dialog. `start`: { key, cmd, scope, origScope, origKey },
 * key '' to start listening at once. `onDone(saved)` closes it; `onSaved`
 * runs after a successful save (the Aliases page drops the alias it came from).
 */
export function MacroDialog({ lang, start, onDone, onSaved }) {
  const [macros, setMacros] = useState(getMacros);
  const [aliases, setAliases] = useState(getAliases);
  const [form, setForm] = useState(start);
  const [listening, setListening] = useState(!start.key);
  const [held, setHeld] = useState('');
  const [unknownKey, setUnknownKey] = useState(false);
  const [aliasWord, setAliasWord] = useState(null); // null: not converting
  const capture = useRef(null);
  const cmdInput = useRef(null);
  const wordInput = useRef(null);
  const returnTo = useRef(document.activeElement);

  useEffect(() => watchMacros(setMacros), []);
  useEffect(() => watchAliases(setAliases), []);
  const set = patch => setForm(f => ({ ...f, ...patch }));

  // Back to whatever opened the dialog when it goes away.
  useEffect(
    () => () => {
      const el = returnTo.current;
      if (el && document.contains(el)) el.focus();
    },
    []
  );

  useEffect(() => {
    if (listening && capture.current) capture.current.focus();
    else if (!listening && aliasWord === null && cmdInput.current) cmdInput.current.focus();
  }, [listening]);

  useEffect(() => {
    if (aliasWord !== null && wordInput.current) wordInput.current.focus();
  }, [aliasWord !== null]);

  // Escape closes this dialog, never the settings sheet under it: a capture
  // listener on window runs before the sheet's own on document.
  useEffect(() => {
    const onKey = e => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      e.preventDefault();
      if (aliasWord !== null) setAliasWord(null);
      else if (listening && form.key) setListening(false);
      else onDone(false);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [listening, aliasWord, form.key]);

  const onCaptureKey = e => {
    if (e.key === 'Tab' || e.key === 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    const mods = keycode.MODIFIERS.filter(m => e[m + 'Key']);
    const name = pressName(e);
    if (!name) {
      // A bare modifier shows while it is held; any other key with no name
      // (Cmd, media keys) cannot be a macro.
      const modOnly = ['Control', 'Alt', 'Shift', 'AltGraph'].includes(e.key);
      setHeld(modOnly ? mods.join('+') : '');
      setUnknownKey(!modOnly);
      return;
    }
    setHeld('');
    setUnknownKey(false);
    set({ key: name });
    setListening(false);
  };

  const onCaptureUp = e => {
    const mods = keycode.MODIFIERS.filter(m => e[m + 'Key']);
    setHeld(mods.join('+'));
  };

  const scopes = macros.known ? ['char', 'acct'] : ['local'];
  const list = sc => (sc === 'local' ? allMacros() : macros[sc]);
  const clash =
    form.key &&
    list(form.scope).find(x => x.key === form.key && !(form.origScope === form.scope && form.origKey === form.key));
  const full =
    form.scope !== 'local' && form.origScope !== form.scope && macros[form.scope].length >= MAX_PER_LIST;
  const cmd = form.cmd.trim();
  const canSave = form.key && cmd && !clash && !full && !listening;
  const warn = takesFromInput(form.key);

  const save = e => {
    e.preventDefault();
    if (!canSave) return;
    if (!saveMacro(form.origScope, form.origKey, form.scope, form.key, cmd)) return;
    if (onSaved) onSaved();
    onDone(true);
  };

  const remove = () => {
    removeMacro(form.origScope, form.origKey);
    onDone(true);
  };

  // Macro -> alias: the same list, a browser-only macro to the character.
  const aliasScope = form.scope === 'acct' ? 'acct' : 'char';
  const word = (aliasWord || '').trim();
  const aliasProblem = (() => {
    if (aliasWord === null || !word) return '';
    const why = badName(word);
    if (why) return 'al.bad.' + why;
    if (aliases[aliasScope].some(x => x.name === word)) return 'al.bad.taken';
    if (aliasScope === 'char' && !fitsLine(word, cmd)) return 'al.bad.long';
    return '';
  })();
  const canAlias =
    aliases.known && (aliasScope === 'char' || aliases.account) && form.origKey && cmd;

  const toAlias = e => {
    e.preventDefault();
    if (!word || aliasProblem) return;
    if (aliasScope === 'char') setCharAlias(null, word, cmd);
    else setAcctAliases(aliases.acct.concat([{ name: word, body: cmd }]));
    removeMacro(form.origScope, form.origKey);
    onDone(true);
  };

  const title = t(form.origKey ? 'mc.editing' : 'mc.adding', lang);

  return (
    <div className="mc-scrim">
      <div className="mc-dialog ab trig" role="dialog" aria-modal="true" aria-labelledby="mc-title">
        <div className="ab-h" id="mc-title">
          {title}
        </div>

        <div className="mc-keyrow">
          {listening ? (
            <div
              ref={capture}
              className="mc-capture"
              tabIndex={0}
              role="textbox"
              aria-label={t('mc.press', lang)}
              aria-describedby="mc-press-hint"
              onKeyDown={onCaptureKey}
              onKeyUp={onCaptureUp}
            >
              {held ? <KeyCaps value={held} /> : <span className="mc-wait">{t('mc.press', lang)}</span>}
            </div>
          ) : (
            <div className="mc-capture mc-captured" aria-live="polite">
              <KeyCaps value={form.key} />
            </div>
          )}
          {listening ? (
            <button type="button" className="cfg-button" onClick={() => {
              set({ key: 'esc' });
              setListening(false);
            }}>
              {t('mc.useesc', lang)}
            </button>
          ) : (
            <button type="button" className="cfg-button" onClick={() => setListening(true)}>
              {t('mc.rekey', lang)}
            </button>
          )}
        </div>
        <div className="cfg-note" id="mc-press-hint">
          {listening ? t('mc.press.hint', lang) : ''}
        </div>
        {unknownKey && listening ? (
          <div className="cfg-note trig-bad" role="alert">
            {t('mc.badkey', lang)}
          </div>
        ) : null}
        {!listening && warn ? <div className="cfg-note mc-warn">{t(warn, lang)}</div> : null}
        {!listening && clash ? (
          <div className="cfg-note trig-bad" role="alert">
            {t('mc.clash', lang)}: {clash.cmd}
          </div>
        ) : null}

        {!form.key ? (
          // Nothing to fill in before there is a key: first the key, then the commands.
          <div className="trig-buttons">
            <button type="button" className="cfg-button" onClick={() => onDone(false)}>
              {t('tr.cancel', lang)}
            </button>
          </div>
        ) : aliasWord !== null ? (
          <form className="mc-form" onSubmit={toAlias}>
            <label className="ab-field" htmlFor="mc-word">
              <span className="cfg-note">{t('mc.toalias.word', lang)}</span>
              <input
                id="mc-word"
                ref={wordInput}
                type="text"
                value={aliasWord}
                spellCheck={false}
                autoComplete="off"
                placeholder={t('al.name.ph', lang)}
                onChange={e => setAliasWord(e.target.value)}
              />
              <span className="cfg-note">{t(aliasScope === 'char' ? 'mc.toalias.char' : 'mc.toalias.acct', lang)}</span>
            </label>
            {aliasProblem ? (
              <div className="cfg-note trig-bad" role="alert">
                {t(aliasProblem, lang)}
              </div>
            ) : null}
            <div className="trig-buttons">
              <button type="button" className="cfg-button" onClick={() => setAliasWord(null)}>
                {t('tr.cancel', lang)}
              </button>
              <button type="submit" className="cfg-button cfg-button-main" disabled={!word || !!aliasProblem}>
                {t('mc.toalias', lang)}
              </button>
            </div>
          </form>
        ) : (
          <form className="mc-form" onSubmit={save}>
            <label className="ab-field" htmlFor="mc-cmd">
              <span className="cfg-note">{t('al.body', lang)}</span>
              <input
                id="mc-cmd"
                ref={cmdInput}
                type="text"
                value={form.cmd}
                spellCheck={false}
                autoComplete="off"
                placeholder={t('al.body.ph', lang)}
                onChange={e => set({ cmd: e.target.value })}
              />
              <span className="cfg-note">{t('mc.cmd.hint', lang)}</span>
            </label>

            {scopes.length > 1 ? (
              <label className="ab-field" htmlFor="mc-scope">
                <span className="cfg-note">{t('tr.scope', lang)}</span>
                <select id="mc-scope" value={form.scope} onChange={e => set({ scope: e.target.value })}>
                  <option value="char">{t('tr.char', lang)}</option>
                  <option value="acct" disabled={!macros.account}>
                    {t('tr.acct', lang)}
                  </option>
                </select>
              </label>
            ) : null}
            {full ? <div className="cfg-note trig-bad">{t('mc.full', lang)}</div> : null}

            <div className="trig-buttons">
              {form.origKey ? (
                <button type="button" className="cfg-button trig-delete" onClick={remove}>
                  {t('tr.delete', lang)}
                </button>
              ) : null}
              {canAlias ? (
                <button type="button" className="cfg-button" onClick={() => setAliasWord('')}>
                  {t('mc.toalias', lang)}
                </button>
              ) : null}
              <button type="button" className="cfg-button" onClick={() => onDone(false)}>
                {t('tr.cancel', lang)}
              </button>
              <button type="submit" className="cfg-button cfg-button-main" disabled={!canSave}>
                {t('tr.save', lang)}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// A phone or tablet with no keyboard has nothing to press in the dialog.
export const noKeyboard = () =>
  typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches;

export default function MacrosPage({ lang }) {
  const [data, setData] = useState(getMacros);
  const [dialog, setDialog] = useState(null);
  const [said, setSaid] = useState('');

  useEffect(() => watchMacros(setData), []);

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

  const items = scope => (scope === 'local' ? allMacros() : data[scope]);

  const list = scope => {
    const label = t(scope === 'char' ? 'tr.char' : scope === 'acct' ? 'tr.acct' : 'mc.local', lang);
    const rows = items(scope);
    return (
      <>
        <div className="ab-h">{label}</div>
        {scope === 'acct' && !data.account ? (
          <div className="cfg-row-desc">{t('mc.noaccount', lang)}</div>
        ) : rows.length ? (
          <ol className="ab-list" role="list" aria-label={label}>
            {rows.map(one => (
              <li key={one.key} className="ab-item">
                <span className="ab-name">
                  <KeyCaps value={one.key} />
                  <span className="trig-chips">
                    <span className="trig-chip trig-chip-cmd">{one.cmd}</span>
                  </span>
                </span>
                <button
                  type="button"
                  className="cfg-button"
                  aria-label={t('tr.edit', lang) + ': ' + keyCaps(one.key).join(' + ')}
                  onClick={() =>
                    setDialog({ key: one.key, cmd: one.cmd, scope, origScope: scope, origKey: one.key })
                  }
                >
                  {t('tr.edit', lang)}
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <div className="cfg-note">{t('mc.empty', lang)}</div>
        )}
        {scope !== 'local' && statusText(scope) ? (
          <div className="cfg-note" role="status">
            {statusText(scope)}
          </div>
        ) : null}
      </>
    );
  };

  if (!data.known && !data.unsupported) return <div className="cfg-note">{t('mc.loading', lang)}</div>;

  const scopes = data.known ? ['char', 'acct'] : ['local'];
  const firstScope = data.known ? (data.char.length < MAX_PER_LIST ? 'char' : 'acct') : 'local';

  return (
    <div className="ab trig">
      <div className="cfg-row-desc ab-intro">{t('mc.intro', lang)}</div>
      {data.unsupported ? <div className="cfg-note">{t('mc.unsupported', lang)}</div> : null}
      <div className="ab-sr" aria-live="polite">
        {said}
      </div>

      {noKeyboard() ? (
        <div className="cfg-note">{t('mc.nokeyboard', lang)}</div>
      ) : (
        <div>
          <button
            type="button"
            className="cfg-button cfg-button-main"
            onClick={() => setDialog({ key: '', cmd: '', scope: firstScope, origScope: null, origKey: null })}
          >
            {t('mc.add', lang)}
          </button>
        </div>
      )}

      {scopes.map(scope => (
        <React.Fragment key={scope}>{list(scope)}</React.Fragment>
      ))}

      {dialog ? (
        <MacroDialog
          lang={lang}
          start={dialog}
          onDone={saved => {
            setDialog(null);
            if (saved) setSaid(t('mc.saved', lang));
          }}
        />
      ) : null}
    </div>
  );
}
