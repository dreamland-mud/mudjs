/* Chat buffers and reading positions for the chat buffer keys (chatbuffers.js).
 * No DOM and no side effects, so tests can drive it directly.
 *
 * Every row is in "all" and in one buffer of its own: tells, group, room,
 * creatures, or the channel it came on. Each buffer keeps its own `keep` newest
 * rows, so a busy channel never pushes a quiet buffer's tells out. A buffer's
 * reading position is the row last read (not an index), so dropped or arriving
 * rows never move it; no position means "past the newest row". */
export const ALL = 'all';
export const CHANNEL = 'chan:'; // channel buffers are 'chan:ooc' and so on
const KIND_BUFFERS = { personal: 'tells', group: 'group', room: 'room', mob: 'mob' };

/* The buffer a chat row belongs to, besides "all". Channels keep the game's own
 * channel name (ooc, gossip), the word players type to talk on them, under a
 * prefix of their own: a channel called "room" or "all" is not those buffers. */
export function bufferOf(row) {
  const kind = row.kind || 'world';
  if (Object.prototype.hasOwnProperty.call(KIND_BUFFERS, kind)) return KIND_BUFFERS[kind];
  return row.chan ? CHANNEL + row.chan : 'other';
}

export function createStore(keep = 1000) {
  const s = {
    // Maps, not objects: buffer names come from the server, and a channel
    // called "constructor" must not find something on Object.prototype.
    lists: new Map([[ALL, []]]),
    order: [ALL],
    current: ALL,
    pos: new Map(),
    reset() {
      s.lists = new Map([[ALL, []]]);
      s.order = [ALL];
      s.current = ALL;
      s.pos = new Map();
    },
    add(row) {
      const b = bufferOf(row);
      if (!s.lists.has(b)) {
        s.lists.set(b, []);
        s.order.push(b);
      }
      [s.lists.get(ALL), s.lists.get(b)].forEach(list => {
        list.push(row);
        if (list.length > keep) list.splice(0, list.length - keep);
      });
    },
    rowsOf(name) {
      return s.lists.get(name || s.current) || [];
    },
    switch(step) {
      const i = s.order.indexOf(s.current);
      s.current = s.order[(i + step + s.order.length) % s.order.length];
      return s.current;
    },
    /* The row `step` away from the reading position, and 'top', 'end' or
     * 'empty' at the edges. From no position, older starts at the newest row
     * and newer reads the newest row, neither of them an edge. */
    move(step) {
      const rows = s.rowsOf();
      if (!rows.length) return { row: null, edge: 'empty' };
      const at = s.pos.get(s.current);
      let p;
      if (!at) {
        p = step < 0 ? rows.length + step : rows.length - 1;
      } else {
        p = rows.lastIndexOf(at);
        // The row read last was dropped as the oldest: newer reads on from
        // the top, older is at the top already.
        p = p < 0 ? (step > 0 ? step - 1 : -1) : p + step;
      }
      let edge = null;
      if (p < 0) {
        p = 0;
        edge = 'top';
      } else if (p >= rows.length) {
        p = rows.length - 1;
        edge = 'end';
      }
      s.pos.set(s.current, rows[p]);
      return { row: rows[p], edge };
    },
    jump(toEnd) {
      const rows = s.rowsOf();
      if (!rows.length) return null;
      s.pos.set(s.current, rows[toEnd ? rows.length - 1 : 0]);
      return s.pos.get(s.current);
    },
  };
  return s;
}
