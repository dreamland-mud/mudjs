
var PROTO_VERSION = 'DreamLand Web Client/1.1';
var msgs = [];
var rpccmd = function() {}, send = function() {}, notify = function() {};

$(document).ready(function() {

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
            'console-out': function(b) {
                telnet.process(b);
            },
            'notify': function(b) {
                notify(b);
            },
            'alert': function(b) {
                alert(b);
            },
            'prompt': function(b) {
                $('#stats').show();
                
                function stat($node, value, max) {
                    $node.find('.fill').css({ width: (100*value/max) + '%' });
                    $node.find('.value').text(value + ' / ' + max);
                }

                stat($('#stats .hit'), b.hit, b.max_hit);
                stat($('#stats .mana'), b.mana, b.max_mana);
                stat($('#stats .move'), b.move, b.max_move);
            },
            'version': function(b) {
                if(b !== PROTO_VERSION) {
                    process('\n\u001b[1;31mВерсия клиента (' + PROTO_VERSION + ') не совпадает с версией сервера (' + b + ').\n' +
                            'Обнови страницу, если не поможет - почисти кеши.\n');
                    ws.close();
                }
            },
            'editor-open': function(b) {
                texteditor(b)
                    .then(function(text) {
                        rpccmd('editor-save', text);
                    });
            }
        };

        ws.binaryType = 'arraybuffer';
        ws.onmessage = function(e) {
            var b = new Uint8Array(e.data);
            b = String.fromCharCode.apply(null, b);
            b = decodeURIComponent(escape(b));
            b = JSON.parse(b);
            msgs.push(b);
            handlers[b.command].apply(handlers, b.args);
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
            rpccmd('console-in', text + '\n');
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

