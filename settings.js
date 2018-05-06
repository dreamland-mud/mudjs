
$(document).ready(function() {
    function hashCode(s) {
        var hash = 0, i, chr;

        if (!s) return hash;

        for (i = 0; i < s.length; i++) {
            chr   = s.charCodeAt(i);
            hash  = ((hash << 5) - hash) + chr;
            hash |= 0; // convert to 32bit integer
        }

        return hash;
    }

    $.ajax({
            url: 'defaults.js',
            datatype: 'text',
            beforeSend: function(xhr) {
                xhr.overrideMimeType('text/plain');
            }
        })
        .then(function(contents) {
            var contentsHash = '' + hashCode(contents);
            var settingsHash = '' + hashCode(localStorage.settings);
            
            // defaults version has changed?
            if(contentsHash !== localStorage.defaultsHash) {
                console.log(contentsHash + ', ' + localStorage.defaultsHash);
                // has user ever edited settings?
                if(localStorage.defaultsHash && settingsHash !== localStorage.defaultsHash) {
                    console.log(settingsHash + ': ' + localStorage.defaultsHash);
                    if(confirm('Настройки по умолчанию изменились. Перезаписать собственные настройки настройками по умолчанию?')) {
                        localStorage.settings = contents;
                    }
                } else {
                    // silently override
                    localStorage.settings = contents;
                }
                localStorage.defaultsHash = contentsHash;
            }

            editor.setValue(localStorage.settings);

            try {
                eval(editor.getValue());
            } catch(e) {
                console.log(e);
                echo(e);
            }
        });

    $('#settings-button').show();
    $('#settings-panel').hide();


    var editor = ace.edit("editor");
    editor.setTheme("ace/theme/monokai");
    editor.session.setMode("ace/mode/javascript");

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
