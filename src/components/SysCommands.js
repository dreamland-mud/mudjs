import $ from 'jquery';
import { parseStringCmd, clickableLink, echoHtml } from './sysCommandUtils'
export { parseStringCmd, clickableLink, echoHtml }
import hotkeyCmd, { hotkeyHelp } from './sysCommands/hotkey'
import propertiesCmd, { settingsHelp } from './sysCommands/userProperties'
import helpCmd, { helpHelp } from './sysCommands/help'
import varCmd, { varHelp } from './sysCommands/var'
import deleteCmd, { deleteHelp } from './sysCommands/delete'
import actionCmd, { actionHelp } from './sysCommands/action'
import autobuffCmd, { autobuffHelp } from './sysCommands/autobuff'
import reviewCmd, { reviewHelp } from './sysCommands/review'
import { st } from './sysCommands/strings'
import { getLang } from '../i18n'

const multiCmdHelp = {
    get title() { return st('sys.multi.title', clickableLink('#help multiCmd')) },
    get description() { return st('sys.multi.desc') },
}

// Other names of the commands, per display language. Any of them works
// whatever the language; the help lists only the ones of the player's own.
const ALIASES = {
    ru: {
        'удалить' : 'delete',
        'справка' : 'help',
        'кнопка' : 'hotkey',
        'настройки' : 'settings',
        'переменная' : 'var',
        'действие' : 'action',
        'автобафф' : 'autobuff',
        'чтение' : 'review',
        'инструменты' : 'tools'
    },
    ua: {
        'видалити' : 'delete',
        'довідка' : 'help',
        'кнопка' : 'hotkey',
        'налаштування' : 'settings',
        'змінна' : 'var',
        'дія' : 'action',
        'автобаф' : 'autobuff',
        'читання' : 'review',
        'інструменти' : 'tools'
    }
}
const cmdAliases = { ...ALIASES.ru, ...ALIASES.ua }

const Commands = {
    autobuff: {
        payload: function(value) {
            autobuffCmd(value)
        },
        help: autobuffHelp
    },
    action: {
        payload: function(value) {
            actionCmd(value)
        },
        help: actionHelp
    },
    help: {
        payload: function(value) {
            helpCmd(value)
        },
        help: helpHelp
    },
    hotkey: {
        payload: function(value) {
            hotkeyCmd(value)
        },
        help: hotkeyHelp
    },
    var: {
        payload: function(value) {
            varCmd(value)
        },
        help: varHelp
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
        help: settingsHelp
    },
    review: {
        payload: function(value) {
            reviewCmd(value)
        },
        help: reviewHelp
    },
    delete: {
        payload: function(value) {
            deleteCmd(value)
        },
        help: deleteHelp
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
    const own = ALIASES[getLang()] || {}
    for (let alias in own) {
        if (own[alias] === cmd) {
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

// A function: the text follows the player's display language.
export const errCmdDoesNotExist = () => st('sys.nocmd', clickableLink('#help'))

export function splitCommand(value) {
    const sysCmd = value.split(' ')[0].substr(1);
    const sysCmdArgs = value.split(' ').slice(1).join(' ');
    return {
        sysCmd: sysCmd,
        sysCmdArgs: sysCmdArgs
    }
}

export default  Commands