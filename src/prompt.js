const $ = require('jquery');

require('devbridge-autocomplete');

$(document).ready(function() {

    $('body').delegate('[data-hint]', 'click', function(e) {
        $('#' + $(this).data('hint')).modal('toggle');
        e.stopPropagation();
        e.preventDefault();
    });
});
