
//-----------------------------------------------------
// Пример тригера
$('.trigger').on('text', function(e, text) {
    if(text.match('^Ты умираешь от голода')) {
        console.log('triggered!');
// раскоментируй следующую строку чтоб пить из бочонка
//        send('dr barr');
    }
    
    if(
        text.match('^\\[ic\\] ') ||
        text.match('^\\[ooc\\] ') ||
        text.match(' говорит тебе \'.*\'$') ||
        text.match(' произносит \'.*\'$') ||
        text.match('\\[Flower Children\\] .*: ')
        ) {
        notify(text);
    }
});

var victim;

//-----------------------------------------------------
// Пример алиаса
$('.trigger').on('input', function(e, text) {
    var match;

    match = (/^\/victim (.*)/).exec(text);

    if(match) {
        // команда обработана локально - не отправлять на сервер!
        e.stopPropagation(); 
        victim = match[1];
        echo('\nТвоя мишень теперь ' + victim + '\n');
    }
});

function go(where) {
    send(where);
}

function scan(where) {
    echo('\nscan ' + where + '\n');
    send('scan ' + where);
}

function shoot(where) {
    send('shoot ' + where + ' ' + victim);
}

//-----------------------------------------------------
// Пример хоткеев
keydown=function(e) {
    if(e.shiftKey) {
        switch(e.which) {
            case 37: // Shift+Left
                scan('west');
                break;
            case 38: // Shift+Up
                scan('north');
                break;
            case 39: // Shift+Right
                scan('east');
                break;
            case 40: // Shift+Down
                scan('south');
                break;
            default:
                return;
        }
        e.preventDefault();
        return;
    }

    if(e.ctrlKey) {
        switch(e.which) {
            case 37: // Ctrl+Left
                shoot('west');
                break;
            case 38: // Ctrl+Up
                shoot('north');
                break;
            case 39: // Ctrl+Right
                shoot('east');
                break;
            case 40: // Ctrl+Down
                shoot('south');
                break;
            default:
                return;
        }
        e.preventDefault();
        return;
    }

    if(e.altKey) {
        switch(e.which) {
            case 37: // Alt+Left
                go('west');
                break;
            case 38: // Alt+Up
                go('north');
                break;
            case 39: // Alt+Right
                go('east');
                break;
            case 40: // Alt+Down
                go('south');
                break;
            default:
                return;
        }
        e.preventDefault();
        return;
    }

    if(!e.shiftKey && !e.ctrlKey && !e.altKey) {
        switch(e.which) {
            case 27: // esc
                e.preventDefault();
                $('#input input').val(''); // очистить поле воода
                break;
            case 112: // F1
                e.preventDefault();
                send('say hi');
                break;
        }
    }
};

