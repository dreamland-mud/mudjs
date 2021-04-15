import $ from 'jquery';
import { echo } from '../input';
import hotkeyCmd from './sysCommands/hotkey'
import propertiesCmd from './sysCommands/userProperties'

const Commands = {
    hotkey: function(value) {
        hotkeyCmd(value)
    },
    multiCmd: function(value) {
        const { sysCmd, sysCmdArgs } = splitCommand(value)
        echo(value)
        for (let i = 0; i < parseInt(sysCmd); i++) {
            $('.trigger').trigger('input', ['' + sysCmdArgs.trim()]);
        }
    },
    settings: function(value) {
        propertiesCmd(value)
    }
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

export default  Commands