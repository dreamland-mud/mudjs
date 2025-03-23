import $ from 'jquery';
import { send } from './websock.js';

function echo(txt) {
  if (!txt) return;

  if (txt.length !== 0) {
    const output = $('<div/>')
      .addClass('echo-with-anchor')
      .attr('aria-hidden', 'true')
      .text(txt + '\n');

    $('.terminal').trigger('output-html', [output[0].outerHTML]);
  } else {
    $('.terminal').trigger('output', '\n');
  }
}

$(document).ready(function () {
  $('#triggers').on('input', function (e, text) {
    send(text);
  });
});

export { echo };
