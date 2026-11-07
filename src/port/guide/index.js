/* The game guide: Ctrl+J, or Alt+Shift with the first letter of a tab. */
import $ from 'jquery';
import './strings';
import { registerTool } from '../tools';
import { registerView } from '../views';
import { t } from '../../i18n';
import GuideView, { TABS, OPEN } from './GuideView';

const open = tab => $(document).trigger(OPEN, [tab]);

registerTool({
  id: 'guide',
  label: () => t('guide.title'),
  keys: ['ctrl+j'],
  hash: 'guide',
  inDialog: true,
  help: () => t('guide.help'),
  run: arg => {
    const word = String(arg || '').trim().toLowerCase();
    open(TABS.find(id => word && id.startsWith(word)));
  },
});

TABS.forEach(id =>
  registerTool({
    id: 'guide-' + id,
    label: () => t('guide.title') + ': ' + t('guide.tab.' + id),
    keys: ['alt+shift+' + id[0]],
    menu: false,
    inDialog: true,
    run: () => open(id),
  })
);

registerView('guide', GuideView);
