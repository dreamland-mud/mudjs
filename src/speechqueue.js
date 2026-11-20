// Leaf module: the terminal registers how to drop its not-yet-spoken lines, and
// whatever sends a player's own command (input line, hotkey) calls it, so speech
// from the previous room does not trail behind the new one. A leaf so hotkeySend
// can import it without pulling terminal.jsx into the SysCommands cycle.
let clearFn = null;
export function setPendingSpeechClear(fn) {
  clearFn = fn;
}
export function clearPendingSpeech() {
  if (clearFn) clearFn();
}
