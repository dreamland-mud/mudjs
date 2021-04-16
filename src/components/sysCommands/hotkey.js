import { echo } from '../../input';
import { send } from '../../websock';
import { parseStringCmd, echoHtml, clickableLink } from '../SysCommands'

var keycode = require("keycode")

export const hotkeyHelp = {
    title: `Присвоить команду для горячей клавиши, подробнее ${clickableLink('#help hotkey')}`,
    description: `
Команда #hotkey позволяет привязывать хоткеи для игровых команд.
Синтаксис:
#hotkey - вывести список назначенных хоткеев
#hotkey {key} - удалить хоткей {key} из списка
#hotkey {key} {action} - привязать комаду {action} к хоткею {key} 

В качестве {action} могут использоваться игровые команды доступные в мире.

В качестве {key} можно использовать буквы, цифры, функциональные клавиши f1-f10, клавиши кейпада kp0-kp9.
Доступны комбинации с ctrl, alt, shift. Например: ctrl+a, alt+9

Пример использования:

#hotkey f1 say Luke, I'm your papi!
#hotkey ctrl+a say Ay dios mio, NOOOO!!!!

Чтобы удалить:
#hotkey f1
#hotkey ctrl+a
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