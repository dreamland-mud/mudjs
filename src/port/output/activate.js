/* Run a link kept in the line ring the way a click on it in the output does
 * (manip.js, cmdinput.jsx): the page element may be long gone. */
import { send } from '../../websock';
import { echo } from '../../input';
import Commands, { splitCommand, getSystemCmd, errCmdDoesNotExist } from '../../components/SysCommands';
import { echoHtml } from '../../components/sysCommandUtils';
import { t } from '../../i18n';
import { say, tf } from './speak';

export function runCommand(action, echoText) {
  if (!action) return;
  // The product link of a blueprint starts a craft: asked once, as on a click.
  if (/^craft \d+$/.test(action) && !window.confirm(t('confirm.craft'))) return;
  echo(echoText);
  send(action);
}

export function runBuiltin(action, echoText) {
  const { sysCmd, sysCmdArgs } = splitCommand(action);
  const command = getSystemCmd(sysCmd);
  echo(echoText);
  if (!command) return echoHtml(errCmdDoesNotExist);
  Commands[command].payload(sysCmdArgs);
}

/* Item menu entries send without an echo, as a click on them does. */
export function runMenuItem(item) {
  if (item && item.action) send(item.action);
}

export function activate(link, delay) {
  if (!link) return;
  if (link.kind === 'cmd') return runCommand(link.action, link.echo);
  if (link.kind === 'builtin') return runBuiltin(link.action, link.echo);
  if (link.kind === 'url' && link.href) {
    say(tf('out.links.open', link.href), delay);
    window.open(link.href, '_blank', 'noopener');
  }
}
