
var websock = require('./websock');

var send = websock.send;

var keydown = function(e) {};

$(document).ready(function() {
    var input_history = localStorage.history ? JSON.parse(localStorage.history) : [],
        position = input_history.length,
        current_cmd = $('#input input').val();

    function scrollPage(dir) {
        var wrap = $('#terminal-wrap');
        wrap.scrollTop(wrap.scrollTop() + wrap.height()*dir);
    }

    $('#input input').keydown(function(e) {
        e.stopPropagation();

        if(!e.shiftKey && !e.ctrlKey && !e.altKey) {
            switch(e.which) {
                case 33: // page up
                    e.preventDefault();
                    scrollPage(-0.8);
                    return;
                case 34: // page down
                    e.preventDefault();
                    scrollPage(0.8);
                    return;
                case 38: // up
                    e.preventDefault();
                    if(position > 0) {
                        if(position == input_history.length)
                            current_cmd = $('#input input').val();

                        for(var i=position-1;i >= 0;i--) {
                            if(input_history[i].indexOf(current_cmd) >= 0) {
                                var v = input_history[(position=i)];
                                $('#input input').val(v);
                                return;
                            }
                        }
                    }
                    return;
                case 40: // down
                    e.preventDefault();
                    if(position < input_history.length) {
                        var i;
                        for(i=position+1;i < input_history.length;i++) {
                            if(input_history[i].indexOf(current_cmd) >= 0) {
                                var v = input_history[(position=i)];
                                $('#input input').val(v);
                                return;
                            }
                        }
                        position=i;
                        $('#input input').val(current_cmd);
                    }
                    return;
            }
        }

        keydown(e);
    });

    $('#input').on('submit', function(e) {
        e.preventDefault();
        var input = $('#input input'),
            t = input.val();

        input.val('');

        if(t) {
            position = input_history.length;
            input_history[position++] = t;
            var drop = input_history.length - 1000; // store only 1000 most recent entries;
            if(drop < 0)
                drop = 0;
            localStorage.history = JSON.stringify(input_history.slice(drop));
        }
        var lines = t.split('\n');
        $(lines).each(function() {
            $('#terminal').trigger('output', ['' + this + '\r\n']);
            $('.trigger').trigger('input', ['' + this]);
        });
    });

    $('#triggers').on('input', function(e, text) {
        send(text);
    });
});
