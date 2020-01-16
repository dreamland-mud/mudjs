
const $ = require('jquery');

var websock = require('./websock');
var input = require('./input');

var send = websock.send;
var echo = input.echo;

// Create the list of all possible area file names (without ".are" bit).
var areas = require('./data/areas.json').map(function(a) { 
    return a.file.replace('.are', ''); 
});

$(document).ready(function() {
    // Control panel buttons.
    $('body').on('click', '.btn-ctrl-panel', function(e) {
		var cmd = $(e.currentTarget).attr('data-action');
        var conf = $(e.currentTarget).attr('data-confirm');

        if (conf !== undefined && !global.confirm('Вы действительно хотите ' + conf + '?'))
            return;
            
        echo(cmd);
        send(cmd);
    });

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
        /\[map=([-0-9a-z_]{1,15})\.are\]/g, 
        function(match, p1, string) {
            if (areas.indexOf(p1) === -1)
                return '';
            return '<a class="btn btn-sm btn-outline-info btn-orange" href="https://dreamland.rocks/maps/' + p1 + '.html" target=_blank>открыть карту</a>';
        });
    
    // Replace extra-description placeholders [read=sign знак,see=sign] with (<span class="manip-cmd manip-ed" data-action="read 'sign знак'">sign</span>).
    // Returns empty string if 'see' part is not contained within 'read' part.
    html = html.replace(
        /\[read=([^,]{1,100}),see=([^\]]{1,30})]/ig, 
        function(match, p1, p2, string) {
            if (p1.toLowerCase().split(' ').indexOf(p2.toLowerCase()) === -1)
                return '';
            return '(<span class="manip-cmd manip-ed" data-action="read \'' + p1 + '\'" data-echo="читать ' + p2 + '">' + p2 + '</span>)';
        });

    // Replace random commands with data-action span.
    html = html.replace(
        /\[cmd=([^,]{1,50}),see=([^,]{1,50}),nonce=(.{8})]/ig,
        function(match, cmd, see, nonce, string) {
            // Ensure the command is coming from the server.
            if (nonce !== websock.ws().nonce) {
                console.log('Invalid nonce in command, someone\'s up to no good', string);
                return string;
            }
           
            // Replace argument placeholder.
            var action = cmd.replace(/\$1/, see);

            // The link will only surround the message itself, spaces are not underlined.
            return see.replace(
                    /^( *)(.*[^ ])( *)$/,
                    function(match, spaceBegin, msg, spaceEnd, string) {
                        var label;
                        switch (msg) {
                            case "edit":
                                label = '<i class="fa fa-edit"></i>';
                                break;
                            case "save":
                            case "done":
                                label = '<i class="fa fa-save"></i>';
                                break;
                            case "cancel":
                                label = '<i class="fa fa-window-close"></i>';
                                break;
                            case "show":
                                label = '<i class="fa fa-eye"></i>';
                                break;
                            default:
                                label = msg;
                                break;
                        }

                        return  '&nbsp;'.repeat(spaceBegin.length)
                                + '<span class="manip-cmd manip-ed" data-action="' + action + '" data-echo="' + action + '">' + label + '</span>'
                                + '&nbsp;'.repeat(spaceEnd.length);
                    });
               
        });

    span.html(html);

    // Replace "<hc>command</hc>" tags surrounding commands to send as is.
    span.find('hc').each(function(index) {
        var cmd = $(this).contents();

        $(this).replaceWith(function() {
            var action = cmd.text().toLowerCase();
            var result = $('<span/>')
                .addClass('manip-cmd')
                .attr('data-action', action)
				.attr('data-echo', action)
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

    // Replace "<hh>article name</hh>" or "<hh id='333'>" tags surrounding help articles.
    span.find('hh').each(function(index) {
        var article= $(this).contents();
        var id = $(this).attr('id') || article.text();
    
        $(this).replaceWith(function() {
            var result = $('<span/>')
                .addClass('manip-cmd')
                .addClass('manip-link')
                .attr('data-action', 'help ' + id)
				.attr('data-echo', 'справка ' + id)
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
            var label = cmd.replace(/^([а-яa-z ]+).*$/, '$1');
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
