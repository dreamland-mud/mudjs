
require('brace');
require('brace/theme/monokai');
require('./ace/mode-fenia');

var websock = require('./websock');

function fixindent(fn, str) {
    var lines = str.replace(/\r/g,'').split('\n');
    lines = lines.map(function(line) {
        var parts = line.match(/^([ \t]*)(.*)$/);
        return fn(parts[1]) + parts[2];
    });
    return lines.join('\n');
}

function tabsize8to4(str) {
    return str.replace(/\t/g, '        ').replace(/    /g, '\t');
}

function tabsize4to8(str) {
    return str.replace(/\r/g,'').replace(/\t/g, '    ').replace(/        /g, '\t');
}

$(document).ready(function() {
    var editor = ace.edit($('#cs-modal .editor')[0], {
        tabSize: 4
    });
    editor.setTheme('ace/theme/monokai');
    editor.session.setMode('ace/mode/fenia');

    $('#cs-modal .run-button').click(function(e) {
        var subj = $('#cs-subject').val(),
            body = fixindent(tabsize4to8, editor.getValue());

        e.preventDefault();
        websock.rpccmd('cs_eval', subj, body);
    });

    $('#rpc-events').on('rpc-cs_edit', function(e, subj, body) {
        if(subj) {
            $('#cs-subject').val(subj);
        }

        if(body) {
            editor.setValue(fixindent(tabsize8to4, body), -1);
        }

        $('#cs-modal').modal('show');
    });
});


