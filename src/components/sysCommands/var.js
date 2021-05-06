import { parseStringCmd, echoHtml, clickableLink } from '../SysCommands'

export const varHelp = {
    title: `Позволяет создать переменную с указанным значением, подробнее ${clickableLink('#help var')}`,
    description: `Команда ${clickableLink('#var')} позволяет создавать переменные.
Синтаксис:
#var                - вывести список заданных переменных
#var variable       - вывести значение переменной variable
#var variable value - задать значение value переменной variable

Имя переменной должно начинаться с буквы. В имени переменной могут быть использзованы русские и английские буквы, цифры и символ нижнего подчеркивания.

Пример правильного имени переменной:
враг
victim
my_enemy
food1

Недопустимые имена переменных:
1враг
my-party-member
first enemy

Использование переменных при создании команд для "горячих клавиш":
#hotkey f1 есть $food

`
}

const varAdd = (stringCmd) => {
    const varsStorage = localStorage.vars ? JSON.parse(localStorage.vars) : {};
    const re = new RegExp(/^[a-zA-Zа-яА-Я][\wа-яА-Я]*$/)
    if (!re.test(stringCmd[0])) return echoHtml(`Неподходящее имя переменной. Для дополнительной справки введи ${clickableLink('#help var')} \n`)
    varsStorage[stringCmd[0]] = stringCmd.slice(1).join(' ')
    localStorage.vars = JSON.stringify(varsStorage)
    echoHtml('Переменная сохранена. \n')
}

const varShow = (userVar) => {
    const varsStorage = localStorage.vars ? JSON.parse(localStorage.vars) : {};
    if (!varsStorage[userVar]) return echoHtml(`Переменная не найдена. Для просмотра всех сохраненых переменных введи ${clickableLink('#var')} \n`)
    echoHtml(`$${userVar} : ${varsStorage[userVar]} \n`)
}

const varsListShow = () => {
    const varsStorage = localStorage.vars ? JSON.parse(localStorage.vars) : {};
    if (Object.keys(varsStorage).length === 0) return echoHtml(`Список переменных пуст. Набери ${clickableLink('#help var')} для справки`)
    let varsList = 'Список переменных: \n'
    for (let i in varsStorage) {
        varsList += '$' + i + ' : ' +  varsStorage[i] + '\n'
    }
    echoHtml(varsList)
}

const varCmd = value => {
    const stringCmd = parseStringCmd(value)
    if (!stringCmd[0]) return varsListShow()
    if (stringCmd.length === 1) return varShow(stringCmd[0])
    return varAdd(stringCmd)
}

export function parseUserVars(str) {
    const varsStorage = localStorage.vars ? JSON.parse(localStorage.vars) : {};
    const stringArr = str.split(/([^?=[\wа-яА-я$\]])/)
    for (let i in stringArr) {
        if (stringArr[i].startsWith('$') && (varsStorage[stringArr[i].slice(1)])) {
                stringArr[i] = varsStorage[stringArr[i].slice(1)]
        }
    }
    return stringArr.join('')
}

export default varCmd