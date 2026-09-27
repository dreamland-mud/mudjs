import React, { useEffect, useRef, useState } from 'react';
import $ from 'jquery';
import { useSelector } from 'react-redux';
import Box from '@mui/material/Box';
import CmdInput from './cmdinput';
import Terminal from './terminal';

import { t, fmt } from '../i18n';

const OverlayCell = ({ ariaLabel, ariaHidden, children, ...props }) => {
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
          width: 'var(--rf-nav-size, 30px)',
          height: 'var(--rf-nav-size, 30px)',
          padding: 0,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {children}
      </button>
    </td>
  );
};

const Overlay = ({ unread, chatUnread, onScrollToBottom, lang }) => {
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
          right: '10px',
          top: '10px',
          margin: 0,
        }}
      >
        <tbody>
          <tr>
            {/* Unread jump-to-bottom lives in the nav panel, left of the gear, wearing
                the same control-button skin. Shows the count (no icon); the full
                "N unread" text stays on aria-label for screen readers. */}
            {unread > 0 && (
              <OverlayCell
                id="unread-button"
                onClick={onScrollToBottom}
                ariaLabel={fmt('ov.unread', unread, lang)}
                ariaHidden="false"
              >
                <span className="rf-unread-count">{unread > 99 ? '99+' : unread}</span>
              </OverlayCell>
            )}
            {/* Conversations. The panel itself lives in app.jsx and listens for
                this event; the count it publishes rides on the same channel, so
                the button knows nothing about chat frames. */}
            <OverlayCell
              id="chat-button"
              onClick={() => $(document).trigger('chat:open')}
              ariaLabel={t('ov.chat', lang)}
              ariaHidden="false"
            >
              {/* The icon stays put and the count rides on it: a button that
                  swaps its face for a number is a different button every time
                  someone speaks, and the eye has to find it again. */}
              <span className="chat-cell">
                <i className="fa fa-comments"></i>
                {chatUnread > 0 ? (
                  <span className="chat-badge">
                    {chatUnread > 99 ? '99+' : chatUnread}
                  </span>
                ) : null}
              </span>
            </OverlayCell>
            {/* Download log moved into the settings side-sheet footer (id kept,
                so main.js's delegated #logs-button handler still fires). */}
            <OverlayCell
              id="settings-button"
              onClick={() => $(document).trigger('settings:open')}
              ariaLabel={t('ov.settings', lang)}
              ariaHidden="false"
            >
              <i className="fa fa-cog"></i>
            </OverlayCell>
            <OverlayCell id="font-plus-button" ariaHidden="true">
              <i className="fa fa-plus"></i>
            </OverlayCell>
            <OverlayCell id="font-minus-button" ariaHidden="true">
              <i className="fa fa-minus"></i>
            </OverlayCell>
          </tr>
          {/* Movement keypad moved to the mobile command-bar toggle (MobileKeypad in app.jsx). */}
        </tbody>
      </table>
    </Box>
  );
};

export default function MainWindow({ showInput = true }) {
  const terminal = useRef();
  const [unread, setUnread] = useState(0);
  // Published by the chat panel: it knows when a line went unseen, the button
  // only has to draw the number.
  const [chatUnread, setChatUnread] = useState(0);

  useEffect(() => {
    const onCount = (e, n) => setChatUnread(n || 0);
    $(document).on('chat:unread', onCount);
    return () => $(document).off('chat:unread', onCount);
  }, []);
  const lang = useSelector(state => state.prompt && state.prompt.lang);

  return (
    <Box flex="1" display="flex" flexDirection="column">
      <Box flex="1 1 auto" position="relative">
        <Overlay
          unread={unread}
          chatUnread={chatUnread}
          onScrollToBottom={() => terminal.current.scrollToBottom()}
          lang={lang}
        />
        <Terminal
          ref={terminal}
          resetUnread={() => setUnread(0)}
          bumpUnread={() => setUnread(unread + 1)}
        />
      </Box>
      {showInput && <CmdInput />}
    </Box>
  );
}
