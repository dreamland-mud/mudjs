import { parseStringCmd, echoHtml, clickableLink } from '../SysCommands'
import { getTriggers, setTriggerList } from '../../triggers'
import { onServer, shown, sameTrigger } from './action'

export const deleteHelp = {
    title: `Позволяет удалять горячие клавиши, переменные и пользовательские настройки, подробнее ${clickableLink('#help delete')}`,
    description: `Команда ${clickableLink('#delete')} позволяет удалять горячие клавиши, переменные и пользовательские настройки.
Синтаксис:
#delete                 - вывести список хранилищ доступных для взаимодействия
#delete storage         - вывести список записей из storage, которые можно удалить
#delete storage record  - удалить запись record из хранилища storage
#delete storage all     - ключевое слово all позволяет удалить все записи из хранилища storage

`
}

const restrictedStorages = ['history', 'defaultsHash']
const escapeHtml = str => String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const deleteClickableLink = (storage, item) => {
    const cmd = escapeHtml(`#delete ${storage} ${item}`)
    return `<span class="builtin-cmd manip-link" data-action="${cmd}" data-echo="${cmd}">${escapeHtml(item)}</span>`
}

// Triggers moved from localStorage.actions to the character on the server
// (triggers.js); once that list has arrived, 'actions' means the server lists.
const TRIGGER_STORE = 'actions'
const serverTriggers = () => onServer() ? getTriggers().char.concat(getTriggers().acct) : null

const deleteTrigger = record => {
    // 'all' clears this character's list only: account triggers are shared by
    // every character and go one by one, or from the settings tab.
    if (record === 'all') {
        if (getTriggers().char.length) setTriggerList('char', [])
        return echoHtml(`Все триггеры персонажа удалены. Общие триггеры аккаунта удаляются по одному.\n`)
    }
    let found = false
    for (const scope of ['char', 'acct']) {
        const list = getTriggers()[scope]
        if (list.some(x => sameTrigger(x, record))) {
            found = true
            setTriggerList(scope, list.filter(x => !sameTrigger(x, record)))
        }
    }
    if (!found) return echoHtml(`Запись не найдена, набери ${clickableLink(`#delete ${TRIGGER_STORE}`)} для списка записей. \n`)
    echoHtml(`${escapeHtml(record)} удалено. \n`)
}

function isJSON(str) {
    try {
        return (JSON.parse(str) && !!str);
    } catch (e) {
        return false;
    }
}

const deleteRecord = str => {
    const storage = str[0]
    const record = str.slice(1).join(' ')
    if (storage === TRIGGER_STORE && serverTriggers()) return deleteTrigger(record)
    if (!localStorage[storage]) return echoHtml(`Хранилище не найдено, набери ${clickableLink('#delete')} для получения доступных хранилищ. \n`)
    if (record === 'all') {
        localStorage[storage] = JSON.stringify({})
        echoHtml(`Все записи из ${storage} удалены`)
        return
    }
    const recordsArr = JSON.parse(localStorage[storage])
    if (!recordsArr[record]) return echoHtml(`Запись не найдена, набери ${clickableLink(`#delete ${storage}`)} для списка записей. \n`)
    delete recordsArr[record]
    localStorage[storage] = JSON.stringify(recordsArr)
    echoHtml(`${record} удалено. \n`)
}

const deleteRecordsShow = storage => {
    const trigs = storage === TRIGGER_STORE ? serverTriggers() : null
    if (trigs) {
        if (trigs.length === 0) return echoHtml(`В ${storage} нет записей`)
        return echoHtml('Список записей доступных для удаления: \n'
            + trigs.map(x => `${deleteClickableLink(storage, shown(x))} : ${escapeHtml(x.cmd || '')} \n`).join(''))
    }
    if (!localStorage[storage]) return echoHtml(`Хранилище не найдено, набери ${clickableLink('#delete')} для получения доступных хранилищ \n`)
    const recordsArr = JSON.parse(localStorage[storage])
    if (Object.keys(recordsArr).length === 0) return echoHtml(`В ${storage} нет записей`)
    let records = 'Список записей доступных для удаления: \n'
    for (let record in recordsArr) {
        const value = recordsArr[record]
        records += `${deleteClickableLink(storage, record)} : ${escapeHtml(value && typeof value === 'object' ? (value.action ?? JSON.stringify(value)) : value)} \n`
    }
    echoHtml(records)
}

const deleteStoragesShow = () => {
    let storagesList = 'Список хранилищ из которых можно удалять записи: \n'
    const trigs = serverTriggers()
    if (trigs && trigs.length)
        storagesList += `<span class="builtin-cmd manip-link" data-action="#delete ${TRIGGER_STORE}" data-echo="delete ${TRIGGER_STORE}">${TRIGGER_STORE}</span>\n`
    for (let i in localStorage) {
        if ((typeof localStorage[i] === 'string') 
            && isJSON(localStorage[i])
            && !restrictedStorages.includes(i)
            && !(i === TRIGGER_STORE && trigs)) {
                storagesList += `<span class="builtin-cmd manip-link" data-action="#delete ${i}" data-echo="delete ${i}">${i}</span>\n`
        }
    }
    echoHtml(storagesList)
}

const deleteCmd = value => {
    const stringCmd = parseStringCmd(value)
    if (!stringCmd[0]) return deleteStoragesShow()
    if (stringCmd.length === 1) return deleteRecordsShow(stringCmd[0])
    return deleteRecord(stringCmd)
}

export default deleteCmd