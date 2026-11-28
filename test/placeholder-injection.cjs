// Regression test for player-typed placeholders in terminal output
// (click injection and attribute breakout). Needs jsdom, not a project dep:
//   npm i --no-save jsdom && node test/placeholder-injection.cjs
// It extracts the helpers and the read|look pass from src/manip.js by text,
// so it breaks loudly if that code moves.
const fs = require('fs');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><div id=t></div>');
global.document = dom.window.document;
const src = fs.readFileSync(require('path').join(__dirname, '..', 'src', 'manip.js'), 'utf8');
// helpers
eval(src.slice(src.indexOf('function decodeHtmlText'), src.indexOf('function manipParseAndReplace')));
// the single read|look pass, extracted verbatim
const a = src.indexOf('  html = html.replace(\n    /\\[(read|look)=');
const b = src.indexOf('  // Replace random commands');
const t = k => ({ 'echo.examine': 'изучить', 'echo.look': 'смотреть' })[k];
const pass = new Function('html', 't', 'safePlaceholderPart', 'escapeHtmlAttr', 'decodeHtmlText', src.slice(a, b) + '\nreturn html;');
const cmdRe = new RegExp(src.match(/\/\\\[cmd=(.*?)\/gi,/)[1].replace(/^/, '\\[cmd=').replace(/\/gi,$/, ''), 'gi');
function render(input) {
  const out = pass(input, t, safePlaceholderPart, escapeHtmlAttr, decodeHtmlText);
  const div = document.getElementById('t');
  div.innerHTML = out;
  const handlers = [...div.querySelectorAll('*')].filter(e => [...e.attributes].some(x => /^on/i.test(x.name))).length;
  const links = [...div.querySelectorAll('.manip-cmd')].map(e => e.getAttribute('data-action'));
  return { handlers, links };
}
const cases = {
  chain: '[read=x [look=q,see=x],see=" onmouseover="window.PWNED=1]" hi',
  pipe: '[look=x|give all.gold vasya,see=free gold]',
  quote: '[look=x" onmouseover="alert(1),see=y]',
  entity: '[look=x&#124;give,see=y]',
  legit: 'A [read=sign знак,see=sign] and [look=door,see=door] and [read=note note,see=note].',
  apostrophe: "[read=shopkeeper's note,see=note]",
  nested_look_in_see: '[look=a,see=[look=b|x,see=c]]',
};
const want = {
  chain: [], pipe: [], quote: [], entity: [], nested_look_in_see: [],
  legit: ["examine 'sign знак'", 'look door', "examine 'note note'"],
  apostrophe: ["examine 'shopkeeper's note'"],
};
let failed = 0;
for (const [k, v] of Object.entries(cases)) {
  const r = render(v);
  const ok = r.handlers === 0 && JSON.stringify(r.links) === JSON.stringify(want[k]);
  if (!ok) failed++;
  console.log((ok ? 'ok   ' : 'FAIL ') + k.padEnd(20), JSON.stringify(r));
}
// nonce hijack: attacker prefix before a legit server link in the same chunk
const hijack = '[cmd=give all.gold vasya,see=x [cmd=whois Trank,see=Trank,nonce=ABCDEFGH]';
const m = [...hijack.matchAll(cmdRe)].map(x => x[1]);
if (JSON.stringify(m) !== JSON.stringify(['whois Trank'])) failed++;
console.log('nonce hijack cmds  ', JSON.stringify(m));
const legitCmd = '[cmd=whois Trank,see=Trank,nonce=ABCDEFGH] [cmd=alts Inis,see=pair,nonce=ABCDEFGH]';
const lc = [...legitCmd.matchAll(cmdRe)].map(x => x[1]);
if (JSON.stringify(lc) !== JSON.stringify(['whois Trank', 'alts Inis'])) failed++;
console.log('legit cmds         ', JSON.stringify(lc));
process.exit(failed ? 1 : 0);
