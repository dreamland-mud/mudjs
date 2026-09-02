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
// Every flag is a field prompt.js keeps current on window.mudprompt from each web
// prompt (interprethandler.cpp webPrompt): fight, rage, blind, mind, poison, fade,
// hide. Colour is never the only signal -- the affects panel and the game messages
// carry the real state for screen readers; this is ambient flavour on top.
//   blind  -> white, heavy (any AFF_BLIND: blindness spell, dirt kick...)
//   mind   -> purple (charmed / magically asleep / stunned)
//   fight  -> red heartbeat   (rage -> heavier red heartbeat)
//   poison -> green, slow sick pulse
//   fade   -> heavy grey (concealment, steady)
//   hide   -> grey (concealment, steady)
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

    // Single terminal vignette, most urgent state wins. Blind tops it (you can't
    // see -- the white wash-out dominates), then mind, then combat, then the
    // slower afflictions and the passive concealment glows.
    const glow =
      p.blind ? 'blind' :
      p.mind ? 'mind' :
      raging ? 'rage' :
      fighting ? 'fight' :
      p.poison ? 'poison' :
      p.fade ? 'fade' :
      p.hide ? 'hide' : '';

    if (glow) body.dataset.glow = glow;
    else delete body.dataset.glow;
  });
});
