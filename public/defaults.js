/* Этот файл будет сохранен в браузере (в LocalStorage.settings).
 * В переменной mudprompt хранится много полезной информации о персонаже.
 * Подробнее см. https://github.com/dreamland-mud/mudjs/wiki/MUD-prompt
 * Расшифровка аффектов: https://github.com/dreamland-mud/mudjs/blob/dreamland/src/components/windowletsPanel/windowletsConstants.js
 */

/*--------------------------------------------------------------------------
 * Триггера - автоматические действия как реакция на какую-то строку в мире.
 *-------------------------------------------------------------------------*/
$('.trigger').on('text', function(e, text) {
    if (text.match('ВЫБИЛ.? у тебя оружие, и оно упало на землю!$')) {
//        echo('>>> Подбираю оружие с пола, очистив буфер команд.\n');
//        send('\\');
//        send('взять ' + weapon + '|надеть ' + weapon);
    }

    if (text.match('^Ты умираешь от голода|^Ты умираешь от жажды')) {
        if (mudprompt.p2.pos === 'stand' || mudprompt.p2.pos === 'sit' || mudprompt.p2.pos === 'rest') {
//        echo('>>> Правильно питаюсь, когда не сплю и не сражаюсь.\n');
//        send('взять бочон сумка');
//        send('пить боч|пить боч|пить боч');
//        send('положить боч сумка');
        }
    }

    if (text.match('Обессилев, ты падаешь лицом вниз!')) {
//        echo('>>> ЕЩЕ РАЗОК!!!\n');
//        send('встать|выбить ' + doorToBash);
    }

    if (
        (text.match('^\\[ic\\] ') ||
        text.match('^\\[ooc\\] ') ||
        text.match(' говорит тебе \'.*\'$') ||
        text.match(' произносит \'.*\'$'))
        && !text.match('^Стражник|^Охранник'))
    {
        // Всплывающие оповещения для важных сообщений.
        notify(text);
    }
});

/*----------------------------------------------------------------------------
 * Синонимы (алиасы) -- свои команды с аргументами.
 * Также см. "справка синонимы" в игре.
 *----------------------------------------------------------------------------*/
// Здесь хранится текущая жертва для выстрелов из лука или удаленных заклинаний.
var victim;

// Здесь хранится, какую дверь пытаемся вышибить.
var doorToBash = 'n';

// Здесь хранится оружия для триггера на обезоруживание.
var weapon = 'dagger';

// Вспомогательная функция для выполнения команды с аргументами.
function command(e, cmd, text, handler) {
    var match, re;
   
   	// Попытаться распознать команду в формате 'cmd' или 'cmd аргумент'
    re = new RegExp('^' + cmd + ' *(.*)');
    match = re.exec(text);
    if (!match)
       return false;
	
	// Нашли соответствие. Аргументы передаем в параметры функции-обработчика команды.
    handler(match);
    e.stopPropagation(); // команда обработана локально - не отправлять на сервер
}

// Примеры алиасов.
$('.trigger').on('input', function(e, text) {
    // Установить жертву для выстрелов, например: /victim хассан
    command(e, '/victim', text, function(args) {
        victim = args[1];
        echo('>>> Твоя мишень теперь ' + victim + "\n");
    });
    
    // Установить оружие (см. тригер выше), например: /weapon меч
    command(e, '/weapon', text, function(args) {
        weapon = args[1];
        echo('>>> Твое оружие теперь ' + weapon + "\n");
    });
    
    // Опознать вещь из сумки, например: /iden кольцо
    command(e, '/iden', text, function(args) {
        send('взять ' + args[1] + ' сумка');
        send('к опознание ' + args[1]);
        send('полож ' + args[1] + ' сумка');
    });

    // Выбросить и уничтожить вещь из сумки: /purge барахло
    command(e, '/purge', text, function(args) {
        send('взять ' + args[1] + ' сумка');
        send('бросить ' + args[1]);
        send('жертвовать ' + args[1]);
    });
   
    // Начать выбивать двери (см. тригер выше): /bd юг
    command(e, '/bd', text, function(args) {
        doorToBash = args[1];
        echo('>>> Поехали, вышибаем по направлению ' + doorToBash + '\n');
        send('выбить ' + doorToBash);
    });
});


