import React, { useEffect, useMemo, useRef, useState } from 'react';
import $ from 'jquery';
import { t, getLang } from '../../i18n.js';
import useConfig from './useConfig.js';
import SettingsPage from './SettingsPage.jsx';
import ScriptPage from './ScriptPage.jsx';
import { saveScript } from '../../settings.js';
import {
  buildTree,
  filterTree,
  findPage,
  firstPage,
  spell,
  SCRIPT_PAGE,
} from './schema.js';

// The settings window: a sheet that slides in from the right edge, with a tree
// of pages on one side, the page itself on the other, and a footer that belongs
// to the page -- the command that was just sent for the game's settings,
// Close/Save for the script.
//
// The sheet is in the document from the start and only ever moves: open and
// closed are one piece of state, from which a class follows, and the transform
// lives in the stylesheet. Written the other way -- a style string built at
// render time -- the browser has nothing to transition from on the first paint
// and the panel appears only on the second click.
//
// Which way the inside is laid out follows the WIDTH OF THE SHEET, not of the
// window: below 560px the tree becomes a drill-down. The sheet is the only
// thing that changes size here, so the window is the wrong thing to ask.
const NARROW = 560;

// The sheet can be dragged wider or narrower by its left edge, and remembers
// how wide the player left it. Never narrower than this, or the settings stop
// fitting at all; never wider than the window, which the stylesheet enforces
// with min(..., 100vw) so a stored width larger than today's window simply does
// not apply -- and still stands when the window grows back.
const MIN_WIDTH = 380;
const DEFAULT_WIDTH = 620;
const WIDTH_KEY = 'mudjs.settings.width';

function storedWidth() {
  try {
    const saved = parseInt(localStorage.getItem(WIDTH_KEY), 10);
    return Number.isFinite(saved) ? Math.max(saved, MIN_WIDTH) : DEFAULT_WIDTH;
  } catch (e) {
    return DEFAULT_WIDTH; // storage disabled -- the default is no worse
  }
}

