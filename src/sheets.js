import $ from 'jquery';

// One side-sheet at a time. Every sheet announces itself when it opens, and
// every sheet steps aside when someone else announces. The sheets never learn
// about each other, so a new sheet joins by calling these two and nothing more.
const OPEN = 'sheet:open';

export function announceSheet(id) {
  $(document).trigger(OPEN, [id]);
}

// Calls close() whenever a sheet other than `id` opens. Returns the unsubscribe.
export function onOtherSheet(id, close) {
  const handler = (e, who) => {
    if (who !== id) close();
  };
  $(document).on(OPEN, handler);
  return () => $(document).off(OPEN, handler);
}

// The legacy bootstrap modals (the Fenia and text editors) are opened by the
// server, not by a button, so they announce through bootstrap's own event.
// Nothing needs to close them in turn: their backdrop covers every button that
// could open another sheet.
$(document).on('show.bs.modal', () => announceSheet('modal'));
