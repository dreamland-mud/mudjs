import $ from 'jquery';

// Boss phase flash: a one-shot coloured burst over the terminal when a
// champion, boss or legend changes phase. The server sends it right after the
// phase scene (Fenia utils/combat ai phaseFlash), as
//   boss_phase(kind, tier)  kind = control | panic, tier = tier_champion | tier_boss | tier_legend
// The scene text is the real signal (screen readers get it like any line);
// this is ambient flavour on the .terminal-flash layer, separate from the
// data-glow state vignette so the two never fight. theme-parchment.css draws it.
const FLASH_MS = 1500;
const TIERS = { tier_champion: 'champion', tier_boss: 'boss', tier_legend: 'legend' };

let timer = null;

$(function () {
  $('#rpc-events').on('rpc-boss_phase', function (e, kind, tier) {
    if (kind !== 'control' && kind !== 'panic') return;
    const body = document.body;

    // Restart the animation if a second change lands mid-flash.
    clearTimeout(timer);
    delete body.dataset.flash;
    void body.offsetWidth;

    body.dataset.flash = kind;
    body.dataset.flashTier = TIERS[tier] || 'boss';
    timer = setTimeout(function () {
      delete body.dataset.flash;
      delete body.dataset.flashTier;
    }, FLASH_MS);
  });
});
