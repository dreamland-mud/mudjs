import $ from 'jquery';
import loader from '@monaco-editor/loader';
import { send, rpccmd } from './websock.js';
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

// Settled once the stock script has been looked at: the account sync below
// waits for it, since "is this script customized" is only known after that.
let defaultsLoaded = null;

// The script is applied at start-up, from what is in storage: it binds the
// player's keys, and those have to work whether or not the settings window was
// ever opened. The editor itself is built later, if the player asks for it.
$(document).ready(function () {
  defaultsLoaded = loadDefaults().always(function () {
    try {
      applySettings(localStorage.settings || '');
    } catch (e) {
      console.log(e);
      echo(e);
    }
  });
});

/*
 * Account backup of the script.
 *
 * The server keeps one copy per ACCOUNT (script_get / script_put, see
 * dreamland_code plug-ins/comm/webscript.cpp). A character without an account
 * gets none, and the Save area says so.
 *
 * The text goes over as base64 of its UTF-8 bytes: every string in a frame is
 * squeezed through KOI8 on the server, which would quietly eat anything KOI8
 * has no letter for.
 *
 * localStorage keys next to `settings`:
 *   scriptStamp  -- server stamp of the copy this browser last saved or took
 *   scriptDirty  -- '1' while a local change has not reached the account
 *   settingsPrev -- the local text replaced by a newer account copy, kept once
 */
const SCRIPT_MAX_BYTES = 65536;
const SCRIPT_RETRY_MS = 3500;

let syncState = { state: 'unknown', reason: '' };
const syncWatchers = new Set();
let syncAsked = false;
// The server has answered script_get on this connection. Until then a Save
// only marks the script dirty: the answer uploads it, and a server too old to
// answer is never told anything.
let syncKnown = false;
let retryTimer = null;
// The text of the put waiting for its answer, to tell whether it is still the
// current text when the answer comes.
let inFlight = null;

function setSync(state, reason) {
  syncState = { state, reason: reason || '' };
  syncWatchers.forEach(fn => fn(syncState));
}

export function getScriptSync() {
  return syncState;
}

export function watchScriptSync(fn) {
  syncWatchers.add(fn);
  return () => syncWatchers.delete(fn);
}

function utf8ToB64(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000)
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return { b64: btoa(bin), size: bytes.length };
}

function b64ToUtf8(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function isStock(text) {
  return '' + hashCode(text) === localStorage.defaultsHash;
}

function storedStamp() {
  return Number(localStorage.scriptStamp) || 0;
}

/** Send the current local script to the account. Stock text goes as an empty
 *  copy, which clears the server side instead of storing the defaults. */
function uploadScript() {
  // One put at a time. Its answer compares what it carried with the current
  // text and sends again if they differ; a second put now would only be
  // refused by the server's rate limit, and its answers could then be read
  // against the wrong text.
  if (inFlight !== null) {
    setSync('saving');
    return;
  }

  const text = localStorage.settings || '';
  let b64 = '';

  if (!isStock(text)) {
    let packed;
    try {
      packed = utf8ToB64(text);
    } catch (e) {
      console.log(e);
      setSync('error', 'bad_data');
      return;
    }
    if (packed.size > SCRIPT_MAX_BYTES) {
      setSync('error', 'too_big');
      return;
    }
    b64 = packed.b64;
  }

  if (!rpccmd('script_put', b64)) {
    setSync('pending');
    return;
  }

  inFlight = text;
  setSync('saving');
}

/** Take the account's copy: keep the replaced text once, store and apply the
 *  new one the way Save does, and refresh the editor only if it still shows the
 *  old stored text (never over something the player is typing). */
function adoptScript(text, stamp) {
  const old = localStorage.settings || '';

  localStorage.settingsPrev = old;
  localStorage.settings = text;
  localStorage.scriptStamp = '' + stamp;
  localStorage.scriptDirty = '0';

  $('.trigger').off();
  try {
    applySettings(text);
  } catch (e) {
    console.log(e);
    echo(e);
  }

  if (editor && editor.getValue() === old) editor.setValue(text);

  setSync('restored');
}

function onScriptData(data) {
  if (!data || typeof data !== 'object') return;
  syncKnown = true;

  if (!data.account) {
    setSync('local');
    return;
  }

  const stamp = Number(data.stamp) || 0;
  const b64 = typeof data.b64 === 'string' ? data.b64 : '';

  if (localStorage.scriptDirty === '1') {
    uploadScript();
    return;
  }

  if (stamp > storedStamp()) {
    if (b64) {
      let text;
      try {
        text = b64ToUtf8(b64);
      } catch (e) {
        console.log(e);
        setSync('error', 'bad_data');
        return;
      }
      if (text !== (localStorage.settings || '')) adoptScript(text, stamp);
      else {
        localStorage.scriptStamp = '' + stamp;
        setSync('saved');
      }
      return;
    }
  }

  // An empty account copy and a customized script here: back it up. This also
  // wins over a reset to stock made from another browser -- losing a reset is
  // cheaper than losing a script.
  if (!b64 && !isStock(localStorage.settings || '')) {
    uploadScript();
    return;
  }

  setSync('saved');
}

function onScriptSaved(data) {
  if (!data || typeof data !== 'object') return;
  const sent = inFlight;
  inFlight = null;

  if (data.ok) {
    localStorage.scriptStamp = '' + (Number(data.stamp) || 0);
    // A Save landed while this one was on its way: that one still has to go.
    if (sent !== null && sent !== (localStorage.settings || '')) {
      uploadScript();
      return;
    }
    localStorage.scriptDirty = '0';
    setSync('saved');
    return;
  }

  if (data.reason === 'no_account') {
    setSync('local');
    return;
  }

  if (data.reason === 'rate') {
    setSync('saving');
    if (!retryTimer)
      retryTimer = setTimeout(() => {
        retryTimer = null;
        if (syncKnown && localStorage.scriptDirty === '1') uploadScript();
      }, SCRIPT_RETRY_MS);
    return;
  }

  setSync('error', data.reason || 'io');
}

$(document).ready(function () {
  $('#rpc-events')
    // A new socket, or another character on this one (it may be on another
    // account, or on none): ask again at the next prompt.
    .on('rpc-version', function () {
      syncAsked = false;
      syncKnown = false;
      inFlight = null;
    })
    .on('rpc-config_state', function () {
      syncAsked = false;
      syncKnown = false;
    })
    .on('rpc-prompt', function () {
      if (syncAsked) return;
      syncAsked = true;
      const ask = () => rpccmd('script_get');
      if (defaultsLoaded) defaultsLoaded.always(ask);
      else ask();
    })
    .on('rpc-script_data', function (e, data) {
      const run = () => onScriptData(data);
      if (defaultsLoaded) defaultsLoaded.always(run);
      else run();
    })
    .on('rpc-script_saved', function (e, data) {
      onScriptSaved(data);
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

  localStorage.scriptDirty = '1';
  if (!syncKnown) return;
  // A character known to have no account: nothing to send, say so again.
  if (syncState.state === 'local') {
    setSync('local');
    return;
  }
  uploadScript();
}

export function getKeydown() {
  return keydown;
}
