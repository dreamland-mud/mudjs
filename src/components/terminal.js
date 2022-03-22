import React from 'react';
import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import $ from 'jquery';

import historyDb from '../historydb';
import ansi2html from '../ansi2html';
import manip from '../manip';
import { processTriggers } from './sysCommands/action';

// TODO: the following parameters should be replaced with two numbers - viewport size (in pixels) and the threshold (in pixels)
const bytesToLoad = 100000; // how much stuff to load from the database in one go, when we hit the threshold (bytes)
const scrollThreshold = 1000; // when to start loading more data (px)
const maxBytesOnScreen = 1000000;


var firstChunkId = -1; // id of the first chunk in history (only set when scrolled to the very top)
var lastChunkId = -1; // id of the last chunk sent to the terminal
var scrolling = false;

const loadChunks = (startId, direction, maxlen) => {
    const chunks = [];

    return historyDb
        .then(db => db.load(startId, direction, maxlen, (id, value) => chunks.push({id, value})))
        .then(() => {
            // direction is backward, we start from the very bottom => the first returned record has the last chunk id 
            if(!startId && direction && chunks.length > 0)
                lastChunkId = chunks[0].id;

            // direction is backward, we have initial key and no records returned => initial key is the first one in the database
            if(startId && direction && chunks.length === 0)
                firstChunkId = startId;

            return chunks.map(({id, value}) => $('<div>').append(value).attr('data-chunk-id', id));
        });
};

function terminalInit(wrap) {
    const terminal = wrap.find('.terminal');

    const append = $chunk => {
        $chunk.appendTo(terminal);

        while(terminal.html().length > maxBytesOnScreen)
            terminal.children(':first').remove();

        wrap.scrollTop(terminal.height());
    };

    const atBottom = () => wrap.scrollTop() > (terminal.height() - 2 * wrap.height());

    const loadTop = (startId, len) => {
        scrolling = true;

        return loadChunks(startId, true, len)
            .then(chunks => chunks.forEach(chunk => terminal.prepend(chunk)));
    };

    const loadBottom = (startId, len) => {
        scrolling = true;

        return loadChunks(startId, false, len)
            .then(chunks => chunks.forEach(chunk => terminal.append(chunk)));
    };

    const scrollToBottom = () => {
        wrap.scrollTop(0);
        terminal.empty();

        return loadTop(null, maxBytesOnScreen)
            .then(() => {
                wrap.scrollTop(terminal.height());
                scrolling = false;
            }); // scroll to the bottom
    };

    wrap.on('scroll-to-bottom', e => scrollToBottom());

    terminal.on('output', function(e, txt) {
        const span = $('<span/>');
        span.html(ansi2html(txt));

        manip.colorParseAndReplace(span);
        manip.manipParseAndReplace(span);
        manip.hideElementsForScreenReaders(span);

        terminal.trigger('output-html', [span.html()]);
    });

    // this may not be called from outside of terminal logic.
    terminal.on('output-html', function(e, html) {
        historyDb
            .then(db => db.append(html))
            .then(id => {
                const $chunk = $('<div>')
                    .append(html)
                    .attr('data-chunk-id', id)
                    .attr('aria-live', 'alert');

                $chunk.find('.manip-cmd').each(function(){
                    $(this)
                    .attr('role','link')
                    .attr('tabindex', 0)
                })
                // only append a DOM node if we're at the bottom
                if(atBottom()) {
                    append($chunk);
                } else {
                    wrap.trigger('bump-unread', []);
                }

                lastChunkId = id;

                // Transform output into clean text and call user-defined triggers.
                const $chunkCopy = $chunk.clone();
                $chunkCopy.find('.no-triggers').remove();
                const lines = $chunkCopy.text().replace(/\xa0/g, ' ').split('\n');
                lines.forEach(line => {
                    processTriggers(line);
                    $('.trigger').trigger('text', [''+line])
                });
                // lines.forEach(line => $('.trigger').trigger('text', [''+line]));
            });
    });

    wrap.on('scroll', e => {
        // We are already handling a scroll event. 
        // Don't trigger another database operation until the current one completed.
        if(scrolling) {
            // Prevent scrolling, so that the user won't hit the limits of the scrolling window.
            // e.preventDefault(); 
            return;
        }

        // Load top chunks while scrolling up.
        if(wrap.scrollTop() < scrollThreshold) {
            let $fst = terminal.find('div[data-chunk-id]:first-child');

            // terminal is empty, can't scroll
            if($fst.length === 0)
                return;

            let off = $fst.offset().top;
            let fstId = parseInt($fst.attr('data-chunk-id'));

            if(fstId === firstChunkId) {
                // We're at the very top, no need to load anything
                return;
            }

            loadTop(fstId, bytesToLoad)
                .then(() => {
                    while(terminal.html().length > maxBytesOnScreen)
                        terminal.children(':last').remove();

                    wrap.scrollTop(wrap.scrollTop() + $fst.offset().top - off);
                    scrolling = false;
                });

            return;
        }

        // Load bottom chunks while scrolling down.
        if(wrap.scrollTop() > (terminal.height() - wrap.height() - scrollThreshold)) {
            let $lst = terminal.find('div[data-chunk-id]:last-child');

            // terminal is empty, can't scroll
            if($lst.length === 0)
                return;

            let off = $lst.offset().top;
            let lstId = parseInt($lst.attr('data-chunk-id'));

            // The last html element in the DOM is the last sent message, 
            // so we're at the bottom, no need to load anything.
            if(lstId === lastChunkId) {
                // Check if we can reset the unread counter and return
                if(atBottom()) {
                    wrap.trigger('reset-unread', []);
                }

                return;
            }

            loadBottom(lstId, bytesToLoad)
                .then(() => {
                    while(terminal.html().length > maxBytesOnScreen)
                        terminal.children(':first').remove();

                    wrap.scrollTop(wrap.scrollTop() + $lst.offset().top - off);
                    scrolling = false;
                });

            return;
        }
    });

    scrollToBottom()
        .then(() => {
            const echo = html => terminal.trigger('output-html', [html]);

            echo('<hr>');
            echo(ansi2html('\u001b[1;31m#################### ИСТОРИЯ ЧАТА ЗАГРУЖЕНА ####################\u001b[0;37m\n'));
            echo('<hr>');
        });

    return () => {
        wrap.off();
        terminal.off();
    };
}

export default forwardRef(({bumpUnread, resetUnread}, ref) => {
    const wrap = useRef();

    useEffect(() => terminalInit($(wrap.current)), [wrap]);

    useEffect(() => {
        let cur = $(wrap.current);
        cur.on('bump-unread', bumpUnread);
        return () => cur.off('bump-unread', bumpUnread);
    }, [wrap, bumpUnread]);

    useEffect(() => {
        let cur = $(wrap.current);
        cur.on('reset-unread', resetUnread);
        return () => cur.off('reset-unread', resetUnread);
    }, [wrap, resetUnread]);

    useImperativeHandle(ref, () => ({
        scrollToBottom: () => $(wrap.current).trigger('scroll-to-bottom', [])
    }), [wrap]);

    return <div className="terminal-wrap" ref={wrap}>
            <div className="terminal" aria-live="polite" aria-relevant="additions"></div>
          </div>;
});