export default function SettingsDialog() {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState(getLang());
  const [pageKey, setPageKey] = useState(null);
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState({});
  const [inPage, setInPage] = useState(false);
  const [scriptSeen, setScriptSeen] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const [width, setWidth] = useState(storedWidth);
  // Dragging the edge belongs to a mouse and a window that has room to spare;
  // on a phone the sheet is the whole screen and there is nothing to drag.
  const [resizable, setResizable] = useState(() => window.innerWidth > NARROW);
  // How far the finger has pushed the sheet to the right, while it is pushing.
  const [pushed, setPushed] = useState(0);
  const pushedBy = useRef(0);

  const sheet = useRef(null);
  const { schema, values, support, set, echo } = useConfig(open, lang);

  // The gear over the terminal is the only way in; everything else here closes.
  useEffect(() => {
    const onOpen = () => setOpen(true);
    const onPrompt = (e, b) => {
      if (b && b.lang) setLang(b.lang);
    };

    $(document).on('settings:open', onOpen);
    $('#rpc-events').on('rpc-prompt', onPrompt);

    return () => {
      $(document).off('settings:open', onOpen);
      $('#rpc-events').off('rpc-prompt', onPrompt);
    };
  }, []);

  useEffect(() => {
    const onResize = () => setResizable(window.innerWidth > NARROW);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // The sheet measures itself: its width is what the layout below depends on.
  useEffect(() => {
    const node = sheet.current;
    if (!node || typeof ResizeObserver !== 'function') return undefined;

    const watch = new ResizeObserver(entries => {
      for (const entry of entries) setNarrow(entry.contentRect.width < NARROW);
    });

    watch.observe(node);
    return () => watch.disconnect();
  }, []);

  // While the sheet is over the game: the page behind does not scroll, and what
  // is typed here is not dragged into the game's command line (cmdinput.jsx
  // stands aside for body.settings-open). Escape closes, as everywhere else.
  useEffect(() => {
    document.body.classList.toggle('settings-open', open);
    if (!open) return undefined;

    const onKey = e => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // Focus goes into the sheet while it is open and comes back to the game's
  // command line when it closes -- the player was typing there a moment ago.
  useEffect(() => {
    if (open) {
      const node = sheet.current;
      if (node) node.focus({ preventScroll: true });
      return;
    }

    const input = document.getElementById('inputBox');
    if (input) input.focus({ preventScroll: true });
  }, [open]);

  // Swiping the sheet away, left to right, on a narrow screen -- where the cross
  // in the corner is a long reach for a thumb. The sheet follows the finger, so
  // it is plain what the gesture is doing, and snaps back if it was not enough.
  //
  // The listeners are attached by hand rather than through React: only a
  // gesture that starts on empty space counts, and deciding that needs the
  // element the touch actually landed on.
  useEffect(() => {
    const node = sheet.current;
    if (!node || !narrow || !open) return undefined;

    const CONTROLS =
      'input, button, select, textarea, a, [role="separator"], .cfg-script-editor, .monaco-editor';
    let from = null;
    let along = null;

    const start = e => {
      if (e.touches.length !== 1) return;
      if (e.target.closest && e.target.closest(CONTROLS)) return;

      from = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      along = null;
    };

    const move = e => {
      if (!from) return;

      const dx = e.touches[0].clientX - from.x;
      const dy = e.touches[0].clientY - from.y;

      // Which way this gesture goes is decided once, by whichever axis moved
      // first: a swipe that started as a scroll stays a scroll.
      if (along === null) {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
        along = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      }

      if (along === 'x') {
        // Ours, not the browser's: a swipe to the right near the left edge is
        // otherwise taken as 'go back' and the game page is left behind.
        if (e.cancelable) e.preventDefault();

        pushedBy.current = Math.max(0, dx);
        setPushed(pushedBy.current);
      }
    };

    const end = () => {
      if (along === 'x') {
        const enough = Math.min(90, node.getBoundingClientRect().width * 0.25);
        if (pushedBy.current >= enough) setOpen(false);

        pushedBy.current = 0;
        setPushed(0);
      }

      from = null;
      along = null;
    };

    node.addEventListener('touchstart', start, { passive: true });
    node.addEventListener('touchmove', move, { passive: false });
    node.addEventListener('touchend', end);
    node.addEventListener('touchcancel', end);

    return () => {
      node.removeEventListener('touchstart', start);
      node.removeEventListener('touchmove', move);
      node.removeEventListener('touchend', end);
      node.removeEventListener('touchcancel', end);
      pushedBy.current = 0;
      setPushed(0);
    };
  }, [narrow, open]);

  // Widening by the left edge. The width is kept in a custom property rather
  // than in a style of its own, so the stylesheet can still cap it at the width
  // of the window.
  const startDrag = event => {
    event.preventDefault();
    document.body.classList.add('cfg-resizing');

    const move = e => {
      const from = e.touches ? e.touches[0].clientX : e.clientX;
      setWidth(Math.max(MIN_WIDTH, Math.round(window.innerWidth - from)));
    };

    const stop = () => {
      document.body.classList.remove('cfg-resizing');
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', stop);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', stop);

      setWidth(was => {
        try {
          localStorage.setItem(WIDTH_KEY, String(was));
        } catch (e) {
          /* storage disabled: the width lives for this session only */
        }
        return was;
      });
    };

    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', stop);
    window.addEventListener('touchmove', move);
    window.addEventListener('touchend', stop);
  };

  // The same by keyboard, for whoever reaches the handle by Tab.
  const nudge = event => {
    const step = event.shiftKey ? 64 : 16;

    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      setWidth(was => {
        const next = Math.max(
          MIN_WIDTH,
          was + (event.key === 'ArrowLeft' ? step : -step)
        );
        try {
          localStorage.setItem(WIDTH_KEY, String(next));
        } catch (e) {
          /* storage disabled */
        }
        return next;
      });
    }
  };

  // Tab walks the sheet and stays in it.
  const onKeyDown = e => {
    if (e.key !== 'Tab') return;

    const node = sheet.current;
    if (!node) return;

    const stops = [...node.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
    )].filter(one => one.offsetParent !== null);

    if (!stops.length) return;

    const first = stops[0];
    const last = stops[stops.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const needle = query.trim().toLowerCase();
  const tree = useMemo(() => buildTree(schema, support, lang), [schema, support, lang]);
  const shown = useMemo(() => filterTree(tree, needle), [tree, needle]);

  // The page in hand: the one chosen, as long as the search still has it.
  const page = findPage(shown, pageKey) || (needle ? firstPage(shown) : findPage(tree, pageKey));
  const current = page || (narrow ? null : firstPage(shown));
  const isScript = !!current && current.key === SCRIPT_PAGE;
  // Searching does not walk into a page of its own accord: on a narrow sheet
  // the box lives in the list, and jumping to a page at the first letter typed
  // takes it off the screen with the text still in it.
  const onPage = !narrow || inPage;

  // The script page can also become the page in hand without being clicked --
  // through the search, or as the only thing left in the tree -- and its editor
  // has to exist by then.
  useEffect(() => {
    if (isScript) setScriptSeen(true);
  }, [isScript]);

  const choose = key => {
    setPageKey(key);
    setInPage(true);
  };

  const change = (option, value, spelled) =>
    set(option.key, value, spell(schema, option, spelled));

  const search = (
    <div className="cfg-search-wrap">
      <input
        type="text"
        className="cfg-search"
        value={query}
        placeholder={t('cfg.search', lang)}
        onChange={e => setQuery(e.target.value)}
      />
      {query ? (
        <button
          type="button"
          className="cfg-search-clear"
          aria-label={t('cfg.clear', lang)}
          onClick={() => setQuery('')}
        >
          ✕
        </button>
      ) : null}
    </div>
  );

  const treeNodes = shown.map(section => {
    const isOpen = collapsed[section.key] !== true;
    return (
      <div className="cfg-branch" key={section.key}>
        <button
          type="button"
          className="cfg-branch-head"
          aria-expanded={isOpen}
          onClick={() =>
            setCollapsed(was => ({ ...was, [section.key]: isOpen }))
          }
        >
          <span className="cfg-caret">{isOpen ? '▾' : '▸'}</span>
          <span className="cfg-branch-name">{section.label}</span>
          <span className="cfg-branch-count">{section.pages.length}</span>
        </button>

        {isOpen ? (
          <div className="cfg-branch-body">
            {section.pages.map(one => (
              <button
                type="button"
                key={one.key}
                className={
                  current && one.key === current.key
                    ? 'cfg-leaf cfg-leaf-on'
                    : 'cfg-leaf'
                }
                onClick={() => choose(one.key)}
              >
                <span className="cfg-leaf-bar" />
                <span className="cfg-leaf-title">{one.label}</span>
                {needle && one.options.length ? (
                  <span className="cfg-leaf-count">{one.options.length}</span>
                ) : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    );
  });

  // The script page keeps its place whatever else happens -- it is hidden, never
  // taken out -- because taking it out takes the editor with it.
  const body = (
    <>
      {shown.length ? (
        <SettingsPage
          page={isScript ? null : current}
          values={values}
          lang={lang}
          query={needle}
          onChange={change}
        />
      ) : (
        <div className="cfg-page">
          <div className="cfg-note">{t('cfg.nothing', lang)}</div>
        </div>
      )}

      {scriptSeen ? (
        <div hidden={!isScript || !shown.length} className="cfg-pane-script">
          <SettingsPage page={findPage(tree, SCRIPT_PAGE)} values={values} lang={lang}>
            <ScriptPage visible={isScript && open} />
          </SettingsPage>
        </div>
      ) : null}
    </>
  );

  return (
    <>
      <div
        className={open ? 'cfg-scrim cfg-scrim-open' : 'cfg-scrim'}
        onClick={() => setOpen(false)}
      />

      <aside
        ref={sheet}
        className={
          'cfg-sheet' + (open ? ' cfg-sheet-open' : '') + (narrow ? ' cfg-narrow' : '')
        }
        role="dialog"
        aria-modal="true"
        aria-label={t('cfg.title', lang)}
        aria-hidden={!open}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        style={
          pushed
            ? {
                '--cfg-sheet-width': width + 'px',
                // Only while a finger is on it: the sheet keeps up with the
                // gesture instead of animating behind it.
                transform: 'translateX(' + pushed + 'px)',
                transition: 'none',
              }
            : { '--cfg-sheet-width': width + 'px' }
        }
      >
        {resizable ? (
          <div
            className="cfg-grip"
            role="separator"
            aria-orientation="vertical"
            aria-label={t('cfg.resize', lang)}
            title={t('cfg.resize', lang)}
            tabIndex={0}
            onMouseDown={startDrag}
            onTouchStart={startDrag}
            onKeyDown={nudge}
          />
        ) : null}

        <div className="cfg-dialog">
          <div className="cfg-head">
            {narrow && onPage ? (
              <button
                type="button"
                className="cfg-back"
                aria-label={t('cfg.back', lang)}
                onClick={() => {
                  setInPage(false);
                  setPageKey(null);
                }}
              >
                ‹
              </button>
            ) : null}

            <div className="cfg-head-text">
              <div className="cfg-head-title">
                {narrow && onPage && current ? current.label : t('cfg.title', lang)}
              </div>
            </div>

            <button
              type="button"
              className="cfg-close"
              aria-label={t('cfg.close', lang)}
              onClick={() => setOpen(false)}
            >
              ✕
            </button>
          </div>

          {narrow ? (
            <div className="cfg-body cfg-body-mobile">
              {/* Both halves stay in the document and take turns being hidden.
                  The page half carries the editor, and an editor that is taken
                  out and put back does not come back with the script in it. */}
              <div hidden={!onPage} className="cfg-mobile-page">
                {body}
              </div>

              <div hidden={onPage} className="cfg-mobile-list">
                <div className="cfg-list">
                  {search}
                  {shown.map(section => (
                    <div className="cfg-list-branch" key={section.key}>
                      <div className="cfg-list-head">
                        <span className="cfg-branch-name">{section.label}</span>
                        <span className="cfg-branch-count">{section.pages.length}</span>
                      </div>
                      <div className="cfg-list-card">
                        {section.pages.map(one => (
                          <button
                            type="button"
                            key={one.key}
                            className="cfg-list-item"
                            onClick={() => choose(one.key)}
                          >
                            <span className="cfg-list-item-text">
                              <span className="cfg-list-item-title">{one.label}</span>
                              <span className="cfg-list-item-meta">
                                {/* Names, not keys: a key is always the English
                                    one, and a Ukrainian list of English words
                                    reads as a page nobody translated. */}
                                {one.options
                                  .slice(0, 3)
                                  .map(o => o.label)
                                  .join(' · ') || 'javascript'}
                              </span>
                            </span>
                            <span className="cfg-list-item-arrow">›</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="cfg-body">
              <div className="cfg-tree">
                <div className="cfg-search-box">{search}</div>
                <div className="cfg-tree-list">{treeNodes}</div>
              </div>
              <div className="cfg-pane">{body}</div>
            </div>
          )}

          {isScript ? (
            <div className="cfg-foot">
              <div className="cfg-foot-note">{t('cfg.save.note', lang)}</div>
              <div className="cfg-foot-buttons">
                <button
                  type="button"
                  className="cfg-button"
                  onClick={() => setOpen(false)}
                >
                  {t('cfg.close', lang)}
                </button>
                <button
                  type="button"
                  className="cfg-button cfg-button-main"
                  onClick={saveScript}
                >
                  {t('cfg.save', lang)}
                </button>
              </div>
            </div>
          ) : (
            <div className="cfg-foot cfg-foot-echo">
              <span className="cfg-dot" />
              <span className="cfg-echo">{echo || t('cfg.echo.idle', lang)}</span>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
