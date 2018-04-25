
var ws, terminal = $('#terminal');

function connect() {
    ws = new WebSocket("wss://dreamland.rocks/dreamland", ['binary']);
    //ws = new WebSocket("ws://192.168.0.226:1234/dreamland", ['binary']);

    ws.binaryType = 'arraybuffer';
    ws.onmessage = function(e) {
        var b = new Uint8Array(e.data);
        b = String.fromCharCode.apply(null, b);
        b = decodeURIComponent(escape(b));
        process(b);
    }
    ws.onopen = function(e) {
        ws.send('7\r');
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

var input_history = [], position = 0;

$('body').on('keydown', function() {
    var input = $('#input input');

    if(!input.is(':focus')) {
        input.focus();
    }
});

$('#input input').keydown(function(e) {
    e.stopPropagation();

    switch(e.which) {
        case 38: // up
            if(position > 0) {
                var v = input_history[--position];
                $('#input input').val(v);
            }
            break;
        case 40: // down
            if(position < input_history.length) {
                $('#input input').val(input_history[position++]);
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

    if(t) {
        position = input_history.length;
        input_history[position++] = t;
    }
    process(t + '\r\n');
    ws.send(t + '\r');
    input.val('');
});

var txt = '';
var x = 0;
var ansi = '';

var bold = false, fg = 7, bg = 0;
var desired_class = 'fg-ansi-dark-color-7';
var actual_class;

function process_ansi(start, params, cmd) {
    if(start != '[') {
        return;
    }

    switch(cmd) {
        case 'm':
            for(i in params) {
                if(params[i] == '0') {
                    bold = false;
                }
                if(params[i] == '1') {
                    bold = true;
                }
                if(params[i] >= 40 && params[i] <= 49) {
                    bg = params[i] - 40;
                    console.log('background ignored: ' + bg);
                }
                if(params[i] >= 30 && params[i] <= 39) {
                    fg = params[i] - 30;
                }
                if(bold) {
                    desired_class = 'fg-ansi-bold fg-ansi-bright-color-' + fg;
                } else {
                    desired_class = 'fg-ansi-dark-color-' + fg;
                }
            }
            break;
        case 'J':
            txt = '';
            //terminal.empty();
            break;
        case 'H':
            console.log('move cursor');
            break;
        default:
            console.log('wtf: ' + cmd + ', ' + params);
    }
}

function process(b) {
    actual_class = '';
    txt = '';
    for(i in b) {
        if(ansi) {
            ansi += b[i];
            var m = ansi.match('.(.)([0-9;]*)([A-Za-z])');
            if(m) {
                ansi='';
                process_ansi(m[1], m[2].split(';'), m[3]);
            }
        } else {
            var c = b.charCodeAt(i);

            switch(c) {
                case 0xa:
                    txt += '<br/>\n';
                    x = 0;
                    break;
                case 0x9:
                    while((++x % 8) != 0) {
                        txt += '&nbsp;';
                    }
                    break;
                case 0x20:
                    txt += '&nbsp;';
                    x++;
                    break;
                case 0x1b:
                    ansi += b[i];
                    break;
                default:
                    if(c > 0x20) {
                        if(desired_class != actual_class) {
                            if(txt) {
                                txt += '</span>';
                            }
                            txt += '<span class="' + desired_class + '">';
                            actual_class = desired_class;
                        }
                        if(b[i] == '<') {
                            txt += '&lt';
                        } else {
                            txt += b[i];
                        }
                        x++;
                    }
            }
        }
    }
    if(txt) {
        terminal.append(txt);
        $('#input input').focus();
        $('#terminal-wrap').animate({ scrollTop: $('#terminal').height() }, 50);
    }
}
