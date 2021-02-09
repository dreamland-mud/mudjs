const $ = require('jquery');

require('devbridge-autocomplete');

var websock = require('./websock');
var input = require('./input');
var send = websock.send;
var echo = input.echo;

$(document).ready(function() {

    $('body').delegate('[data-hint]', 'click', function(e) {
        $('#' + $(this).data('hint')).modal('toggle');
        e.stopPropagation();
        e.preventDefault();
    });

    // prompt sector fields: s - sector type, l - light
    function promptSector(b) {
        // Later if needed. Showing sector type everywhere will discover a lot of funny things.
    }

    // Should the main affect window be hidden as it's empty?
    var affectsPanelHidden = true;

    // prompt affect helper function: draw a block of affects
    // prompt affect block fields: a - active bits, z - bits from affects with zero duration
    function drawAffectBlock(block, selector, blockName, bitNames, color) {
        var clr_active = 'fg-ansi-bright-color-' + color;
        var clr_zero = 'fg-ansi-bright-color-3';
        var clr_header = 'fg-ansi-bright-color-7';
        var $row = $(selector);

        // Nothing changed since last time.
        if (block == undefined) {
            if ($row.is(':visible'))
                affectsPanelHidden = false;
            return;
        }

        // This affect block is now hidden.
        if (block === "none") {
            $row.hide();
            $row.empty();
            return;
        }

        $row.show();
        $row.empty();
        affectsPanelHidden = false;

        var $span = $('<span/>').addClass(clr_header).text(blockName);
        $row.append($span);

        for (var bit in bitNames) {
            if (bitNames.hasOwnProperty(bit)) {
                var clr;

                // Draw active affect names in green, those about to
                // disappear in yellow.
                if (block.z.indexOf(bit) !== -1)
                    clr = clr_zero;
                else if (block.a.indexOf(bit) !== -1)
                    clr = clr_active;
                else
                    continue;

                var $span = $('<span/>').addClass(clr).text(bitNames[bit]);
                $row.append($span);
            }
        }
    }

    // prompt fields related to affects: det - detection, trv - transport&travel
    //                                   enh - fightmaster&enhancement, pro - protective,
    //                                   cln - clan skills and spells
    function promptAffects(b) {
        var $affects = $('#player-affects');
        affectsPanelHidden = true;

        var dnames = { 'h': 'Скрыт', 'i': 'Невид', 'w': 'ОНевид', 'f': 'Спрят', 'a': 'Камуф', 
            'e': 'Зло', 'g': 'Добро', 'u': 'Нежить', 'm': 'Магия', 'o': 'Диагн', 'l': 'Жизнь', 'r': 'Инфра' };
        drawAffectBlock(b.det, '#pa-detects', 'Обнар', dnames, '2');

        var tnames = {'i':'Невид','h':'Скрыт','F':'Спрят','I':'УНевд','s':'Подкр','f':'Полет','p':'Прозр','m':'МБлок','c':'Камуфл'};
        drawAffectBlock(b.trv, '#pa-travel', 'Трансп', tnames, '2');

        var enames = { 'r': 'Реген','h':'Ускор','g':'ГигСил','l':'Обуч', 'b':'Благос','f':'Неист','B':'Блгсть','i':'Вдохн','c':'Спокой',
                      'C':'Концен','z':'Берсрк','w':'Клич','F':'Лес','m':'МагФок','t':'Тигр','v':'Вампир'};
        drawAffectBlock(b.enh, '#pa-enhance', 'Усилен', enames, '2');

        var pnames = { 'z':'Звезд','s':'ЗащСвя','d':'ТАура','p':'ЗащЩит','e':'Зло','g':'Добро','m':'Заклин',
        'P':'Молит','n':'Негат','a':'Броня','A':'УлБрон','S':'Щит','D':'КжДрак','k':'КамКж','r':'СКамн','c':'Холод','h':'Жар',
        'b':'ЛМыш','F': 'Немощь','E':'Выносл','R':'Радуга','M':'Мантия','Z':'Себат', 'B':'ДревКж'};
        drawAffectBlock(b.pro, '#pa-protect', 'Защита', pnames, '2');
        
        var mnames = {'b': 'Слеп','p':'Яд','P':'Чума','C':'Гниени','f':'ОгФей','W':'Очаров','c':'Прокл','w':'Слабо',
        's':'Замедл','S':'Крик','B':'ЖажКрв','T':'Оглуш','i':'НетРук','I':'Стрела','j':'Сосуд','a':'Анафем','e':'Паут','E':'Терн','r':'КНож','n':'Нервы','y':'Укус','A':'Шипы','l':'Сон'};
        drawAffectBlock(b.mal, '#pa-malad', 'Отриц', mnames, '1');

        var cnames = {'r':'Сопрот','s':'Спелба','B':'ЖажКрв','b':'Повязк','t':'Трофей','T':'Зрение','d':'ОбнЛов','e':'Лев','p':'Предот','f':'Трансф',
        'g':'ЗолАур','h':'СвщБрн','S':'Плащ','D':'Доппел','m':'Зеркал','R':'Рандом','i':'Компро','G':'Гарбл','c':'Конфуз','M':'Наруч','u':'Повест','j':'Тюрьма',
        'J':'НеРули','A':'АураПр' };
        drawAffectBlock(b.cln, '#pa-clan', 'Клан', cnames, '2');

        // Hide main affects window if no affect blocks are displayed.
        if (affectsPanelHidden)
            $affects.hide();
        else
            $affects.show();
    }

    // prompt 'who' fields: p - list of players, v - visible player count,
    // t - total player count.
    // Each player contains fields: n - name, r - first 2 letters of race,
    // cn - first letter of clan name, cc - clan colour.
    function promptWho(b) {
        // Nothing changed since last time.
        if (b.who == undefined) {
            return;
        }

        $('#who').show();
        var body = $('#who tbody');
        body.empty();

        // Nothing in 'who' - shouldn't happen except in very specific cases.
        if (b.who === "none") {
            $('#who').hide();
            return;
        }

        // Translate race and clan to their full names.
        var races = {'ar':'Ариал','ce':'Кентавр','cl':'ОбВелик','da':'ТемЭльф','dr':'Дроу','du':'Дуэргар',
            'dw':'Дварф','el':'Эльф','fa':'Фея','fe':'Фелар','fi':'ОгВелик','fr':'ИнВелик','gi':'Гитианк',
            'gn':'Гном','ha':'ПолЭльф','ho':'Хоббит','hu':'Человек','ke':'Кендер','ma':'Чес','ro':'Роксир',
            'sa':'Сатир','st':'ШтВелик','sv':'Свирф','tr':'Тролль','ur':'Урукха'};
        var clans = {'b':'Ярости','c':'Хаос','e':'Изгои','f':'Цветы','g':'Призраки','h':'Охотники',
            'i':'Захватчики','k':'Рыцари','l':'Львы','o':'Одиночки','r':'Правители','s':'Шалафи', 'n':''};

        // Draw single player line.
        function who_player(wch) {
            var tr = $('<tr/>');

            tr.append($('<td/>').append(wch.n));
            tr.append($('<td/>').append(races[wch.r]));
            if (wch.cn == undefined)
                tr.append($('<td/>').append(""));
            else
                tr.append($('<td/>').append("<span class='fg" + wch.cc + "'>" + clans[wch.cn] + "</span>"));
            return tr;
        }

        // Draw all players.
        b.who.p.forEach(function(wch) {
            body.append(who_player(wch));
        });
    }

    // prompt params fields p1: ps - array of permanent stats, cs - array of current stats.
    // prompt params fields p2: h - hitroll, d - damroll, a - armor class, s - saves vs spell.
    function promptParams(b) {
        var params = $('#player-params'), p1 = $('#player-params-1'), p2 = $('#player-params-2');

        params.show();

        // Redraw stats panel from p1 if changed.
        if (b.p1 !== undefined) {
            // Hidden stats -shouldn't happen.
            if (b.p1 === "none")  {
                p1.hide();
            } else {
                var body = p1.find('tbody'), tr;

                p1.show();
                body.empty();

                tr = $('<tr/>');
                tr.append($('<td/>').append('<b>Сила</b>:')).append($('<td/>').append(b.p1.ps[0] + '&nbsp;(<b>' + b.p1.cs[0] + '</b>)'));
                tr.append($('<td/>').append('<b>Ум</b>:')).append($('<td/>').append(b.p1.ps[1] + '&nbsp;(<b>' + b.p1.cs[1] + '</b>)'));
                body.append(tr);
                tr = $('<tr/>');
                tr.append($('<td/>').append('<b>Мудр</b>:')).append($('<td/>').append(b.p1.ps[2] + '&nbsp;(<b>' + b.p1.cs[2] + '</b>)'));
                tr.append($('<td/>').append('<b>Ловк</b>:')).append($('<td/>').append(b.p1.ps[3] + '&nbsp;(<b>' + b.p1.cs[3] + '</b>)'));
                body.append(tr);
                tr = $('<tr/>');
                tr.append($('<td/>').append('<b>Слож</b>:')).append($('<td/>').append(b.p1.ps[4] + '&nbsp;(<b>' + b.p1.cs[4] + '</b>)'));
                tr.append($('<td/>').append('<b>Обая</b>:')).append($('<td/>').append(b.p1.ps[5] + '&nbsp;(<b>' + b.p1.cs[5] + '</b>)'));
                body.append(tr);
            }
        }

        // Redraw other parameters from p2 if changed.
        if (b.p2 !== undefined) {
            // Hidden stats - for player level below 20.
            if (b.p2 === "none")  {
                p2.hide();
            } else {
                var body = p2.find('tbody'), tr;

                p2.show();
                body.empty();

                tr = $('<tr/>');
                tr.append($('<td/>').append('<b>Точность</b>:')).append($('<td/>').append(b.p2.h));
                tr.append($('<td/>').append('<b>Урон</b>:')).append($('<td/>').append(b.p2.d));
                body.append(tr);
                tr = $('<tr/>');
                tr.append($('<td/>').append('<b>Броня</b>:')).append($('<td/>').append(b.p2.a));
                tr.append($('<td/>').append('<b>Заклин</b>:')).append($('<td/>').append(b.p2.s));
                body.append(tr);
            }
        }
    }

    // prompt questor quest info 'q' fields: t - remaining time, i - short quest info.
    function promptQuestor(b) {
        // Nothing changed since last time.
        if (b.q == undefined) {
            return;
        }

        // Questor panel is now hidden.
        if (b.q === "none") {
            $('#questor').hide();
            return;
        } 

        $('#questor').show();
        // Draw quest time in the header.
        $('#quest-time').text(b.q.t);
        // Draw quest info.
        $('#questor-table p').text(b.q.i);
    }

    // prompt 'group' fields: ln - leader name in genitive case,
    // leader - leader stats to display as a first line,
    // pc - list of all remaining PCs, npc - all NPCs in the group.
    // Each line format: sees - name, level, health - hitpoints percentage, hit_clr - color to display health with
    // tnl - exp to next level.
    function promptGroup(b) {
        // Nothing changed since last time.
        if (b.group == undefined) {
            return;
        }

        // Group is now hidden: shouldn't happen as the leader is always shown.
        if (b.group === "none") {
            $('#group').hide();
            return;
        }

        $('#group').show();
        $('#g_leader').text(b.group.ln);
        var body = $('#group tbody');
        body.empty();

        // Function to display a row with individual group member.
        function group_member(gch) {
            var tr = $('<tr/>');
            tr.append($('<td/>').append(gch.sees));
            tr.append($('<td/>').append(gch.level));
            tr.append($('<td/>').append($('<span/>').addClass('fg-ansi-bright-color-'+gch.hit_clr).append(gch.health + "%")));
            tr.append($('<td/>').append(gch.tnl));
            return tr;
        }

        // Display rows for all PCs and NPCs.
        body.append(group_member(b.group.leader));
        if (b.group.pc !== undefined)
            b.group.pc.forEach(function(gch) {
                body.append(group_member(gch));
            });

        if (b.group.npc !== undefined)
            b.group.npc.forEach(function(gch) {
                body.append(group_member(gch));
            });
    }


    // Main prompt handler, triggered from websock.js.
    $('#rpc-events').on('rpc-prompt', function(e, b) {
        // Remember merged prompt here, so that valid latest prompt
        // is always available to user scripts.
        if (window.mudprompt === undefined)
            window.mudprompt = b;
        else
            $.extend(window.mudprompt, b);

        // First prompt sent - show time and 'where' windows.
        $('#player-location').show();
        $('#help').show();
        $('#who').show();
        // Display control panel with buttons.
        $('#commands').show();

        // Handle all prompt fields.
        promptGroup(b);
        promptAffects(b);
        promptWho(b);
        promptParams(b);
        promptQuestor(b);
    });
});
