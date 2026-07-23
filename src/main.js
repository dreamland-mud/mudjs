import $ from 'jquery';
import PropertiesStorage from './properties';
import { connect } from './websock';
import lastLocation from './location';
import getSessionId from './sessionid.js';
import historydb from './historydb';
import { startAutoUpdate } from './autoupdate';

import './notify';
import './input';
import './settings';
import './prompt';
import './combatui';
import './textedit';
import './cs';

import './main.css';

const sessionId = getSessionId();
let propertiesStorage = PropertiesStorage;

$(window).bind('beforeunload', function () {
  return 'leaving already?';
});

$(document).ready(function () {
  $('#logs-button').click(function (e) {
    var logs = [];

    e.preventDefault();

    historydb
      .then(function (db) {
        return db.load(null, false, 100000000, function (key, value) {
          logs.push(value);
        });
      })
      .then(function () {
        var blobOpts = { type: 'text/html' },
          blob = new Blob(logs, blobOpts),
          url = URL.createObjectURL(blob);

        logs = null;
        console.log(url);

        // create a link
        var link = $('<a>').attr({
          href: url,
          download: 'mudjs.log',
        })[0];

        // click on it
        setTimeout(function () {
          var event = document.createEvent('MouseEvents');
          event.initMouseEvent(
            'click',
            true,
            true,
            window,
            1,
            0,
            0,
            0,
            0,
            false,
            false,
            false,
            false,
            0,
            null
          );
          link.dispatchEvent(event);
        }, 10);
      });
  });

  $('#map-button').click(function (e) {
    e.preventDefault();

    if (!lastLocation()) {
      return;
    }

    var basefilename = lastLocation().area.replace(/\.are$/, '');
    var mapfile = '/maps/' + basefilename + '.html?sessionId=' + sessionId;
    window.open(mapfile);
  });

  connect();
  initTerminalFontSize();
  startAutoUpdate();

  /*
   * Handlers for plus-minus buttons to change terminal font size.
   */
  var fontDelta = 2;
  var terminalFontSizeKey = 'terminalFontSize';

  function changeFontSize(delta) {
    var terminal = $('.terminal');
    var style = terminal.css('font-size');
    var fontSize = parseFloat(style);
    terminal.css('font-size', fontSize + delta + 'px');
    localStorage.setItem(terminalFontSizeKey, fontSize + delta);
    propertiesStorage['terminalFontSize'] = fontSize + delta;
    localStorage.properties = JSON.stringify(propertiesStorage);
  }

  function initTerminalFontSize() {
    var cacheFontSize = localStorage.properties
      ? JSON.parse(localStorage.properties)['terminalFontSize']
      : propertiesStorage;
    if (cacheFontSize != null) {
      var terminal = $('.terminal');
      terminal.css('font-size', cacheFontSize + 'px');
    }
  }

  // Delegated from document so the binding survives React mounting these buttons after
  // this script runs (a direct $('#id').click() at load time finds nothing and silently
  // no-ops, which is why the buttons appeared dead).
  $(document).on('click', '#font-plus-button', function (e) {
    e.preventDefault();
    changeFontSize(fontDelta);
  });

  $(document).on('click', '#font-minus-button', function (e) {
    e.preventDefault();
    changeFontSize(-fontDelta);
  });

  // Layout-width persistence now lives in app.jsx (Mosaic onRelease), which reads the split
  // off the layout tree instead of querying #map-wrap — the dead '.layout-splitter' handler
  // here both never fired (react-mosaic uses .mosaic-split) and crashed on a missing #map-wrap
  // when the map pane was hidden at narrow widths.
});
