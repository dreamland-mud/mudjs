
var PROTO_VERSION = 'DreamLand Web Client/1.3';
var rpccmd = function() {}, send = function() {}, notify = function() {};
var wsUrl = "wss://dreamland.rocks/dreamland";

if(location.hash === '#build') {
    wsUrl = "wss://dreamland.rocks/buildplot";
} else if(location.hash === '#local') {
    wsUrl = "ws://localhost:1234";
}
    var lastLocation, locationChannel, bcastLocation;

$(window).bind('beforeunload', function() {
    return 'leaving already?';
});

$(document).ready(function() {
    if('BroadcastChannel' in window) {
        locationChannel = new BroadcastChannel('location');

        locationChannel.onmessage = function(e) {
            if(e.data.what === 'where am i' && lastLocation) {
                bcastLocation();
            }
        };
    }

    bcastLocation = function () {
        if(locationChannel) {
            locationChannel.postMessage({
                what: 'location',
                location: lastLocation
            });
        }
    };

    $('#map-button').click(function(e) {
        if(!lastLocation) {
            e.preventDefault();
            return;
        }

        var mapfile = '/maps/' + lastLocation.area.replace(/\.are$/, '') + '.html?1';
        window.open(mapfile);
        e.preventDefault();
    });

    function process(s) {
        $('#terminal').trigger('output', [s]);

        // dont autofocus if modal dialog is present
        if($('body.modal-open').length == 0)
            $('#input input').focus();
    }

    function connect() {
        ws = new WebSocket(wsUrl, ['binary']);

        var telnet = new Telnet();

        telnet.handleRaw = function(s) {
            process(s);
        }

        var handlers = {
            'console_out': function(b) {
                telnet.process(b);
            },
            'notify': function(b) {
                notify(b);
            },
            'alert': function(b) {
                alert(b);
            },
            'prompt': function(b) {
                promptHandler(b);
            },
            'version': function(b) {
                if(b !== PROTO_VERSION) {
                    process('\n\u001b[1;31mВерсия клиента (' + PROTO_VERSION + ') не совпадает с версией сервера (' + b + ').\n' +
                            'Обнови страницу, если не поможет - почисти кеши.\n');
                    ws.close();
                }
            },
            'editor_open': function(b) {
                texteditor(b)
                    .then(function(text) {
                        rpccmd('editor_save', text);
                    });
            },
            'cs_edit': function(subj, body) {
                csEdit(subj, body);
            }
        };

        ws.binaryType = 'arraybuffer';
        ws.onmessage = function(e) {
            var b = new Uint8Array(e.data);
            b = String.fromCharCode.apply(null, b);
            b = decodeURIComponent(escape(b));
            b = JSON.parse(b);
            var h = handlers[b.command];
            if(h) {
                h.apply(handlers, b.args);
            } else {
                console.log('Dont know how to handle ' + b.command);
            }
        }
        ws.onopen = function(e) {
            send('1'); // use internal encoding (koi8). All WebSocket IO is converted to/from UTF8 at the transport layer.
        }
        ws.onclose = function(e) {
            process('\u001b[1;31m#################### DISCONNECTED ####################\n');
            $('#reconnect').show();
            $('#input input').hide();
            ws = null;
        }

        rpccmd = function(cmd) {
            ws.send(JSON.stringify({
                command: cmd,
                args: Array.prototype.slice.call(arguments, 1)
            }));
        }

        send = function(text) {
            rpccmd('console_in', text + '\n');
        }

        process('Connecting....\n');
        $('#reconnect').hide();
        $('#input input').show();
    }

    connect();

    $('#reconnect').click(function(e) {
        e.preventDefault();
        connect();
    });

    $('body').on('keydown', function(e) {
        var input = $('#input input');

        // dont autofocus if modal dialog is present
        if($('body.modal-open').length != 0)
            return;

        if(e.ctrlKey || e.altKey)
            return;

        if(input.is(':focus'))
            return;

        input.focus();
    });


    if('Notification' in window) {
        Promise.resolve(Notification.permission)
            .then(function(perm) {
                if(perm === 'granted') {
                    return perm;
                } else {
                    return Notification.requestPermission();
                }
            })
            .then(function(perm) {
                if(perm === 'granted') {
                    notify = function(text) {
                        if(document.hidden) {
                            new Notification(text);
                        }
                    }
                }
            });
    }
});

