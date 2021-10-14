import $ from 'jquery';
import hotkeyCmd, { hotkeyHelp } from './sysCommands/hotkey'
import propertiesCmd, { settingsHelp } from './sysCommands/userProperties'
import helpCmd, { helpHelp } from './sysCommands/help'
import varCmd, { varHelp } from './sysCommands/var'
import deleteCmd, { deleteHelp } from './sysCommands/delete'
import actionCmd, { actionHelp } from './sysCommands/action'

const multiCmdHelp = {
    title: `Выполнить указанную команду несколько раз, подробнее ${clickableLink('#help multiCmd')}`,
    description: `Синтаксис:
#number action - выполнить команду action указанное число раз (number)

Примеры:
#10 новость
#3 сбежать|возврат

`
}

const cmdAliases = {
    'удалить' : 'delete',
    'справка' : 'help',
    'кнопка' : 'hotkey',
    'настройки' : 'settings',
    'переменная' : 'var',
    'действие' : 'action'
}

const Commands = {
    action: {
        payload: function(value) {
            actionCmd(value)
        },
        help: {
            title: actionHelp.title,
            description: actionHelp.description
        }
    },
    help: {
        payload: function(value) {
            helpCmd(value)
        },
        help: {
            title: helpHelp.title,
            description: helpHelp.description
        }
    },
    hotkey: {
        payload: function(value) {
            hotkeyCmd(value)
        },
        help: {
            title: hotkeyHelp.title,
            description: hotkeyHelp.description
        }
    },
    var: {
        payload: function(value) {
            varCmd(value)
        },
        help: {
            title: varHelp.title,
            description: varHelp.description
        }
    },
    multiCmd: {
        payload: function(value) {
            const { sysCmd, sysCmdArgs } = splitCommand(value)
            for (let i = 0; i < parseInt(sysCmd); i++) {
                $('.trigger').trigger('input', ['' + sysCmdArgs.trim()]);
            }
        },
        help: multiCmdHelp
    },
    settings: {
        payload: function(value) {
            propertiesCmd(value)
        },
        help: {
            title: settingsHelp.title,
            description: settingsHelp.description
        }
    },
    delete: {
        payload: function(value) {
            deleteCmd(value)
        },
        help: {
            title: deleteHelp.title,
            description: deleteHelp.description
        }
    }
}

export function getSystemCmd(cmd) {
    const re = new RegExp(cmd)
    for (let command in Commands) {
        if (re.test(command)) {
            return command
        }
    }
    for (let command in cmdAliases) {
        if (re.test(command)) {
            return cmdAliases[command]
        }
    }
}

export function getSystemCmdAliases(cmd) {
    let string = ''
    let aliases = []
    for (let alias in cmdAliases) {
        if (cmdAliases[alias] === cmd) {
            aliases.push(alias)
        }
    }
    if(aliases[0]) {
        string += '( '
        for (let i = 0; i < aliases.length; i++) {
            string += `${clickableLink('#' + aliases[i])} `
        }
        string += ') '
    }
    return string
}

export const errCmdDoesNotExist = `Этой команды не существует, набери ${clickableLink('#help')} для получения списка доступных команд. \n`

export function clickableLink(cmd) {
    return `<span class="builtin-cmd manip-link" data-action="${cmd}" data-echo="${cmd}">${cmd}</span>`
}

export function parseStringCmd(value) {
    const stringCmd = value.trim().split(' ')
    return stringCmd
}

export function splitCommand(value) {
    const sysCmd = value.split(' ')[0].substr(1);
    const sysCmdArgs = value.split(' ').slice(1).join(' ');
    return {
        sysCmd: sysCmd,
        sysCmdArgs: sysCmdArgs
    }
}

export function echoHtml(html) {
    if (!html) return
    $('.terminal').trigger('output-html', html)
}

export default  Commands