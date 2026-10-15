import { parseStringCmd, echoHtml, clickableLink } from '../SysCommands'
import { send } from '../../websock';
import { getTriggers, setTriggerList, fromAction, legacyActionMap, setLegacyActionMap } from '../../triggers';

export const actionHelp = {
    title: `Создать пользовательский триггер, подробнее ${clickableLink('#help action')}`,
    description: `Команда ${clickableLink('#action')} позволяет создавать/удалять/изменять пользовательские триггеры для событий в игре.
Синтаксис:
#action -- список всех триггеров
#action {trigger} {action} -- создать пользовательский триггер с действием {action} для события {trigger}. Триггер хранится на персонаже и работает с любого устройства
#action string -- вывести список триггеров совпадающих со строкой 'string'
#action string delete|удалить -- удалить все триггеры совпадающие со строкой 'string'
#action {trigger} delete|удалить -- удалить указанный триггер

В триггере {trigger} могут быть использоны регулярные выражения. Можно определять переменные вида %1,%2,%3...%9 для дальнейшего использования в действиях {action}.  

Примеры использования:
#action {%1 пришел с севера} {say hello %1}

Звук, подсветку и общие для всего аккаунта триггеры настраивай в Настройки -> Расширения -> Триггеры.
#action {^Ты умираешь от голода|^Ты умираешь от жажды} {взять бочон сумка|пить боч|пить боч|пить боч|положить боч сумка}
`
}

// #action edits the character's trigger list on the server (triggers.js), the
// same list the settings tab edits. Its pattern keeps the old meaning: a regex
// where %1..%9 each take one word, numbered in the order they appear.
//
// Until the server has handed the lists over -- the first seconds after login,
// or for good on a server without the triggers rpc -- #action works on the old
// browser-only store in localStorage.actions, exactly as it used to. Whatever
// is there moves onto the server list the moment that list arrives.

const onServer = () => getTriggers().known
const shown = trig => trig.act || trig.pattern
const showOne = trig => '    {' + shown(trig) + '} : {' + trig.cmd + '}' + (trig.on === false ? ' (выкл)' : '') + '\n'
const sameTrigger = (trig, typed) => trig.act === typed || trig.pattern === typed || trig.pattern === fromAction(typed, '').pattern

const actionAdd = actionArr => {
    const trigger = actionArr[0].slice(1,-1)
    const action = actionArr[1].slice(1,-1)
    if (!onServer()) {
        const stored = legacyActionMap()
        stored[trigger] = { action, priority: 5 }
        setLegacyActionMap(stored)
        return echoHtml(` {${trigger}} добавлен в список триггеров.\n`)
    }
    const list = getTriggers().char
    const old = list.find(x => sameTrigger(x, trigger))
    const trig = fromAction(trigger, action)
    if (old) {
        // A new command for an existing trigger keeps its highlight and sound.
        setTriggerList('char', list.map(x => (x === old ? { ...old, cmd: trig.cmd, act: trigger } : x)))
    } else {
        setTriggerList('char', list.concat([trig]))
    }
    echoHtml(` {${trigger}} добавлен в список триггеров. Звук и подсветка: Настройки -> Расширения -> Триггеры.\n`)
}

const actionsListShow = string => {
    let list
    if (onServer()) {
        list = getTriggers().char.concat(getTriggers().acct)
    } else {
        const stored = legacyActionMap()
        list = Object.keys(stored).map(k => ({ pattern: k, cmd: stored[k].action }))
    }
    if (string) {
        let re
        try { re = new RegExp(string) } catch (e) { return echoHtml(`Некорректный шаблон поиска.\n`) }
        list = list.filter(x => re.test(shown(x)))
    }
    if (list.length === 0) return echoHtml(`Список триггеров пуст. Набери ${clickableLink('#help action')} для справки.\n`)
    return echoHtml('Список триггеров: \n' + list.map(showOne).join('') + '\n')
}

const actionShow = value => {
    const typed = value.slice(1,-1)
    let trig
    if (onServer()) {
        trig = getTriggers().char.concat(getTriggers().acct).find(x => sameTrigger(x, typed))
    } else {
        const stored = legacyActionMap()
        if (stored[typed]) trig = { pattern: typed, cmd: stored[typed].action }
    }
    if (!trig) return echoHtml(`Триггер не найден. Для просмотра всех триггеров введи ${clickableLink('#action')}.\n`)
    echoHtml(showOne(trig))
}

