import $ from 'jquery';

// State UI accent: paint the client with a coloured inner glow that reflects the
// player's current state, so it's obvious at a glance without reading every line
// (matters most for players with fightspam off, where a quiet round prints little).
//
// The terminal vignette shows ONE state at a time -- the most urgent wins (see the
// priority list below) and lands on body[data-glow]; main.css draws the colour.
// The red combat input stroke and the red command buttons are a separate combat
// signal driven by body.mud-fighting, kept as-is.
//
// The heartbeat also tracks HP (both client-only, no server flag): the fight/rage/
// near-death pulse quickens as you bleed out (body --beat, from hit/max_hit), and
// under 25% HP the whole vignette turns to a heavy dark-crimson throb -- you're
// dying, so that owns the view over any other state.
//
// State flags are fields prompt.js keeps current on window.mudprompt from each web
// prompt (interprethandler.cpp webPrompt): fight, rage, blind, faerie, mind, poison,
// fade, hide (+ hit/max_hit). Colour is never the only signal -- the affects panel
// and the game messages carry the real state for screen readers; ambient flavour.
//   neardeath -> dark crimson, heavy throb (<=25% HP; beats faster the lower you go)
//   blind     -> white, heavy pulse (any AFF_BLIND: blindness spell, dirt kick...)
//   mind      -> purple (charmed / magically asleep / stunned)
//   fight     -> red heartbeat   (rage -> heavier red heartbeat)
//   faerie    -> pink (faerie fire -- you're lit up, easier to hit)
//   poison    -> green, slow sick pulse
//   fade      -> heavy grey (concealment, steady)
//   hide      -> grey (concealment, steady)
//
// Imported after ./prompt in main.js so window.mudprompt is already updated here.
$(function () {
  $('#rpc-events').on('rpc-prompt', function () {
    const p = window.mudprompt || {};
    const body = document.body;

    const fighting = p.fight > 0;
    // Berserk or frenzy (prompt.rage): the same red beat, several times heavier,
    // so rage reads as blood over the whole view. Gated on fighting -- a rage buff
    // still ticking in town shouldn't paint the client red.
    const raging = fighting && !!p.rage;

    // Combat classes still drive the input stroke + red button panel.
    body.classList.toggle('mud-fighting', fighting);
    body.classList.toggle('mud-rage', raging);

    // Heartbeat rate tracks HP: the fight/rage/near-death pulse quickens as you
    // bleed out, from 1.15s at full health toward ~0.55s near death (main.css reads
    // var(--beat)). nearDeath at or below a quarter HP flips the vignette to a heavy
    // dark-crimson throb that owns the view.
    const maxHit = p.max_hit;
    let nearDeath = false;
    if (maxHit > 0) {
      let frac = p.hit / maxHit;
      if (frac < 0) frac = 0;
      else if (frac > 1) frac = 1;
      body.style.setProperty('--beat', (0.55 + 0.6 * frac).toFixed(2) + 's');
      nearDeath = frac > 0 && frac <= 0.25;
    }

    // Single terminal vignette, most urgent state wins. Dying tops everything, then
    // blind (you can't see -- the white wash-out dominates), then mind, then combat,
    // then faerie fire, the slower afflictions, and the passive concealment glows.
    const glow =
      nearDeath ? 'neardeath' :
      p.blind ? 'blind' :
      p.mind ? 'mind' :
      raging ? 'rage' :
      fighting ? 'fight' :
      p.faerie ? 'faerie' :
      p.poison ? 'poison' :
      p.fade ? 'fade' :
      p.hide ? 'hide' : '';

    if (glow) body.dataset.glow = glow;
    else delete body.dataset.glow;
  });
});
