var csEdit;

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
        theme: 'ace/theme/monokai',
        mode: 'ace/mode/fenia',
        tabSize: 4
    });

    $('#cs-modal .run-button')
        .click(function(e) {
            e.preventDefault();
            rpccmd('cs_eval', $('#cs-subject').val(), fixindent(tabsize4to8, editor.getValue()));
        });

    csEdit = function(subj, body) {
        if(subj) {
            $('#cs-subject').val(subj);
        }

        if(body) {
            editor.setValue(fixindent(tabsize8to4, body), -1);
        }

        $('#cs-modal').modal('show');
    };
});


