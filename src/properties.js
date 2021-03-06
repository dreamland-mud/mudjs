const DEFAULT_PROPERTIES = {
    'terminalLayoutWidth': 1150,
    'panelLayoutWidth': 270,
    'mapLayoutWidth': 500,
    'terminalFontSize': 20,
    'isPgKeysScroll': true,
}

if (!localStorage.properties) {
    localStorage.properties = JSON.stringify(DEFAULT_PROPERTIES)
}

let PropertiesStorage = JSON.parse(localStorage.properties)

if (Object.keys(PropertiesStorage).length !== Object.keys(DEFAULT_PROPERTIES).length) {
    for (let key in DEFAULT_PROPERTIES) {
        if (!PropertiesStorage[key]) {
            PropertiesStorage[key] = DEFAULT_PROPERTIES[key]
        }
    }
    localStorage.properties = JSON.stringify(PropertiesStorage)
}

export default PropertiesStorage