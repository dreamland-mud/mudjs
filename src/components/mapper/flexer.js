/**
 * Resolve Dreamland gender (flexer) switches in graph text for a given player sex.
 *
 * The graph builder (dreamland_mapper build-graph.ts) preserves these switches verbatim
 * instead of baking one gender, so each player sees their own form. Colour codes are
 * already stripped at build time; only the {S…} switches remain.
 *
 *   {Sf<f>{Sm<m>{Sx   ->  <f> for female, <m> for male
 *   {Sm<m>{Sf<f>{Sx   ->  <m> for male,   <f> for female
 *   {Sf<f>{Sx         ->  <f> for female, ''  for male   (the male form is the bare stem)
 *   {Sm<m>{Sx         ->  <m> for male,   ''  for female
 *
 * Unknown/neutral sex falls back to the male form, matching the engine's default and the
 * map's previous (male-baked) behaviour.
 */
export function resolveFlexer(text, sex) {
  if (text == null || text.indexOf('{S') === -1) return text;
  const want = sex === 'female' ? 'f' : 'm';
  return text.replace(
    /\{S([mf])([^{]*)(?:\{S([mf])([^{]*))?\{Sx/g,
    (_match, g1, t1, g2, t2) => {
      if (g1 === want) return t1;
      if (g2 === want) return t2 || '';
      return '';
    }
  );
}

/**
 * Resolve the name/description pair of one entity. Returns null when nothing changed,
 * so callers can keep the original object and its identity.
 */
function resolveEntity(entity, sex) {
  if (entity == null) return null;
  const name = resolveFlexer(entity.name, sex);
  const description = resolveFlexer(entity.description, sex);
  if (name === entity.name && description === entity.description) return null;
  return { ...entity, name, description };
}

/**
 * Return a copy of an area layout with every room name/description resolved for `sex`.
 * Layouts without any flexer switch (the common case) are returned by identity, so the
 * heavy d3 map and downstream effects don't see a fresh object on every sex/area tick.
 *
 * The base fields are the RUSSIAN text. An en/ua player reads room.i18n[loc] instead
 * (i18n.ts nameFor/descFor), and those overrides carry their own switches -- resolve
 * them too, or the map shows raw {Sm…{Sf…{Sx to everyone outside RU.
 */
export function resolveLayoutFlexer(layout, sex) {
  if (layout == null) return layout;
  let touched = false;
  const rooms = {};
  for (const vnum in layout.rooms) {
    const room = layout.rooms[vnum];
    const base = resolveEntity(room, sex);

    let i18n = null;
    if (room.i18n != null) {
      const en = resolveEntity(room.i18n.en, sex);
      const ua = resolveEntity(room.i18n.ua, sex);
      if (en != null || ua != null) {
        i18n = { ...room.i18n };
        if (en != null) i18n.en = en;
        if (ua != null) i18n.ua = ua;
      }
    }

    if (base != null || i18n != null) {
      rooms[vnum] = { ...(base || room) };
      if (i18n != null) rooms[vnum].i18n = i18n;
      touched = true;
    } else {
      rooms[vnum] = room;
    }
  }
  return touched ? { ...layout, rooms } : layout;
}
