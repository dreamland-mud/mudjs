import React, { useState, useRef, useEffect } from 'react';
import { useSelector } from 'react-redux';
import $ from 'jquery';
import { echo } from '../input';
import { send, connect } from '../websock';
import { getKeydown } from '../settings';

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

  const [value, setValue] = useState('');
  const textInput = useRef(null);

  useEffect(() => {
    const handleKey = e => {
      if (e.which === 9) return;

      const input = $('#input input');
      if ($('body.modal-open').length !== 0) return;

      if (!sendHotKeyCmd(e)) {
        if (e.ctrlKey || e.altKey) return;
        if (input.is(':focus') || $('#help input').is(':focus')) return;

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
      <button onClick={connect} type="button" className="btn btn-primary">
        Reconnect
      </button>
    );
  }

  return (
    <div
      sx={{
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'wrap',
        maxWidth: '1920px',
        margin: '0 auto',
        width: '100%',
      }}
    >
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
        <table
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
          }}
        >
          <tbody>
            <tr>
              <td>
                <button
                  onClick={historyRepeat}
                  aria-label="Повторить команду"
                  cmd="repeat"
                  className="btn btn-sm btn-ctrl btn-outline-primary"
                  style={{
                    height: '1.7em',
                    width: '1.7em',
                    pointerEvents: 'all',
                  }}
                >
                  <i className="fa fa-repeat"></i>
                </button>
              </td>
              <td>
                <button
                  onClick={historyDown}
                  aria-label="Следующая команда"
                  cmd="history-down"
                  className="btn btn-sm btn-ctrl btn-outline-primary"
                  style={{
                    height: '1.7em',
                    width: '1.7em',
                    pointerEvents: 'all',
                  }}
                >
                  <i className="fa fa-arrow-down"></i>
                </button>
              </td>
              <td>
                <button
                  onClick={historyUp}
                  aria-label="Предыдущая команда"
                  cmd="history-up"
                  className="btn btn-sm btn-ctrl btn-outline-primary"
                  style={{
                    height: '1.7em',
                    width: '1.7em',
                    pointerEvents: 'all',
                  }}
                >
                  <i className="fa fa-arrow-up"></i>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
};

export default CmdInput;
