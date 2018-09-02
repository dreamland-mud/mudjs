
// for easy scripting in triggers
function echo(txt) {
    $('#terminal').trigger('output', [txt]);
}

// jQuery 'terminal' module initialization
$.fn.terminal = function() {
    var terminal = this;

    this.on('output', function(e, txt) {
        var txt = ansi2html(txt);

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

};

function terminalInit() {
    var terminal = $('#terminal').terminal();
    return Promise.resolve();
}

