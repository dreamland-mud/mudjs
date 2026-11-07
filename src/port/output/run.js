/* Continue a run the game stopped. The game sends the rest of the speedwalk in
 * the run_left frame ("" once a run is over); as a fallback the line "You
 * still have left to run: ..." gives it too. Ctrl+Shift+R and #continue send
 * "run <rest>". A new run typed or clicked forgets the old rest. */
import $ from 'jquery';
import { registerTool } from '../tools';
import { command } from '../game';
import { t } from '../../i18n';
import { onLines } from './ring';
import { say } from './speak';

const RUN_LEFT = ['You still have left to run:', 'Тобі залишалося бігти:', 'Тебе оставалось бежать:'];

let runLeft = null; // the command that continues the run
let toldAt = 0;

function remember(cmd) {
  if (!cmd) return;
  const fresh = cmd !== runLeft || Date.now() - toldAt > 3000;
  runLeft = cmd;
  // The frame and the line both come for one stop: said once.
  if (fresh) {
    toldAt = Date.now();
    say(t('out.run.stopped'));
  }
}

const isRun = text => {
  const w = text.trim().toLowerCase().split(/\s+/)[0];
  return w === 'run' || w === t('echo.run').toLowerCase();
};

onLines(fresh => {
  fresh.forEach(line => {
    const text = line.text.trim();
    if (line.echo) {
      if (isRun(text)) runLeft = null;
      return;
    }
    const head = RUN_LEFT.find(h => text.startsWith(h));
    if (!head) return;
    const link = line.links.find(l => l.kind === 'cmd' && /^run /.test(l.action || ''));
    const rest = text.slice(head.length).trim();
    remember(link ? link.action : rest ? 'run ' + rest : null);
  });
});

$(function () {
  $('#rpc-events').on('rpc-run_left.portoutput', (e, a) => {
    const path = a && typeof a.path === 'string' ? a.path.trim() : '';
    if (path) remember('run ' + path);
    else runLeft = null;
  });
});

export function continueRun() {
  if (!runLeft) return say(t('out.run.none'));
  const cmd = runLeft;
  runLeft = null;
  command(cmd);
}

registerTool({
  id: 'out-run',
  label: () => t('out.run'),
  keys: ['ctrl+shift+r'],
  hash: 'continue',
  run: () => continueRun(),
});
