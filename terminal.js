
var echo = function() {};

$(document).ready(function() {
    var terminal = $('#terminal');
    var input = $('#input input');
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

    echo = function(b) {
        actual_class = '';
        txt = '';
        function addText(t) {
            if(desired_class != actual_class) {
                if(txt) {
                    txt += '</span>';
                }
                txt += '<span class="' + desired_class + '">';
                actual_class = desired_class;
            }
            txt += t;
        }
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
                        addText('\n');
                        x = 0;
                        break;
                    case 0x9:
                        while((++x % 8) != 0)
                            addText(' ');
                        break;
                    case 0x1b:
                        ansi += b[i];
                        break;
                    case 0x3c: // <
                        if (options.escape_html === true) {
                            addText('&lt;');
                            x++;
                            break;
                        }
                        // FALLTHROUGH
                    case 0x3e: // >
                        if (options.escape_html === true) {
                            addText('&gt;');
                            x++;
                            break;
                        }
                        // FALLTHROUGH
                    default:
                        if(c >= 0x20) {
                            addText(b[i]);
                            x++;
                        }
                }
            }
        }
        if(txt) {
            if (actual_class !== '') 
                txt += '</span>';

            var span = $('<span/>');
            span.html(txt);

            // Replace colour "<c c='fgbr'/>" tags coming from the server with spans.
            span.find('c').each(function(index) {
                var style = $(this).attr('c');
                $(this).replaceWith(function() {
                    var result = $('<span/>').append($(this).contents());
                    result.addClass(style);
                    return result;
                });
            });

            manipParseAndReplace(span);

            var atBottom = $('#terminal-wrap').scrollTop() > ($('#terminal').height() - 2 * $('#terminal-wrap').height() );
            var lines = span.appendTo(terminal).text().replace(/\xa0/g, ' ').split('\n');
            $(lines).each(function() {
                $('.trigger').trigger('text', [''+this]);
            });

            // only autoscroll if near the bottom of the page
            if(atBottom) {
                $('#terminal-wrap').scrollTop($('#terminal').height());
            }
        }
    };
    terminal.on('output', function process(e, b) {
        echo(b);
    });

    /*
     * Handlers for plus-minus buttons to change terminal font size.
     */ 
    var fontDelta = 2;
    
    function changeFontSize(delta) {
        var style = terminal.css('font-size'); 
        var fontSize = parseFloat(style); 
        terminal.css('font-size', (fontSize + delta) + 'px');
    }

    $('#font-plus-button').click(function(e) {
        e.preventDefault();
        changeFontSize(fontDelta);
    });

    $('#font-minus-button').click(function(e) {
        e.preventDefault();
        changeFontSize(-fontDelta);
    });

    /*
     * Handlers for 'keypad' key area.
     */
    // Long press: open/close direction etc.
    var btnTimer;
    var wasLongPress = false;
    var longPressDelay = 800;

    $('.btn-keypad').on('touchstart', function(e) {
        wasLongPress = false;

        // Send specified long-cmd once the delay has elapsed.
        btnTimer = setTimeout(function() {
            btnTimer = null;
            wasLongPress = true;
            var btn = $(e.currentTarget), cmd = btn.data('long-cmd');
            if (cmd) {
                send(cmd);
            }

        }, longPressDelay);

    }).on('touchend', function(e) {
        if (btnTimer)  
            clearTimeout(btnTimer);
    });

    // Single click: go direction, look etc.`
    $('.btn-keypad').click(function(e) {
        if (wasLongPress)
            return;

        e.preventDefault();
        var btn = $(e.currentTarget), cmd = btn.data('cmd');

        if (cmd) {
            send(cmd);
        }
    });

});
