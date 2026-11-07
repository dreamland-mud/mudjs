/* Small keys from the desktop client: help search, chat history, settings,
 * text size. */
import $ from 'jquery';
import { registerTool } from '../tools';
import { putInInput } from '../walk';
import { say } from '../speak';
import { t } from '../../i18n';
import './strings';

registerTool({
  id: 'helpsearch',
  label: () => t('misc.helpsearch'),
  keys: ['f1'],
  hash: 'helpsearch',
  // The help box of the status panels (panelHelp.jsx) already searches the
  // help: the key goes there, opening its panel first (on a phone, the
  // panels page), with what was typed after #helpsearch as the search.
  run: arg => {
    $(document).trigger('panel:help');
    setTimeout(() => {
      const table = document.getElementById('help-table');
      if (table && table.classList.contains('collapse') && !table.classList.contains('show')) {
        const toggle = document.querySelector('#help [data-target="#help-table"]');
        if (toggle) toggle.click();
      }
      setTimeout(() => {
        const box = document.querySelector('#help-table input');
        // The panel window can be closed on a computer: say so, not nothing.
        if (!box || !box.getClientRects().length) return say(t('misc.nohelpbox'));
        if (arg) {
          putInInput(arg, box);
        }
        box.focus();
      }, 250);
    }, 150);
  },
});

registerTool({
  id: 'chathistory',
  label: () => t('misc.chat'),
  keys: ['ctrl+h'],
  run: () => $(document).trigger('chat:open'),
});

registerTool({
  id: 'settings',
  menu: false, // spoken only, or Settings itself: not on the Tools page
  label: () => t('misc.settings'),
  keys: ['ctrl+shift+o'],
  run: () => $(document).trigger('settings:open'),
});

registerTool({
  id: 'fontplus',
  label: () => t('misc.fontplus'),
  keys: ['ctrl+='],
  menu: false,
  run: () => $('#font-plus-button').trigger('click'),
});

registerTool({
  id: 'fontminus',
  label: () => t('misc.fontminus'),
  keys: ['ctrl+-'],
  menu: false,
  run: () => $('#font-minus-button').trigger('click'),
});
