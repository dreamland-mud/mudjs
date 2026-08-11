import $ from 'jquery';

// Combat UI accent: while the player is fighting, paint the client red -- a red
// stroke on the command input and a faint red inner glow around the terminal --
// so it's obvious at a glance that combat is live (matters most for players with
// fightspam off, where a quiet round prints little or nothing).
//
// Driven by window.mudprompt.fight (>0 while fighting), which prompt.js keeps
// current from every web prompt (interprethandler webPrompt -> prompt.fight).
// We only toggle a body class; the styling lives in main.css (body.mud-fighting)
// and auto-reverts the instant combat ends (fight drops back to 0). Imported
// after ./prompt in main.js so window.mudprompt is already updated when we read it.
$(function () {
  $('#rpc-events').on('rpc-prompt', function () {
    const fighting = !!(window.mudprompt && window.mudprompt.fight > 0);
    document.body.classList.toggle('mud-fighting', fighting);
    // Berserk or frenzy (prompt.rage, set in interprethandler.cpp): same heartbeat,
    // several times heavier, so rage reads as blood over the whole view. Gated on
    // fighting -- a rage buff still ticking in town shouldn't paint the client red.
    const raging = fighting && !!(window.mudprompt && window.mudprompt.rage);
    document.body.classList.toggle('mud-rage', raging);
  });
});
