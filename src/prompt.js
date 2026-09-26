import $ from 'jquery';
import 'devbridge-autocomplete';

$(document).ready(function () {
  // Слушаем события от сервера и обновляем глобальный mudprompt
  $('#rpc-events').on('rpc-prompt', function (e, b) {
    if (window.mudprompt === undefined) {
      window.mudprompt = b;
    } else {
      $.extend(window.mudprompt, b);
    }
  });
});
