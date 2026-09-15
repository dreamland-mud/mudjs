import React, { useEffect, useState, useRef } from 'react';
import { Mosaic, MosaicWindow } from 'react-mosaic-component';
import useMediaQuery from '@mui/material/useMediaQuery';
import Box from '@mui/material/Box';

import 'react-mosaic-component/react-mosaic-component.css';
import './mosaic-grip.css';   // visible gold/purple resize grip over the seams
import 'bootstrap';

import MainWindow from './components/mainwindow';
import Panel from './components/windowletsPanel/panel';
import Stats from './components/stats';
import Map from './components/map';
import CmdInput from './components/cmdinput';
import AccountLogin from './components/accountLogin';
import PropertiesStorage from './properties';
import { send } from './websock';

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
  <div className="rf-keypad" aria-hidden="true">
    <KeyBtn cmd="scan" label="scan"><i className="fa fa-fw fa-refresh"></i></KeyBtn>
    <KeyBtn cmd="n" longCmd="отпер север|откр север">N</KeyBtn>
    <KeyBtn cmd="u" longCmd="отпер вверх|откр вверх">U</KeyBtn>
    <KeyBtn cmd="w" longCmd="отпер запад|откр запад">W</KeyBtn>
    <KeyBtn cmd="l" label="look"><i className="fa fa-fw fa-eye"></i></KeyBtn>
    <KeyBtn cmd="e" longCmd="отпер восток|откр восток">E</KeyBtn>
    <KeyBtn cmd="where" label="where"><i className="fa fa-fw fa-map-marker"></i></KeyBtn>
    <KeyBtn cmd="s" longCmd="отпер юг|откр юг">S</KeyBtn>
    <KeyBtn cmd="d" longCmd="отпер вниз|откр вниз">D</KeyBtn>
  </div>
);

// ---- mobile app: swipe pager (terminal / widgets / map) + persistent bar ------
const PAGES = ['terminal', 'widgets', 'map'];

const MobileApp = () => {
  const pagerRef = useRef(null);
  const [page, setPage] = useState(0);
  const [keypadOpen, setKeypadOpen] = useState(false);

  const onScroll = () => {
    const el = pagerRef.current;
    if (!el || !el.clientWidth) return;
    const p = Math.round(el.scrollLeft / el.clientWidth);
    if (p !== page) setPage(p);
  };

  const goTo = i => {
    const el = pagerRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  };

  return (
    <>
      <div className="rf-pager" ref={pagerRef} onScroll={onScroll}>
        <section className="rf-page">
          <MainWindow showInput={false} />
        </section>
        <section className="rf-page rf-page-scroll">
          <Panel />
        </section>
        <section className="rf-page rf-page-scroll">
          <Map />
        </section>
      </div>

      <div className="rf-dots" aria-hidden="true">
        {PAGES.map((name, i) => (
          <button
            key={name}
            type="button"
            className={i === page ? 'rf-dot is-active' : 'rf-dot'}
            aria-label={name}
            onClick={() => goTo(i)}
          />
        ))}
      </div>

      <div className={keypadOpen ? 'rf-keypad-wrap is-open' : 'rf-keypad-wrap'} aria-hidden={!keypadOpen}>
        <div className="rf-keypad-inner">
          <MobileKeypad />
        </div>
      </div>

      <Stats />

      <div className="rf-cmdbar">
        <button
          type="button"
          className={keypadOpen ? 'rf-cmdbtn rf-keypad-toggle is-on' : 'rf-cmdbtn rf-keypad-toggle'}
          aria-label="movement keypad"
          aria-pressed={keypadOpen}
          onClick={() => setKeypadOpen(k => !k)}
        >
          <i className="fa fa-arrows"></i>
        </button>
        <CmdInput />
      </div>
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
      <AccountLogin />
    </Box>
  );
}
