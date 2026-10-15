import React, { useEffect, useRef, useState } from 'react';
import { t } from '../../i18n.js';
import {
  getAliases,
  watchAliases,
  setCharAlias,
  removeCharAlias,
  setAcctAliases,
  badName,
  fitsLine,
  MAX_ACCT,
  MAX_LINE,
} from '../../aliases.js';

// The aliases tab: the character's in-game aliases (the game's `alias`
// command) and the account's, which the client expands (aliases.js).
//
// One editor form adds and changes both. Saving a character alias sends the
// same `alias` / `unalias` a player would type, so its answer shows in the
// game text and the list here follows what the game then reports.

const blank = scope => ({ scope, name: '', body: '', origScope: null, origName: null });

export default function AliasesPage({ lang }) {
  const [data, setData] = useState(getAliases);
  const [form, setForm] = useState(null);
  const [formKey, setFormKey] = useState(0);
  const [said, setSaid] = useState('');
  const nameInput = useRef(null);
  const open = next => {
    setForm(next);
    setFormKey(k => k + 1);
  };

  useEffect(() => watchAliases(setData), []);
  useEffect(() => {
    if (formKey && nameInput.current) nameInput.current.focus();
  }, [formKey]);

  const set = patch => setForm(f => ({ ...f, ...patch }));

  /** Why the form cannot be saved, as an i18n key, or ''. */
  const problem = f => {
    const name = f.name.trim();
    const body = f.body.trim();
    if (!name) return '';
    const why = badName(name);
    if (why) return 'al.bad.' + why;
    const taken = data[f.scope].some(x => x.name === name && !(f.origScope === f.scope && f.origName === name));
    if (taken) return 'al.bad.taken';
    if (body && f.scope === 'char' && !fitsLine(name, body)) return 'al.bad.long';
    if (body.length > MAX_LINE) return 'al.bad.long';
    return '';
  };

  const bad = form ? problem(form) : '';
  const canSave = form && form.name.trim() && form.body.trim() && !bad;

  const save = e => {
    e.preventDefault();
    if (!canSave) return;
    const name = form.name.trim();
    const body = form.body.trim();
    const { scope, origScope, origName } = form;

    if (scope === 'char') {
      setCharAlias(origScope === 'char' ? origName : null, name, body);
      if (origScope === 'acct') setAcctAliases(data.acct.filter(x => x.name !== origName));
    } else {
      const one = { name, body };
      const at = origScope === 'acct' ? data.acct.findIndex(x => x.name === origName) : -1;
      setAcctAliases(at >= 0 ? data.acct.map((x, i) => (i === at ? one : x)) : data.acct.concat([one]));
      if (origScope === 'char') removeCharAlias(origName);
    }
    setSaid(t(scope === 'char' ? 'al.sent' : 'al.saved', lang));
    open(null);
  };

  const remove = () => {
    if (form.origScope === 'char') removeCharAlias(form.origName);
    else setAcctAliases(data.acct.filter(x => x.name !== form.origName));
    setSaid(t('al.removed', lang));
    open(null);
  };

  const statusText = () => {
    const st = data.status;
    if (st === 'saving') return t('tr.saving', lang);
    if (st && st.startsWith('error:')) {
      const why = st.slice(6);
      const known = ['offline', 'too_big', 'rate', 'no_account'].includes(why);
      return t('tr.error', lang) + ': ' + t(known ? 'tr.err.' + why : 'tr.err.other', lang);
    }
    return '';
  };

  const full = scope => (scope === 'char' ? data.char.length >= data.max : data.acct.length >= MAX_ACCT);

  const list = scope => {
    const items = data[scope];
    const label = t(scope === 'char' ? 'al.char' : 'al.acct', lang);
    return (
      <>
        <div className="ab-h">{label}</div>
        {scope === 'acct' && !data.account ? (
          <div className="cfg-row-desc">{t('al.noaccount', lang)}</div>
        ) : items.length ? (
          <ol className="ab-list" role="list" aria-label={label}>
            {items.map(one => (
              <li key={one.name} className="ab-item">
                <span className="ab-name">
                  <span className="trig-pattern">{one.name}</span>
                  <span className="trig-chips">
                    <span className="trig-chip trig-chip-cmd">{one.body}</span>
                  </span>
                </span>
                <button
                  type="button"
                  className="cfg-button"
                  aria-label={t('tr.edit', lang) + ': ' + one.name}
                  onClick={() => open({ scope, name: one.name, body: one.body, origScope: scope, origName: one.name })}
                >
                  {t('tr.edit', lang)}
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <div className="cfg-note">{t('al.empty', lang)}</div>
        )}
        {scope === 'acct' && statusText() ? (
          <div className="cfg-note" role="status">
            {statusText()}
          </div>
        ) : null}
      </>
    );
  };

  if (data.unsupported) return <div className="cfg-note">{t('al.unsupported', lang)}</div>;
  if (!data.known) return <div className="cfg-note">{t('al.loading', lang)}</div>;

  return (
    <div className="ab trig">
      <div className="cfg-row-desc ab-intro">{t('al.intro', lang)}</div>
      <div className="ab-sr" aria-live="polite">
        {said}
      </div>

      {form ? (
        <form className="ab-add trig-form" onSubmit={save} aria-label={t(form.origName ? 'al.editing' : 'al.adding', lang)}>
          <div className="ab-h">{t(form.origName ? 'al.editing' : 'al.adding', lang)}</div>

          <label className="ab-field" htmlFor="alias-name">
            <span className="cfg-note">{t('al.name', lang)}</span>
            <input
              id="alias-name"
              ref={nameInput}
              type="text"
              value={form.name}
              spellCheck={false}
              autoComplete="off"
              placeholder={t('al.name.ph', lang)}
              aria-invalid={bad ? 'true' : 'false'}
              onChange={e => set({ name: e.target.value })}
            />
          </label>

          <label className="ab-field" htmlFor="alias-body">
            <span className="cfg-note">{t('al.body', lang)}</span>
            <input
              id="alias-body"
              type="text"
              value={form.body}
              spellCheck={false}
              autoComplete="off"
              placeholder={t('al.body.ph', lang)}
              onChange={e => set({ body: e.target.value })}
            />
            <span className="cfg-note">{t('al.body.hint', lang)}</span>
          </label>
          {bad ? (
            <div className="cfg-note trig-bad" role="alert">
              {t(bad, lang)}
            </div>
          ) : null}

          <label className="ab-field" htmlFor="alias-scope">
            <span className="cfg-note">{t('tr.scope', lang)}</span>
            <select id="alias-scope" value={form.scope} onChange={e => set({ scope: e.target.value })}>
              <option value="char" disabled={form.origScope !== 'char' && full('char')}>
                {t('al.char', lang)}
              </option>
              <option value="acct" disabled={!data.account || (form.origScope !== 'acct' && full('acct'))}>
                {t('al.acct', lang)}
              </option>
            </select>
            <span className="cfg-note">{t(form.scope === 'char' ? 'al.scope.char' : 'al.scope.acct', lang)}</span>
          </label>

          <div className="trig-buttons">
            {form.origName ? (
              <button type="button" className="cfg-button trig-delete" onClick={remove}>
                {t('tr.delete', lang)}
              </button>
            ) : null}
            <button type="button" className="cfg-button" onClick={() => open(null)}>
              {t('tr.cancel', lang)}
            </button>
            <button type="submit" className="cfg-button cfg-button-main" disabled={!canSave}>
              {t('tr.save', lang)}
            </button>
          </div>
        </form>
      ) : (
        <div>
          <button
            type="button"
            className="cfg-button cfg-button-main"
            disabled={full('char') && (!data.account || full('acct'))}
            onClick={() => open(blank(full('char') ? 'acct' : 'char'))}
          >
            {t('al.add', lang)}
          </button>
        </div>
      )}

      {list('char')}
      {list('acct')}
    </div>
  );
}
