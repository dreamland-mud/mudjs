
var msgs = [];
var send = function() {}, notify = function() {};

$(document).ready(function() {
    var handlers = {
        'console-out': function(b) {
            process(b);
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
        }
    };

    function process(s) {
        $('#terminal').trigger('output', [s]);
        $('#input input').focus();
    }

    function connect() {
        ws = new WebSocket(wsUrl, ['binary']);

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

        send = function(text) {
            ws.send(JSON.stringify({
                command: 'console-in',
                args: [text + '\n']
            }));
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

