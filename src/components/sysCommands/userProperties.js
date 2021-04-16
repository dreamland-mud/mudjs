import { parseStringCmd, echoHtml, clickableLink } from '../SysCommands'



export const settingsHelp = {
    title: `Установить или сбросить пользовательские настройки, подробнее ${clickableLink('#help settings')}`,
    description: `
Команда #settings позволяет изменять и запоминать пользовательские настройки.

Синтаксис:
#settings - вывести список доступных настроек
#settings {properties} - удаляет текущий параметр {properties} и сбрасывает его на значение "по умолчанию"
#settings {properties} {value} - устанавливает значение {value} для параметра {properties}

Список доступных настроек:
terminalLayoutWidth - ширина окна терминала
panelLayoutWidth - ширина окна панели виджетов
mapLayoutWidth - ширина окна карты
terminalFontSize - размер шрифта
isPgKeysScroll - использовать ли клавишы PgUp и PgDown для скрола или сделать их доступными для использовать в качестве горячих клавиш. true (по умолчанию) - скролл, false - горячие клавиши
`
}

const setProperty = (stringCmd) => {
    const propertiesStorage = JSON.parse(localStorage.properties)
    if (!propertiesStorage.hasOwnProperty(stringCmd[0])) return echoHtml("Нет такого параметра")
    let save = false
    const propertyValueType = typeof(propertiesStorage[stringCmd[0]])
    switch (propertyValueType) {
        case 'number':
            if (!(+stringCmd[1])) return echoHtml('Параметр должен быть числом')
            propertiesStorage[stringCmd[0]] = Number.parseInt(stringCmd[1])
            save = true
            break
        case 'boolean':
            if (!(String(stringCmd[1]) === 'true') && !(String(stringCmd[1]) === 'false')) return echoHtml('Параметр должен быть true или false')
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
    if (!propertiesStorage[property]) return echoHtml('Нет такого параметра')
    delete propertiesStorage[property]
    localStorage.properties = JSON.stringify(propertiesStorage)
    echoHtml(`Параметр ${property} удален. После перезагруки страницы будет использовано значение "по умолчанию"`)
}

const propertiesList = () => {
    const propertiesStorage = JSON.parse(localStorage.properties)
    let properties = 'Пользовательские настройки: \n'
    for (let i in propertiesStorage) {
        properties = properties + i + ' : ' +  propertiesStorage[i] + '\n'
    }
    echoHtml(properties)
}

const propertiesCmd = value => {
    const stringCmd = parseStringCmd(value)
    if (!stringCmd[0]) return propertiesList()
    if (stringCmd.length === 1) return propertyDelete(stringCmd[0])
    if (stringCmd.length > 2) return echoHtml('Проверьте правильность введенной команды')
    return setProperty(stringCmd)
}

export default propertiesCmd 