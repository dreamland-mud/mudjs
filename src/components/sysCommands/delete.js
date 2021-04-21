import { parseStringCmd, echoHtml, clickableLink } from '../SysCommands'

export const deleteHelp = {
    title: `Позволяет удалять горячие клавиши, переменные и пользовательские настройки, подробнее ${clickableLink('#help delete')}`,
    description: `Команда ${clickableLink('#delete')} позволяет удалять горячие клавиши, переменные и пользовательские настройки.
Синтаксис:
#delete                 - вывести список хранилищ доступных для взаимодействия
#delete storage         - вывести список записей из storage, которые можно удалить
#delete storage record  - удалить запись record из хранилища storage
#delete storage all     - ключевое своло all позволяет удалить все записи из хранилища storage 

`
}

const restrictedStorages = ['history', 'defaultsHash']
const deleteClickableLink = (storage, item) => {
    return `<span class="builtin-cmd manip-link" data-action="#delete ${storage} ${item}" data-echo="#delete ${storage} ${item}">${item}</span>`
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
    const record = str.slice(1)
    if (!localStorage[storage]) return echoHtml(`Хранилище не найдено, набери ${clickableLink('#delete')} для получения доступных хранилищ. \n`)
    if (str[1] === 'all') {
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
    if (!localStorage[storage]) return echoHtml(`Хранилище не найдено, набери ${clickableLink('#delete')} для получения доступных хранилищ \n`)
    const recordsArr = JSON.parse(localStorage[storage])
    if (Object.keys(recordsArr).length === 0) return echoHtml(`В ${storage} нет записей`)
    let records = 'Список записей доступных для удаления: \n'
    for (let record in recordsArr) {
        records += `${deleteClickableLink(storage, record)} : ${recordsArr[record]} \n`
    }
    echoHtml(records)
}

const deleteStoragesShow = () => {
    let storagesList = 'Список хранилищ из которых можно удалять записи: \n'
    for (let i in localStorage) {
        if ((typeof localStorage[i] === 'string') 
            && isJSON(localStorage[i])
            && !restrictedStorages.includes(i)) {
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