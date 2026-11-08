import React, { useState, useRef, useEffect } from 'react';
import { useSelector } from 'react-redux';
import $ from 'jquery';
import { echo } from '../input';
import { send, connect } from '../websock';
import { getKeydown } from '../settings';
import { t } from '../i18n';
import FocusOrbit from './FocusOrbit';

import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

import Commands, {
  splitCommand,
  echoHtml,
  errCmdDoesNotExist,
  getSystemCmd,
} from './SysCommands';
import { sendHotKeyCmd } from './sysCommands/hotkey';
import { enterReview, reviewEnabled } from '../review';

const input_history = localStorage.history
  ? JSON.parse(localStorage.history)
  : [];
let position = input_history.length;
let draftAt = -1; // where Down put away the unsent line, while it is still unsent
let tabLeavesInput = false; // Escape was the last key: Tab moves on instead of reading the output
let current_cmd = '';

$('body').on('click', '.builtin-cmd', function (e) {
  const cmd = $(e.currentTarget);
  const { sysCmd, sysCmdArgs } = splitCommand(cmd.attr('data-action'));
  const command = getSystemCmd(sysCmd);
  echo(cmd.attr('data-echo'));
  if (!command) return echoHtml(errCmdDoesNotExist());
  Commands[command]['payload'](sysCmdArgs);
});

/* Extra keys of the command line, used by the next PRs (the output tools in
 * src/port): fn(e, atHistoryEnd)
 * returns true when it took the key. */
const keyHooks = [];
export function addInputKeyHook(fn) {
  keyHooks.push(fn);
}

const scrollPage = dir => {
  const wrap = $('.terminal-wrap');
  wrap.scrollTop(wrap.scrollTop() + wrap.height() * dir);
};

