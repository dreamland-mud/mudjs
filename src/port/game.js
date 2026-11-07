/* What the tools need to know about the game right now. */
import { store } from '../store.js';
import { getLang } from '../i18n';
import { send } from '../websock.js';
import { echo } from '../input';

export const prompt = () => store.getState().prompt || {};

/* en, ru or ua: the language the game talks in. */
export const lang = () => {
  const l = prompt().lang || getLang();
  return l === 'ua' || l === 'ru' ? l : 'en';
};

/* A command to the game, shown in the output like a typed one. */
export function command(cmd) {
  if (!cmd) return;
  echo(cmd);
  send(cmd);
}

/* Follow the game's prompt frames: fn(prompt) on every one. */
export function onPrompt(fn) {
  return store.subscribe(() => fn(prompt()));
}
