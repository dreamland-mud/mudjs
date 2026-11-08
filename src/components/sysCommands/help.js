import Commands, { echoHtml, clickableLink, parseStringCmd, getSystemCmd, errCmdDoesNotExist, getSystemCmdAliases } from '../SysCommands'
import { st } from './strings'


export const helpHelp = {
    get title() { return st('sys.help.title', clickableLink('#help help')) },
    get description() { return st('sys.help.desc', clickableLink('#help')) },
};


const help = (cmd) => {
    const command = getSystemCmd(cmd)
    if (!command) return echoHtml(errCmdDoesNotExist())
    echoHtml(Commands[command]['help']['description'])
}

const helpList = () => {
    let list = st('sys.help.list')
    for (let command in Commands) {
        const aliases = getSystemCmdAliases(command)
        list += `${clickableLink('#' + command)} `
        if (aliases) {
            list += `${aliases}`
        }
        list += `:  ${Commands[command]['help']['title']}\n`
    }
    list += '\n';
    echoHtml(list)
}

const helpCmd = (value) => {
    const stringCmd = parseStringCmd(value)
    if (!stringCmd[0]) return helpList()
    return help(stringCmd[0])
}

export default helpCmd