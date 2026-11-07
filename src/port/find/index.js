/* The find windows of the desktop client: areas of the world, rooms of this
 * area and item search. */
import './strings';
import { registerTool } from '../tools';
import { registerView } from '../views';
import { t } from '../../i18n';
import { openFind } from './common';
import AreasView from './AreasView';
import $ from 'jquery';
import { say } from '../speak';
import ItemsView from './ItemsView';

registerView('areas', AreasView);
registerTool({
  id: 'areas',
  label: () => t('areas.title'),
  keys: ['ctrl+e'],
  hash: 'areas',
  help: () => t('areas.about'),
  run: arg => openFind('areas', arg),
});

// The rooms of this area: the mapper's own room list (the map's List view),
// which walks to the room picked. Only its key lives here.
export const OPEN_ROOM_LIST = 'map:roomlist';
registerTool({
  id: 'rooms',
  label: () => t('rooms.title'),
  keys: ['alt+shift+o'],
  hash: 'rooms',
  help: () => t('rooms.about'),
  run: () => {
    $(document).trigger(OPEN_ROOM_LIST);
    // The map window can be closed on a computer: say so, not nothing.
    setTimeout(() => {
      const root = document.querySelector('.dl-mapper-root');
      if (!root || !root.getClientRects().length) say(t('rooms.nomap'));
    }, 400);
  },
});

registerView('items', ItemsView);
registerTool({
  id: 'items',
  label: () => t('items.title'),
  keys: ['ctrl+k'],
  hash: 'items',
  help: () => t('items.about'),
  run: arg => openFind('items', arg),
});
