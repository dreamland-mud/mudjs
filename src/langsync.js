import $ from 'jquery';
import { send } from './websock';

// The nanny shows a fixed English "Choose your language" menu as the very first
// thing on every connect, before login. We always auto-answer it (matchLang
// accepts en/ua/ru): with the player's saved language if they have one, otherwise
// with 'en' -- so a first-time /newui connection opens the terminal in English,
// matching the login toggle's EN default instead of the server's own default.
// The flag switch (pickLang -> reconnect) saves the new choice and re-answers this
// menu with it on the next connect.
//
// We answer on *seeing* the menu (i.e. after a full server round-trip), so the
// nanny has already reached its input wait and reliably reads our reply. This is
// the LANGUAGE menu only; the earlier codepage menu is answered separately by the
// send('1') on ws.onopen (koi8-r). Guarded to one answer per connection; the
// guard resets on rpc-version, which fires once per connect.
let answered = false;

function savedLang() {
  try {
    const l = localStorage.getItem('mudjs.lang');
    return l === 'en' || l === 'ru' || l === 'ua' ? l : null;
  } catch (e) {
    return null; // localStorage unavailable (private mode)
  }
}

$(function () {
  $('#rpc-events')
    .on('rpc-version', function () {
      answered = false; // new connection -> allow answering its language menu once
    })
    .on('rpc-console_out', function (e, b) {
      if (answered || typeof b !== 'string') return;
      if (b.indexOf('Choose your language') === -1) return;
      answered = true;
      send(savedLang() || 'en');
    });
});
