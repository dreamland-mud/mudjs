import React, { useEffect, useRef, useState } from 'react';
import $ from 'jquery';

import { rpccmd } from '../../websock.js';
import { getLang, t } from '../../i18n';
import { loadIndex, loadBodies, label } from '../windowletsPanel/helpSearch';
import { render } from './helpMarkup';
import './help-sheet.css';

// The widgets' help: a parchment sheet on the right, opened by clicking a widget.
//
//   openWidgetHelp({ kind: 'article', id: 1029 })            a help article
//   openWidgetHelp({ kind: 'stats' })                        stats legend + summary
//   openWidgetHelp({ kind: 'cmd', what: 'quest' })           an info command's output
//   openWidgetHelp({ kind: 'cmd', what: 'whois', arg: 'Kit' })
//
// Command output comes from the widget_help RPC (dreamland_code iomanager), which
// runs the command with its output captured, so nothing lands in the terminal.
// A server without that RPC never answers; after REPLY_WAIT the sheet says which
// command to type instead of spinning forever.

const OPEN_EVENT = 'widgethelp:open';
const REPLY_WAIT = 4000;
const STATS_ARTICLE = 41;

export function openWidgetHelp(req) {
  $(document).trigger(OPEN_EVENT, [req]);
}

const reqKey = (what, arg) => what + '|' + (arg || '');

function articleBody(bodies, id) {
  const o = bodies.overlay[id];
  return o != null && o !== '' ? o : bodies.ru[id] || '';
}

// An <hh> without an id (the game's [bracket] markup) is resolved by keyword.
function keywordResolver(index) {
  const byKw = {};
  index.forEach(a => (a.kwList || []).forEach(k => {
    const low = k.toLowerCase();
    if (byKw[low] == null) byKw[low] = a.id;
  }));
  return text => {
    const id = byKw[text.trim().toLowerCase()];
    return id == null ? null : String(id);
  };
}

function StatsLegend({ lang, onArticle }) {
  const row = (keys, text) => (
    <li>
      <b>{keys.map(k => t('par.' + k, lang)).join(', ')}:</b> {t(text, lang)}
    </li>
  );
  return (
    <>
      <h3>{t('hs.legend', lang)}</h3>
      <ul>
        {row(['str', 'int', 'wis', 'dex', 'con', 'cha'], 'hs.stats.base')}
        {row(['hit'], 'hs.stats.hit')}
        {row(['dam'], 'hs.stats.dam')}
        {row(['ac'], 'hs.stats.ac')}
        {row(['save'], 'hs.stats.save')}
      </ul>
      <h3>{t('hs.stats.how', lang)}</h3>
      <p>{t('hs.stats.sum1', lang)}</p>
      <p>{t('hs.stats.sum2', lang)}</p>
      <p>{t('hs.stats.sum3', lang)}</p>
      <p>
        <button type="button" className="hs-link hs-more" onClick={() => onArticle(STATS_ARTICLE)}>
          {t('hs.full', lang)}
        </button>
      </p>
    </>
  );
}

// The modular frame: one corner shape turned four ways, plain side rules and a
// keystone top and bottom. Decoration only.
const Frame = () => (
  <span className="hs-frame" aria-hidden="true">
    <span className="hs-frame__c tl" /><span className="hs-frame__c tr" />
    <span className="hs-frame__c bl" /><span className="hs-frame__c br" />
    <span className="hs-frame__s top" /><span className="hs-frame__s bottom" />
    <span className="hs-frame__s left" /><span className="hs-frame__s right" />
    <span className="hs-frame__k top" /><span className="hs-frame__k bottom" />
  </span>
);

