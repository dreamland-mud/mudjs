
var echo = function() {};

$(document).ready(function() {
    var terminal = $('#terminal');
    var input = $('#input input');
    var txt = '';
    var x = 0;

    echo = function(b) {
        txt = '';
        function addText(t) {
            txt += t;
        }
        for(i in b) {
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
                default:
                    if(c >= 0x20) {
                        addText(b[i]);
                        x++;
                    }
            }
        }

        if(txt) {
            var span = $('<span/>');
            span.html(txt);
            span.find('c').each(function(index) {
                var style = $(this).attr('c');
                $(this).replaceWith(function() {
                    var result = $('<span/>').append($(this).contents());
                    result.addClass(style);
                    return result;
                });
            });

            var atBottom = $('#terminal-wrap').scrollTop() > ($('#terminal').height() - $('#terminal-wrap').height() - 50);
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
    $('.btn-keypad').click(function(e) {
        e.preventDefault();
        var btn = $(e.currentTarget), cmd = btn.data('cmd');

        if (cmd !== '') {
            console.log('cmd', cmd);
            send(cmd);
        }
    });
});
