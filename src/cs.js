import $ from 'jquery';

import 'brace';
import 'brace/theme/monokai';
import './ace/mode-fenia'; // убедись, что такой файл существует и экспортируется

import { rpccmd } from './websock.js';

function fixindent(fn, str) {
  const lines = str.replace(/\r/g, '').split('\n');
  return lines
    .map(line => {
      const parts = line.match(/^([ \t]*)(.*)$/);
      return fn(parts[1]) + parts[2];
    })
    .join('\n');
}

function tabsize8to4(str) {
  return str.replace(/\t/g, '        ').replace(/ {4}/g, '\t');
}

function tabsize4to8(str) {
  return str.replace(/\r/g, '').replace(/\t/g, '    ').replace(/ {8}/g, '\t');
}

$(document).ready(function () {
  const editor = window.ace.edit($('#cs-modal .editor')[0], {
    tabSize: 4,
  });

  editor.setTheme('ace/theme/monokai');
  editor.session.setMode('ace/mode/fenia');

  $('#cs-modal .run-button').click(function (e) {
    const subj = $('#cs-subject').val();
    const body = fixindent(tabsize4to8, editor.getValue());

    e.preventDefault();
    rpccmd('cs_eval', subj, body);
  });

  $('#rpc-events').on('rpc-cs_edit', function (e, subj, body) {
    if (subj) $('#cs-subject').val(subj);
    if (body) editor.setValue(fixindent(tabsize8to4, body), -1);
    $('#cs-modal').modal('show');
  });
});
