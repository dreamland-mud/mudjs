import { store, onConnected, onDisconnected } from './store.js';
import $ from 'jquery';
import Telnet from './telnet';

const PROTO_VERSION = 'DreamLand Web Client/2.1';

// Decode incoming UTF-8 frames. Must NOT use String.fromCharCode.apply(null,
// bytes): apply spreads every byte as a separate argument, which overflows the
// engine's argument limit on large messages and crashes the tab (a big webedit
// payload -- e.g. `fedit` on a config file -- was doing exactly this).
const utf8Decoder = new TextDecoder('utf-8');

let wsUrl = 'wss://dreamland.rocks/dreamland';
let ws;

if (globalThis.location.hash === '#build') {
  wsUrl = 'wss://dreamland.rocks/buildplot';
} else if (
  globalThis.location.hash === '#local' ||
  globalThis.location.hash === '#bd'
) {
  // local dev: auto-login bridge (Ukrainization/localdev/bridge.js) that logs
  // into the backdoor as Kadm, bypassing the not-locally-available nanny.
  // (The native local websocket on :1234 runs the nanny and stalls locally,
  // so #local points here too.)
  wsUrl = 'ws://localhost:1237';
}

function rpccmd(cmd, ...args) {
  if (ws) {
    ws.send(
      JSON.stringify({
        command: cmd,
        args: args,
      })
    );
  }
}

function send(text) {
  rpccmd('console_in', text + '\n');
}

function process(s) {
  $('.terminal').trigger('output', [s]);
}

// attach default RPC handlers
$(document).ready(function () {
  const telnet = new Telnet();

  telnet.handleRaw = function (s) {
    process(s);
  };

  $('#rpc-events')
    .on('rpc-console_out', function (e, b) {
      
      telnet.process(b);
    })
    .on('rpc-alert', function (e, b) {
      alert(b);
    })
    .on('rpc-version', function (e, version, nonce) {
      console.log('rpc-version', version, nonce);

      if (version !== PROTO_VERSION) {
        process(
          '\n\u001b[1;31mВерсия клиента (' +
            PROTO_VERSION +
            ') не совпадает с версией сервера (' +
            version +
            ').\n' +
            'Обнови страницу, если не поможет - почисти кеши.\u001b[0;37m\n'
        );
        ws.close();
      }

      ws.nonce = nonce;
    });
});

function connect() {
  ws = new WebSocket(wsUrl, ['binary']);

  ws.binaryType = 'arraybuffer';

  ws.onmessage = function (e) {
    const b = JSON.parse(utf8Decoder.decode(e.data));

    $('#rpc-events').trigger('rpc-' + b.command, b.args);
  };

  ws.onopen = function () {
    // (Previously sent '1' here to auto-pick English at the nanny language menu,
    // but that was race-prone -- it often arrived before the nanny was ready to
    // read it. The language menu is now auto-answered from the saved choice in
    // src/langsync.js, after the menu actually appears.)
  };

  ws.onclose = function () {
    process(
      '\u001b[1;31m#################### DISCONNECTED ####################\u001b[0;37m\n'
    );
    ws = null;
    store.dispatch(onDisconnected());
  };

  process('Connecting....\n');
  store.dispatch(onConnected());
}

export { send, rpccmd, connect, ws };