const actionDelete = value => {
    const typed = value.slice(1,-1)
    if (!onServer()) {
        const stored = legacyActionMap()
        if (!stored[typed]) return echoHtml(`Такой триггер не задан.\n`)
        delete stored[typed]
        setLegacyActionMap(stored)
        return echoHtml(` {${typed}} удален из списка.\n`)
    }
    let found = false
    for (const scope of ['char', 'acct']) {
        const list = getTriggers()[scope]
        if (list.some(x => sameTrigger(x, typed))) {
            found = true
            setTriggerList(scope, list.filter(x => !sameTrigger(x, typed)))
        }
    }
    if (!found) return echoHtml(`Такой триггер не задан.\n`)
    echoHtml(` {${typed}} удален из списка.\n`)
}

const actionDeleteOnMask = value => {
    const mask = value.substring(0, value.lastIndexOf(" "))
    let re
    try { re = new RegExp(mask) } catch (e) { return echoHtml(`Некорректный шаблон.\n`) }
    let gone = []
    if (!onServer()) {
        const stored = legacyActionMap()
        gone = Object.keys(stored).filter(k => re.test(k))
        gone.forEach(k => delete stored[k])
        setLegacyActionMap(stored)
        gone = gone.map(k => ({ pattern: k }))
    } else {
        for (const scope of ['char', 'acct']) {
            const list = getTriggers()[scope]
            const hit = list.filter(x => re.test(shown(x)))
            if (hit.length) setTriggerList(scope, list.filter(x => !re.test(shown(x))))
            gone = gone.concat(hit)
        }
    }
    if (gone.length === 0) return echoHtml(`Совпавших триггеров не найдено.\n`)
    gone.forEach(x => echoHtml(` {${shown(x)}} удален из списка.\n`))
    return echoHtml(`Все совпавшие триггеры удалены.\n`)
}

const actionCmd = value => {
    const stringCmd = parseStringCmd(value)
    const actionArr =  parseActionCmd(value)
    if (value.toString().startsWith('{')) {
        if (actionArr.length === 1) {
            if ((stringCmd[stringCmd.length-1] === 'delete') || (stringCmd[stringCmd.length-1] === 'удалить')) {
                return actionDelete(actionArr[0])
            }
            return actionShow(actionArr[0])
        }
        if (actionArr.length >= 2) return actionAdd(actionArr)
        return echoHtml(`Некорректная команда. Введи ${clickableLink('#help action')} для получения справки.\n`) 
    }
    if (!stringCmd[0]) return actionsListShow()
    if (stringCmd.length > 1) { 
        if ((stringCmd[stringCmd.length-1] === 'delete') || (stringCmd[stringCmd.length-1] === 'удалить')) {
            return actionDeleteOnMask(value)
        }
    }
    if ((stringCmd[0]) && (!actionArr?.length)) return actionsListShow(stringCmd)
    return echoHtml(`Некорректная команда. Введи ${clickableLink('#help action')} для получения справки.\n`)
}

export default actionCmd

const parseActionCmd = value => {
    const re = /{(.*?)}/gm; 
    const actionArr = value.match(re)
    return actionArr
}

const sortByPriorities = (a, b) => {
    let comparison = 0;
    if (a.priority > b.priority) {
      comparison = 1;
    } else if (a.priority < b.priority) {
      comparison = -1;
    }
    return comparison;
}

export function processTriggers(line) {
    if (!localStorage.actions) return; // moved to the server, or never had any
    const actionsStorage = legacyActionMap();
    const regexpActionShow = /^\s*{|^\s*#\b/gm; 
    const regexpVariable = /%\d{1}\b/gm;
    const actionArray = []

    for (let trigger in actionsStorage) {
        //Check if we have variable-patterns inside the trigger
        const variableArr = [...trigger.matchAll(regexpVariable)];
        // processing them if so
        if (variableArr[0]) {
            let i = 1
            const valList= {}
            const tmpTrigger = trigger.replace(/%\d{1}\b/gm, '(\\S+)')
            const reVal = new RegExp(tmpTrigger,"gm")
            if (line.match(tmpTrigger) && (!line.match(regexpActionShow))) {
                const valArray = [...line.matchAll(reVal)]
                if (valArray[0]) {
                    variableArr.forEach(item => {
                        valList[item] = valArray[0][i]
                    i++
                    })
                    let action = actionsStorage[trigger]['action']
                    for (let i in valList) {
                        const re = new RegExp(i, 'g')
                        action = action.replace(re, valList[i])
                    }
                    actionArray.push({
                        'priority': actionsStorage[trigger]['priority'],
                        'action': action
                    })
                }
            }
        } else {
            //Check trigger without variable-patterns
            const re = new RegExp(trigger,"g");
            if ((line.match(re)) && (!line.match(regexpActionShow))) {
                actionArray.push({
                    'priority': actionsStorage[trigger]['priority'],
                    'action': actionsStorage[trigger]['action']
                })
            }
        }
    }
    //Send actions to server
    if (actionArray.length > 0) {
        actionArray.sort(sortByPriorities)
        actionArray.forEach(item => {
            send(item.action)
        })
    }
}