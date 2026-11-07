/* Walking for the tools: a speedwalk the website publishes, which starts on
 * the Market Square of Midgaard. Alt+W is the same as sending "run <route>"
 * yourself, so it runs only from the Square; anywhere else the route waits in
 * the command line, with a word that it starts there. Nothing walks on its
 * own: the client never chooses a way to anywhere. */
import { echoHtml } from '../components/sysCommandUtils';
import { prompt, command } from './game';
import { t } from '../i18n';

export const MARKET_SQUARE = 3014;

export function run(route) {
  if (route) command('run ' + route);
}

/* From the Square: run it. Elsewhere: into the command line, said why. */
export function runFromSquare(route) {
  if (!route) return;
  if (Number(prompt().vnum) === MARKET_SQUARE) return run(route);
  putInInput('run ' + route);
  echoHtml(t('walk.fromsquare'));
}

/* Text into the command line (or another field), ready to send, without
 * sending it, the way React sees typing. */
export function putInInput(text, input = document.getElementById('inputBox')) {
  if (!input) return;
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, text);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.focus();
}
