import Commands, { echoHtml, clickableLink, parseStringCmd } from '../SysCommands'


export const helpHelp = {
    title: `Получить справку по встроенным командам, подробнее ${clickableLink('#help help')}`,
    description: `
Команда #help позволяет получить справку по встроенным командам.
Синтаксис:
#help - вывести список доступных команд
#help {command} - подробная справка по команде {command}
`
}


const help = (cmd) => {
    const re = new RegExp(cmd)
    for (let command in Commands) {
        if (re.test(command)) {
            echoHtml(Commands[command]['help']['description'])
        }
    }
}

const helpList = () => {
    let list = `Список доступных команд: \n`
    for (let i in Commands) {
        list += (`${clickableLink('#' + i)} :  ${Commands[i]['help']['title']}\n`)
    }
    echoHtml(list)
}

const helpCmd = (value) => {
    const stringCmd = parseStringCmd(value)
    if (!stringCmd[0]) return helpList()
    return help(stringCmd[0])
}

export default helpCmd