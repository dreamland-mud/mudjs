import $ from 'jquery';
import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';

import { send } from '../../websock';
import { usePrompt } from '../../react-hooks';
import { t, getLang } from '../../i18n';
import { loadIndex, loadBodies, makeTextCache, search, normQuery, label, kind, excerpt } from './helpSearch';

const echo = txt => {
  $('.terminal').trigger('output', [txt]);
};

const DROPDOWN_MIN_WIDTH = 360;

// Index and bodies are fetched on first focus, not on page load: most sessions
// never touch the help box and the bodies are ~1 MB gzipped.
const useHelpData = (wanted, lang) => {
  const [index, setIndex] = useState(null);
  const [error, setError] = useState(null);
  const [bodies, setBodies] = useState(null);

  useEffect(() => {
    if (!wanted || index) return;
    let live = true;
    loadIndex()
      .then(data => live && setIndex(data))
      .catch(e => {
        console.log('Cannot retrieve help index.');
        if (live) setError(e);
      });
    return () => {
      live = false;
    };
  }, [wanted, index]);

  useEffect(() => {
    if (!wanted) return;
    let live = true;
    loadBodies(lang).then(b => live && setBodies(b));
    return () => {
      live = false;
    };
  }, [wanted, lang]);

  // stripped article text for the current language, built lazily per article
  const textFor = useMemo(() => (bodies && bodies.lang === lang ? makeTextCache(bodies) : null), [bodies, lang]);

  return { index, error, textFor };
};

export default function Help() {
  const inputRef = useRef();
  const listRef = useRef();
  // Subscribe to the prompt so a `config language` switch re-renders the labels.
  const prompt = usePrompt();
  const lang = (prompt && prompt.lang) || getLang();

  const [wanted, setWanted] = useState(false);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState(null);

  const { index, error, textFor } = useHelpData(wanted, lang);

  const q = normQuery(query);
  const hits = useMemo(() => (index ? search(index, q, lang, textFor) : []), [index, q, lang, textFor]);
  const showList = open && q !== '' && index !== null;

  useEffect(() => setActive(0), [q]);

  // The panel scrolls, so the list lives in a portal on <body> and is pinned
  // under the input instead of being clipped by the panel.
  useLayoutEffect(() => {
    if (!showList) return;
    const place = () => {
      const r = inputRef.current.getBoundingClientRect();
      const width = Math.min(Math.max(r.width, DROPDOWN_MIN_WIDTH), window.innerWidth - 16);
      const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
      setPos({ left, top: r.bottom + 6, width, maxHeight: Math.max(160, window.innerHeight - r.bottom - 20) });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [showList]);

  useEffect(() => {
    if (!showList || !listRef.current) return;
    const el = listRef.current.querySelector('.is-active');
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [active, showList]);

  const showTopic = topic => {
    const cmd = 'справка ' + topic;
    echo(cmd + '\n');
    send(cmd);
    setQuery('');
    setOpen(false);
    $('#input input').focus();
  };

  const onKeyDown = e => {
    if (e.key === 'ArrowDown' && hits.length) {
      e.preventDefault();
      setOpen(true);
      setActive(i => (i + 1) % hits.length);
    } else if (e.key === 'ArrowUp' && hits.length) {
      e.preventDefault();
      setActive(i => (i - 1 + hits.length) % hits.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (showList && hits[active]) showTopic(hits[active].id);
      // no index (fetch failed or still loading): let the game resolve it
      else if (q && (error || !index)) showTopic(query.trim());
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const listId = 'help-results';
  const optionId = i => 'help-result-' + i;

  const list =
    showList &&
    pos &&
    createPortal(
      <div
        ref={listRef}
        id={listId}
        className="help-results"
        role="listbox"
        style={{ left: pos.left, top: pos.top, width: pos.width, maxHeight: pos.maxHeight }}
      >
        {hits.length === 0 && <p className="help-results__empty">{t('help.notFound', lang)}</p>}
        {hits.map((a, i) => {
          const k = kind(a, lang);
          const ex = textFor ? excerpt(textFor(a.id), q) : null;
          return (
            <div
              key={a.id}
              id={optionId(i)}
              role="option"
              aria-selected={i === active}
              className={'help-results__item' + (i === active ? ' is-active' : '')}
              onMouseEnter={() => setActive(i)}
              // mousedown, not click: the input's blur would close the list first
              onMouseDown={e => {
                e.preventDefault();
                showTopic(a.id);
              }}
            >
              <b className="help-results__title">
                {label(a, lang)}
                {k && <span className="help-results__kind">{k}</span>}
              </b>
              {ex && ex[0] + ex[1] + ex[2] !== '' ? (
                <span className="help-results__excerpt">
                  {ex[0]}
                  {ex[1] && <mark>{ex[1]}</mark>}
                  {ex[2]}
                </span>
              ) : (
                <span className="help-results__kw">
                  {(a.kwList || [])
                    .slice(0, 4)
                    .join(' · ')
                    .toLowerCase()}
                </span>
              )}
            </div>
          );
        })}
      </div>,
      document.body
    );

  return (
    <div id="help" className="table-wrapper">
      <span className="dark-panel-title" data-toggle="collapse" data-target="#help-table">
        {t('help.title', lang)}
      </span>
      <button className="close" type="button" data-toggle="collapse" data-target="#help-table">
        {' '}
      </button>
      <div id="help-table" className="" data-hint="hint-help">
        <span className="fa fa-search form-control-feedback"></span>
        <input
          ref={inputRef}
          type="text"
          className="form-control"
          placeholder={t('help.placeholder', lang)}
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={!!showList}
          aria-controls={listId}
          aria-activedescendant={showList && hits[active] ? optionId(active) : undefined}
          value={query}
          onFocus={() => {
            setWanted(true);
            setOpen(true);
          }}
          onBlur={() => setOpen(false)}
          onChange={e => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
        />
      </div>
      {list}
    </div>
  );
}
