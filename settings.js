$(document).ready(function() {
    $('#settings-button').show();
    $('#settings-panel').hide();


    var editor = ace.edit("editor");
    editor.setTheme("ace/theme/monokai");
    editor.session.setMode("ace/mode/javascript");

    if(localStorage.settings) {
        editor.setValue(localStorage.settings);
    }

    eval(editor.getValue());

    $('#settings-button')
        .click(function(e) {
            e.preventDefault();
            $('#settings-button').hide();
            $('#settings-panel').show();
        });

    $('#settings-hide-button')
        .click(function(e) {
            e.preventDefault();
            $('#settings-button').show();
            $('#settings-panel').hide();
            
            $('.trigger').off();
            var val = editor.getValue();
            eval(val);
            localStorage.settings = val;
        });
});
