import React, { useEffect, useState, useRef } from 'react';
import { useSelector } from 'react-redux';
import { Mosaic, MosaicWindow } from 'react-mosaic-component';
import useMediaQuery from '@mui/material/useMediaQuery';
import Box from '@mui/material/Box';

import 'react-mosaic-component/react-mosaic-component.css';
import './mosaic-grip.css';   // visible gold/purple resize grip over the seams
import 'bootstrap';

import MainWindow from './components/mainwindow';
import Panel from './components/windowletsPanel/panel';
import ChatPanel from './components/chat/ChatPanel';
import Stats from './components/stats';
import Map from './components/map';
import CmdInput from './components/cmdinput';
import AccountLogin from './components/accountLogin';
import PropertiesStorage from './properties';
import { send } from './websock';
import { t } from './i18n';
import './a11yStrings';
import $ from 'jquery';
import { screenReaderMode, SR_CHANGED } from './review';

const propertiesStorage = PropertiesStorage;

const ELEMENT_MAP = {
  terminal: <MainWindow />,
  panel: <Panel />,
  map: <Map />,
};

const getResponsiveLayout = (bigScreen, hugeScreen) => {
  if (!bigScreen) return 'terminal';

  if (!hugeScreen) {
    return {
      direction: 'row',
      first: 'terminal',
      second: 'panel',
      splitPercentage: 70,
    };
  }

  return {
    direction: 'row',
    first: 'terminal',
    second: {
      direction: 'row',
      first: 'panel',
      second: 'map',
      splitPercentage:
        (propertiesStorage['panelLayoutWidth'] /
          (propertiesStorage['panelLayoutWidth'] +
            propertiesStorage['mapLayoutWidth'])) *
        100,
    },
    splitPercentage:
      (propertiesStorage['terminalLayoutWidth'] /
        (propertiesStorage['terminalLayoutWidth'] +
          propertiesStorage['panelLayoutWidth'] +
          propertiesStorage['mapLayoutWidth'])) *
      100,
  };
};

// Persist the terminal/panel/map split when a resize-drag ends. We read the percentages
// straight off the mosaic layout tree (no DOM querying), so this never touches a missing
// #map-wrap the way the old splitter handler did. Only the full three-pane (huge-screen)
// tree carries all three widths; smaller layouts use a fixed split and aren't persisted.
const persistLayout = value => {
  if (!value || typeof value !== 'object') return;
  const inner = value.second;
  if (!inner || typeof inner !== 'object' || inner.second !== 'map') return;
  const outerPct = value.splitPercentage;
  const innerPct = inner.splitPercentage;
  if (typeof outerPct !== 'number' || typeof innerPct !== 'number') return;

  const terminal = outerPct;
  const rest = 100 - outerPct;
  const panel = rest * (innerPct / 100);
  const map = rest - panel;

  propertiesStorage['terminalLayoutWidth'] = terminal;
  propertiesStorage['panelLayoutWidth'] = panel;
  propertiesStorage['mapLayoutWidth'] = map;
  localStorage.properties = JSON.stringify(propertiesStorage);
};

// ---- mobile movement keypad (a toggle-pad above the command bar) --------------
// Mirrors the old overlay Keypad (scan/n/u, w/look/e, where/s/d) including the
// long-press "open/unlock door" on the directional keys.
const MOVE_LONGPRESS = 700;

const KeyBtn = ({ cmd, longCmd, label, children }) => {
  const timer = useRef(null);
  const wasLong = useRef(false);

  const start = () => {
    wasLong.current = false;
    if (longCmd)
      timer.current = setTimeout(() => {
        wasLong.current = true;
        timer.current = null;
        send(longCmd);
      }, MOVE_LONGPRESS);
  };
  const end = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };
  const click = e => {
    if (wasLong.current) return;
    e.preventDefault();
    if (cmd) send(cmd);
  };

  return (
    <button
      type="button"
      className="rf-mk-btn"
      aria-label={label || cmd}
      aria-description={longCmd ? t('a11y.mk.hold') : undefined}
      onClick={click}
      onTouchStart={start}
      onTouchEnd={end}
      onMouseDown={start}
      onMouseUp={end}
      onMouseLeave={end}
    >
      {children}
    </button>
  );
};

const MobileKeypad = () => (
  <div className="rf-keypad" role="group" aria-label={t('in.keypad')}>
    <KeyBtn cmd="scan" label={t('a11y.mk.scan')}><i className="fa fa-fw fa-refresh" aria-hidden="true"></i></KeyBtn>
    <KeyBtn cmd="n" label={t('a11y.mk.n')} longCmd="отпер север|откр север">N</KeyBtn>
    <KeyBtn cmd="u" label={t('a11y.mk.u')} longCmd="отпер вверх|откр вверх">U</KeyBtn>
    <KeyBtn cmd="w" label={t('a11y.mk.w')} longCmd="отпер запад|откр запад">W</KeyBtn>
    <KeyBtn cmd="l" label={t('a11y.mk.look')}><i className="fa fa-fw fa-eye" aria-hidden="true"></i></KeyBtn>
    <KeyBtn cmd="e" label={t('a11y.mk.e')} longCmd="отпер восток|откр восток">E</KeyBtn>
    <KeyBtn cmd="where" label={t('a11y.mk.where')}><i className="fa fa-fw fa-map-marker" aria-hidden="true"></i></KeyBtn>
    <KeyBtn cmd="s" label={t('a11y.mk.s')} longCmd="отпер юг|откр юг">S</KeyBtn>
    <KeyBtn cmd="d" label={t('a11y.mk.d')} longCmd="отпер вниз|откр вниз">D</KeyBtn>
  </div>
);