export default function HelpSheet() {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState(getLang());
  // Views stack up as the reader follows links; Back pops one.
  const [stack, setStack] = useState([]);
  const [view, setView] = useState(null); // { title, html, node, state }
  const sheet = useRef(null);
  const returnTo = useRef(null);
  const waiting = useRef({}); // reqKey -> timer

  const top = stack.length ? stack[stack.length - 1] : null;

  useEffect(() => {
    const onOpen = (e, req) => {
      returnTo.current = document.activeElement;
      setStack([req]);
      setOpen(true);
    };
    const onPrompt = (e, b) => {
      if (b && b.lang) setLang(b.lang);
    };
    const onResult = (e, b) => {
      if (!b) return;
      const key = reqKey(b.what, b.arg);
      clearTimeout(waiting.current[key]);
      delete waiting.current[key];
      $(document).trigger('widgethelp:result', [key, b.text || '']);
    };

    $(document).on(OPEN_EVENT, onOpen);
    $('#rpc-events').on('rpc-prompt', onPrompt);
    $('#rpc-events').on('rpc-widget_help_result', onResult);
    return () => {
      $(document).off(OPEN_EVENT, onOpen);
      $('#rpc-events').off('rpc-prompt', onPrompt);
      $('#rpc-events').off('rpc-widget_help_result', onResult);
    };
  }, []);

  // Build the view for the top of the stack.
  useEffect(() => {
    if (!open || !top) return undefined;
    let live = true;

    if (top.kind === 'stats') {
      setView({ title: t('par.title', lang), node: 'stats', state: 'ready' });
    } else if (top.kind === 'article') {
      setView({ title: '', state: 'loading' });
      Promise.all([loadIndex(), loadBodies(lang)])
        .then(([index, bodies]) => {
          if (!live) return;
          const entry = index.find(a => String(a.id) === String(top.id));
          const raw = articleBody(bodies, top.id);
          if (!raw) {
            setView({ title: '', state: 'error', note: t('hs.nohelp', lang) });
            return;
          }
          setView({
            title: entry ? label(entry, lang) : '#' + top.id,
            html: render(raw, { resolveLink: keywordResolver(index) }),
            state: 'ready',
          });
        })
        .catch(() => live && setView({ title: '', state: 'error', note: t('hs.nohelp', lang) }));
    } else if (top.kind === 'cmd') {
      const key = reqKey(top.what, top.arg);
      const title = top.what === 'whois' ? top.arg : t('hs.t.' + top.what, lang);
      const typed = top.what + (top.arg ? ' ' + top.arg : '');
      const fallback = () =>
        live && setView({ title, state: 'error', note: t('hs.noreply', lang).replace('%s', typed) });
      const onText = (e, k, text) => {
        if (k !== key || !live) return;
        setView({ title, html: render(text, { lines: true }), state: 'ready' });
      };

      setView({ title, state: 'loading' });
      $(document).on('widgethelp:result', onText);
      if (rpccmd('widget_help', top.what, top.arg || '')) {
        clearTimeout(waiting.current[key]);
        waiting.current[key] = setTimeout(fallback, REPLY_WAIT);
      } else {
        fallback();
      }
      return () => {
        live = false;
        $(document).off('widgethelp:result', onText);
      };
    }
    return () => { live = false; };
  }, [open, top, lang]);

  // Escape closes; focus goes into the sheet and back to what opened it.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = e => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    if (sheet.current) sheet.current.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (open) return;
    const back = returnTo.current;
    if (back && typeof back.focus === 'function' && document.contains(back)) back.focus();
    else $('#input input').focus();
  }, [open]);

  const pushArticle = id => setStack(s => s.concat([{ kind: 'article', id }]));

  // Links inside rendered markup are plain buttons carrying data-hid.
  const onBodyClick = e => {
    const link = e.target.closest('[data-hid]');
    if (!link) return;
    e.preventDefault();
    pushArticle(link.getAttribute('data-hid'));
  };

  let body;
  if (!view || view.state === 'loading') {
    body = <p className="hs-note">{t('hs.loading', lang)}</p>;
  } else if (view.state === 'error') {
    body = <p className="hs-note">{view.note}</p>;
  } else if (view.node === 'stats') {
    body = <StatsLegend lang={lang} onArticle={pushArticle} />;
  } else {
    body = <div className={top && top.kind === 'cmd' ? 'hs-out' : 'hs-article'}
      dangerouslySetInnerHTML={{ __html: view.html }} />;
  }

  return (
    <>
      <div className={open ? 'hs-scrim hs-scrim-open' : 'hs-scrim'} onClick={() => setOpen(false)} />
      <aside
        ref={sheet}
        className={open ? 'hs-sheet hs-sheet-open' : 'hs-sheet'}
        role="dialog"
        aria-modal="true"
        aria-labelledby="hs-title"
        aria-hidden={!open}
        tabIndex={-1}
      >
        <div className="hs-paper">
          <Frame />
          <div className="hs-head">
            {stack.length > 1 ? (
              <button type="button" className="hs-back" aria-label={t('hs.back', lang)}
                onClick={() => setStack(s => s.slice(0, -1))}>‹</button>
            ) : null}
            <h2 id="hs-title" className="hs-title">{view && view.title ? view.title : ''}</h2>
            <button type="button" className="hs-close" aria-label={t('hs.close', lang)}
              onClick={() => setOpen(false)}>✕</button>
          </div>
          <div className="hs-body" onClick={onBodyClick}>{body}</div>
        </div>
      </aside>
    </>
  );
}
