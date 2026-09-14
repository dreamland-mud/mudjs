import React, { useState, useRef, useEffect } from 'react';
import { useSelector } from 'react-redux';
import $ from 'jquery';
import { echo } from '../input';
import { send, connect } from '../websock';
import { getKeydown } from '../settings';
import { t } from '../i18n';

import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

import Commands, {
  splitCommand,
  echoHtml,
  errCmdDoesNotExist,
  getSystemCmd,
} from './SysCommands';
import { sendHotKeyCmd } from './sysCommands/hotkey';

const input_history = localStorage.history
  ? JSON.parse(localStorage.history)
  : [];
let position = input_history.length;
let current_cmd = '';

$('body').on('click', '.builtin-cmd', function (e) {
  const cmd = $(e.currentTarget);
  const { sysCmd, sysCmdArgs } = splitCommand(cmd.attr('data-action'));
  const command = getSystemCmd(sysCmd);
  echo(cmd.attr('data-echo'));
  if (!command) return errCmdDoesNotExist;
  Commands[command]['payload'](sysCmdArgs);
});

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

      const input = $('#input input');
      // A window over the game -- an editor modal, or the settings sheet --
      // keeps what is typed in it.
      if ($('body.modal-open, body.settings-open').length !== 0) return;

      if (!sendHotKeyCmd(e)) {
        if (e.ctrlKey || e.altKey) return;
        if (
          input.is(':focus') ||
          $('#help input').is(':focus') ||
          $('.dl-mapper-root .search-input').is(':focus')
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

  const saveCmd = t => {
    if (t) {
      position = input_history.length;
      if (
        input_history.length === 0 ||
        t !== input_history[input_history.length - 1]
      ) {
        input_history[position++] = t;
        const drop = Math.max(0, input_history.length - 1000);
        const save = JSON.stringify(input_history.slice(drop));
        try {
          localStorage.history = save;
        } catch (e) {
          console.warn('Could not save history to localStorage', e);
        }
      }
    }
  };

  const historyUp = () => {
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
    setValue('');
    position = input_history.length;
    saveCmd(cmd);
    echo(cmd);
    send(cmd);
  };

  const keydown = e => {
    e.stopPropagation();
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

    if (!sendHotKeyCmd(e)) {
      getKeydown()(e);
    }
  };

  const submit = e => {
    e.preventDefault();
    const userCommand = value;
    setValue('');
    saveCmd(userCommand);

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
      return echoHtml(errCmdDoesNotExist);
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
          onKeyDown={keydown}
          value={value}
          onChange={e => setValue(e.target.value)}
          type="text"
          autoComplete="off"
        />
      </form>
      {!big && (
        <div className="rf-cmdactions">
          <button type="button" onClick={historyUp} aria-label={t('in.prev', lang)} className="rf-cmdbtn">
            <i className="fa fa-arrow-up"></i>
          </button>
          <button type="button" onClick={historyRepeat} aria-label={t('in.repeat', lang)} className="rf-cmdbtn">
            <i className="fa fa-repeat"></i>
          </button>
          <button type="submit" form="input" aria-label="Send" className="rf-cmdbtn rf-send">
            <i className="fa fa-paper-plane"></i>
          </button>
        </div>
      )}
    </>
  );
};

export default CmdInput;
