// Class badge icons for the login roster and the settings account page.
// Keyed by the engine's profession key -- that is class.en on the roster JSON,
// which is Profession::getName() (the profession's XML filename stem). Vite
// bundles + content-hashes each import; the value is the emitted asset URL.
import warrior from './classicons/warrior.png';
import ranger from './classicons/ranger.png';
import samurai from './classicons/samurai.png';
import thief from './classicons/thief.png';
import ninja from './classicons/ninja.png';
import paladin from './classicons/paladin.png';
import antipaladin from './classicons/anti-paladin.png';
import vampire from './classicons/vampire.png';
import cleric from './classicons/cleric.png';
import witch from './classicons/witch.png';
import warlock from './classicons/warlock.png';
import druid from './classicons/druid.png';
import necromancer from './classicons/necromancer.png';

const ICONS = {
  warrior,
  ranger,
  samurai,
  thief,
  ninja,
  paladin,
  'anti-paladin': antipaladin,
  vampire,
  cleric,
  witch,
  warlock,
  druid,
  necromancer,
};

// Defensive aliases: if an older or differently-worded engine hands over a
// plural, an abbreviation, or the arcane-mage synonym, still resolve to a badge.
const ALIAS = {
  warriors: 'warrior',
  rangers: 'ranger',
  thieves: 'thief',
  paladins: 'paladin',
  pal: 'paladin',
  antipaladin: 'anti-paladin',
  'anti-paladins': 'anti-paladin',
  ap: 'anti-paladin',
  clerics: 'cleric',
  witches: 'witch',
  warlocks: 'warlock',
  mage: 'warlock',
  mages: 'warlock',
  druids: 'druid',
  necromancers: 'necromancer',
  necr: 'necromancer',
  vampires: 'vampire',
};

// Resolve an engine class key (pass class.en, never a localized display name) to
// its badge asset URL, or null when unknown so the caller falls back to the
// letter sigil.
export function classIconFor(key) {
  if (!key) return null;
  const k = String(key).trim().toLowerCase();
  return ICONS[k] || ICONS[ALIAS[k]] || null;
}