// ---- mobile app: swipe pager (terminal / widgets / map) + persistent bar ------
const PAGES = ['terminal', 'widgets', 'map'];

const MobileApp = () => {
  const pagerRef = useRef(null);
  const [page, setPage] = useState(0);
  const [keypadOpen, setKeypadOpen] = useState(false);
  const lang = useSelector(state => state.prompt && state.prompt.lang);
  const [srMode, setSrMode] = useState(screenReaderMode());
  // The rooms key opens the map's room list: on a phone, its page.
  useEffect(() => {
    const toMap = () => goTo(2);
    const toPanels = () => goTo(1); // the help key: the help box is on the panels page
    $(document).on('map:roomlist', toMap);
    $(document).on('panel:help', toPanels);
    return () => {
      $(document).off('map:roomlist', toMap);
      $(document).off('panel:help', toPanels);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const update = () => setSrMode(screenReaderMode());
    $(document).on(SR_CHANGED, update);
    return () => $(document).off(SR_CHANGED, update);
  }, []);

  const onScroll = () => {
    const el = pagerRef.current;
    if (!el || !el.clientWidth) return;
    const p = Math.round(el.scrollLeft / el.clientWidth);
    if (p !== page) setPage(p);
  };

  const offPage = i => (i === page ? {} : { inert: '', 'aria-hidden': 'true' });

  const pageButtons = (
    <div className="rf-dots" role="group" aria-label={t('a11y.pages')}>
          {PAGES.map((name, i) => (
            <button
              key={name}
              type="button"
              className={i === page ? 'rf-dot is-active' : 'rf-dot'}
              aria-label={t('a11y.page.' + name)}
              aria-current={i === page ? 'page' : undefined}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
  );

  const goTo = i => {
    const el = pagerRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  };

  return (
    <>
      {/* Only the page on screen is there for a screen reader: VoiceOver
          swiping back from the command line went on into the map page, scrolled
          to it and so switched to it. The page buttons below switch pages. */}
      <div className="rf-pager" ref={pagerRef} onScroll={onScroll}>
        <section className="rf-page" {...offPage(0)}>
          <MainWindow showInput={false} />
        </section>
        <section className="rf-page rf-page-scroll" {...offPage(1)}>
          <Panel />
        </section>
        <section className="rf-page rf-page-scroll" {...offPage(2)}>
          <Map />
        </section>
      </div>

      {srMode ? null : pageButtons}

      <div
        className={keypadOpen ? 'rf-keypad-wrap is-open' : 'rf-keypad-wrap'}
        {...(keypadOpen ? {} : { inert: '', 'aria-hidden': 'true' })}
      >
        <div className="rf-keypad-inner">
          <MobileKeypad />
        </div>
      </div>

      {/* In screen reader mode the bars sit under the command line, on screen
          too: VoiceOver on an iPhone goes by where things are, and a player
          swiping back from the command line reaches the output straight away. */}
      {srMode ? null : <Stats />}
      <div className="rf-cmdbar">
        <button
          type="button"
          className={keypadOpen ? 'rf-cmdbtn rf-keypad-toggle is-on' : 'rf-cmdbtn rf-keypad-toggle'}
          aria-label={t('in.keypad', lang)}
          aria-pressed={keypadOpen}
          onClick={() => setKeypadOpen(k => !k)}
        >
          <i className="fa fa-arrows"></i>
        </button>
        <CmdInput />
      </div>
      {srMode ? <Stats /> : null}
      {/* In screen reader mode the page buttons come last, after the bars. */}
      {srMode ? pageButtons : null}
    </>
  );
};

export default function App() {
  const bigScreen = useMediaQuery('(min-width:600px)');
  const hugeScreen = useMediaQuery('(min-width:1280px)');

  const [layout, setLayout] = useState(() =>
    getResponsiveLayout(bigScreen, hugeScreen)
  );

  useEffect(() => {
    setLayout(getResponsiveLayout(bigScreen, hugeScreen));
  }, [bigScreen, hugeScreen]);

  return (
    <Box
      display="flex"
      flexDirection="column"
      sx={{
        // Percent, not 100vh/100vw. On mobile Chromium `100vh` is frozen to the
        // large viewport (browser chrome retracted), while the #root percentage
        // chain tracks the currently visible one -- so a 100vh box overflows
        // #root by the height of the visible URL bar, and #root's overflow:hidden
        // clips that slice away with no way to scroll to it. The clipped slice is
        // the bottom of the layout: the command input and the Stats bars.
        // Percent fits #root exactly, whatever the browser does with its chrome.
        height: '100%',
        width: '100%',
        overflow: 'hidden',
      }}
    >
      {bigScreen ? (
        <>
          <Box
            sx={{
              flex: 1,
              overflow: 'hidden',
              position: 'relative',
              minHeight: 0,
            }}
          >
            <Mosaic
              value={layout}
              onChange={setLayout}
              onRelease={persistLayout}
              renderTile={(id, path) => (
                <MosaicWindow
                  path={path}
                  title=""
                  toolbarControls={[]}
                  additionalControls={[]}
                  renderToolbar={() => null}
                >
                  {ELEMENT_MAP[id]}
                </MosaicWindow>
              )}
              className="mosaic-theme-default"
            />
          </Box>
          <Stats />
        </>
      ) : (
        <MobileApp />
      )}
      <ChatPanel />
      <AccountLogin />
    </Box>
  );
}
