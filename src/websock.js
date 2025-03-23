import { store, onConnected, onDisconnected } from './store.js';
import $ from 'jquery';
import Telnet from './telnet';

const PROTO_VERSION = 'DreamLand Web Client/2.1';

let wsUrl = 'wss://dreamland.rocks/dreamland';
let ws;

if (globalThis.location.hash === '#build') {
  wsUrl = 'wss://dreamland.rocks/buildplot';
} else if (globalThis.location.hash === '#local') {
  wsUrl = 'ws://localhost:1234';
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
    let b = new Uint8Array(e.data);
    b = String.fromCharCode.apply(null, b);
    b = decodeURIComponent(escape(b));
    b = JSON.parse(b);
    
    $('#rpc-events').trigger('rpc-' + b.command, b.args);
  };

  ws.onopen = function () {
    send('1');
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
