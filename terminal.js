
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
};

function terminalInit() {
    var terminal = $('#terminal').terminal();
    return Promise.resolve();
}

