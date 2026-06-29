function keyCode(searchInput) {
  if (searchInput && typeof searchInput === 'object') {
    const hasKeyCode =
      searchInput.which || searchInput.keyCode || searchInput.charCode;
    if (hasKeyCode) searchInput = hasKeyCode;
  }

  if (typeof searchInput === 'number') return keyCode.names[searchInput];

  const search = String(searchInput).toLowerCase();
  let foundNamedKey = keyCode.codes[search];
  if (foundNamedKey) return foundNamedKey;

  foundNamedKey = keyCode.aliases[search];
  if (foundNamedKey) return foundNamedKey;

  if (search.length === 1) return search.charCodeAt(0);

  return undefined;
}

keyCode.isEventKey = function (event, nameOrCode) {
  if (event && typeof event === 'object') {
    const code = event.which || event.keyCode || event.charCode;
    if (code == null) return false;

    if (typeof nameOrCode === 'string') {
      let found =
        keyCode.codes[nameOrCode.toLowerCase()] ||
        keyCode.aliases[nameOrCode.toLowerCase()];
      return found === code;
    } else if (typeof nameOrCode === 'number') {
      return nameOrCode === code;
    }
  }
  return false;
};

keyCode.hotkey = function (e) {
  let meta;
  let key;

  if (e && typeof e === 'object') {
    if (e.key && e.ctrlKey) {
      meta = 'ctrl';
    } else if (e.key && e.altKey) {
      meta = 'alt';
    } else if (e.key && e.shiftKey) {
      meta = 'shift';
    }

    key = keyCode(e.which);
  }

  if (meta && key) return `${meta}+${key}`;
  return key;
};

// ===== codes / aliases / names =====
keyCode.codes = {
  space: 32,
  pgup: 33,
  pgdn: 34,
  end: 35,
  home: 36,
  left: 37,
  up: 38,
  right: 39,
  down: 40,
  ins: 45,
  del: 46,
  'kp*': 106,
  'kp+': 107,
  'kp-': 109,
  'kp.': 110,
  'kp/': 111,
  ';': 186,
  '=': 187,
  ',': 188,
  '-': 189,
  '.': 190,
  '/': 191,
  '`': 192,
  '[': 219,
  '\\': 220,
  ']': 221,
  "'": 222,
};

keyCode.aliases = {};
keyCode.names = {};
keyCode.title = keyCode.names; // for legacy compatibility

// lowercase a-z => A-Z keycodes
for (let i = 97; i < 123; i++) keyCode.codes[String.fromCharCode(i)] = i - 32;
// 0-9
for (let i = 48; i < 58; i++) keyCode.codes[(i - 48).toString()] = i;
// F1-F12
for (let i = 1; i <= 12; i++) keyCode.codes['f' + i] = i + 111;
// numpad kp0-kp9
for (let i = 0; i < 10; i++) keyCode.codes['kp' + i] = i + 96;

// reverse mapping
for (let key in keyCode.codes) {
  keyCode.names[keyCode.codes[key]] = key;
}

// aliases mapping
for (let alias in keyCode.aliases) {
  keyCode.codes[alias] = keyCode.aliases[alias];
}

// Cyrillic (ЙЦУКЕН, RU + UK) letters share physical keys with QWERTY. The
// browser reports e.which by physical key, so pressing я yields 90 (the Z key).
// Map each Cyrillic letter to the code of the Latin key it sits on, so that
// "#hotkey я" binds the same physical key the keypress reports. Added AFTER the
// reverse map on purpose, so names[] keeps the Latin label (e.g. 90 -> "z").
const cyrillicLayout = {
  // top row
  й: 'q', ц: 'w', у: 'e', к: 'r', е: 't', н: 'y', г: 'u', ш: 'i', щ: 'o', з: 'p', х: '[', ъ: ']', ї: ']',
  // home row
  ф: 'a', ы: 's', і: 's', в: 'd', а: 'f', п: 'g', р: 'h', о: 'j', л: 'k', д: 'l', ж: ';', э: "'", є: "'",
  // bottom row
  я: 'z', ч: 'x', с: 'c', м: 'v', и: 'b', т: 'n', ь: 'm', б: ',', ю: '.',
  // extras: ё on backtick, UK ґ on backslash
  ё: '`', ґ: '\\',
};
for (let cyr in cyrillicLayout) {
  const code = keyCode.codes[cyrillicLayout[cyr]];
  if (code !== undefined) keyCode.codes[cyr] = code;
}

export default keyCode;
