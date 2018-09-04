
var websock = require('./websock');

$(document).ready(function() {
    var editor = ace.edit($('#textedit-modal .editor')[0]);

    editor.setTheme('ace/theme/monokai');
    // editor.session.setMode('ace/mode/javascript');

    $('#rpc-events').on('rpc-editor_open', function(e, text) {
        editor.setValue(text);
        $('#textedit-modal').modal('show');

        $('#textedit-modal .save-button')
            .off()
            .click(function(e) {
                e.preventDefault();
                websock.rpccmd('editor_save', editor.getValue());
            });

        $('#textedit-modal .cancel-button')
            .off()
            .click(function(e) {
                e.preventDefault();
            });

    });

});
