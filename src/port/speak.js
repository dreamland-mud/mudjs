/* Spoken answers of every tool: the chat buffers' assertive region, so no two
 * tools talk over each other from separate regions. */
import { announce } from '../chatbuffers';
import { t } from '../i18n';

/* After a sheet closes the focus goes back to the command line and the screen
 * reader names it; an answer said at the same moment is cut off. */
export const AFTER_SHEET_MS = 200;

export function say(text, delay) {
  if (!text) return;
  if (delay) setTimeout(() => announce(text), delay);
  else announce(text);
}

/* t(key) with every %s or %d filled in turn, by position: the values are game
 * text and may hold "%s" or "$&" themselves. */
export function tf(key, ...values) {
  const parts = t(key).split(/%[sd]/);
  return parts.map((p, i) => p + (i < parts.length - 1 ? String(values[i] ?? '') : '')).join('');
}
