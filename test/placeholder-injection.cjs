// Regression test for bracket placeholders in terminal output: player-typed
// [read=]/[look=]/[cmd=]/[map=] must never become a link that sends anything
// but a look/examine of a plain word, must never break out of an attribute,
// and must never borrow a server link's nonce. Legit server shapes must still
// render.
//
// Run from the repo root (jsdom is not a project dependency):
//   npm i --no-save jsdom && npm test
// Needs Node 20.19+ or 22.7+: it import()s ES modules from a package with no
// "type" field. Exits 1 on any failure.
//
// It loads src/placeholders.js, the module manip.js runs every output chunk
// through, and checks that manip.js still delegates to it and parses no
// placeholder on its own. Input goes through a parse + serialize round trip,
// the way the terminal builds a span and reads span.html() back. The help
// sheet (helpMarkup.js render) runs the same tokenizer and is driven too.
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// runScripts so that an injected inline handler would really run on hover.
const dom = new JSDOM('<!doctype html><div id=in></div><div id=out></div>', { runScripts: 'dangerously' });
global.document = dom.window.document;

const NONCE = 'K7QW2M9P';
const T = {
  'echo.examine': 'изучить',
  'echo.look': 'смотреть',
  'help.openMap': 'Open map',
};
const t = k => T[k];

// What the server does to player text before it reaches the client
// (mudtags.cpp html_escape): only < and > are escaped.
const player = s => s.replace(/</g, '&lt;').replace(/>/g, '&gt;');

let failed = 0;
function check(name, ok, detail) {
  if (!ok) failed++;
  console.log((ok ? 'ok   ' : 'FAIL ') + name.padEnd(28) + (detail ? ' ' + detail : ''));
}

function audit(replacePlaceholders, serverHtml, linkSel) {
  const inEl = document.getElementById('in');
  inEl.innerHTML = serverHtml;
  const html = inEl.innerHTML;
  return show(replacePlaceholders(html, { nonce: NONCE, t }), linkSel || '.manip-cmd');
}

function show(out, linkSel) {
  const el = document.getElementById('out');
  el.innerHTML = out;
  const all = [...el.querySelectorAll('*')];
  all.forEach(e => e.dispatchEvent(new dom.window.MouseEvent('mouseover', { bubbles: true })));
  return {
    handlers: all.filter(e => [...e.attributes].some(a => /^on/i.test(a.name))).length,
    links: [...el.querySelectorAll(linkSel)].map(e => e.getAttribute('data-action')),
    labels: [...el.querySelectorAll(linkSel)].map(e => e.innerHTML),
    anchors: [...el.querySelectorAll('a')].map(e => e.getAttribute('href')),
    text: el.textContent,
  };
}

const n = NONCE;
const cmd = (c, see) => `[cmd=${c},see=${see},nonce=${n}]`;
const fill = (c, see) => `[fill=${c},see=${see},nonce=${n}]`;

