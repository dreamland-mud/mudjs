
const { store, onConnected, onDisconnected } = require('./store.js');

var $ = require('jquery');
var Telnet = require('./telnet');

var PROTO_VERSION = 'DreamLand Web Client/2.1';
var wsUrl = "wss://dreamland.rocks/dreamland";

var ws;

if(global.location.hash === '#build') {
    wsUrl = "wss://dreamland.rocks/buildplot";
} else if(global.location.hash === '#local') {
    wsUrl = "ws://localhost:1234";
}

function rpccmd(cmd) {
    if(ws) {
        ws.send(JSON.stringify({
            command: cmd,
            args: Array.prototype.slice.call(arguments, 1)
        }));
    }
}

function send(text) {
    rpccmd('console_in', text + '\n');
}

function process(s) {
    $('.terminal').trigger('output', [s]);
}

// attach default RPC handlers
$(document).ready(function() {
    var telnet = new Telnet();

    telnet.handleRaw = function(s) {
        process(s);
    }

    $('#rpc-events')
        .on('rpc-console_out', function(e, b) {
            telnet.process(b);
        })
        .on('rpc-alert', function(e, b) {
            alert(b);
        })
        .on('rpc-version', function(e, version, nonce) {
            console.log('rpc-version', version, nonce);

            if(version !== PROTO_VERSION) {
                process('\n\u001b[1;31mВерсия клиента (' + PROTO_VERSION + ') не совпадает с версией сервера (' + version + ').\n' +
                        'Обнови страницу, если не поможет - почисти кеши.\u001b[0;37m\n');
                ws.close();
            }

            // Store unique ID from the server and use it to verify action links ([cmd] tag).
            ws.nonce = nonce;
        });
});

function connect() {
    ws = new WebSocket(wsUrl, ['binary']);


    ws.binaryType = 'arraybuffer';
    ws.onmessage = function(e) {
        var b = new Uint8Array(e.data);
        b = String.fromCharCode.apply(null, b);
        b = decodeURIComponent(escape(b));
        b = JSON.parse(b);
        $('#rpc-events').trigger('rpc-' + b.command, b.args);
    }
    ws.onopen = function(e) {
        send('1'); // use internal encoding (koi8). All WebSocket IO is converted to/from UTF8 at the transport layer.
    }
    ws.onclose = function(e) {
        process('\u001b[1;31m#################### DISCONNECTED ####################\u001b[0;37m\n');
        ws = null;
        // Dispatches an action to trigger a state change.
        store.dispatch(onDisconnected());
    }

    process('Connecting....\n');
    // Dispatches an action to trigger a state change.
    store.dispatch(onConnected());
}

module.exports = {
    send: send,
    rpccmd: rpccmd,
    connect: connect,
    ws: function() {
        return ws;
    }
};
