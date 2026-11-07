/* The game guide window: tabs for zone quests, items, class skills, gods and
 * races, each a searchable list. A port of the desktop client's guide
 * (findviews.py guide_views). Level, class and alignment are shared by every
 * tab and are always its first three filters (Alt+1, Alt+2, Alt+3). Each tab
 * remembers its search and its row while the page is open. */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import $ from 'jquery';
import { useSelector } from 'react-redux';
import Sheet from '../Sheet';
import './guide.css';
import FindView from '../FindView';
import { loadData, loadIndex, loadBodies } from '../sitedata';
import { lang as gameLang } from '../game';
import { runFromSquare } from '../walk';
import { echoHtml } from '../../components/sysCommandUtils';
import { openWidgetHelp } from '../../components/helpSheet/HelpSheet';
import { t } from '../../i18n';
import './strings';
import { tr } from '../find/common';
import { Site } from './site.js';
import { parseAreas, areaByName } from '../find/areadata';
import { buildViews } from './views.js';
import { load as loadChar, save as saveChar, onCharacter, askServer } from './character';

export const TABS = ['quests', 'items', 'skills', 'gods', 'races'];
export const OPEN = 'guide:open';

// Kept while the page is open: the tab, and each tab's search and row.
const place = { tab: 'quests', query: {}, active: {} };

const sites = {};
function loadSite(lang) {
  if (!sites[lang]) {
    sites[lang] = Promise.all([loadIndex(), loadBodies(lang), loadData('db_weapon.json'), loadData('db_armor.json')])
      .then(([index, bodies, weapons, armor]) => {
        const site = new Site(lang, index, bodies, weapons, armor);
        if (!site.ready()) throw new Error('empty');
        return site;
      })
      .catch(e => {
        delete sites[lang];
        throw e;
      });
  }
  return sites[lang];
}

const escapeHtml = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const say = text => echoHtml('<span>' + escapeHtml(text) + '</span>');

