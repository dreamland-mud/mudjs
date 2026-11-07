import { parseStringCmd, echoHtml, clickableLink } from '../SysCommands'
import { st } from './strings'

export const settingsHelp = {
    get title() { return st('sys.set.title', clickableLink('#help settings')) },
    get description() { return st('sys.set.desc') },
};

const setProperty = (stringCmd) => {
    const propertiesStorage = JSON.parse(localStorage.properties)
    if (!propertiesStorage.hasOwnProperty(stringCmd[0])) return echoHtml(st('sys.set.noparam'))
    let save = false
    const propertyValueType = typeof(propertiesStorage[stringCmd[0]])
    switch (propertyValueType) {
        case 'number':
            if (!(+stringCmd[1])) return echoHtml(st('sys.set.number'))
            propertiesStorage[stringCmd[0]] = Number.parseInt(stringCmd[1])
            save = true
            break
        case 'boolean':
            if (!(String(stringCmd[1]) === 'true') && !(String(stringCmd[1]) === 'false')) return echoHtml(st('sys.set.bool'))
            if (String(stringCmd[1]) === 'true') {
                propertiesStorage[stringCmd[0]] = true
            }
            if (String(stringCmd[1]) === 'false') {
                propertiesStorage[stringCmd[0]] = false
            }
            save = true
            break
        case 'string':
            break
        default:
            break
    }
    if (save) return localStorage.properties = JSON.stringify(propertiesStorage)
}

const propertyDelete = (property) => {
    const propertiesStorage = JSON.parse(localStorage.properties)
    if (!propertiesStorage[property]) return echoHtml(st('sys.set.noparam'))
    delete propertiesStorage[property]
    localStorage.properties = JSON.stringify(propertiesStorage)
    echoHtml(st('sys.set.removed', property))
}

const propertiesList = () => {
    const propertiesStorage = JSON.parse(localStorage.properties)
    let properties = st('sys.set.list')
    for (let i in propertiesStorage) {
        properties = properties + i + ' : ' +  propertiesStorage[i] + '\n'
    }
    properties += '\n';
    echoHtml(properties)
}

const propertiesCmd = value => {
    const stringCmd = parseStringCmd(value)
    if (!stringCmd[0]) return propertiesList()
    if (stringCmd.length === 1) return propertyDelete(stringCmd[0])
    if (stringCmd.length > 2) return echoHtml(st('sys.set.check'))
    return setProperty(stringCmd)
}

export default propertiesCmd
