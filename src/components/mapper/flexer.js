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
 * Return a copy of an area layout with every room name/description resolved for `sex`.
 * Layouts without any flexer switch (the common case) are returned by identity, so the
 * heavy d3 map and downstream effects don't see a fresh object on every sex/area tick.
 */
export function resolveLayoutFlexer(layout, sex) {
  if (layout == null) return layout;
  let touched = false;
  const rooms = {};
  for (const vnum in layout.rooms) {
    const room = layout.rooms[vnum];
    const name = resolveFlexer(room.name, sex);
    const description = resolveFlexer(room.description, sex);
    if (name !== room.name || description !== room.description) {
      rooms[vnum] = { ...room, name, description };
      touched = true;
    } else {
      rooms[vnum] = room;
    }
  }
  return touched ? { ...layout, rooms } : layout;
}
