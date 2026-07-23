import $ from 'jquery';
import { send } from './websock';

// The nanny shows a fixed English "Choose your language" menu as the very first
// thing on every connect, before login. If the player already picked a language
// (remembered in localStorage by i18n.js), auto-answer it with the language word
// -- the server's matchLang accepts en/ua/ru -- so they aren't asked again. New
// players (no saved language) still see the menu and choose manually, and that
// choice is saved for next time.
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
      const lang = savedLang();
      if (lang) {
        answered = true;
        send(lang);
      }
    });
});
