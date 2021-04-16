import $ from 'jquery';
import hotkeyCmd, { hotkeyHelp } from './sysCommands/hotkey'
import propertiesCmd, { settingsHelp } from './sysCommands/userProperties'
import helpCmd, { helpHelp } from './sysCommands/help'

const multiCmdHelp = {
    title: `Выполнить указанную команду несколько раз, подробнее ${clickableLink('#help multiCmd')}`,
    description: `
Синтаксис:
#{number} {action} - выполнить команду {action} указанное число раз {number}

Пример:
#3 say too too
`
}

const Commands = {
    hotkey: {
        payload: function(value) {
            hotkeyCmd(value)
        },
        help: {
            title: hotkeyHelp.title,
            description: hotkeyHelp.description
        }
    },
    multiCmd: {
        payload: function(value) {
            const { sysCmd, sysCmdArgs } = splitCommand(value)
            for (let i = 0; i < parseInt(sysCmd); i++) {
                $('.trigger').trigger('input', ['' + sysCmdArgs.trim()]);
            }
        },
        help: {
            title: multiCmdHelp.title
        }
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
    help: {
        payload: function(value) {
            helpCmd(value)
        },
        help: {
            title: helpHelp.title,
            description: helpHelp.description
        }
    }
}

export const errCmdDoesNotExist = `Этой команды не существует, набери ${clickableLink('#help')} для получения списка доступных команд.`

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