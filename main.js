
var send;

$(document).ready(function() {
    var ws;

    send = function(text) {
        ws.send(text + '\r');
    }

    function process(s) {
        $('#terminal').trigger('output', [s]);
        $('#input input').focus();
    }

    function connect() {
        //ws = new WebSocket("wss://dreamland.rocks/dreamland", ['binary']);
        ws = new WebSocket("ws://127.0.0.1:1234/dreamland", ['binary']);

        ws.binaryType = 'arraybuffer';
        ws.onmessage = function(e) {
            var b = new Uint8Array(e.data);
            b = String.fromCharCode.apply(null, b);
            b = decodeURIComponent(escape(b));
            process(b);
        }
        ws.onopen = function(e) {
            send('7');
        }
        ws.onclose = function(e) {
            process('\u001b[1;31m#################### DISCONNECTED ####################\n');
            $('#reconnect').show();
            $('#input input').hide();
            ws = null;
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

    var input_history = localStorage.history ? JSON.parse(localStorage.history) : [],
        position = input_history.length,
        current_cmd = $('#input input').val();

    $('body').on('keydown', function() {
        var input = $('#input input');

        // dont autofocus if something in the panel is in focus
        if($('#settings-panel :focus').length != 0) {
            return;
        }

        if(!input.is(':focus')) {
            input.focus();
        }
    });

    function scrollPage(dir) {
        var wrap = $('#terminal-wrap');
        wrap.scrollTop(wrap.scrollTop() + wrap.height()*dir);
    }

    $('#input input').keydown(function(e) {
        e.stopPropagation();

        switch(e.which) {
            case 33: // page up
                scrollPage(-0.8);
                break;
            case 34: // page down
                scrollPage(0.8);
                break;
                /*
            case 36: // home
                $('#terminal-wrap').animate({ 
                    scrollTop: 0
                }, 50);
                break;
            case 35: // end
                $('#terminal-wrap').animate({ 
                    scrollTop: $('#terminal').height()
                }, 50);
                break;
                */
            case 38: // up
                if(position > 0) {
                    if(position == input_history.length)
                        current_cmd = $('#input input').val();

                    var v = input_history[--position];
                    $('#input input').val(v);
                }
                break;
            case 40: // down
                if(position < input_history.length) {
                    position++;
                    $('#input input').val(position == input_history.length ? current_cmd : input_history[position]);
                }
                break;
            default:
                return;
        }

        e.preventDefault();
    });

    $('#input').on('submit', function(e) {
        e.preventDefault();
        var input = $('#input input'),
            t = input.val();

        input.val('');

        if(t) {
            position = input_history.length;
            input_history[position++] = t;
            var drop = input_history.length - 1000; // store only 1000 most recent entries;
            if(drop < 0)
                drop = 0;
            localStorage.history = JSON.stringify(input_history.slice(drop));
        }
        process(t + '\r\n');
        $('.trigger').trigger('input', [t]);
    });

    $('#triggers').on('input', function(e, text) {
        send(text);
    });
});

