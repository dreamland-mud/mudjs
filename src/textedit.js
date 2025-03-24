import $ from 'jquery';
import loader from '@monaco-editor/loader';
import 'devbridge-autocomplete';
import { rpccmd } from './websock';

let monacoEditor;

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
        onSelect: function (suggestion) {
          $('#textedit-modal .editor').focus();
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
    const editorElement = $('#textedit-modal .editor')[0];

    monacoEditor = monaco.editor.create(editorElement, {
      value: '',
      language: 'plaintext',
      theme: 'vs-dark',
      wordWrap: 'on',
      lineNumbers: 'off',
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      fontSize: 16,
      fontFamily: 'serif',
      padding: { top: 20, bottom: 20 },
      automaticLayout: true,
      minimap: { enabled: false },
    });

    $('#rpc-events').on('rpc-editor_open', function (e, text, arg) {
      monacoEditor.setValue(text || '');
      $('#textedit-modal').modal('show');

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
          const val = monacoEditor.getValue();
          rpccmd('editor_save', val);
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
