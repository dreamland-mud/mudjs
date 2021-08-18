const $ = require('jquery');

require('devbridge-autocomplete');

$(document).ready(function() {

    $('body').delegate('[data-hint]', 'click', function(e) {
        $('#' + $(this).data('hint')).modal('toggle');
        e.stopPropagation();
        e.preventDefault();
    });

    $('#rpc-events').on('rpc-prompt', function(e, b) {
        // Remember merged prompt here, so that valid latest prompt
        // is always available to user scripts.
        if (window.mudprompt === undefined)
            window.mudprompt = b;
        else
            $.extend(window.mudprompt, b);
    });
});
