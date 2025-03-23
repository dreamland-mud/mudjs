import $ from 'jquery';
import 'devbridge-autocomplete';

$(document).ready(function () {
  // Обработка клика по элементам с data-hint
  $('body').on('click', '[data-hint]', function (e) {
    $('#' + $(this).data('hint')).modal('toggle');
    e.stopPropagation();
    e.preventDefault();
  });

  // Слушаем события от сервера и обновляем глобальный mudprompt
  $('#rpc-events').on('rpc-prompt', function (e, b) {
    if (window.mudprompt === undefined) {
      window.mudprompt = b;
    } else {
      $.extend(window.mudprompt, b);
    }
  });
});
