import { parseStringCmd, echoHtml, clickableLink } from '../SysCommands'
import { st } from './strings'
import { DELETE_WORDS } from '../sysCommandUtils'

export const varHelp = {
    get title() { return st('sys.var.title', clickableLink('#help var')) },
    get description() { return st('sys.var.desc', clickableLink('#var')) },
};

// Names may use English, Russian and Ukrainian letters (parseUserVars in
// hotkeySend.js reads them with the same set).
const NAME = /^[a-zA-Zа-яА-ЯёЁіІїЇєЄґҐ][\wа-яА-ЯёЁіІїЇєЄґҐ]*$/

const varAdd = (stringCmd) => {
    const varsStorage = localStorage.vars ? JSON.parse(localStorage.vars) : {};
    let varName = stringCmd[0];
    if (!NAME.test(varName))
        return echoHtml(st('sys.var.badname', clickableLink('#help var')))
    let varValue = stringCmd.slice(1).join(' ');
    varsStorage[varName] = varValue;
    localStorage.vars = JSON.stringify(varsStorage)
    echoHtml(st('sys.var.set', varName, varValue));
}

const varDelete = key => {
    const varsStorage = localStorage.vars ? JSON.parse(localStorage.vars) : {};
    if (varsStorage[key]){
        delete varsStorage[key]
        localStorage.vars = JSON.stringify(varsStorage)
        echoHtml(st('sys.var.deleted', key))
        return
    }

    return echoHtml(st('sys.var.notset'))
}

const varShow = (userVar) => {
    const varsStorage = localStorage.vars ? JSON.parse(localStorage.vars) : {};
    if (!varsStorage[userVar]) return echoHtml(st('sys.var.notfound', clickableLink('#var')))
    echoHtml(`$${userVar} : ${varsStorage[userVar]} \n`)
}

const varsListShow = () => {
    const varsStorage = localStorage.vars ? JSON.parse(localStorage.vars) : {};
    if (Object.keys(varsStorage).length === 0) return echoHtml(st('sys.var.empty', clickableLink('#help var')))
    let varsList = st('sys.var.list')
    for (let i in varsStorage) {
        varsList += '    ' + i + ' : ' +  varsStorage[i] + '\n'
    }
    echoHtml(varsList + '\n')
}

const varCmd = value => {
    const stringCmd = parseStringCmd(value)
    if (!stringCmd[0]) return varsListShow()
    if (stringCmd.length === 1) return varShow(stringCmd[0])
    if (stringCmd.length === 2 && DELETE_WORDS.includes(stringCmd[1]))
        return varDelete(stringCmd[0]);
    return varAdd(stringCmd)
}

// Moved to the leaf module (no SysCommands import); re-exported for existing callers.
export { parseUserVars } from './hotkeySend';

export default varCmd
