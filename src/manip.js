
var websock = require('./websock');
var input = require('./input');

var send = websock.send;
var echo = input.echo;

// Create the list of all possible area file names (without ".are" bit).
var areas = require('./data/areas.json').map(function(a) { 
    return a.file.replace('.are', ''); 
});

$(document).ready(function() {

    // Send comman to the server when command hyper link is clicked
    // e. g. 'read sign' or 'walk trap'.
    $('body').on('click', '.manip-cmd', function(e) {
		var cmd = $(e.currentTarget);
        echo(cmd.attr('data-echo'));
        send(cmd.attr('data-action'));
    });

    // Send command to the server when individual menu item is clicked.
    $('body').on('click', '.manip-item', function(e) {
		var cmd = $(e.currentTarget);
        echo(cmd.attr('data-echo'));
        send(cmd.attr('data-action'));
    });

    // Underline current selection when dropdown is shown.
    $('body').on('show.bs.dropdown', '.dropdown', function (e) {
        $(e.relatedTarget).css('text-decoration', 'underline');
    });

    // Remove underline when dropdown is hidden.
    $('body').on('hide.bs.dropdown', '.dropdown', function (e) {
        $(e.relatedTarget).removeAttr('style');
    });
});

// Replace colour "<c c='fgbr'/>" tags coming from the server with spans.
function colorParseAndReplace(span) {
    span.find('c').each(function(index) {
        var style = $(this).attr('c');
        $(this).replaceWith(function() {
            var result = $('<span/>').append($(this).contents());
            result.addClass(style);
            return result;
        });
    });
};

function manipParseAndReplace(span) {
    // Replace placeholders [map=filename.are] with buttons that open a map, 
    // or with an empty string, if area is not found in the areas.json.
    var html = span.html().replace(
        /\[map=([0-9a-z_]{1,15})\.are\]/g, 
        function(match, p1, string) {
            if (areas.indexOf(p1) === -1)
                return '';
            return '<a class="btn btn-sm btn-outline-info btn-orange" href="https://dreamland.rocks/maps/' + p1 + '.html" target=_blank>открыть карту</a>';
        });
    span.html(html);
    
    // Replace extra-description placeholders [read=sign знак,see=sign] with (<span class="manip-cmd manip-ed" data-action="read 'sign знак'">sign</span>).
    // Returns empty string if 'see' part is not contained within 'read' part.
    html = span.html().replace(
        /\[read=([^,]{1,50}),see=([^\]]{1,30})]/ig, 
        function(match, p1, p2, string) {
            if (p1.toLowerCase().split(' ').indexOf(p2.toLowerCase()) === -1)
                return '';
            return '(<span class="manip-cmd manip-ed" data-action="read \'' + p1 + '\'" data-echo="читать ' + p2 + '">' + p2 + '</span>)';
        });
    span.html(html);

    // Replace "<hc>command</hc>" tags surrounding commands to send as is.
    span.find('hc').each(function(index) {
        var cmd = $(this).contents();

        $(this).replaceWith(function() {
            var result = $('<span/>')
                .addClass('manip-cmd')
                .attr('data-action', cmd.text())
				.attr('data-echo', cmd.text().toLowerCase())
                .append(cmd);
            return result;
        });
    });

    // Replace "<hl>hyper link</hl>" tags surrounding hyper links.
    // Basic sanitization of the links.
    span.find('hl').each(function(index) {
        var content = $(this).contents();
                    var href = content.text();
                    if (!href.startsWith('http'))
                            return;

        $(this).replaceWith(function() {
            var result = $('<a target=_blank />')
                .addClass('manip-link')
                .attr('href', href)
                .append(content);
            return result;
        });
    });

    // Replace "<hh>article name</hh>" tags surrounding help articles.
    span.find('hh').each(function(index) {
        var article= $(this).contents();

        $(this).replaceWith(function() {
            var result = $('<span/>')
                .addClass('manip-cmd')
                .attr('data-action', 'help ' + article.text())
				.attr('data-echo', 'справка ' + article.text())
                .append(article);
            return result;
        });
    });

    // Replace "<hg>skill group</hg>" tags surrounding group names.
    span.find('hg').each(function(index) {
        var article= $(this).contents();

        $(this).replaceWith(function() {
            var result = $('<span/>')
                .addClass('manip-cmd')
                .attr('data-action', 'glist ' + article.text())
                .attr('data-echo', 'группаумен ' + article.text())
                .append(article);
            return result;
        });
    });

    // Replace item manipulation "<m i='234234' c='take $,put $ 12348'/>" tags surrounding every item.
    span.find('m').each(function(index) {
        // Populate menu node for each item based on the 'c' and 'l' attributes containing command lists.
        var id = $(this).attr('i');
        var menu = $('<span class="dropdown-menu" />');

        function addToMenu(cmd) {
            if (cmd.trim().length === 0)
		return;
            var action = cmd.replace(/\$/, id);
            var label = cmd.replace(/^([а-я ]+).*$/, '$1');
            menu.append($('<a/>')
                         .addClass('dropdown-item')
                         .addClass('manip-item')
                         .attr('data-action', action)
                         .attr('href', '#')
                         .append(label));
        }

        // Main commands above the divider.
        if (this.hasAttribute('c')) 
            $(this).attr('c').split(',').map(function(cmd) {
                addToMenu(cmd);
            });

        // Commands only available in this room, below the divider.
        if (this.hasAttribute('l')) {
            var divider = $('<div/>').addClass('dropdown-divider');
            menu.append(divider);
            $(this).attr('l').split(',').map(function(cmd) {
                addToMenu(cmd);
            });
        }

        // Create drop-down toggle from item description text.
        var toggle = $('<span class="dropdown-toggle" data-toggle="dropdown"/>').append($(this).contents());

        // Replace '<m>' pseudo-tag with Popper dropdown markup. 
        $(this).replaceWith(function() {
            var result = $('<span class="dropdown-norelative"/>').append(toggle).append(menu);
            return result;
        });
    });
};

module.exports = {
    manipParseAndReplace: manipParseAndReplace,
    colorParseAndReplace: colorParseAndReplace
};