const CmdInput = () => {
  const theme = useTheme();
  const big = useMediaQuery(theme.breakpoints.up('sm'));
  const connection = useSelector(state => state.connection);
  // prompt is merged in the store, so lang stays stable -> re-renders only on a real switch.
  const lang = useSelector(state => state.prompt && state.prompt.lang);

  const [value, setValue] = useState('');
  const textInput = useRef(null);

  useEffect(() => {
    const handleKey = e => {
      if (e.which === 9) return;
      // The output review box (review.js) handles its own keys.
      if (e.target && e.target.id === 'outputReview') return;

      const input = $('#input input');
      // A window over the game -- an editor modal, or the settings sheet --
      // keeps what is typed in it.
      if ($('body.modal-open, body.settings-open, body.port-sheet-open').length !== 0) return;

      if (!sendHotKeyCmd(e)) {
        if (e.ctrlKey || e.altKey) return;
        if (
          input.is(':focus') ||
          $('#help input').is(':focus') ||
          $('.dl-mapper-root .search-input').is(':focus') ||
          $('.acc-overlay :focus').length !== 0 ||
          // Typing in the conversation panel stays there: it has its own input
          // and its own Enter, and a keystroke dragged into the game's command
          // line takes the focus with it mid-word.
          $('.chat-sheet :focus').length !== 0
        )
          return;

        if (document.getElementById('inputBox')) {
          textInput.current.focus();
          document
            .getElementById('inputBox')
            .dispatchEvent(new KeyboardEvent('keydown', e));
        }
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const persistHistory = () => {
    const drop = Math.max(0, input_history.length - 1000);
    const save = JSON.stringify(input_history.slice(drop));
    try {
      localStorage.history = save;
    } catch (e) {
      console.warn('Could not save history to localStorage', e);
    }
  };

  const saveCmd = t => {
    if (t) {
      position = input_history.length;
      if (
        input_history.length === 0 ||
        t !== input_history[input_history.length - 1]
      ) {
        input_history[position++] = t;
        persistHistory();
      }
    }
  };

  // Up or Down on a line taken from the history that the player has changed:
  // the change is kept, so moving away and back finds it, as in the desktop
  // client. The unsent line Down put away is updated in place; a changed past
  // command stays as it was sent, and the changed copy becomes the unsent line.
  const keepEdit = () => {
    if (position >= input_history.length) return;
    if (!value.trim() || value === input_history[position]) return;
    if (position === draftAt) {
      input_history[position] = value;
      persistHistory();
      return;
    }
    const i = input_history.lastIndexOf(value);
    if (i >= 0) {
      input_history.splice(i, 1);
      if (i < position) position--;
    }
    input_history.push(value);
    draftAt = input_history.length - 1;
    persistHistory();
  };

  const historyUp = () => {
    keepEdit();
    if (position > 0) {
      if (position === input_history.length) current_cmd = value;
      for (let i = position - 1; i >= 0; i--) {
        if (input_history[i].includes(current_cmd)) {
          position = i;
          setValue(input_history[i]);
          return;
        }
      }
    }
  };

  const historyDown = () => {
    // Down below the newest command with something typed: the unfinished line
    // is kept in the history, where Up finds it again, and the line is cleared
    // for something else, as in the desktop client.
    if (position >= input_history.length && value.trim()) {
      const i = input_history.lastIndexOf(value);
      const wasDraft = i >= 0 && i === draftAt;
      if (i >= 0) {
        input_history.splice(i, 1);
        if (i < draftAt) draftAt--;
      }
      current_cmd = '';
      saveCmd(value);
      // A line already sent once stays a sent command; only new text (or the
      // unsent line itself) is the unsent line.
      if (i < 0 || wasDraft) draftAt = input_history.length - 1;
      setValue('');
      return;
    }
    keepEdit();
    if (position < input_history.length) {
      for (let i = position + 1; i < input_history.length; i++) {
        if (input_history[i].includes(current_cmd)) {
          position = i;
          setValue(input_history[i]);
          return;
        }
      }
      position = input_history.length;
      setValue(current_cmd);
    }
  };

  const historyRepeat = () => {
    const cmd = input_history[position] || input_history[position - 1];
    if (!cmd) return;
    if (input_history[draftAt] === cmd) draftAt = -1;
    setValue('');
    position = input_history.length;
    saveCmd(cmd);
    echo(cmd);
    send(cmd);
  };

  const keydown = e => {
    e.stopPropagation();
    const passTab = tabLeavesInput;
    // Only keys really pressed here change it: the window handler re-sends keys
    // pressed elsewhere on the page into the command line, and a lone modifier
    // (the Shift of Shift+Tab) is not a key of its own.
    if (e.isTrusted && !['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) tabLeavesInput = e.key === 'Escape';
    if (keyHooks.some(fn => fn(e, position >= input_history.length))) return;
    const isPgKeysScroll = localStorage.properties
      ? JSON.parse(localStorage.properties)['isPgKeysScroll']
      : true;

    if (!e.shiftKey && !e.ctrlKey && !e.altKey) {
      switch (e.which) {
        case 33:
          if (isPgKeysScroll) {
            e.preventDefault();
            scrollPage(-0.8);
            return;
          }
          break;
        case 34:
          if (isPgKeysScroll) {
            e.preventDefault();
            scrollPage(0.8);
            return;
          }
          break;
        case 38:
          e.preventDefault();
          historyUp();
          return;
        case 40:
          e.preventDefault();
          historyDown();
          return;
        default:
          break;
      }
    }

    if (sendHotKeyCmd(e)) return;

    // Tab or Shift+Tab reads the output (review.js). A player's own hotkey or
    // keydown script on them wins. Escape first lets the next Tab or Shift+Tab
    // move on to the page's other controls, so the keyboard is never trapped
    // between the command line and the output.
    const isTab = e.key === 'Tab' && !e.ctrlKey && !e.altKey;

    getKeydown()(e);

    if (isTab && !passTab && !e.defaultPrevented && reviewEnabled() && enterReview()) e.preventDefault();
  };

  const submit = e => {
    e.preventDefault();
    const userCommand = value;
    // Sending the unsent line: it leaves the history as it was put away, and
    // what is sent goes in as a command like any other.
    if (position === draftAt) {
      input_history.splice(draftAt, 1);
      draftAt = -1;
      persistHistory();
    }
    setValue('');
    saveCmd(userCommand);
    // The same text sent from another line: the unsent line has now been sent.
    if (input_history[draftAt] === userCommand) draftAt = -1;

    if (userCommand.startsWith('#')) {
      echo(userCommand);
      const { sysCmd, sysCmdArgs } = splitCommand(userCommand);
      if (Number.isInteger(+sysCmd)) {
        Commands['multiCmd']['payload'](userCommand);
        return;
      }
      const command = getSystemCmd(sysCmd);
      if (command) {
        Commands[command]['payload'](sysCmdArgs);
        return;
      }
      return echoHtml(errCmdDoesNotExist());
    }

    const lines = userCommand.split('\n');
    $(lines).each(function () {
      echo(this);
      $('.trigger').trigger('input', [this]);
    });
  };

  if (!connection.connected) {
    return (
      <button onClick={connect} type="button" className="btn btn-primary rf-reconnect">
        {t('in.reconnect', lang)}
      </button>
    );
  }

  // On mobile the input lives in the persistent command bar (app.jsx MobileApp),
  // with inline history + send buttons; the send button submits form#input via the
  // `form` attribute even though it sits outside the <form>. On desktop it's just
  // the input (Enter submits), placed below the terminal by MainWindow.
  return (
    <>
      <form onSubmit={submit} id="input">
        <input
          ref={textInput}
          id="inputBox"
          aria-label={t('in.label', lang)}
          onKeyDown={keydown}
          onBlur={() => {
            // Escape-then-Tab only counts while the focus stays here.
            tabLeavesInput = false;
          }}
          value={value}
          onChange={e => setValue(e.target.value)}
          type="text"
          autoComplete="off"
        />
        <FocusOrbit />
      </form>
      {!big && (
        <div className="rf-cmdactions">
          <button type="button" onClick={historyUp} aria-label={t('in.prev', lang)} className="rf-cmdbtn">
            <i className="fa fa-arrow-up"></i>
          </button>
          <button type="button" onClick={historyRepeat} aria-label={t('in.repeat', lang)} className="rf-cmdbtn">
            <i className="fa fa-repeat"></i>
          </button>
          <button type="submit" form="input" aria-label={t('in.send', lang)} className="rf-cmdbtn rf-send">
            <i className="fa fa-paper-plane"></i>
          </button>
        </div>
      )}
    </>
  );
};

export default CmdInput;
