var manipParseAndReplace;

$(document).ready(function() {

    // Replace item manipulation "<m i='234234' c='take $,put $ 12348'/>" tags surrounding every item.
    manipParseAndReplace = function(span) {
        span.find('m').each(function(index) {
            // Populate menu node for each item based on the 'c' attribute containing command list.
            var id = $(this).attr('i');
            var menu = $('<span class="dropdown-menu" />');
            $(this).attr('c').split(',').map(function(cmd) {
                var action = cmd.replace(/\$/, id);
                var label = cmd.replace(/^([а-я ]+).*$/, '$1');
                menu.append($('<a/>')
                             .addClass('dropdown-item')
                             .addClass('manip-item')
                             .attr('data-action', action)
                             .attr('href', '#')
                             .append(label));
            });
            // Create drop-down toggle from item description text.
            var toggle = $('<span class="dropdown-toggle" data-toggle="dropdown"/>').append($(this).contents());

            // Replace '<m>' pseudo-tag with Popper dropdown markup. 
            $(this).replaceWith(function() {
                var result = $('<span class="dropdown"/>').append(toggle).append(menu);
                return result;
            });
        });
    };

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
