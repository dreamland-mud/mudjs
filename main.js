
var PROTO_VERSION = 'DreamLand Web Client/1.3';
var rpccmd = function() {}, send = function() {}, notify = function() {};
var wsUrl = "wss://dreamland.rocks/dreamland";

if(location.hash === '#build') {
    wsUrl = "wss://dreamland.rocks/buildplot";
} else if(location.hash === '#local') {
    wsUrl = "ws://localhost:1234";
}
    var lastLocation, locationChannel;

$(window).bind('beforeunload', function() {
    return 'leaving already?';
});

$(document).ready(function() {
    if('BroadcastChannel' in window) {
        locationChannel = new BroadcastChannel('location');

        locationChannel.onmessage = function(e) {
            if(e.data.what === 'where am i' && lastLocation) {
                bcastLocation();
            }
        };
    }

    function bcastLocation() {
        if(locationChannel) {
            locationChannel.postMessage({
                what: 'location',
                location: lastLocation
            });
        }
    }

    $('#map-button').click(function(e) {
        if(!lastLocation) {
            e.preventDefault();
            return;
        }

        var mapfile = '/maps/' + lastLocation.area.replace(/\.are$/, '') + '.html?1';
        window.open(mapfile);
        e.preventDefault();
    });

    function process(s) {
        $('#terminal').trigger('output', [s]);

        // dont autofocus if modal dialog is present
        if($('body.modal-open').length == 0)
            $('#input input').focus();
    }

    function promptLocation(b) {
        lastLocation = {
            area: b.area,
            vnum: b.vnum
        };
        bcastLocation();
    }

    // prompt time fields: h - hour, tod - time of day, l - daylight
    function promptTime(b) {
        var $row = $('#tw-time');

        // Time is unchanged since last prompt.
        if (b.time === undefined)
            return;
        // Time is now hidden.
        if (b.time === "none") {
            $row.hide();
            return;
        }

        // Display time.
        $row.show();
        $row.find('i').removeClass().addClass("wi wi-fw wi-time-" + b.time.h);

        var txt = b.time.h + " " + b.time.tod;
        // Daylight can be hidden.
        if (b.time.l !== undefined)
            txt = txt + ", " + b.time.l;
        $row.find('span').text(txt);
    }

    // prompt date fields: d - day, m - month, y - year
    function promptDate(b) {
        var $row = $('#tw-date');

        // Date is unchanged since last prompt.
        if (b.date === undefined)
            return;
        // Date is now hidden.
        if (b.date === "none") {
            $row.hide();
            return;
        }

        // Display date.
        $row.show();
        $row.find('span').text(b.date.d + " / " + b.date.m + " / " + b.date.y);
    }

    // prompt weather (w) fields: i - icon to use, m - weather message
    function promptWeather(b) {
        var $row = $('#tw-weather');

        // Weather is unchanged since last prompt.
        if (b.w === undefined)
            return;
        // Weather is now hidden.
        if (b.w === "none") {
            $row.hide();
            return;
        }

        // Display weather.
        $row.show();
        $row.find('i').removeClass().addClass("wi wi-fw wi-" + b.w.i);
        $row.find('span').text(b.w.m);
    }

    // prompt zone field: string with area name
    function promptZone(b) {
        var $row = $('#pl-zone');

        // Zone is unchanged since last prompt.
        if (b.zone === undefined)
            return;
        // Zone is now hidden.
        if (b.zone === "none") {
            $row.hide();
            return;
        }

        // Display zone name.
        $row.show();
        $row.find('span').text(b.zone);
    }

    // prompt room field: string with room name
    function promptRoom(b) {
        var $row = $('#pl-room');

        // Room is unchanged since last prompt.
        if (b.room === undefined)
            return;
        // Room is now hidden.
        if (b.room === "none") {
            $row.hide();
            return;
        }

        // Display room name.
        $row.show();
        $row.find('span').text(b.room);
    }

    // prompt exits fields: e - visible exits, h - hidden exits (perception),
    // l - language (r, e)
    function promptExits(b) {
        var $row = $('#pl-exits');

        // Exits are unchanged since last prompt.
        if (b.exits === undefined)
            return;
        // Exits are now hidden.
        if (b.exits === "none") {
            $row.hide();
            return;
        }

        // Display visible and hidden exits.
        $row.show();

        function markExit(ex_ru, ex_en) {
            var exit = ex_en.toLowerCase();
            var $node = $row.find('#ple-' + exit);
            // See if this exit letter is among hidden exits.
            var hidden = b.exits.h.indexOf(exit) !== -1;
            // See if this exit letter is among visible exits.
            var visible = b.exits.e.indexOf(exit) !== -1;
        
            $node.removeClass();
            // If found anywhere, draw a letter of selected language, otherwise a dot.
            if (hidden || visible) {
                $node.text(b.exits.l === 'r' ? ex_ru : ex_en);
            } else {
                $node.text("\u00B7");
            }
            // Mark hidden exits with default color, other exits with bright blue.
            if (!hidden)
                $node.addClass('fg-ansi-bright-color-6');
        }
       
        markExit('С', 'N');
        markExit('В', 'E');
        markExit('Ю', 'S');
        markExit('З', 'W');
        markExit('О', 'D');
        markExit('П', 'U');
    }

    // prompt sector fields: s - sector type, l - light 
    function promptSector(b) {
        // Later if needed. Showing sector type everywhere will discover a lot of funny things.
    }

    function promptStats(b) {
        $('#stats').show();
        
        function stat($node, value, max) {
            $node.find('.fill').css({ width: (100*value/max) + '%' });
            $node.find('.value').text(value + ' / ' + max);
        }

        stat($('#stats .hit'), b.hit, b.max_hit);
        stat($('#stats .mana'), b.mana, b.max_mana);
        stat($('#stats .move'), b.move, b.max_move);
    }

    // prompt det field: a - active detection bits, z - bits from affects with zero duration
    function promptDetection(b) {
        var clr_active = 'fg-ansi-bright-color-2';
        var clr_zero = 'fg-ansi-dark-color-2';
        var $row = $('#player-detect');
        var $bitvector = $row.find('.bitvector');
        var names = { 'h': 'Скрыт', 'i': 'Невид', 'w': 'ОНев', 'f': 'Спрят', 'a': 'Кмф', 
            'e': 'Зло', 'g': 'Дбр', 'u': 'Неж', 'm': 'Маг', 'o': 'Диаг', 'l': 'Жзн', 'r': 'Инфр' };

        // Nothing changed since last time.
        if (b.det == undefined) {
            return;
        }

        // Detects are now hidden.
        if (b.det === "none") {
            $row.removeClass('d-md-block');
            $bitvector.empty();
            return;
        } 

        $row.addClass('d-md-block');
        $bitvector.empty();

        for (var bit in names) {
            if (names.hasOwnProperty(bit)) {
                var clr;

                if (b.det.z.indexOf(bit) !== -1)
                    clr = clr_zero;
                else if (b.det.a.indexOf(bit) !== -1)
                    clr = clr_active;
                else
                    continue;

                $bitvector.append($('<span/>')).addClass(clr).append(names[bit]);
                $bitvector.append(', ');
            }
        }
    }

    function promptGroup(b) {
        // Nothing changed since last time.
        if (b.group == undefined) {
            return;
        }

        // Group is now hidden.
        if (b.group === "none" || (b.group.pc == undefined && b.group.npc == undefined)) {
            $('#group').removeClass('d-md-block');
            return;
        } 

        $('#group').addClass('d-md-block');
        $('#g_leader').text(b.group.leader.sees);

        var body = $('#group tbody');
        body.empty();
        
        function group_member(gch) {
            var tr = $('<tr/>');
            tr.append($('<td/>').append(gch.sees));
            tr.append($('<td/>').append(gch.level));
            tr.append($('<td/>').append($('<span/>').addClass('fg-ansi-bright-color-'+gch.hit_clr).append(gch.health + "%")));
            tr.append($('<td/>').append(gch.tnl));
            return tr;
        }

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

    function connect() {
        ws = new WebSocket(wsUrl, ['binary']);

        var telnet = new Telnet();

        telnet.handleRaw = function(s) {
            process(s);
        }

        var handlers = {
            'console_out': function(b) {
                telnet.process(b);
            },
            'notify': function(b) {
                notify(b);
            },
            'alert': function(b) {
                alert(b);
            },
            'prompt': function(b) {
                promptGroup(b);
                promptLocation(b);
                promptZone(b);
                promptRoom(b);
                promptExits(b);
                promptTime(b);
                promptDate(b);
                promptWeather(b);
                promptSector(b);
                promptDetection(b);
// TODO rework: promptStats(b);
            },
            'version': function(b) {
                if(b !== PROTO_VERSION) {
                    process('\n\u001b[1;31mВерсия клиента (' + PROTO_VERSION + ') не совпадает с версией сервера (' + b + ').\n' +
                            'Обнови страницу, если не поможет - почисти кеши.\n');
                    ws.close();
                }
            },
            'editor_open': function(b) {
                texteditor(b)
                    .then(function(text) {
                        rpccmd('editor_save', text);
                    });
            },
            'cs_edit': function(subj, body) {
                csEdit(subj, body);
            }
        };

        ws.binaryType = 'arraybuffer';
        ws.onmessage = function(e) {
            var b = new Uint8Array(e.data);
            b = String.fromCharCode.apply(null, b);
            b = decodeURIComponent(escape(b));
            b = JSON.parse(b);
            var h = handlers[b.command];
            if(h) {
                h.apply(handlers, b.args);
            } else {
                console.log('Dont know how to handle ' + b.command);
            }
        }
        ws.onopen = function(e) {
            send('1'); // use internal encoding (koi8). All WebSocket IO is converted to/from UTF8 at the transport layer.
        }
        ws.onclose = function(e) {
            process('\u001b[1;31m#################### DISCONNECTED ####################\n');
            $('#reconnect').show();
            $('#input input').hide();
            ws = null;
        }

        rpccmd = function(cmd) {
            ws.send(JSON.stringify({
                command: cmd,
                args: Array.prototype.slice.call(arguments, 1)
            }));
        }

        send = function(text) {
            rpccmd('console_in', text + '\n');
        }

        process('Connecting....\n');
        $('#reconnect').hide();
        $('#input input').show();
    }

    connect();

    $('#reconnect').click(function(e) {
        e.preventDefault();
        connect();
    });

    $('body').on('keydown', function(e) {
        var input = $('#input input');

        // dont autofocus if modal dialog is present
        if($('body.modal-open').length != 0)
            return;

        if(e.ctrlKey || e.altKey)
            return;

        if(input.is(':focus'))
            return;

        input.focus();
    });


    if('Notification' in window) {
        Promise.resolve(Notification.permission)
            .then(function(perm) {
                if(perm === 'granted') {
                    return perm;
                } else {
                    return Notification.requestPermission();
                }
            })
            .then(function(perm) {
                if(perm === 'granted') {
                    notify = function(text) {
                        if(document.hidden) {
                            new Notification(text);
                        }
                    }
                }
            });
    }
});

