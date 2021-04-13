import { parseStringCmd } from '../SysCommands'
import { echo } from '../../input';

const setProperty = (stringCmd) => {
    const propertiesStorage = JSON.parse(localStorage.properties)
    if (!propertiesStorage.hasOwnProperty(stringCmd[0])) return echo("Нет такого параметра")
    let save = false
    const propertyValueType = typeof(propertiesStorage[stringCmd[0]])
    switch (propertyValueType) {
        case 'number':
            if (!(+stringCmd[1])) return echo('Параметр должен быть числом')
            propertiesStorage[stringCmd[0]] = Number.parseInt(stringCmd[1])
            save = true
            break
        case 'boolean':
            console.log(stringCmd[1])
            if (!(String(stringCmd[1]) === 'true') && !(String(stringCmd[1]) === 'false')) return echo('Параметр должен быть true или false')
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
    if (!propertiesStorage[property]) return echo('Нет такого параметра')
    delete propertiesStorage[property]
    localStorage.properties = JSON.stringify(propertiesStorage)
    echo(`Параметр ${property} удален. После перезагруки страницы будет использовано значение "по умолчанию"`)
}

const propertiesList = () => {
    const propertiesStorage = JSON.parse(localStorage.properties)
    let properties = 'Пользовательские настройки: \n'
    for (let i in propertiesStorage) {
        properties = properties + i + ' : ' +  propertiesStorage[i] + '\n'
    }
    echo(properties)
}

const propertiesCmd = value => {
    const stringCmd = parseStringCmd(value)
    if (!stringCmd[0]) return propertiesList()
    if (stringCmd.length === 1) return propertyDelete(stringCmd[0])
    if (stringCmd.length > 2) return echo('Проверьте правильность введенной команды')
    return setProperty(stringCmd)
}

export default propertiesCmd 