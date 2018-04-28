
$(document).ready(function() {
    var terminal = $('#terminal');
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

    terminal.on('output', function process(e, b) {
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
            var lines = $(txt).appendTo(terminal).text().replace(/\xa0/g, ' ').split('\n');
            $(lines).each(function() {
                $('.trigger').trigger('text', [''+this]);
            });
            $('#terminal-wrap').animate({ scrollTop: $('#terminal').height() }, 50);
        }
    });
});
