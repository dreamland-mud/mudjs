/* The find windows of the desktop client: areas of the world, rooms of this
 * area and item search. */
import './strings';
import { registerTool } from '../tools';
import { registerView } from '../views';
import { t } from '../../i18n';
import { openFind } from './common';
import AreasView from './AreasView';
import $ from 'jquery';
import ItemsView from './ItemsView';
import RoomsView from './RoomsView';

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
// which walks to the room picked. In the map pane when it is on the screen
// (and on the phone's map page); otherwise a find window over the same map data.
export const OPEN_ROOM_LIST = 'map:roomlist';
registerView('rooms', RoomsView);
registerTool({
  id: 'rooms',
  label: () => t('rooms.title'),
  keys: ['alt+shift+o'],
  hash: 'rooms',
  help: () => t('rooms.about'),
  run: () => {
    const root = document.querySelector('.dl-mapper-root');
    if (root && root.getClientRects().length) $(document).trigger(OPEN_ROOM_LIST);
    else openFind('rooms');
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
