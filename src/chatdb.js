// Chat history, one shelf per character.
//
// The panel keeps every line it was ever sent, and a player who talks all
// evening collects thousands. Holding them in memory would make the page pay
// for the whole history on every render, so the store below is the archive and
// the panel keeps only a window of the newest ones -- the same trade the
// terminal makes with its own IndexedDB store (historydb.js).
//
// A DATABASE OF ITS OWN, not another store in 'dreamland'. That one guards a
// single tab: every read checks the session id and sends the loser to
// about:blank. Chat has no such rule -- a second tab may read the archive -- and
// bumping that database's version to add a store would drag its upgrade path
// into this feature for nothing.
//
// The key is [who, id]: one compound index answers both questions the panel
// asks -- the newest N lines of this character, and the N before a given id --
// without loading anyone else's history to get there.

const DB_NAME = 'dreamland-chat';
const STORE = 'messages';
const INDEX = 'who_id';

// Nothing is lost when IndexedDB is missing or blocked (private window, storage
// off): the panel still shows what arrives while the page is open, and only the
// archive is gone. Refusing to run at all would be worse.
function memoryDb() {
  const rows = [];
  let seq = 0;

  return {
    append(who, msg) {
      const row = Object.assign({}, msg, { who: who, id: ++seq });
      rows.push(row);
      return Promise.resolve(row);
    },
    loadLast(who, limit) {
      return Promise.resolve(rows.filter(r => r.who === who).slice(-limit));
    },
    loadOlder(who, beforeId, limit) {
      const mine = rows.filter(r => r.who === who && r.id < beforeId);
      return Promise.resolve(mine.slice(Math.max(0, mine.length - limit)));
    },
    clear(who) {
      for (let i = rows.length - 1; i >= 0; i--) {
        if (rows[i].who === who) rows.splice(i, 1);
      }
      return Promise.resolve();
    },
  };
}

function openDb() {
  return new Promise((accept, reject) => {
    const request = window.indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      const store = db.createObjectStore(STORE, {
        keyPath: 'id',
        autoIncrement: true,
      });
      store.createIndex(INDEX, ['who', 'id']);
    };

    request.onerror = () => reject(request.error);
    request.onsuccess = () => accept(request.result);
  });
}

function indexedDb() {
  return openDb().then(db => {
    // A cursor walked backwards from the newest entry, stopping at `limit`.
    // Both reads want the same thing in opposite order, so they share it: the
    // newest first while walking, oldest first in the answer, because that is
    // the order the panel paints.
    function back(who, upper, open, limit) {
      return new Promise(accept => {
        const out = [];
        const range = IDBKeyRange.bound([who, 0], [who, upper], false, open);
        const cursor = db
          .transaction([STORE], 'readonly')
          .objectStore(STORE)
          .index(INDEX)
          .openCursor(range, 'prev');

        cursor.onsuccess = e => {
          const at = e.target.result;
          if (at && out.length < limit) {
            out.push(at.value);
            at.continue();
            return;
          }
          out.reverse();
          accept(out);
        };
        cursor.onerror = () => accept(out);
      });
    }

    return {
      append(who, msg) {
        return new Promise((accept, reject) => {
          const row = Object.assign({}, msg, { who: who });
          const add = db
            .transaction([STORE], 'readwrite')
            .objectStore(STORE)
            .add(row);

          add.onsuccess = e => accept(Object.assign(row, { id: e.target.result }));
          add.onerror = () => reject(add.error);
        });
      },

      loadLast(who, limit) {
        return back(who, Infinity, false, limit);
      },

      // Strictly older than beforeId: the panel already holds that line, and a
      // repeat would show up as a duplicate at the seam.
      loadOlder(who, beforeId, limit) {
        return back(who, beforeId, true, limit);
      },

      clear(who) {
        return new Promise(accept => {
          const range = IDBKeyRange.bound([who, 0], [who, Infinity]);
          const cursor = db
            .transaction([STORE], 'readwrite')
            .objectStore(STORE)
            .index(INDEX)
            .openCursor(range);

          cursor.onsuccess = e => {
            const at = e.target.result;
            if (at) {
              at.delete();
              at.continue();
              return;
            }
            accept();
          };
          cursor.onerror = () => accept();
        });
      },
    };
  });
}

const chatDb = window.indexedDB
  ? indexedDb().catch(() => {
      console.log('chat history: IndexedDB unavailable, keeping this session only');
      return memoryDb();
    })
  : Promise.resolve(memoryDb());

export default chatDb;
