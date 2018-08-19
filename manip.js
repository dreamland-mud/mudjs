var manipParseAndReplace;

$(document).ready(function() {

    manipParseAndReplace = function(span) {
        // Replace "<r i='sign'>sign</r>" tags surrounding extra descriptions.
        span.find('r').each(function(index) {
            var id = $(this).attr('i');
            var keyword = $(this).contents();

            $(this).replaceWith(function() {
                var result = $('<span/>')
                    .addClass('manip-ed')
                    .attr('data-id', id)
                    .append(keyword);
                return result;
            });
        });

        // Replace "<hc>command</hc>" tags surrounding commands to send as is.
        span.find('hc').each(function(index) {
            var cmd = $(this).contents();

            $(this).replaceWith(function() {
                var result = $('<span/>')
                    .addClass('manip-cmd')
                    .attr('data-action', cmd.text())
                    .append(cmd);
                return result;
            });
        });

        // Replace "<hl>hyper link</hl>" tags surrounding hyper links.
        span.find('hl').each(function(index) {
            var href= $(this).contents();

            $(this).replaceWith(function() {
                var result = $('<a target=_blank />')
                    .addClass('manip-link')
                    .attr('href', href.text())
                    .append(href);
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
                var result = $('<span class="dropdown"/>').append(toggle).append(menu);
                return result;
            });
        });
    };

    // Send 'read' command to the server when extra descr keyword is clicked.
    $('body').on('click', '.manip-ed', function(e) {
        var id = $(e.currentTarget).attr('data-id');
        send("read '" + id + "'");
    });

    // Send comman to the server when command hyper link is clicked
    // e. g. 'read sign' or 'walk trap'.
    $('body').on('click', '.manip-cmd', function(e) {
        var action = $(e.currentTarget).attr('data-action');
        send(action);
    });

    // Send command to the server when individual menu item is clicked.
    $('body').on('click', '.manip-item', function(e) {
        var action = $(e.currentTarget).attr('data-action');
        send(action);
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
