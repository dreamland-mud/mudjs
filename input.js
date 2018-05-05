
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

        switch(e.which) {
            case 33: // page up
                scrollPage(-0.8);
                break;
            case 34: // page down
                scrollPage(0.8);
                break;
                /*
            case 36: // home
                $('#terminal-wrap').animate({ 
                    scrollTop: 0
                }, 50);
                break;
            case 35: // end
                $('#terminal-wrap').animate({ 
                    scrollTop: $('#terminal').height()
                }, 50);
                break;
                */
            case 38: // up
                if(position > 0) {
                    if(position == input_history.length)
                        current_cmd = $('#input input').val();

                    var v = input_history[--position];
                    $('#input input').val(v);
                }
                break;
            case 40: // down
                if(position < input_history.length) {
                    position++;
                    $('#input input').val(position == input_history.length ? current_cmd : input_history[position]);
                }
                break;
            default:
                $('.trigger').trigger($.Event('keydown', { which: e.which }));
                return;
        }

        e.preventDefault();
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
        $('#terminal').trigger('output', [t + '\r\n']);
        $('.trigger').trigger('input', [t]);
    });

    $('#triggers').on('input', function(e, text) {
        send(text);
    });
});