/* Walk to the area with one of these names (any language), from the area index. */
async function walkTo(names, lang) {
  let areas;
  try {
    areas = parseAreas(await loadData('maps-index.json'), lang);
  } catch (e) {
    return say(t('guide.areas.offline'));
  }
  // The same areas and routes as the Areas window (find/areadata.js): a route
  // in several parts walks its first part.
  const byName = areaByName(areas);
  const key = n => String(n || '').replace(/^['"]+|['"]+$/g, '').trim().toLowerCase();
  const area = (names || []).map(n => byName.get(key(n))).find(Boolean) || null;
  if (!area) return say(tr('guide.nozone', names[0] || ''));
  if (!area.route) return say(area.note ? tr('guide.noroute', area.name, area.note) : tr('guide.noroute.plain', area.name));
  if (area.note) say(tr('guide.then', area.note));
  runFromSquare(area.route);
}

export default function GuideView() {
  const uiLang = useSelector(state => state.prompt && state.prompt.lang);
  const lang = gameLang();
  const [open, setOpen] = useState(false);
  const openRef = useRef(false);
  const [tab, setTab] = useState(place.tab);
  const [status, setStatus] = useState({ state: 'idle' });
  const [{ ctx, opts }, setChar] = useState(() => loadChar());
  const searchRefs = useRef({});
  const tabRefs = useRef({});
  const initialFocus = useMemo(() => ({ get current() { return searchRefs.current[place.tab] && searchRefs.current[place.tab].current; } }), []);

  TABS.forEach(id => {
    if (!searchRefs.current[id]) searchRefs.current[id] = { current: null };
  });

  const focusSearch = id => setTimeout(() => {
    const el = searchRefs.current[id] && searchRefs.current[id].current;
    if (el) el.focus();
  }, 0);

  const pick = useCallback((id, focus) => {
    place.tab = id;
    setTab(id);
    if (focus === 'search') focusSearch(id);
    else if (focus === 'tab') setTimeout(() => tabRefs.current[id] && tabRefs.current[id].focus(), 0);
  }, []);

  const fetchSite = useCallback(() => {
    const l = gameLang();
    setStatus({ state: 'loading' });
    loadSite(l).then(
      site => setStatus({ state: 'ready', site }),
      () => setStatus({ state: 'error' })
    );
  }, []);

  // Opened by the keys, the Tools menu and #guide.
  useEffect(() => {
    const onOpen = (e, which) => {
      const id = TABS.includes(which) ? which : place.tab;
      if (!openRef.current) {
        setChar(loadChar());
        askServer();
        // A failed load is tried again on the next open.
        setStatus(s => (s.state === 'error' ? { state: 'idle' } : s));
      }
      openRef.current = true;
      setOpen(true);
      pick(id, 'search');
    };
    $(document).on(OPEN, onOpen);
    return () => $(document).off(OPEN, onOpen);
  }, [pick]);

  useEffect(() => onCharacter(r => setChar({ ctx: r.ctx, opts: r.opts })), []);

  // The data of the game's language, again when the language changes.
  useEffect(() => {
    const stale = status.state === 'idle' || (status.state === 'ready' && status.site.lang !== lang);
    if (open && stale) fetchSite();
  }, [open, lang, status, fetchSite]);

  // Once the data is in, the search box of the open tab, unless the focus is
  // already somewhere in the guide.
  useEffect(() => {
    if (!open || status.state !== 'ready') return;
    const a = document.activeElement;
    // Still on the window or its title (Sheet's start while there was no
    // search box yet): on into the search box now it is there.
    if (!a || a === document.body || a.classList.contains('port-sheet') || a.classList.contains('port-title'))
      focusSearch(place.tab);
  }, [open, status.state]);

  // A failed load: the focus goes to Try again, not lost on the page.
  const retryRef = useRef(null);
  useEffect(() => {
    if (open && status.state === 'error') setTimeout(() => retryRef.current && retryRef.current.focus(), 0);
  }, [open, status.state]);

  const close = useCallback(() => {
    openRef.current = false;
    setOpen(false);
  }, []);

  const setCtx = (key, value) => {
    const next = Object.assign({}, ctx, { [key]: value });
    saveChar(next, opts);
    setChar({ ctx: next, opts });
  };
  const setOpt = (key, value) => {
    const next = Object.assign({}, opts, { [key]: value });
    saveChar(ctx, next);
    setChar({ ctx, opts: next });
  };

  // Leave the guide first, then act, so the focus lands where the action goes.
  const after = fn => {
    close();
    setTimeout(fn, 50);
  };
  const goTo = names => after(() => walkTo(names, lang));
  const readHelp = id => after(() => openWidgetHelp({ kind: 'article', id }));

  const site = status.state === 'ready' ? status.site : null;
  const views = useMemo(
    () => (site ? buildViews(t, tr, site, ctx, opts, setCtx, setOpt, goTo, readHelp) : null),
    // setCtx and friends close over ctx and opts, which are listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [site, ctx, opts, uiLang]
  );

  const onTabKey = e => {
    const i = TABS.indexOf(tab);
    let n = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % TABS.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i + TABS.length - 1) % TABS.length;
    else if (e.key === 'Home') n = 0;
    else if (e.key === 'End') n = TABS.length - 1;
    if (n === null || e.altKey || e.ctrlKey) return;
    e.preventDefault();
    pick(TABS[n], 'tab');
  };

  // The row in focus, so the tab opens on it again.
  // The row carries its key (FindView): no need to search the list again.
  const onRowFocus = id => e => {
    const el = e.target;
    if (!el || el.getAttribute('role') !== 'option') return;
    const key = el.getAttribute('data-key');
    if (key) place.active[id] = { key, sig: views[id].sig };
  };

  let body;
  if (status.state === 'error') {
    body = (
      <div>
        <p className="ds-note" role="alert">{t('guide.offline')}</p>
        <button ref={retryRef} type="button" className="btn btn-sm" onClick={fetchSite}>{t('guide.retry')}</button>
      </div>
    );
  } else if (!views) {
    body = <p className="ds-note" role="status">{t('guide.loading')}</p>;
  } else {
    body = (
      <>
        <div className="ds-chips" role="tablist" aria-label={t('guide.tabs')} onKeyDown={onTabKey}>
          {TABS.map(id => (
            <button
              key={id}
              ref={el => (tabRefs.current[id] = el)}
              id={'guide-tab-' + id}
              type="button"
              role="tab"
              className={tab === id ? 'ds-chip is-on' : 'ds-chip'}
              aria-selected={tab === id}
              aria-controls={'guide-panel-' + id}
              aria-keyshortcuts={'Alt+Shift+' + id[0].toUpperCase()}
              tabIndex={tab === id ? 0 : -1}
              onClick={() => pick(id)}
            >
              {t('guide.tab.' + id)}
            </button>
          ))}
        </div>
        {TABS.map(id => {
          const v = views[id];
          const kept = place.active[id];
          const selectKey = kept && kept.sig === v.sig ? kept.key : v.start;
          return (
            <div
              key={id}
              id={'guide-panel-' + id}
              role="tabpanel"
              aria-labelledby={'guide-tab-' + id}
              className="port-panel"
              hidden={tab !== id}
              onFocus={onRowFocus(id)}
            >
              <FindView
                rows={v.rows}
                filters={v.filters}
                actions={v.actions}
                searchLabel={t('guide.search') + ', ' + t('guide.tab.' + id)}
                query={place.query[id] || ''}
                onQuery={q => (place.query[id] = q)}
                emptyText={v.empty}
                searchRef={searchRefs.current[id]}
                selectKey={selectKey}
              />
            </div>
          );
        })}
      </>
    );
  }

  return (
    <Sheet id="guide" open={open} onClose={close} title={t('guide.title')} wide initialFocus={initialFocus}>
      {body}
    </Sheet>
  );
}
