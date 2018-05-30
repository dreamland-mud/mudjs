
var texteditor;

$(document).ready(function() {
    var editor = ace.edit($('#textedit-modal .editor')[0]);

    editor.setTheme('ace/theme/monokai');
    // editor.session.setMode('ace/mode/javascript');

    texteditor = function(text) {
        return new Promise(function(accept, reject) {
            editor.setValue(text);
            $('#textedit-modal').modal('show');

            $('#textedit-modal .save-button')
                .off()
                .click(function(e) {
                    e.preventDefault();
                    accept(editor.getValue());
                });

            $('#textedit-modal .cancel-button')
                .off()
                .click(function(e) {
                    e.preventDefault();
                    reject();
                });

        });
    };

});
