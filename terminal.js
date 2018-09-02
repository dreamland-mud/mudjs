
// TODO: the following parameters should be replaced with two numbers - viewport size (in pixels) and the threshold (in pixels)
var bytesToLoad = 5000; // how much stuff to load from the database in one go, when we hit the threshold (bytes)
var scrollThreshold = 1000; // when to start loading more data (px)
var maxChildren = 100; // TODO - check the length of the html instead of the number of children


var lastChunkId = -1; // id of the last chunk appended to the terminal

// for easy scripting in triggers
function echo(txt) {
    $('#terminal').trigger('output', [txt]);
}

// jQuery 'terminal' module initialization
$.fn.terminal = function() {
    var terminal = this;

    this.on('output', function(e, txt) {
        var span = $('<span/>');
        span.html(ansi2html(txt));

        colorParseAndReplace(span);
        manipParseAndReplace(span);

        historyDb
            .append(span.html())
            .then(function(id) {
                var $chunk = $('<span>')
                    .append(span)
                    .attr('data-chunk-id', id);
                
                // only append the new chunk if we had the latest
                var $lst = terminal.find('span[data-chunk-id]:last-child');

                if($lst.length === 0 || parseInt($lst.attr('data-chunk-id')) === lastChunkId) {
                    terminal.trigger('append', [$chunk]);

                    while(terminal.children().length > maxChildren) {
                        terminal.children(':first').remove();
                    }
                }

                lastChunkId = id;

                var lines = $chunk.text().replace(/\xa0/g, ' ').split('\n');
                $(lines).each(function() {
                    $('.trigger').trigger('text', [''+this]);
                });
            });
    });

    this.on('append', function(e, $txt) {
        var atBottom = $('#terminal-wrap').scrollTop() > (terminal.height() - 2 * $('#terminal-wrap').height() );
        $txt.appendTo(terminal);

        // only autoscroll if near the bottom of the page
        if(atBottom) {
            $('#terminal-wrap').scrollTop(terminal.height());
        }
    });

    return this;
};

// jQuery 'terminal-wrapper' module initialization
$.fn.terminalWrap = function() {
    var wrap = this,
        terminal = $('#terminal'),
        scrolling = false;

    this.on('scroll', function(e) {
        // We are already handling a scroll event. 
        // Don't trigger another database operation until the current one completed.
        if(scrolling) {
            // Prevent scrolling, so that the user won't hit the limits of the scrolling window.
            e.preventDefault(); 
            return;
        }

        // Load top chunks while scrolling up.
        if(wrap.scrollTop() < scrollThreshold) {
            var $fst = terminal.find('span[data-chunk-id]:first-child');

            // terminal is empty, can't scroll
            if($fst.length === 0)
                return;

            var off = $fst.offset().top;
            var fstId = parseInt($fst.attr('data-chunk-id'));

            scrolling = true;

            historyDb
                .load(fstId, true, bytesToLoad, function(id, value) { 
                    var $chunk = $('<span>')
                        .append(value)
                        .attr('data-chunk-id', id);

                    terminal.prepend($chunk);

                    while(terminal.children().length > maxChildren) {
                        terminal.children(':last').remove();
                    }

                    wrap.scrollTop(wrap.scrollTop() + $fst.offset().top - off);
                })
                .then(function() {
                    scrolling = false;
                });
        }

        // Load bottom chunks while scrolling down.
        if(wrap.scrollTop() > (terminal.height() - wrap.height() - scrollThreshold)) {
            var $lst = terminal.find('span[data-chunk-id]:last-child');

            // terminal is empty, can't scroll
            if($lst.length === 0)
                return;

            var off = $lst.offset().top;
            var lstId = parseInt($lst.attr('data-chunk-id'));

            // The last html element in the DOM is the last appended message, 
            // so we're at the bottom, no need to load anything.
            if(lstId === lastChunkId) 
                return;

            scrolling = true;
            
            historyDb
                .load(lstId, false, bytesToLoad, function(id, value) { 
                    var $chunk = $('<span>')
                        .append(value)
                        .attr('data-chunk-id', id);

                    terminal.append($chunk);

                    while(terminal.children().length > maxChildren) {
                        terminal.children(':first').remove();
                    }

                    wrap.scrollTop(wrap.scrollTop() + $lst.offset().top - off);
                })
                .then(function() {
                    scrolling = false;
                });
        }
    });
};

function terminalInit() {
    var terminal = $('#terminal').terminal();

    return historyDb
        .load(null, true, bytesToLoad, function(id, value) {
            var $chunk = $('<span>')
                .append(value)
                .attr('data-chunk-id', id);

            terminal.prepend($chunk);
        })
        .then(function() {
            function append(html) {
                terminal.trigger('append', [$(html)]);
            }

            append('<hr>');
            append(ansi2html('\u001b[1;31m#################### HISTORY LOADED ####################\n'));
            append('<hr>');
        
            $('#terminal-wrap')
                .scrollTop(terminal.height()) // scroll to the bottom
                .terminalWrap(); // initialize the wrapper
        });
}

