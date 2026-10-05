// Layout widths are used only as ratios to derive the mosaic split percentages
// (see getResponsiveLayout in app.jsx), so 43/14/43 yields a 43% / 14% / 43%
// terminal / panel / map split of the content area (gaps/grabbers excluded).
export const NEWCOMER_KEY = 'mudjs.newcomer'

const DEFAULT_PROPERTIES = {
    'terminalLayoutWidth': 43,
    'panelLayoutWidth': 14,
    'mapLayoutWidth': 43,
    'terminalFontSize': 20,
    'isPgKeysScroll': true,
}

// No saved properties = this browser has never opened the client. Mark it as a
// newcomer so the login door covers the whole screen until they reach the world
// (see accountLogin.jsx). Players from before this flag never get it.
if (!localStorage.properties) {
    localStorage.properties = JSON.stringify(DEFAULT_PROPERTIES)
    try { localStorage.setItem(NEWCOMER_KEY, '1') } catch (e) { /* private mode */ }
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