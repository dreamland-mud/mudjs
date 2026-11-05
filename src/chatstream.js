/* One place where a chat frame becomes a stored line.
 *
 * The chat panel archives every line the server sends (chatdb.js); other parts
 * of the client that follow chat (the chat buffer keys, chatbuffers.js) take
 * the line from here once it is archived, with the archive's id, so they never
 * miss one or count one twice. A line the archive refused (storage full,
 * blocked) is still handed on, without an id. */
import chatDb from './chatdb.js';

/* A chat frame's body as the archive keeps it. */
export function chatRow(b) {
  return {
    at: b.at || Math.floor(Date.now() / 1000),
    chan: b.id || '',
    kind: b.kind || 'world',
    dir: b.dir || 'in',
    text: b.text || '',
    name: (b.peer && b.peer.name) || '',
    anon: !!(b.peer && b.peer.anon),
    npc: !!(b.peer && b.peer.npc),
    key: (b.peer && b.peer.key) || '',
    area: b.area || '',
    quest: b.quest || 0,
    step: b.step || 0,
  };
}

const listeners = new Set();

/* fn(who, row) for every line archived from now on. Returns the unsubscribe. */
export function onArchived(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(who, row) {
  listeners.forEach(fn => {
    // A listener's failure must not cost the chat panel its line.
    try {
      fn(who, row);
    } catch (e) {
      console.error('chat listener failed', e);
    }
  });
}

/* Archive a line for `who`; resolves with the saved row (it carries its id). */
export function archiveChat(who, row) {
  return chatDb
    .then(db => db.append(who, row))
    .then(
      saved => {
        emit(who, saved);
        return saved;
      },
      err => {
        emit(who, row);
        throw err;
      }
    );
}
