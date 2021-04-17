import { echo } from '../../input';
import { send } from '../../websock';
import { parseStringCmd, echoHtml, clickableLink } from '../SysCommands'

var keycode = require("keycode")

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

В качестве key можно использовать буквы, цифры, функциональные клавиши f1-f12, клавиши кейпада kp0-kp9.
Доступны комбинации с участием ctrl, alt, shift. Например: ctrl+a, alt+9

Пример для стрелки "вниз" на кейпаде: просто стрелка -- идти на юг, alt+стрелка -- бежать до упора на юг, shift+стрелка -- пристально смотреть на юг.
#hotkey kp2 ю
#hotkey alt+kp2 бежать Ю
#hotkey shift+kp2 всмотр ю

Пример клавиши, выполняющей несколько команд сразу:
#hotkey f1 сбежать | сбежать | возврат

`
}

const hotkeyStorage = localStorage.hotkey ? JSON.parse(localStorage.hotkey) : {};
const metaKeys = ['ctrl', 'alt', 'shift', 'meta', 'tab', 'backspace', 'enter']

const errHotkey = `Набери ${clickableLink('#help hotkey')} для справки`

const checkCombinedKey = (rawKey) => {
    let key = rawKey.split('+')
    let err
    if (key.length > 2) return  { key, err : `В комбинации может быть только две клавиши. ${errHotkey}` }
    
    if (!keycode(key[key.length-1]) || metaKeys.includes(key[key.length-1])) {
        err = `Недопустимый ключ. ${errHotkey}`
    }
    if (!keycode(key[0]) || !metaKeys.slice(0,3).includes(key[0])) {
        err = `Недопустимый комманд-ключ. ${errHotkey}`
    }
    key = key.join('+').toLowerCase()

    return { key, err }
} 

const checkKey = rawKey => {
    rawKey = rawKey.toLowerCase()
    let key = []
    let err = ''
    if (rawKey.indexOf('+') !== -1) {
        return checkCombinedKey(rawKey)
    }
    if (keycode(rawKey) && !metaKeys.includes(rawKey)) return { key: rawKey, err}
    return { key, err: `Недопустимый ключ. ${errHotkey}`}
}

const hotkeyCmdDelete = rawKey => {
    const { key, err } = checkKey(rawKey)

    if (err) return echoHtml(err)

    if (hotkeyStorage[key]){
        delete hotkeyStorage[key]
        localStorage.hotkey = JSON.stringify(hotkeyStorage)
        echoHtml(key + ' удален из списка.')
        return
    }
    
    return echoHtml(key + ' не найден в списке.')
}

const hotkeyCmdAdd = stringCmd => {
    const { key, err } = checkKey(stringCmd[0])
    
    if (err) return echoHtml(err)

    if (!hotkeyStorage[key]) {
        hotkeyStorage[key] = stringCmd.slice(1).join(' ')
        localStorage.hotkey = JSON.stringify(hotkeyStorage)
        echoHtml('Команда для ' + key + ' добавлена.' )
        return
    } 

    return echoHtml(`Этот ключ уже существует, набери <span class="builtin-cmd manip-link" data-action="#hotkey ${key}" data-echo="#hotkey ${key}">#hotkey ${key}</span> для удаления`)
}

const hotkeyCmdList = () => {
    let hotkeyList = 'Список хоткеев: \n'
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

export function sendHotKeyCmd(cmd) {
    echo(cmd)
    send(cmd)
}

export default hotkeyCmd