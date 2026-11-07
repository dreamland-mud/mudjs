import { parseStringCmd, echoHtml, clickableLink } from '../SysCommands'
import { getTriggers, setTriggerList } from '../../triggers'
import { onServer, shown, sameTrigger } from './action'
import { st } from './strings'

export const deleteHelp = {
    get title() { return st('sys.del.title', clickableLink('#help delete')) },
    get description() { return st('sys.del.desc', clickableLink('#delete')) },
};

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
        return echoHtml(st('sys.del.trigall'))
    }
    let found = false
    for (const scope of ['char', 'acct']) {
        const list = getTriggers()[scope]
        if (list.some(x => sameTrigger(x, record))) {
            found = true
            setTriggerList(scope, list.filter(x => !sameTrigger(x, record)))
        }
    }
    if (!found) return echoHtml(st('sys.del.norecord', clickableLink(`#delete ${TRIGGER_STORE}`)))
    echoHtml(st('sys.del.deleted', escapeHtml(record)))
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
    if (!localStorage[storage]) return echoHtml(st('sys.del.nostore', clickableLink('#delete')))
    if (record === 'all') {
        localStorage[storage] = JSON.stringify({})
        echoHtml(st('sys.del.allgone', escapeHtml(storage)))
        return
    }
    const recordsArr = JSON.parse(localStorage[storage])
    if (!recordsArr[record]) return echoHtml(st('sys.del.norecord', clickableLink(`#delete ${storage}`)))
    delete recordsArr[record]
    localStorage[storage] = JSON.stringify(recordsArr)
    echoHtml(st('sys.del.deleted', escapeHtml(record)))
}

const deleteRecordsShow = storage => {
    const trigs = storage === TRIGGER_STORE ? serverTriggers() : null
    if (trigs) {
        if (trigs.length === 0) return echoHtml(st('sys.del.empty', escapeHtml(storage)))
        return echoHtml(st('sys.del.records')
            + trigs.map(x => `${deleteClickableLink(storage, shown(x))} : ${escapeHtml(x.cmd || '')} \n`).join(''))
    }
    if (!localStorage[storage]) return echoHtml(st('sys.del.nostore', clickableLink('#delete')))
    const recordsArr = JSON.parse(localStorage[storage])
    if (Object.keys(recordsArr).length === 0) return echoHtml(st('sys.del.empty', escapeHtml(storage)))
    let records = st('sys.del.records')
    for (let record in recordsArr) {
        const value = recordsArr[record]
        records += `${deleteClickableLink(storage, record)} : ${escapeHtml(value && typeof value === 'object' ? (value.action ?? JSON.stringify(value)) : value)} \n`
    }
    echoHtml(records)
}

const deleteStoragesShow = () => {
    let storagesList = st('sys.del.stores')
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
