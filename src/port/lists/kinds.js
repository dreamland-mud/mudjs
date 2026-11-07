/* Which typed command asks for which server list, and what each verb of a
 * row does. Kinds and verbs as the game sends them (WebList in the server's
 * comm, learn, note, quest and social plug-ins). */

// kind: the command's names and aliases in all three game languages, as
// dreamland_world/commands and notes list them.
const TYPED = {
  skills: 'skills умения навыки навички вміння',
  glist: 'glist группаумений групавмінь',
  help: 'help ? помощь справка допомога довідка',
  commands: 'commands команды команди',
  socials: 'socials социалы соціали',
  notes:
    'note news change story qnote crime penalty dream письмо новость изменение история квестнота преступление ' +
    'наказание сон лист новина зміна історія злочин покарання',
  areas: 'areas zones зоны зони',
  vault: 'vault хранилище тайник сховище схованка',
  quest_request: 'quest квест задание задания завдання',
};

const WORDS = Object.keys(TYPED).map(kind => [kind, TYPED[kind].split(' ')]);
// Every word the game takes for "quest request" (dreamland_world
// grammar/synonyms.json, "request"): the questor's own hint says просить.
const REQUEST = ['request', 'попросити', 'попросить', 'просить', 'получить', 'взяти', 'взять', 'take'];

/* "prac" for practice: the game takes a start of the word too. */
const starts = (typed, words) => words.some(w => w === typed || (typed.length >= 2 && w.startsWith(typed)));

/* The kinds of list a typed line may ask for: a short start of a word can
 * fit more than one command. */
export function kindsOf(line) {
  const words = String(line || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return WORDS.filter(([, list]) => starts(words[0], list))
    .map(([kind]) => {
      if (kind === 'quest_request') return words[1] && starts(words[1], REQUEST) ? kind : null;
      // glist with a group name shows that group.
      if (kind === 'glist' && words.length > 1) return 'group';
      return kind;
    })
    .filter(Boolean);
}

export const TITLES = {
  skills: 'tl.skills',
  glist: 'tl.glist',
  group: 'tl.group',
  help: 'tl.helpmatches',
  commands: 'tl.commands',
  socials: 'tl.socials',
  notes: 'tl.notes',
  areas: 'tl.areas',
  vault: 'tl.vault',
  quest_request: 'tl.questrequest',
};

/* verb: [label key, Alt letter, effect]. "refresh" asks for the list again
 * after the command, "close" closes the window so the answer shows in the
 * output, "open" shows the answer as the next list in the same window,
 * "target" and "input" put the command in the command line for the player to
 * finish. As in the desktop client's framelists.py. */
export const VERBS = {
  practice: ['tl.practice', 'p', 'refresh'],
  help: ['tl.help', 'h', 'close'],
  read: ['tl.read', 'r', 'close'],
  open: ['tl.openlist', 'o', 'open'],
  do: ['tl.dosocial', 'b', null],
  social_at: ['tl.socialat', null, 'target'],
  get: ['tl.get', 'g', 'refresh'],
  filter: ['tl.filter', 'f', 'open'],
  look: ['tl.look', 'l', 'close'],
  whois: ['tl.whois', 'w', 'close'],
  tell: ['tl.tell', 't', 'input'],
  path: ['tl.path', 'a', 'close'],
  request: ['tl.request', 'q', 'refresh'],
  buy: ['tl.buy', 'b', 'refresh'],
};
