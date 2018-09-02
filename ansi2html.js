var ansi2html;

var options = { "escape_html" : false, "ansi_colors": false };

(function() {
    var x = 0;
    var desired_class = 'fg-ansi-dark-color-7';
    var actual_class = '';
    var txt = '';
    var ansi = '';
    var bold = false, fg = 7, bg = 0;

    // Translate server output to HTML, replacing ANSI color sequences
    // with <span/> elements and color CSS classes. Also handles tabs,
    // carriage returns, and if enabled - does basic HTML escaping.
    // This is mostly legacy support for DreamLand, as it uses its own
    // tags to pass color information.
    ansi2html = function(b) {
        txt = '';
        actual_class = '';

        // Tries to process matched ANSI sequence.
        function process_ansi(start, params, cmd) {
            if(start != '[') {
                return;
            }

            switch(cmd) {
                case 'm':
                    if(params[0] == '0') {
                        // Escape sequence starting with [0; - dark colors.
                        bold = false;
                    } else if(params[0] == '1') {
                        // Escape sequence starting with [1; - bold, bright colors.
                        bold = true;
                    }
                    if (params.length == 1 || params[1] == 0) {
                        // Color reset [0m or [0;0m.
                        fg = 7;
                        bold = false;
                    } else if(params[1] >= 40 && params[1] <= 49) {
                        // Background colors [1;43m or [0;43m.
                        bg = params[1] - 40;
                        console.log('background ignored: ' + bg);
                    } else if(params[1] >= 30 && params[1] <= 39) {
                        // Foreground colors [1;33m or [0;33m.
                        fg = params[1] - 30;
                    }

                    if(bold) {
                        desired_class = 'fg-ansi-bold fg-ansi-bright-color-' + fg;
                    } else {
                        desired_class = 'fg-ansi-dark-color-' + fg;
                    }
                    break;
                case 'J':
                    txt = '';
                    break;
                case 'H':
                    console.log('move cursor');
                    break;
                default:
                    console.log('wtf: ' + cmd + ', ' + params);
                    break;
            }
        }

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

        // Process main input in b, accumulating resolved HTML inside txt variable.
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

        if(txt && actual_class !== '') 
            txt += '</span>';

        return txt;
    };   
})();