/*------------------------------------------------------------------------------
 * Горячие клавиши: по умолчанию умеет ходить/стрелять/всматриваться через кейпад. 
 *------------------------------------------------------------------------------*/

// Вспомогательные функции для горячих клавиш.
function go(where) {
    send(where);
}

function scan(where) {
    send('scan ' + where);
}

// Рейнджеры могут стрелять по жертве victim из лука, а маги и клеры -- 
// бить заклинаниями на расстоянии в заданном направлении.
function shoot(where) {
//    send('стрелять ' + where + ' ' + victim); 
//    send("к 'стен клинк' " + where + '.' + victim);
//    send("к 'струя кисл' " + where + '.' + victim);
}

// Коды клавиш на кейпаде.
var KP_0 = 96,
    KP_1 = 97,
    KP_2 = 98,
    KP_3 = 99,
    KP_4 = 100,
    KP_5 = 101,
    KP_6 = 102,
    KP_7 = 103,
    KP_8 = 104,
    KP_9 = 105,
    KP_MUL = 106,
    KP_PLUS = 107,
    KP_MINUS = 109,
    KP_DOT = 110,
    KP_DIV = 111;

// Просто клавиша - идти по направлению, ctrl+клавиша - стрелять, alt+клавиша - всмотреться.
function dir(d, e) {
    if(e.ctrlKey) {
        shoot(d);
    } else if(e.altKey) {
        scan(d);
    } else {
        go(d);
    }
}

// Назначаем горячие клавиши и их действия.
// Чтобы назначить действие на кнопку, нужно сначала найти ее код.
// Коды кнопок смотри тут: https://keycode.info 
keydown=function(e) {
    switch(e.which) {
        case KP_1:
            dir('down', e);
            break;
        case KP_2:
            dir('south', e);
            break;
        case KP_4:
            dir('west', e);
            break;
        case KP_5:
            send('scan');
            break;
        case KP_6:
            dir('east', e);
            break;
        case KP_8:
            dir('north', e);
            break;
        case KP_9:
            dir('up', e);
            break;
            
        case 27: // Например, 27 -- код кнопки Escape
            if(!e.shiftKey && !e.ctrlKey && !e.altKey) {
                $('#input input').val(''); // очистить поле ввода
            } else {
                return;
            }
            break;
            
/*
        case 192: // 192 -- код кнопки ~ (тильда)
            // Пример автобаффа: проверяем какие аффекты отсутствуют и вешаем их.
            if (mudprompt.enh === 'none' || mudprompt.enh.a.indexOf("l") == -1)
                send("c learning");                    
            if (mudprompt.enh === 'none' || mudprompt.enh.a.indexOf("g") == -1)
                send("c giant");
            if (mudprompt.enh === 'none' || mudprompt.enh.a.indexOf("f") == -1)
                send("c frenzy");
            if (mudprompt.enh === 'none' || mudprompt.enh.a.indexOf("h") == -1)
                send("order rat c haste fiorine");  // Тут подставьте ваше имя.
            if (mudprompt.pro === 'none' || mudprompt.pro.a.indexOf("p") == -1)
                send("c 'prot shield'");
            if (mudprompt.pro === 'none' || mudprompt.pro.a.indexOf("s") == -1)
                send("c sanctuary");
            // ... и так далее 
            break;
*/

/*
        case KP_0:
            break;
        case KP_2:
            break;        
        case KP_7:
            break;
        case KP_MUL:
            break;
        case KP_PLUS:
            break;
        case KP_MINUS:
            break;
        case KP_DOT:
            break;
        case KP_DIV:
            break;
        case 112: // F1
            break;
        case 113: // F2
            break;
        case 114: // F3
            break;
        case 115: // F4
            break;
        case 116: // F5
            break;
            
       // Для кодов остальных клавиш смотри https://keycode.info 
*/

        default: 
            return; // по умолчанию просто посылаем клавишу на сервер
    }
    
    e.preventDefault(); // не посылать клавишу на сервер если обработана выше
};

