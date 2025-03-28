import $ from 'jquery';
import loader from '@monaco-editor/loader';
import 'devbridge-autocomplete';
import { rpccmd } from './websock';
import { setupSpeechRecognition } from './speech';

let monacoEditor;
let recognition = null;

// ⬇️ Скрытый элемент для озвучки
const ariaAnnouncer = document.createElement('div');
ariaAnnouncer.setAttribute('id', 'aria-announce');
ariaAnnouncer.setAttribute('aria-live', 'polite');
ariaAnnouncer.setAttribute('role', 'status');
Object.assign(ariaAnnouncer.style, {
  position: 'absolute',
  width: '1px',
  height: '1px',
  overflow: 'hidden',
  clip: 'rect(1px, 1px, 1px, 1px)',
  clipPath: 'inset(50%)',
});
document.body.appendChild(ariaAnnouncer);

function getResponsiveEditorParams() {
  const minWidth = 360;
  const maxWidth = 1440;
  const width = Math.max(minWidth, Math.min(window.innerWidth, maxWidth));
  const percent = (width - minWidth) / (maxWidth - minWidth);

  const fontSize = +(7.5 + (18 - 7.5) * Math.pow(percent, 0.8)).toFixed(2);
  const lineHeight = Math.round(fontSize * 1.5);
  const paddingValue = Math.round(0 + 20 * percent);

  return {
    fontSize,
    lineHeight,
    padding: { top: paddingValue, bottom: paddingValue },
  };
}

function initHelpIds() {
  const heditLookup = $('#textedit-modal input');

  $.get(
    'hedit.json',
    function (data) {
      const topics = $.map(data, item => ({
        value: `${item.id}: ${item.kw.toLowerCase()}`,
        data: item.id,
      }));

      heditLookup.autocomplete({
        lookup: topics,
        lookupLimit: 20,
        autoSelectFirst: true,
        showNoSuggestionNotice: true,
        noSuggestionNotice: 'Справка не найдена',
        onSelect: () => $('#textedit-modal .editor').focus(),
      });
    },
    'json'
  ).fail(() => {
    console.log('Cannot retrieve help ids.');
    $('#textedit-modal input').hide();
  });
}

function initVoiceRecognition(monaco) {
  if (recognition) recognition.abort();

  recognition = setupSpeechRecognition({
    lang: document.querySelector('#voice-lang').value || 'ru-RU',
    buttonSelector: '#start-voice',
    onResult: transcript => {
      const currentText = monaco.getValue();
      monaco.setValue(currentText + ' ' + transcript);
    },
    onError: event => {
      console.error('Speech recognition error:', event.error);
    },
  });
}

$(document).ready(() => {
  loader.init().then(monaco => {
    const editorElement = $('#textedit-modal .editor')[0];
    const { fontSize, lineHeight, padding } = getResponsiveEditorParams();

    monacoEditor = monaco.editor.create(editorElement, {
      value: '',
      accessibilitySupport: 'on',
      language: 'plaintext',
      theme: 'vs-dark',
      wordWrap: 'wordWrapColumn',
      wordWrapColumn: 80,
      wrappingIndent: 'same',
      lineNumbers: 'off',
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      fontSize,
      lineHeight,
      fontFamily: 'Roboto Mono, monospace',
      padding,
      automaticLayout: true,
      rulers: [80],
      renderWhitespace: 'boundary',
      cursorSmoothCaretAnimation: true,
      glyphMargin: false,
      lineDecorationsWidth: 0,
      folding: false,
      renderLineHighlight: 'none',
    });

    initVoiceRecognition(monacoEditor);

    // 🔄 Перезапуск речи при смене языка
    document.querySelector('#voice-lang').addEventListener('change', () => {
      initVoiceRecognition(monacoEditor);
    });

    monacoEditor.onDidChangeModelContent(() => {
      const model = monacoEditor.getModel();
      const pos = monacoEditor.getPosition();
      const line = model.getLineContent(pos.lineNumber);
      if (line.length === 80) {
        ariaAnnouncer.textContent = `Вы достигли 80 символов на строке ${pos.lineNumber}.`;
      }
    });

    window.addEventListener('resize', () => {
      if (monacoEditor) {
        const { fontSize, lineHeight, padding } = getResponsiveEditorParams();
        monacoEditor.updateOptions({ fontSize, lineHeight, padding });
      }
    });

    $('#rpc-events').on('rpc-editor_open', (e, text, arg) => {
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
        .click(e => {
          e.preventDefault();
          const val = monacoEditor.getValue();
          rpccmd('editor_save', val);
        });

      $('#textedit-modal .cancel-button')
        .off()
        .click(e => {
          e.preventDefault();
          $('#textedit-modal').modal('hide');
        });
    });
  });
});
