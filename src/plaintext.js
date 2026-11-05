// Escape sequences: CSI colour codes, charset switches like ESC ( B, and any
// other two-character escape. Control characters other than tab and newline.
const ESCAPES = /\u001b(?:\[[0-9;?]*[ -\/]*[@-~]|[()*+][A-Za-z0-9]|.)/g;
const CONTROLS = /[\u0000-\u0008\u000b-\u001f\u007f]/g;

/* The game's markup taken off: the text a screen reader should hear, or a
 * quoted line should show (the chat panel's footer, the chat buffer keys).
 * Parsed in a separate document made by DOMParser, where nothing runs and
 * nothing loads (an <img onerror> in a line stays inert), and without
 * ansi2html, whose running colour state is shared with the terminal's output. */
export function plain(text) {
  const clean = String(text || '').replace(ESCAPES, '').replace(CONTROLS, '').replace(/\t/g, ' ');
  const doc = new DOMParser().parseFromString('<!doctype html><body>' + clean, 'text/html');
  return doc.body.textContent || '';
}
