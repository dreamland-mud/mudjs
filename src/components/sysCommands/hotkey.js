import { echo } from '../../input';
import { send } from '../../websock';
import { parseStringCmd, echoHtml, clickableLink } from '../SysCommands'
import keycode from "./keycode"

// TODO: List all accepted key codes, after testing all combinations.
export const hotkeyHelp = {
    title: `Присвоить команду для горячей клавиши, подробнее ${clickableLink('#help hotkey')}`,
    description: `Команда #hotkey позволяет назначать горячие клавиши для игровых команд.
Синтаксис:
#hotkey            - вывести список назначенных клавиш
#hotkey key        - удалить клавишу key из списка
#hotkey key action - привязать команду action к клавише key

В качестве action могут использоваться любые игровые команды, в том числе перечисленные через разделитель команд |. 
Если нужно задать более сложные реакции на нажатую клавишу с использованием JavaScript, используйте функцию keydown в редакторе настроек (шестеренка вверху экрана).

В качестве key можно использовать маленькие буквы, цифры, знаки препинания, функциональные клавиши f1-f12, клавиши кейпада kp0-kp9, kp*, kp-, kp+, kp., kp/, стрелки up down left right, клавиши ins del home end pgup pgdown.
Доступны комбинации с участием ctrl, alt, shift. Например: ctrl+a, alt+9. Далеко не все клавиши и комбинации удобны к использованию в браузере.

Пример для стрелки "вниз" на кейпаде: просто стрелка -- идти на юг, alt+стрелка -- бежать до упора на юг, shift+стрелка -- пристально смотреть на юг.
#hotkey kp2 ю
#hotkey alt+kp2 бежать Ю
#hotkey shift+kp2 всмотр ю

Пример клавиши, выполняющей несколько команд сразу:
#hotkey f1 сбежать | сбежать | возврат

`
}

const hotkeyStorage = localStorage.hotkey ? JSON.parse(localStorage.hotkey) : {};

const errHotkey = `Набери ${clickableLink('#help hotkey')} для справки.\n`

const checkKey = rawKey => {
    let key = rawKey.toLowerCase().replace(/\s/g, '');
    let err = ''

    let combos = key.match(/^(ctrl|alt|shift)\+(.+)$/);
    if (combos && combos.length > 2) {
        if (!keycode(combos[2])) 
            err = `Код клавиши ${combos[2]} не найден. ${errHotkey}\n`;

    } else if (!keycode(key)) {
        if (key.match(/^[a-z]+\+./))
            err = `В комбинации клавиш можно использовать только ctrl, alt или shift.\n`;
        else
            err = `Код клавиши ${key} не найден. ${errHotkey}\n`;
    }

    return {key, err};
}

const hotkeyCmdDelete = key => {
    if (hotkeyStorage[key]){
        delete hotkeyStorage[key]
        localStorage.hotkey = JSON.stringify(hotkeyStorage)
        echoHtml(`Горячая клавиша ${key} удалена из списка.\n`)
        return
    }
    
    return echoHtml(`Такая горячая клавиша не задана.\n`)
}

const hotkeyCmdAdd = stringCmd => {
    const { key, err } = checkKey(stringCmd[0])
    
    if (err) return echoHtml(err)

    if (!hotkeyStorage[key]) {
        hotkeyStorage[key] = stringCmd.slice(1).join(' ')
        localStorage.hotkey = JSON.stringify(hotkeyStorage)
        echoHtml('Команда для ' + key + ' добавлена.\n' )
        return
    } 

    return echoHtml(`Этот ключ уже существует, набери <span class="builtin-cmd manip-link" data-action="#hotkey ${key}" data-echo="#hotkey ${key}">#hotkey ${key}</span> для удаления.\n`)
}

const hotkeyCmdList = () => {
    let hotkeyList = 'Список горячих клавиш: \n'
    for (let i in hotkeyStorage) {
        hotkeyList = hotkeyList + i + ' : ' +  hotkeyStorage[i] + '\n'
    }
    echoHtml(hotkeyList)
}

const hotkeyCmd = value => {
    const stringCmd = parseStringCmd(value)
    if (!stringCmd[0]) return hotkeyCmdList()
    if (stringCmd.length === 1) return hotkeyCmdDelete(stringCmd[0])
    return hotkeyCmdAdd(stringCmd)
}

// Translate keyboard event into a symbolic name for a hotkey and run it, if defined in the storage.
export function sendHotKeyCmd(e) {
    const hotkey = keycode.hotkey(e);

    if (!hotkey)
        return false;

    const cmd = hotkeyStorage[hotkey];
    if (cmd) {
        e.stopPropagation();
        e.preventDefault();        
        echo(cmd)
        send(cmd)
        return true;
    }

    return false;
}

export default hotkeyCmd