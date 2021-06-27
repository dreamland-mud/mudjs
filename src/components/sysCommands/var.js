import { parseStringCmd, echoHtml, clickableLink } from '../SysCommands'

export const varHelp = {
    title: `Позволяет создать переменную с указанным значением, подробнее ${clickableLink('#help var')}`,
    description: `Команда ${clickableLink('#var')} позволяет создавать переменные.
Синтаксис:
#var                - вывести список заданных переменных
#var variable       - вывести значение переменной variable
#var variable value - задать значение value переменной variable

Имя переменной должно начинаться с буквы. В имени переменной могут быть использованы русские и английские буквы, цифры и символ нижнего подчеркивания. Пример правильного имени переменной: враг, victim, my_enemy, food1

Переменные удобно использовать внутри команд для горячих клавиш, перед именем переменной нужно написать знак доллара $:
#var еда пирог
#hotkey f1 есть $еда
После этого по нажатию клавиши f1 выполнится команда 'есть пирог'.

`
}

const varAdd = (stringCmd) => {
    const varsStorage = localStorage.vars ? JSON.parse(localStorage.vars) : {};
    const re = new RegExp(/^[a-zA-Zа-яА-Я][\wа-яА-Я]*$/)
    let varName = stringCmd[0]; 
    if (!re.test(varName)) 
        return echoHtml(`Неподходящее имя переменной. Для дополнительной справки введи ${clickableLink('#help var')}.\n`)
    let varValue = stringCmd.slice(1).join(' ');
    varsStorage[varName] = varValue;
    localStorage.vars = JSON.stringify(varsStorage)
    echoHtml(`Переменная '${varName}' теперь означает '${varValue}'.\n`);
}

const varDelete = key => {
    const varsStorage = localStorage.hotkey ? JSON.parse(localStorage.vars) : {};
    if (varsStorage[key]){
        delete varsStorage[key]
        localStorage.vars = JSON.stringify(varsStorage)
        echoHtml(`Переменная ${key} удалена из списка.\n`)
        return
    }
    
    return echoHtml(`Переменная не задана.\n`)
}

const varShow = (userVar) => {
    const varsStorage = localStorage.vars ? JSON.parse(localStorage.vars) : {};
    if (!varsStorage[userVar]) return echoHtml(`Переменная не найдена. Для просмотра всех сохраненых переменных введи ${clickableLink('#var')}.\n`)
    echoHtml(`$${userVar} : ${varsStorage[userVar]} \n`)
}

const varsListShow = () => {
    const varsStorage = localStorage.vars ? JSON.parse(localStorage.vars) : {};
    if (Object.keys(varsStorage).length === 0) return echoHtml(`Список переменных пуст. Набери ${clickableLink('#help var')} для справки.\n`)
    let varsList = 'Список переменных: \n'
    for (let i in varsStorage) {
        varsList += '    ' + i + ' : ' +  varsStorage[i] + '\n'
    }
    echoHtml(varsList + '\n')
}

const varCmd = value => {
    const stringCmd = parseStringCmd(value)
    if (!stringCmd[0]) return varsListShow()
    if (stringCmd.length === 1) return varShow(stringCmd[0])
    if (stringCmd.length === 2 && (stringCmd[1] === 'delete' || stringCmd[1] === 'удалить'))
        return varDelete(stringCmd[0]);
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