import $ from 'jquery';
import loader from '@monaco-editor/loader';
import 'devbridge-autocomplete';
import { rpccmd } from './websock';
import { defineMonokai } from './monaco-monokai.js';

let monacoEditor;

// The plain textarea replaces Monaco for screen-reader users; the choice is
// remembered per browser.
const PLAIN_KEY = 'textedit.plain';
const plainBox = () => $('#textedit-modal .editor-plain');
const isPlain = () => plainBox().is(':visible');

function loadPlainPref() {
  try {
    return localStorage.getItem(PLAIN_KEY) === '1';
  } catch (e) {
    return false;
  }
}

function setPlain(on) {
  if (on) plainBox().val(monacoEditor.getValue());
  else monacoEditor.setValue(plainBox().val());

  $('#textedit-modal .editor').toggle(!on);
  plainBox().toggle(on);
  $('#textedit-modal .plain-button').attr('aria-pressed', on ? 'true' : 'false');
  try {
    localStorage.setItem(PLAIN_KEY, on ? '1' : '0');
  } catch (e) {}

  if (on) plainBox().focus();
  else monacoEditor.focus();
}

const editorValue = () => (isPlain() ? plainBox().val() : monacoEditor.getValue());

// Wrap the selection (or the cursor) in markup; with nothing selected the
// cursor lands between the two halves, ready to type.
function wrapSelection(before, after) {
  if (isPlain()) {
    const el = plainBox()[0];
    const { selectionStart: s, selectionEnd: e, value } = el;
    el.value = value.slice(0, s) + before + value.slice(s, e) + after + value.slice(e);
    el.selectionStart = s + before.length;
    el.selectionEnd = e + before.length;
    el.focus();
    return;
  }

  const sel = monacoEditor.getSelection();
  const text = monacoEditor.getModel().getValueInRange(sel);
  monacoEditor.executeEdits('dl-wrap', [{ range: sel, text: before + text + after, forceMoveMarkers: true }]);
  if (!text) {
    const pos = monacoEditor.getPosition();
    monacoEditor.setPosition({ lineNumber: pos.lineNumber, column: pos.column - after.length });
  }
  monacoEditor.focus();
}

function initHelpIds() {
  const heditLookup = $('#textedit-modal input');

  $.get(
    'hedit.json',
    function (data) {
      console.log('Retrieved', data.length, 'help ids.');

      const topics = $.map(data, function (dataItem) {
        return {
          value: dataItem.id + ': ' + dataItem.kw.toLowerCase(),
          data: dataItem.id,
        };
      });

      heditLookup.autocomplete({
        lookup: topics,
        lookupLimit: 20,
        autoSelectFirst: true,
        showNoSuggestionNotice: true,
        noSuggestionNotice: 'Справка не найдена',
        // Picking an article inserts a link to it around the selection.
        onSelect: function (suggestion) {
          heditLookup.val('');
          wrapSelection('{hh' + suggestion.data, '{x');
        },
      });
    },
    'json'
  ).fail(function () {
    console.log('Cannot retrieve help ids.');
    $('#textedit-modal input').hide();
  });
}

$(document).ready(function () {
  loader.init().then(monaco => {
    defineMonokai(monaco);

    const editorElement = $('#textedit-modal .editor')[0];

    monacoEditor = monaco.editor.create(editorElement, {
      value: '',
      language: 'plaintext',
      theme: 'monokai',
      // In-game help/description text is laid out for an 80-column terminal,
      // so wrap exactly at column 80 and draw a guide there to match.
      wordWrap: 'bounded',
      wordWrapColumn: 80,
      wrappingIndent: 'same',
      rulers: [80],
      lineNumbers: 'off',
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      fontSize: 16,
      // Monospace (same font as the in-game terminal -- Fira Code) so the
      // column-80 ruler and wrap line up with real character columns and mirror
      // what players see. Monaco writes this as an inline style on its own nodes,
      // so the value here (not the theme CSS) is what actually renders; Monaco
      // also defaults fontLigatures off, so column alignment stays exact. The
      // text is mostly Cyrillic, so also turn off Unicode highlight.
      fontFamily: "'Fira Code', monospace",
      unicodeHighlight: {
        ambiguousCharacters: false,
        invisibleCharacters: false,
        nonBasicASCII: false,
      },
      padding: { top: 20, bottom: 20 },
      automaticLayout: true,
    });

    // Ctrl+K: make the selection a clickable command, {y{hc...{x.
    const commandLink = () => wrapSelection('{y{hc', '{x');
    monacoEditor.addAction({
      id: 'dl-command-link',
      label: 'Clickable command {y{hc...{x',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK],
      run: commandLink,
    });
    plainBox().on('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        commandLink();
      }
    });

    $('#textedit-modal .plain-button').on('click', function (e) {
      e.preventDefault();
      setPlain(!isPlain());
    });

    $('#rpc-events').on('rpc-editor_open', function (e, text, arg) {
      monacoEditor.setValue(text || '');
      plainBox().val(text || '');
      const plain = loadPlainPref();
      $('#textedit-modal .editor').toggle(!plain);
      plainBox().toggle(plain);
      $('#textedit-modal .plain-button').attr('aria-pressed', plain ? 'true' : 'false');
      $('#textedit-modal').modal('show');
      if (plain) $('#textedit-modal').one('shown.bs.modal', () => plainBox().focus());

      if (arg === 'help') {
        $('#textedit-modal input').show();
        initHelpIds();
      } else {
        $('#textedit-modal input').hide();
      }

      $('#textedit-modal .save-button')
        .off()
        .click(function (e) {
          e.preventDefault();
          rpccmd('editor_save', editorValue());
        });

      $('#textedit-modal .cancel-button')
        .off()
        .click(function (e) {
          e.preventDefault();
          $('#textedit-modal').modal('hide');
        });
    });
  });
});
