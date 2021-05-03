import Commands, { echoHtml, clickableLink, parseStringCmd, getSystemCmd, errCmdDoesNotExist, getSystemCmdAliases } from '../SysCommands'


export const helpHelp = {
    title: `Получить справку по встроенным командам, подробнее ${clickableLink('#help help')}`,
    description: `Команда ${clickableLink('#help')} позволяет получить справку по встроенным командам.
Синтаксис:
#help - вывести список доступных команд
#help command - подробная справка по команде command
\n`
}


const help = (cmd) => {
    const command = getSystemCmd(cmd)
    if (!command) return echoHtml(errCmdDoesNotExist)
    echoHtml(Commands[command]['help']['description'])
}

const helpList = () => {
    let list = `Список доступных команд: \n`
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