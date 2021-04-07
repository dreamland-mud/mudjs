import $ from 'jquery';
import { echo } from '../input';
import { send } from '../websock';

var keycode = require("keycode")

const hotkeyStorage = localStorage.hotkey ? JSON.parse(localStorage.hotkey) : {};
const metaKeys = ['ctrl', 'alt', 'shift', 'meta', 'tab', 'backspace', 'enter']

const parseStringCmd = (value) => {
    const stringCmd = value.trim().split(' ')
    return stringCmd
}

const checkKey = (rawKey) => {
    rawKey.toLowerCase()
    let key = []
    let err = ''
    if (rawKey.indexOf('+') !== -1) {
        key = rawKey.split('+')
        if (key.length > 2) {
            echo('В комбинации может быть только две клавиши')
        } else {
            if (!keycode(key[key.length-1]) || metaKeys.includes(key[key.length-1])) {
                err = 'Недопустимый ключ. '
            }
            if (!keycode(key[0]) || !metaKeys.slice(0,3).includes(key[0])) {
                err = err + 'Недопустимый комманд-ключ'
            }
            key = key.join('+').toLowerCase()
        }
    } else {
        if (keycode(rawKey) && !metaKeys.includes(rawKey)) {
            key = rawKey
        } else {
            err = 'Недопустимый ключ.'
        }

    }
    return {
        key: key,
        err: err
    }
}

const hotkeyCmdDelete = (rawKey) => {
    const { key, err } = checkKey(rawKey)
    console.log(err)
    if (err) {
        echo(err)
    } else {
        if (hotkeyStorage[key]){
            delete hotkeyStorage[key]
            localStorage.hotkey = JSON.stringify(hotkeyStorage)
            echo(key + ' удален из списка.')
        } else {
            echo(key + ' не найден в списке.')
        }
    }
}

const hotkeyCmdAdd = (stringCmd) => {
    const { key, err } = checkKey(stringCmd[0])
    if (err) {
        echo(err)
    } else {
        if (!hotkeyStorage[key]) {
            hotkeyStorage[key] = stringCmd.slice(1).join(' ')
            localStorage.hotkey = JSON.stringify(hotkeyStorage)
            echo('Команда для ' + key + ' добавлена.' )
        } else {
            echo('Такой ключ уже существует')
        }
    }
}

function hotkeyCmdList() {
    let hotkeyList = ''
    for (let i in hotkeyStorage) {
        hotkeyList = hotkeyList + i + ' : ' +  hotkeyStorage[i] + '\n'
    }
    echo(hotkeyList)
}

function hotkeyCmd(value) {
    const stringCmd = parseStringCmd(value)
    if (!stringCmd[0]) {
        hotkeyCmdList()
    } else if (stringCmd.length === 1) {
        hotkeyCmdDelete(stringCmd[0])
    } else {
        hotkeyCmdAdd(stringCmd)
    }
}

const Commands = {
    hotkey: function(value) {
        hotkeyCmd(value)
    },
    multiCmd: function(value) {
        const { sysCmd, sysCmdArgs } = splitCommand(value)
        for (let i = 0; i < parseInt(sysCmd); i++) {
            $('.trigger').trigger('input', ['' + sysCmdArgs.trim()]);
        }
    }
}

export function splitCommand(value) {
    const sysCmd = value.split(' ')[0].substr(1);
    const sysCmdArgs = value.split(' ').slice(1).join(' ');
    return {
        sysCmd: sysCmd,
        sysCmdArgs: sysCmdArgs
    }
}

export function sendHotCmd(cmd) {
    send(cmd)
}

export default  Commands