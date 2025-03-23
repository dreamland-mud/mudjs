import React, { useState, useRef } from 'react';
import useMediaQuery from '@mui/material/useMediaQuery';
import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';
import CmdInput from './cmdinput';
import Terminal from './terminal';

import { send } from '../websock';

const OverlayCell = ({ ariaLabel, ariaHidden, children, ...props }) => {
  const theme = useTheme();

  const ariaProps = {};
  if (ariaLabel) ariaProps['aria-label'] = ariaLabel;
  if (ariaHidden) ariaProps['aria-hidden'] = ariaHidden;

  return (
    <td>
      <button
        {...ariaProps}
        {...props}
        className="btn btn-sm btn-ctrl btn-outline-primary"
        style={{
          pointerEvents: 'all',
          width: '2em',
        }}
      >
        {children}
      </button>
    </td>
  );
};

const longPressDelay = 800;

const KeypadCell = ({ cmd, longCmd, children, ...props }) => {
  let btnTimer = null;
  let wasLongPress = false;

  const touchstart = e => {
    wasLongPress = false;
    btnTimer = setTimeout(() => {
      wasLongPress = true;
      btnTimer = null;
      send(longCmd);
    }, longPressDelay);
  };

  const touchend = () => {
    if (btnTimer) clearTimeout(btnTimer);
  };

  const click = e => {
    if (wasLongPress) return;
    e.preventDefault();
    send(cmd);
  };

  const handlers = {
    ...(longCmd && {
      onTouchStart: touchstart,
      onTouchEnd: touchend,
      onMouseDown: touchstart,
      onMouseUp: touchend,
      onMouseLeave: touchend,
    }),
    ...(cmd && { onClick: click }),
  };

  return (
    <OverlayCell {...handlers} {...props}>
      {children}
    </OverlayCell>
  );
};

const Keypad = () => {
  const theme = useTheme();
  const big = useMediaQuery(theme.breakpoints.up('sm'));

  if (big) return null;

  return (
    <>
      <tr aria-hidden="true">
        <td></td>
        <td></td>
        <KeypadCell cmd="scan">
          <i className="fa fa-fw fa-refresh"></i>
        </KeypadCell>
        <KeypadCell cmd="n" longCmd="отпер север|откр север">
          <span>N</span>
        </KeypadCell>
        <KeypadCell cmd="u" longCmd="отпер вверх|откр вверх">
          <span>U</span>
        </KeypadCell>
      </tr>
      <tr aria-hidden="true">
        <td></td>
        <td></td>
        <KeypadCell cmd="w" longCmd="отпер запад|откр запад">
          <span>W</span>
        </KeypadCell>
        <KeypadCell cmd="l">
          <i className="fa fa-fw fa-eye"></i>
        </KeypadCell>
        <KeypadCell cmd="e" longCmd="отпер восток|откр восток">
          <span>E</span>
        </KeypadCell>
      </tr>
      <tr aria-hidden="true">
        <td></td>
        <td></td>
        <KeypadCell cmd="where">
          <i className="fa fa-fw fa-map-marker"></i>
        </KeypadCell>
        <KeypadCell cmd="s" longCmd="отпер юг|откр юг">
          <span>S</span>
        </KeypadCell>
        <KeypadCell cmd="d" longCmd="отпер вниз|откр вниз">
          <span>D</span>
        </KeypadCell>
      </tr>
    </>
  );
};

const Overlay = ({ unread, onScrollToBottom }) => {
  return (
    <Box
      sx={{
        position: 'absolute',
        height: '100%',
        width: '100%',
        pointerEvents: 'none',
        zIndex: 500,
      }}
    >
      <table
        id="nav"
        style={{
          position: 'absolute',
          right: '1em',
          top: 0,
          margin: '0.5em',
        }}
      >
        <tbody>
          <tr>
            <OverlayCell id="logs-button" ariaLabel="логи" ariaHidden="true">
              <i className="fa fa-download"></i>
            </OverlayCell>
            <OverlayCell
              id="settings-button"
              data-toggle="modal"
              data-target="#settings-modal"
              ariaLabel="настройки"
              ariaHidden="false"
            >
              <i className="fa fa-cog"></i>
            </OverlayCell>
            <OverlayCell id="map-button" ariaLabel="карта" ariaHidden="true">
              <i className="fa fa-map"></i>
            </OverlayCell>
            <OverlayCell id="font-plus-button" ariaHidden="true">
              <i className="fa fa-plus"></i>
            </OverlayCell>
            <OverlayCell id="font-minus-button" ariaHidden="true">
              <i className="fa fa-minus"></i>
            </OverlayCell>
          </tr>
          <Keypad />
        </tbody>
      </table>

      {unread > 0 && (
        <button
          onClick={onScrollToBottom}
          className="btn btn-sm btn-ctrl btn-outline-primary"
          style={{
            position: 'absolute',
            pointerEvents: 'all',
            right: '1em',
            bottom: 0,
            margin: '0.5em',
          }}
        >
          <span>{`${unread} unread message${unread > 1 ? 's' : ''}`}</span>
        </button>
      )}
    </Box>
  );
};

export default function MainWindow() {
  const terminal = useRef();
  const [unread, setUnread] = useState(0);

  return (
    <Box flex="1" display="flex" flexDirection="column">
      <Box flex="1 1 auto" position="relative">
        <Overlay
          unread={unread}
          onScrollToBottom={() => terminal.current.scrollToBottom()}
        />
        <Terminal
          ref={terminal}
          resetUnread={() => setUnread(0)}
          bumpUnread={() => setUnread(unread + 1)}
        />
      </Box>
      <CmdInput />
    </Box>
  );
}
