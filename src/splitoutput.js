/* Cut one big piece of server output into pieces of about `size` characters,
 * each of which the terminal shows and stores as a chunk of its own.
 *
 * The terminal keeps at most maxBytesOnScreen of chunks in the page and always
 * keeps the newest one whole, so a single chunk over that cap (a long vault
 * list) pushed the whole scrollback out, and trimming it again on the next
 * prompt set off a reload loop. Smaller chunks trim and reload like any other
 * output.
 *
 * A piece ends after a line break, outside any tag: the server's colour and
 * link markup (<c>, <hc>, <m>...) spans lines, and a piece that opened one
 * without closing it would lose the rest of it. ANSI colour needs no care
 * here: ansi2html keeps its colour state between calls. A single line longer
 * than twice `size` (no real output has one) is cut mid-line, still outside
 * any tag, ANSI sequence, &entity; or surrogate pair. Markup that never
 * closes is never cut: the rest of the text stays one piece, as before. */
export const PIECE_CHARS = 50000;

const VOID_TAGS = /^(br|hr|img|input|wbr|meta|link|area|base|col|embed|source|track|param)$/i;
const LETTER = /[A-Za-z]/;
const ENTITY_CHAR = /[#A-Za-z0-9]/;

export default function splitOutput(txt, size) {
  size = size || PIECE_CHARS;
  if (txt.length <= size) return [txt];

  const pieces = [];
  let start = 0;
  let lineCut = -1; // the latest position right after a line break, outside markup
  let depth = 0; // open, not yet closed tags
  let tag = null; // inside <...>: { name, closing, quote, last }
  let esc = 0; // inside an ANSI sequence: characters read so far
  let entity = false; // inside &...;

  for (let i = 0; i < txt.length; i++) {
    const clean = depth === 0 && !tag && !esc && !entity;
    if (clean && i > start) {
      if (i - start >= size && lineCut > start) {
        pieces.push(txt.slice(start, lineCut));
        start = lineCut;
      } else if (i - start >= 2 * size) {
        const code = txt.charCodeAt(i);
        // Never between the two halves of a surrogate pair.
        if (code < 0xdc00 || code > 0xdfff) {
          pieces.push(txt.slice(start, i));
          start = i;
        }
      }
    }

    const c = txt[i];

    if (esc) {
      esc++;
      if (esc > 2 && LETTER.test(c)) esc = 0;
      continue;
    }

    if (tag) {
      if (tag.quote) {
        if (c === tag.quote) tag.quote = '';
      } else if (c === '"' || c === "'") {
        tag.quote = c;
      } else if (c === '>') {
        if (tag.closing) depth = Math.max(0, depth - 1);
        else if (tag.last !== '/' && !VOID_TAGS.test(tag.name)) depth++;
        tag = null;
        continue;
      } else if (tag.naming && /[A-Za-z0-9_-]/.test(c)) {
        tag.name += c;
      } else {
        tag.naming = false;
      }
      if (c.trim()) tag.last = c;
      continue;
    }

    if (entity) {
      if (c === ';') {
        entity = false;
        continue;
      }
      if (ENTITY_CHAR.test(c)) continue;
      entity = false;
    }

    if (c === '\x1b') {
      esc = 1;
    } else if (c === '&') {
      entity = true;
    } else if (c === '<') {
      const next = txt[i + 1] || '';
      if (LETTER.test(next)) {
        tag = { name: '', closing: false, quote: '', last: '', naming: true };
      } else if (next === '/' && LETTER.test(txt[i + 2] || '')) {
        tag = { name: '', closing: true, quote: '', last: '', naming: false };
      } else if (next === '!') {
        // Comment or doctype: skipped like a tag, opens nothing.
        tag = { name: '!', closing: false, quote: '', last: '/', naming: false };
      }
    } else if (c === '\n' && depth === 0) {
      lineCut = i + 1;
    }
  }

  if (start < txt.length) pieces.push(txt.slice(start));
  return pieces;
}
