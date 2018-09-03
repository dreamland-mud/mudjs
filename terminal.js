
// TODO: the following parameters should be replaced with two numbers - viewport size (in pixels) and the threshold (in pixels)
var bytesToLoad = 10000; // how much stuff to load from the database in one go, when we hit the threshold (bytes)
var scrollThreshold = 1000; // when to start loading more data (px)
var maxBytesOnScreen = 100000;


var lastChunkId = -1; // id of the last chunk sent to the terminal
var unread = 0;
var scrolling = false;

function atBottom() {
    var terminal = $('#terminal'),
        wrap = $('#terminal-wrap');

    return wrap.scrollTop() > (terminal.height() - 2 * wrap.height() );
}

function bumpUnread() {
    unread++;

    $('#terminal-activity')
        .text(unread + ' unread message' + (unread > 1 ? 's' : ''))
        .show();
}

function resetUnread() {
    if(!unread)
        return;

    unread = 0;

    $('#terminal-activity')
        .hide();
}

// for easy scripting in triggers
function echo(txt) {
    $('#terminal').trigger('output', [txt]);
}

// jQuery 'terminal' module initialization
$.fn.terminal = function() {
    var terminal = this,
        wrap = $('#terminal-wrap'),
        append = function($chunk) {
            $chunk.appendTo(terminal);

            wrap.scrollTop(terminal.height());

            while(terminal.html().length > maxBytesOnScreen) {
                terminal.children(':first').remove();
            }
        };

    $('#terminal-activity').click(function(e) {
        e.preventDefault();

        // reload from the bottom up
        scrolling = true;
        $('#terminal-wrap').scrollTop(0);
        terminal.empty();
        resetUnread();

        var chunks = [];

        return historyDb
            .load(null, true, maxBytesOnScreen, function(id, value) {
                var $chunk = $('<span>')
                    .append(value)
                    .attr('data-chunk-id', id);

                chunks.push($chunk);
            })
            .then(function(b) {
                $(chunks).each(function() {
                    terminal.prepend(this);
                });
                wrap.scrollTop(terminal.height());
                scrolling = false;
            });
    });

    this.on('output', function(e, txt) {
        var span = $('<span/>');
        span.html(ansi2html(txt));

        colorParseAndReplace(span);
        manipParseAndReplace(span);

        terminal.trigger('output-html', [span.html()]);
    });

    // this may not be called from outside of terminal logic.
    this.on('output-html', function(e, html) {
        historyDb
            .append(html)
            .then(function(id) {
                var $chunk = $('<span>')
                    .append(html)
                    .attr('data-chunk-id', id);
                
                // only append a DOM node if we're at the bottom
                if(atBottom()) {
                    append($chunk);
                } else {
                    bumpUnread();
                }

                lastChunkId = id;

                var lines = $chunk.text().replace(/\xa0/g, ' ').split('\n');
                $(lines).each(function() {
                    $('.trigger').trigger('text', [''+this]);
                });
            });
    });

    return this;
};

// jQuery 'terminal-wrapper' module initialization
$.fn.terminalWrap = function() {
    var wrap = this,
        terminal = $('#terminal');

    this.on('scroll', function(e) {
        // We are already handling a scroll event. 
        // Don't trigger another database operation until the current one completed.
        if(scrolling) {
            // Prevent scrolling, so that the user won't hit the limits of the scrolling window.
            // e.preventDefault(); 
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
            var chunks = [];

            historyDb
                .load(fstId, true, bytesToLoad, function(id, value) { 
                    var $chunk = $('<span>')
                        .append(value)
                        .attr('data-chunk-id', id);

                    chunks.push($chunk);
                })
                .then(function() {
                    $(chunks).each(function() {
                        terminal.prepend(this);
                    });

                    while(terminal.html().length > maxBytesOnScreen) {
                        terminal.children(':last').remove();
                    }

                    wrap.scrollTop(wrap.scrollTop() + $fst.offset().top - off);
                    scrolling = false;
                });

            return;
        }

        // Load bottom chunks while scrolling down.
        if(wrap.scrollTop() > (terminal.height() - wrap.height() - scrollThreshold)) {
            var $lst = terminal.find('span[data-chunk-id]:last-child');

            // terminal is empty, can't scroll
            if($lst.length === 0)
                return;

            var off = $lst.offset().top;
            var lstId = parseInt($lst.attr('data-chunk-id'));

            // The last html element in the DOM is the last sent message, 
            // so we're at the bottom, no need to load anything.
            if(lstId === lastChunkId) {
                // Check if we can reset the unread counter and return
                if(atBottom()) {
                    resetUnread();
                }

                return;
            }

            scrolling = true;
            var chunks = [];
            
            historyDb
                .load(lstId, false, bytesToLoad, function(id, value) { 
                    var $chunk = $('<span>')
                        .append(value)
                        .attr('data-chunk-id', id);

                    chunks.push($chunk);
                })
                .then(function() {
                    $(chunks).each(function() {
                        terminal.append(this);
                    });

                    while(terminal.html().length > maxBytesOnScreen) {
                        terminal.children(':first').remove();
                    }

                    wrap.scrollTop(wrap.scrollTop() + $lst.offset().top - off);
                    scrolling = false;
                });

            return;
        }
    });
};

function terminalInit() {
    var terminal = $('#terminal').terminal();

    scrolling = true;
    $('#terminal-wrap').scrollTop(0);

    var chunks = [];

    return historyDb
        .load(null, true, maxBytesOnScreen, function(id, value) {
            var $chunk = $('<span>')
                .append(value)
                .attr('data-chunk-id', id);

            chunks.push($chunk);
        })
        .then(function() {
            $(chunks).each(function() {
                terminal.prepend(this);
            });

            function append(html) {
                terminal.trigger('output-html', [html]);
            }

            append('<hr>');
            append(ansi2html('\u001b[1;31m#################### HISTORY LOADED ####################\u001b[0;37m\n'));
            append('<hr>');
        
            $('#terminal-wrap')
                .scrollTop(terminal.height()) // scroll to the bottom
                .terminalWrap(); // initialize the wrapper

            scrolling = false;
        });
}

