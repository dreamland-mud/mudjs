import $ from 'jquery';
import loader from '@monaco-editor/loader';
import { send } from './websock.js';
import notify from './notify.js';
import { runAutobuff } from './components/sysCommands/autobuff';

const echo = txt => {
  $('.terminal').trigger('output', [txt]);
};

let keydown = function (e) {};

const applySettings = s => {
  const settings = `return function(params) {
    'use strict';
    let { keydown, notify, send, echo, $, mudprompt, autobuff } = params;
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
    autobuff: runAutobuff,
  });

  keydown = exports.keydown;
};

let editor;
let host = null;

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

// The stock script, refreshed whenever the file it ships in changes -- unless
// the player has edited theirs, which is then left alone.
function loadDefaults() {
  return $.ajax({
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
  });
}

// The script is applied at start-up, from what is in storage: it binds the
// player's keys, and those have to work whether or not the settings window was
// ever opened. The editor itself is built later, if the player asks for it.
$(document).ready(function () {
  loadDefaults().always(function () {
    try {
      applySettings(localStorage.settings || '');
    } catch (e) {
      console.log(e);
      echo(e);
    }
  });
});

/** Build the editor inside the given element, and keep it there.
 *
 *  React can rebuild the page the editor lives on, and then the old editor sits
 *  on a node nobody can see. Moving its markup into the new box is not enough --
 *  Monaco comes back blank -- so it is built again, with whatever the player had
 *  typed by then. */
export function mountScriptEditor(node) {
  if (!node) return;

  // Remembered for the build below: the loader takes a moment, and the element
  // can be replaced again while it is on its way.
  host = node;

  if (!editor) {
    buildEditor(localStorage.settings || '');
    return;
  }

  const dom = editor.getDomNode();
  if (dom && dom.parentElement !== node) {
    const text = editor.getValue();
    editor.dispose();
    editor = undefined;
    buildEditor(text);
  }
}

function buildEditor(value) {
  loader.init().then(monaco => {
    if (editor || !host) return;

    editor = monaco.editor.create(host, {
      value: value,
      language: 'javascript',
      theme: 'vs-dark',
      fontSize: 13,
      wordWrap: 'on',
      lineNumbers: 'off',
      scrollBeyondLastLine: false,
      automaticLayout: true,
      padding: { top: 20, bottom: 20 },
      minimap: { enabled: false },
      tabSize: 4,
      insertSpaces: false,
      detectIndentation: true,
      formatOnType: true,
    });
  });
}

/** Measure again: the editor is kept alive while hidden, and Monaco cannot see
 *  the size of a box that was not on screen when it last looked. */
export function relayoutScriptEditor() {
  if (editor) editor.layout();
}

/** Apply what is in the editor and remember it. */
export function saveScript() {
  if (!editor) return;

  $('.trigger').off();
  const value = editor.getValue();
  applySettings(value);
  localStorage.settings = value;
}

export function getKeydown() {
  return keydown;
}
