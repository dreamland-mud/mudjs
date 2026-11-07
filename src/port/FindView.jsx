/* A searchable list: the find window of the desktop client.
 *
 * Typing goes into the search box; every typed word must start a word of the
 * row. Down moves into the list and Up from the first row goes back to the
 * box; letters typed in the list go on into the search, Backspace too. Enter
 * on a row shows its details below the list; the action buttons work on the
 * chosen row, and each action also has an Alt key. Alt with a digit focuses
 * that filter. Every control is a native element with a name, so it works the
 * same with NVDA, VoiceOver and TalkBack, and with touch. */
import { APP_ROLE } from '../review';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { t, fmt } from '../i18n';

const SHOW_MAX = 300;

/* Every typed word starts some word of the row: "g" finds Githyanki, not Centaur. */
export function matches(query, words) {
  const q = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!q.length) return true;
  const w = (Array.isArray(words) ? words.join(' ') : String(words || ''))
    .toLowerCase()
    .split(/[\s,.;:()'"\-/]+/)
    .filter(Boolean);
  return q.every(part => w.some(word => word.startsWith(part)));
}

let seq = 0;

export default function FindView({
  rows,
  filters = [],
  actions = [],
  searchLabel,
  query: initialQuery = '',
  onQuery,
  emptyText,
  loading,
  searchRef,
  selectKey,
  onActivate,
}) {
  const uid = useMemo(() => 'pf' + ++seq, []);
  const [query, setQuery] = useState(initialQuery);
  const [active, setActive] = useState(0);
  const [details, setDetails] = useState(null);
  const box = useRef(null);
  const list = useRef(null);
  const detailsRef = useRef(null);
  const filterRefs = useRef([]);

  if (searchRef) searchRef.current = box.current;
  useEffect(() => {
    if (searchRef) searchRef.current = box.current;
  });

  const found = useMemo(() => (rows || []).filter(r => matches(query, r.words || r.label)), [rows, query]);
  const shown = found.slice(0, SHOW_MAX);

  // The rows by their keys: a caller that builds the same rows again on a
  // render does not count as a new list.
  const rowsSig = useMemo(() => (rows || []).map(r => r.key).join(''), [rows]);

  // A new search or a new list starts at the top, or on the row asked for.
  useEffect(() => {
    if (selectKey !== undefined) {
      const i = shown.findIndex(r => r.key === selectKey);
      setActive(i >= 0 ? i : 0);
    } else setActive(0);
    setDetails(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, rowsSig]);

  const row = shown[active];

  const setQ = v => {
    setQuery(v);
    if (onQuery) onQuery(v);
  };

  const focusRow = i => {
    const n = Math.max(0, Math.min(shown.length - 1, i));
    setActive(n);
    const el = list.current && list.current.querySelector(`[data-i="${n}"]`);
    if (el) el.focus();
  };

  // onActivate(row): Enter, Space and a click run the row instead of showing its details.
  const showDetails = r => {
    if (!r) return;
    if (onActivate) return onActivate(r);
    const text = typeof r.detail === 'function' ? r.detail() : r.detail || r.label;
    setDetails({ key: r.key, text });
    setTimeout(() => detailsRef.current && detailsRef.current.focus(), 0);
  };

  const actionFor = e => {
    // Not with Shift: Alt+Shift+letter is left to the tools' own keys.
    if (!e.altKey || e.ctrlKey || e.shiftKey) return null;
    const k = e.key && e.key.length === 1 ? e.key.toLowerCase() : null;
    // By the key's place too: on a Cyrillic layout Alt+W types a Cyrillic letter.
    const hit = a => a.key && (a.key === k || e.code === 'Key' + a.key.toUpperCase());
    return actions.find(a => hit(a) && (!a.when || (row && a.when(row)))) || null;
  };

  // Alt with a digit: that filter. Alt with an action's letter: that action.
  const onCommonKey = e => {
    if (e.altKey && !e.ctrlKey && /^Digit[1-9]$/.test(e.code)) {
      const f = filterRefs.current[parseInt(e.code.slice(5)) - 1];
      if (f) {
        e.preventDefault();
        f.focus();
      }
      return true;
    }
    const a = actionFor(e);
    if (a && row) {
      e.preventDefault();
      a.run(row);
      return true;
    }
    return false;
  };

  const onBoxKey = e => {
    if (onCommonKey(e)) return;
    if (e.key === 'ArrowDown' && shown.length) {
      e.preventDefault();
      focusRow(active);
    } else if (e.key === 'Enter' && shown.length) {
      e.preventDefault();
      showDetails(row);
    }
  };

  const onListKey = e => {
    if (onCommonKey(e)) return;
    const i = active;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusRow(i + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (i === 0) box.current && box.current.focus();
      else focusRow(i - 1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      focusRow(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      focusRow(shown.length - 1);
    } else if (e.key === 'PageDown') {
      e.preventDefault();
      focusRow(i + 10);
    } else if (e.key === 'PageUp') {
      e.preventDefault();
      focusRow(i - 10);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      showDetails(row);
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      setQ(query.slice(0, -1));
      box.current && box.current.focus();
    } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault();
      setQ(query + e.key);
      box.current && box.current.focus();
    }
  };

  const count =
    found.length > SHOW_MAX
      ? fmt('find.many', found.length).replace('%n', SHOW_MAX)
      : fmt('find.count', found.length);

  return (
    <>
      {/* An application to NVDA: Escape here reaches the window at once
          instead of first switching NVDA to browse mode. The details below stay
          outside, readable in browse mode. */}
      <div className="port-fill" role={APP_ROLE} aria-label={searchLabel}>
      <label className="port-search">
        <span className="sr-only">{searchLabel}</span>
        <input
          ref={box}
          className="form-control"
          type="search"
          value={query}
          placeholder={searchLabel}
          aria-label={searchLabel}
          aria-describedby={uid + '-count'}
          autoComplete="off"
          spellCheck={false}
          onChange={e => setQ(e.target.value)}
          onKeyDown={onBoxKey}
        />
      </label>
      {filters.length ? (
        <div className="port-filters" role="group" aria-label={t('find.filters')}>
          {filters.map((f, n) => (
            <label key={f.id}>
              <span>
                {f.label}
                {n < 9 ? <span className="sr-only">, Alt+{n + 1}</span> : null}
              </span>
              <select
                ref={el => (filterRefs.current[n] = el)}
                className="ds-select"
                value={f.value}
                onChange={e => f.onChange(e.target.value)}
                onKeyDown={onCommonKey}
              >
                {f.options.map(o => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      ) : null}
      <p id={uid + '-count'} className="ds-note" aria-live="polite">
        {loading ? t('find.loading') : found.length ? count : emptyText || t('find.none')}
      </p>
      {shown.length ? (
        <ul ref={list} className="port-list" role="listbox" aria-label={searchLabel} onKeyDown={onListKey}>
          {shown.map((r, i) => (
            <li
              key={r.key}
              data-i={i}
              data-key={r.key}
              role="option"
              aria-selected={i === active}
              tabIndex={i === active ? 0 : -1}
              className={'port-row' + (r.dim ? ' port-row-dim' : '')}
              onClick={() => {
                setActive(i);
                showDetails(r);
              }}
              onFocus={() => setActive(i)}
            >
              {r.label}
            </li>
          ))}
        </ul>
      ) : null}
      {row && actions.length ? (
        <div className="port-actions" role="group" aria-label={t('find.actions')}>
          {actions
            .filter(a => !a.when || a.when(row))
            .map((a, n) => (
              <button
                key={a.id}
                type="button"
                className={n === 0 ? 'btn btn-sm' : 'btn btn-sm btn-secondary'}
                aria-keyshortcuts={a.key ? 'Alt+' + a.key.toUpperCase() : undefined}
                onClick={() => a.run(row)}
              >
                {typeof a.label === 'function' ? a.label(row) : a.label}
              </button>
            ))}
        </div>
      ) : null}
      </div>
      {details && row && details.key === row.key ? (
        <div
          ref={detailsRef}
          className="ds-terminal port-details"
          tabIndex={-1}
          role="region"
          aria-label={t('find.details')}
          onKeyDown={e => {
            if (onCommonKey(e)) return;
            // Escape from the details goes back to their row, not out of the window.
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              setDetails(null);
              focusRow(active);
            }
          }}
        >
          {details.text}
        </div>
      ) : null}
    </>
  );
}
