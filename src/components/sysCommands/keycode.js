// Source: http://jsfiddle.net/vWx8V/
// http://stackoverflow.com/questions/5603195/full-list-of-javascript-keycodes

/**
 * Conenience method returns corresponding value for given keyName or keyCode.
 *
 * @param {Mixed} keyCode {Number} or keyName {String}
 * @return {Mixed}
 * @api public
 */

 function keyCode(searchInput) {
    // Keyboard Events
    if (searchInput && 'object' === typeof searchInput) {
      var hasKeyCode = searchInput.which || searchInput.keyCode || searchInput.charCode
      if (hasKeyCode) searchInput = hasKeyCode
    }
  
    // Numbers
    if ('number' === typeof searchInput) return names[searchInput]
  
    // Everything else (cast to string)
    var search = String(searchInput)
    var foundNamedKey
    // check codes
    foundNamedKey = codes[search.toLowerCase()]
    if (foundNamedKey) return foundNamedKey
  
    // check aliases
    foundNamedKey = aliases[search.toLowerCase()]
    if (foundNamedKey) return foundNamedKey
  
    // weird character?
    if (search.length === 1) return search.charCodeAt(0)
  
    return undefined
  }
  
  /**
   * Compares a keyboard event with a given keyCode or keyName.
   *
   * @param {Event} event Keyboard event that should be tested
   * @param {Mixed} keyCode {Number} or keyName {String}
   * @return {Boolean}
   * @api public
   */
  keyCode.isEventKey = function isEventKey(event, nameOrCode) {
    if (event && 'object' === typeof event) {
      var keyCode = event.which || event.keyCode || event.charCode
      if (keyCode === null || keyCode === undefined) { return false; }
      if (typeof nameOrCode === 'string') {
        var foundNamedKey
        // check codes
        foundNamedKey = codes[nameOrCode.toLowerCase()]
        if (foundNamedKey) { return foundNamedKey === keyCode; }
      
        // check aliases
        foundNamedKey = aliases[nameOrCode.toLowerCase()]
        if (foundNamedKey) { return foundNamedKey === keyCode; }
      } else if (typeof nameOrCode === 'number') {
        return nameOrCode === keyCode;
      }
      return false;
    }
  }

  /**
   * Translate keyboard event into a valid hotkey name, e.g. 'ctrl+a' or 'f2'.
   * @param {Event} e Keyboard event to translate
   * @return {String} a hotkey name or undef
   */
keyCode.hotkey = function(e) {
    let meta;
    let key;

    if (e && 'object' === typeof e) {
        if (e.key && e.ctrlKey) {
            meta = 'ctrl';
        } else if (e.key && e.altKey) {
            meta = 'alt';
        } else if (e.key && e.shiftKey) {
            meta = 'shift';
        } 

        key = keyCode(e.which);
    }

    if (meta && key) return meta + '+' + key;
    return key;
}
  
  exports = module.exports = keyCode;
  
  /**
   * Get by name
   *
   *   exports.code['enter'] // => 13
   */
  
  var codes = exports.code = exports.codes = {
    'space': 32,
    'pgup': 33,
    'pgdn': 34,
    'end': 35,
    'home': 36,
    'left': 37,
    'up': 38,
    'right': 39,
    'down': 40,
    'ins': 45,
    'del': 46,
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
    "'": 222
  }
  
  // Helper aliases
  
  var aliases = exports.aliases = {
  }
  
  /*!
   * Programatically add the following
   */
  
  // lower case chars
  for (let i = 97; i < 123; i++) codes[String.fromCharCode(i)] = i - 32
  
  // numbers
  for (let i = 48; i < 58; i++) codes[i - 48] = i
  
  // function keys
  for (let i = 1; i < 13; i++) codes['f'+i] = i + 111
  
  // numpad keys
  for (let i = 0; i < 10; i++) codes['kp'+i] = i + 96
  
  /**
   * Get by code
   *
   *   exports.name[13] // => 'Enter'
   */
  
  var names = exports.names = exports.title = {} // title for backward compat
  
  // Create reverse mapping
  for (let i in codes) names[codes[i]] = i
  
  // Add aliases
  for (let alias in aliases) {
    codes[alias] = aliases[alias]
  }
  