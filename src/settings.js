import $ from 'jquery';
import 'brace';
import 'brace/mode/javascript';
import 'brace/theme/monokai';

import { send } from './websock.js';
import notify from './notify.js';

const echo = txt => {
  $('.terminal').trigger('output', [txt]);
};

let keydown = function (e) {};

const applySettings = s => {
  const settings = `return function(params) {
    'use strict';
    let { keydown, notify, send, echo, $, mudprompt } = params;
    (function() { ${s} })();
    return { keydown };
  }`;

  const exports = Function(settings)()({
    keydown,
    notify,
    send,
    echo,
    $,
    mudprompt: window.mudprompt,
  });

  keydown = exports.keydown;
};

$(document).ready(function () {
  function hashCode(s) {
    let hash = 0;
    if (!s) return hash;

    for (let i = 0; i < s.length; i++) {
      const chr = s.charCodeAt(i);
      hash = (hash << 5) - hash + chr;
      hash |= 0;
    }

    return hash;
  }

  $.ajax({
    url: 'defaults.js',
    datatype: 'text',
    beforeSend: function (xhr) {
      xhr.overrideMimeType('text/plain');
    },
  }).then(function (contents) {
    const contentsHash = '' + hashCode(contents);
    const settingsHash = '' + hashCode(localStorage.settings);

    if (contentsHash !== localStorage.defaultsHash) {
      if (
        localStorage.defaultsHash &&
        settingsHash !== localStorage.defaultsHash
      ) {
        console.log(settingsHash + ': ' + localStorage.defaultsHash);
      } else {
        localStorage.settings = contents;
      }
      localStorage.defaultsHash = contentsHash;
    }

    editor.setValue(localStorage.settings);

    try {
      applySettings(editor.getValue());
    } catch (e) {
      console.log(e);
      echo(e);
    }
  });

  const editor = globalThis.ace.edit($('#settings-modal .editor')[0]);
  editor.$blockScrolling = Infinity;
  editor.setTheme('ace/theme/monokai');
  editor.session.setMode('ace/mode/javascript');

  $('#settings-save-button').click(function (e) {
    e.preventDefault();

    $('.trigger').off();
    const val = editor.getValue();
    applySettings(val);
    localStorage.settings = val;
  });
});

export function getKeydown() {
  return keydown;
}