// Each case: server html, expected data-action list, optional extra check.
const cases = {
  // --- player text, must give no link (or only a harmless look/examine)
  // The inner [look=q,see=x] is a well-formed look of a plain word: harmless.
  chain: [player('[read=x [look=q,see=x],see=" onmouseover="window.PWNED=1]" hi'), ['look q']],
  pipe: [player('[look=x|give all.gold vasya,see=free gold]'), []],
  quote: [player('[look=x" onmouseover="alert(1),see=y]'), []],
  entity_pipe: [player('[look=x&#124;give all.gold vasya,see=y]'), []],
  entity_quote: [player('[look=x&#34; onmouseover=&#34;alert(1),see=y]'), []],
  semicolon: [player('[look=x;give,see=y]'), []],
  raw_backspace: [player('[look=\b\b\b\b\bwho,see=who]'), []],
  entity_backspace: [player('[look=&#8;&#8;&#8;&#8;&#8;who,see=who]'), []],
  hex_backspace: [player('[read=&#x8;&#x8;&#x8;&#x8;&#x8;&#x8;&#x8;&#x8;&#x8;who who,see=who]'), []],
  backspace_in_see: [player('[look=door,see=&#8;door]'), []],
  del_char: [player('[look=&#127;who,see=who]'), []],
  raw_tab: [player('[look=a\tb,see=a]'), []],
  newline: [player('[look=a\nquit,see=a]'), []],
  nested: [player('[look=a,see=[look=b|x,see=c]]'), []],
  nested_read: [player('[read=a [read=b,see=b],see=a]'), ["examine 'b'"]],
  forged_nonce: [player('[cmd=give all.gold vasya,see=free gold,nonce=ABCDEFGH]'), [], r => r.text === 'free gold'],
  forged_map: [player('[map=x.are" onclick="alert(1)]'), []],
  shape_a: [player('[cmd=give all.gold vasya,see=x ') + cmd('whois Trank', 'Trank'), []],
  shape_b: [player('[cmd=give all.gold vasya,see=x[look=zzz') + cmd('oedit 5', '5') + ']', []],
  shape_c: [`[cmd=oedit 5,see=x ${player('[cmd=give all.gold vasya,see=y')},nonce=${n}]`, []],
  shape_c_closed: [`[cmd=oedit 5,see=x ] ${player('[cmd=give all.gold vasya,see=y')},nonce=${n}]`, []],
  shape_c_in_cmd: [`[cmd=say ${player('[cmd=give all.gold vasya,see=y')},see=z,nonce=${n}]`, []],
  server_backspace: [cmd('look &#8;&#8;&#8;&#8;&#8;who', 'x'), []],
  server_quote: [cmd('say "hi" onmouseover="x', 'say'), ['say "hi" onmouseover="x']],

  // --- legit server shapes
  read_look: [
    'A [read=sign знак,see=sign] and [look=door,see=door] and [read=note note,see=note].',
    ["examine 'sign знак'", 'look door', "examine 'note note'"],
  ],
  read_cyrillic: ['[read=табличка табличку,see=табличку]', ["examine 'табличка табличку'"]],
  read_ua_apostrophe: ["[read=note памятка пам'ятка,see=пам'ятка]", ["examine 'note памятка пам'ятка'"]],
  read_ua_modifier: ['[read=камʼяний камень,see=камʼяний]', ["examine 'камʼяний камень'"]],
  read_apostrophe: ["[read=shopkeeper's note,see=note]", ["examine 'shopkeeper's note'"]],
  read_dot_dash: ['[read=s.t-r_ange word,see=word]', ["examine 's.t-r_ange word'"]],
  read_not_a_word: ['[read=sign знак,see=board]', []],
  look_ua: ['[look=двері,see=двері]', ['look двері']],
  map: ['[map=midgaard.are]', [], r => r.anchors[0] === 'https://dreamland.rocks/maps.html#midgaard'],
  map_upper: ['[MAP=midgaard.are]', [], r => r.anchors.length === 0],
  exits: [exitsLine(), ['выходы', 'север', 'восток']],
  confirm_row: [
    `<span class="fg-G">[</span>${cmd('confirm accept Vasya', 'Подтвердить')}<span class="fg-G">] </span>` +
      `<span class="fg-R">[</span>${cmd("confirm reject Vasya Прочти 'справка описание'", 'Отклонить')}<span class="fg-R">]</span>`,
    ['confirm accept Vasya', "confirm reject Vasya Прочти 'справка описание'"],
  ],
  list_rows: [
    `[${cmd('oedit $1', ' 3001')}] a sword\n[${cmd('oedit $1', '  42')}] a shield\n`,
    ['oedit  3001', 'oedit   42'],
    r => r.labels.join('|') === '3001|42',
  ],
  dollar_label: [cmd('medit $1', '3001') + ' ' + cmd('raceedit $1', 'human       '), ['medit 3001', 'raceedit human       ']],
  edit_buttons: [
    ['edit', 'save', 'done', 'cancel', 'show'].map(l => cmd('redit|show 3001', l)).join(' '),
    ['redit|show 3001', 'redit|show 3001', 'redit|show 3001', 'redit|show 3001', 'redit|show 3001'],
    r => r.labels.every(l => /^<i class="fa fa-[a-z-]+"><\/i>$/.test(l)),
  ],
  dollar_pattern_label: [cmd('oedit $1', "$'x"), ["oedit $'x"]],
  whois_alts: [cmd('whois Trank', 'Trank') + ' ' + cmd('alts Inis', 'pair'), ['whois Trank', 'alts Inis']],
  ed_then_cmd: ['[read=sign,see=sign] ' + cmd('whois Trank', 'Trank'), ["examine 'sign'", 'whois Trank']],
  refused_ed_then_cmd: [player('[look=a|b,see=c] ') + cmd('whois Trank', 'Trank'), ['whois Trank']],

  // --- round 3: fake nonce tails, long labels, collateral of a stray opener
  decoy_label: [`[cmd=oedit 5,see=${player('x,nonce=AAAAAAAA] [cmd=give all.gold vasya,see=free gold')},nonce=${n}]`, []],
  decoy_cmd: [`[cmd=say ${player('hi,see=q,nonce=AAAAAAAA] [cmd=give all.gold vasya,see=y')},see=z,nonce=${n}]`, []],
  decoy_then_clean: [
    `[cmd=oedit 5,see=${player('x,nonce=AAAAAAAA] [cmd=give all.gold vasya,see=free gold')},nonce=${n}] ` + cmd('whois Trank', 'Trank'),
    ['whois Trank'],
  ],
  quest_list_long_titles: [questList([[4505, 'T'.repeat(73)], [4506, 'Глава шоста: дуже довга назва навчального квесту для новачків'], [29120, 'Ремонт дверей']]),
    ['quest 4505', 'quest 4505', 'quest 4506', 'quest 4506', 'quest 29120', 'quest 29120']],
  quest_title_over_cap: [questList([[4505, 'T'.repeat(121)], [29120, 'Ремонт дверей']]),
    ['quest 4505', 'quest 29120'],
    r => !/\[cmd=quest 29120/.test(r.text) && r.text.includes('29120') && r.text.includes('Ремонт дверей')],
  upper_unmatched_nonce: [`[CMD=x,SEE=${'y'.repeat(121)},NONCE=${n}]`, []],
  gossip_then_exits: [
    player('Vasya gossips: [look=foo') + '\n' + exitsLine(),
    ['север', 'восток'],
    r => !/\[cmd=/i.test(r.text) && r.text.includes('[Выходы: ') && r.text.includes('север'),
  ],
};

function exitsLine() {
  return `<span class="fg-c">[</span><span class="fg-C">${cmd('выходы', 'Выходы')}</span>` +
    `<span class="fg-c">:</span><span class="fg-C"> ${cmd('север', 'север')} *${cmd('восток', 'восток')}*</span>` +
    '<span class="fg-c">]</span>';
}

// quest/newinfo:189-194: an id link and a title link per active quest.
function questList(quests) {
  return quests.map(([id, title]) =>
    `<span class="fg-y">[</span><span class="fg-W">${cmd('quest ' + id, String(id).padStart(5))}</span>` +
    `<span class="fg-y">] </span><span class="fg-Y">${cmd('quest ' + id, title)}</span>` +
    `<span class="fg-y">, zone Midgaard</span>\n<span class="fg-y">step text</span>\n\n`).join('');
}

// Fill links (.manip-fill): the command goes into the command line, never
// sent. Each case: server html, expected fill actions, expected cmd actions.
const fillCases = {
  fill_legit: [fill('whois Trank note ', '+ note'), ['whois Trank note '], []],
  fill_upper: [`[FILL=whois Trank note,see=note,nonce=${n}]`, ['whois Trank note'], []],
  fill_forged_nonce: [player('[fill=deny Kit,see=add note,nonce=ABCDEFGH]'), [], []],
  fill_stray_kills_next: [player('[fill=deny Kit,see=x ') + fill('whois Trank note', 'note'), [], []],
  fill_stray_kills_cmd: [player('[fill=deny Kit,see=x ') + cmd('whois Trank', 'Trank'), [], []],
  cmd_stray_kills_fill: [player('[cmd=deny Kit,see=x ') + fill('whois Trank note', 'note'), [], []],
  fill_then_cmd: [fill('whois Trank note', 'note') + ' ' + cmd('whois Trank', 'Trank'), ['whois Trank note'], ['whois Trank']],
  fill_backspace: [fill('look &#8;&#8;&#8;who', 'x'), [], []],
  fill_quote: [fill('note "x" onmouseover="y', 'note'), ['note "x" onmouseover="y'], []],
};

// Help sheet (quest/affects/whois output): helpMarkup.render, buttons.
const helpCases = {
  help_legit: [cmd('quest 4501', 'Глава перша') + ' ' + cmd('whois Trank', 'Trank'), ['quest 4501', 'whois Trank']],
  help_amp_action: [cmd('say a &amp; b', 'say'), ['say a & b']],
  help_shape_a: [player('[cmd=give all.gold vasya,see=open ') + cmd('whois Trank', 'Trank'), []],
  help_shape_c: [`[cmd=oedit 5,see=x ${player('[cmd=give all.gold vasya,see=y')},nonce=${n}]`, []],
  help_decoy: [`[cmd=oedit 5,see=${player('x,nonce=AAAAAAAA] [cmd=give all.gold vasya,see=free gold')},nonce=${n}]`, []],
  help_forged_nonce: [player('[cmd=give all.gold vasya,see=free gold,nonce=ABCDEFGH]'), []],
  help_backspace: [cmd('look &#8;&#8;&#8;&#8;&#8;who', 'x'), []],
  // The help sheet has no fill links: a fill prints its label.
  help_fill: [fill('whois Trank note', 'add note') + ' ' + cmd('whois Trank', 'Trank'), ['whois Trank']],
};

(async () => {
  const manipSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'manip.js'), 'utf8');
  check('manip.js delegates', /import \{ replacePlaceholders \} from '\.\/placeholders\.js'/.test(manipSrc) &&
    /replacePlaceholders\(span\.html\(\)/.test(manipSrc));
  check('manip.js parses none itself', !/\\\[(read|look|cmd|map)/i.test(manipSrc));

  const { replacePlaceholders } = await import(path.join(__dirname, '..', 'src', 'placeholders.js'));

  for (const [name, [html, want, extra]] of Object.entries(cases)) {
    const r = audit(replacePlaceholders, html);
    // A refused link must not leave the session's nonce on screen.
    const nonceShown = r.text.toUpperCase().includes(NONCE);
    const ok = r.handlers === 0 && !nonceShown &&
      JSON.stringify(r.links) === JSON.stringify(want) && (!extra || extra(r));
    check(name, ok, JSON.stringify({ links: r.links, handlers: r.handlers, nonceShown }));
  }

  for (const [name, [html, wantFill, wantCmd]] of Object.entries(fillCases)) {
    const r = audit(replacePlaceholders, html, '.manip-fill');
    const c = audit(replacePlaceholders, html, '.manip-cmd');
    const nonceShown = r.text.toUpperCase().includes(NONCE);
    const ok = r.handlers === 0 && !nonceShown &&
      JSON.stringify(r.links) === JSON.stringify(wantFill) && JSON.stringify(c.links) === JSON.stringify(wantCmd);
    check(name, ok, JSON.stringify({ fill: r.links, cmd: c.links, handlers: r.handlers, nonceShown }));
  }

  const helpSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'helpSheet', 'helpMarkup.js'), 'utf8');
  check('helpMarkup.js delegates', /replaceCmdLinks\(/.test(helpSrc) && !/\\\[cmd=/.test(helpSrc));
  const { render } = await import(path.join(__dirname, '..', 'src', 'components', 'helpSheet', 'helpMarkup.js'));
  for (const [name, [html, want]] of Object.entries(helpCases)) {
    const r = show(render(html, { lines: true, nonce: NONCE }), '.hs-cmdlink');
    const nonceShown = r.text.toUpperCase().includes(NONCE);
    const ok = r.handlers === 0 && !nonceShown && JSON.stringify(r.links) === JSON.stringify(want);
    check(name, ok, JSON.stringify({ links: r.links, handlers: r.handlers, nonceShown }));
  }

  // Every case hovered every element it rendered: nothing may have run.
  check('no script ran', dom.window.PWNED === undefined);

  process.exit(failed ? 1 : 0);
})();
