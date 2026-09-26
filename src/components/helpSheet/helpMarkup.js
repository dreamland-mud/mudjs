// The game's markup rendered to reading HTML: help article bodies and the web
// output of info commands (quest, affects, whois) share the same tags --
// <c c='fgbw'> colour spans, <hh id='N'> help links, <hc> command echoes.
//
// Port of dreamland_web static/site/js/helpmarkup.js (the site's help browser).
// Keep the block rules in step with it. Differences: no [map=] buttons, and an
// <hh> is a data-hid button that the sheet opens in place, not a page link.
//
// 21% of the colour spans straddle a newline, so the text is parsed into a DOM,
// flattened into segments that remember their wrapper chain, and re-assembled
// into lines and blocks.

export function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
  ));
}

const ARTCH = '|/\\+_-=~^<>*#$─│┌┐└┘├┤┬┴┼═║';

// An "art" line is indented and mostly strokes rather than letters. Real
// diagrams come in runs, so a lone one stays prose.
function isArt(line) {
  if (line.length - line.replace(/^ +/, '').length < 4) return false;
  const body = line.trim();
  if (!body) return false;
  let letters = 0, art = 0;
  for (const ch of body) {
    if (/[a-zA-Zа-яА-ЯёЁіїєґІЇЄҐ]/.test(ch)) letters++;
    if (ARTCH.indexOf(ch) >= 0) art++;
  }
  return art >= 2 && letters / body.length < 0.45;
}

function flatten(root, resolve) {
  const segs = [];
  (function walk(node, chain) {
    for (let n = node.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 3) {
        segs.push({ text: n.nodeValue, chain });
      } else if (n.nodeType === 1) {
        const tag = n.tagName.toLowerCase();
        let link = null, cls = null, act = null;
        if (tag === 'c') cls = n.getAttribute('c');
        else if (tag === 'hc') act = (n.textContent || '').trim();
        else if (tag === 'hh' || tag === 'hg') {
          // Resolved from the whole element: a colour span inside the anchor
          // would otherwise split the phrase that has to be looked up.
          link = n.getAttribute('id');
          if (!link && resolve) link = resolve(n.textContent || '');
        }
        walk(n, chain.concat([{ tag, cls, link, act }]));
      }
    }
  })(root, []);
  return segs;
}

function cmdButton(action, label) {
  return '<button type="button" class="hs-link hs-cmdlink" data-action="' + esc(action) + '">' + label + '</button>';
}

// Server command links, [cmd=<command>,see=<label>,nonce=<8>]. The nonce is the
// session's (websock.js), so a player cannot forge one into text they control;
// a wrong nonce leaves the label as plain text. Same rules as manip.js.
function cmdLinks(html, nonce) {
  return html.replace(/\[cmd=([^,]{1,200}),see=([^\]]{1,50}),nonce=(.{8})]/gi, (m, cmd, see, n) => {
    if (!nonce || n !== nonce) return see;
    const label = see.trim();
    return label ? cmdButton(cmd.replace(/\$1/, see), label) : '';
  });
}

function wrapChain(html, chain) {
  for (let i = chain.length - 1; i >= 0; i--) {
    const w = chain[i];
    if (w.tag === 'c' && w.cls) html = '<span class="c-' + esc(w.cls) + '">' + html + '</span>';
    else if (w.tag === 'hh' || w.tag === 'hg') html = w.link
      ? '<button type="button" class="hs-link" data-hid="' + esc(w.link) + '">' + html + '</button>'
      : '<b class="hs-link-plain">' + html + '</b>';
    // <hc> sends its own text, as in the terminal (manip.js); no cmd attribute here
    else if (w.tag === 'hc' && w.act) html = cmdButton(w.act, html);
    else if (w.tag === 'hc' || w.tag === 'hs') html = '<b class="hs-cmd">' + html + '</b>';
  }
  return html;
}

function toLines(segs) {
  const lines = [[]];
  segs.forEach(s => {
    s.text.split('\n').forEach((p, i) => {
      if (i > 0) lines.push([]);
      if (p !== '') lines[lines.length - 1].push({ text: p, chain: s.chain });
    });
  });
  return lines;
}

const linePlain = line => line.map(s => s.text).join('');
const lineHtml = line => line.map(s => wrapChain(esc(s.text), s.chain)).join('');

// Drop `n` plain characters off the front and render the rest.
function lineHtmlFrom(line, n) {
  const rest = [];
  line.forEach(s => {
    if (n <= 0) { rest.push(s); return; }
    if (s.text.length <= n) { n -= s.text.length; return; }
    rest.push({ text: s.text.slice(n), chain: s.chain });
    n = 0;
  });
  return lineHtml(rest);
}

// "Format:" in each language, and the seven-space continuation of a second call shape.
const FMT_WORD = /^(\s*)(Формат:|Format:)[ \t]*/;
const FMT_CONT = /^ {7}(?! )\S/;

// opts.lines: command output. Every line keeps its own row and its leading
// spaces (affects and whois align columns with them); articles reflow instead.
export function render(raw, opts) {
  const resolve = (opts && opts.resolveLink) || null;
  const byLine = !!(opts && opts.lines);
  const holder = document.createElement('div');
  holder.innerHTML = String(raw || '').replace(/\r/g, '');
  const lines = toLines(flatten(holder, resolve));

  const kind = lines.map(l => {
    const p = linePlain(l);
    if (!p.trim()) return 'blank';
    return isArt(p) ? 'art' : 'text';
  });
  let i;
  for (i = 0; i < kind.length; i++) {
    if (kind[i] === 'art' && kind[i - 1] !== 'art' && kind[i + 1] !== 'art') kind[i] = 'text';
  }
  // Grow each art run over neighbouring indented lines, so a diagram's
  // labelled rows stay inside the picture.
  const indented = n => {
    const p = linePlain(lines[n] || []);
    return !!p.trim() && p.length - p.replace(/^ +/, '').length >= 4;
  };
  for (i = 0; i < kind.length; i++) {
    if (kind[i] !== 'art') continue;
    for (let b = i - 1; b >= 0 && kind[b] !== 'art' && indented(b); b--) kind[b] = 'art';
    let e = i;
    for (; e + 1 < kind.length && kind[e + 1] === 'art'; e++);
    for (let f = e + 1; f < kind.length && indented(f); f++) kind[f] = 'art';
    i = e;
  }

  const out = [];
  let para = [], pre = [], list = [];
  const flushPara = () => { if (para.length) out.push('<p>' + para.join(' ') + '</p>'); para = []; };
  const flushPre = () => { if (pre.length) out.push('<pre>' + pre.join('\n') + '</pre>'); pre = []; };
  const flushList = () => {
    if (list.length) out.push('<ul>' + list.map(li => '<li>' + li + '</li>').join('') + '</ul>');
    list = [];
  };

  let lastWasFmt = false, prevBlank = false;
  for (let n = 0; n < lines.length; n++) {
    const line = lines[n], plain = linePlain(line);

    if (kind[n] === 'art') { flushPara(); flushList(); pre.push(lineHtml(line)); lastWasFmt = false; continue; }
    flushPre();
    if (kind[n] === 'blank') {
      flushPara(); flushList(); lastWasFmt = false;
      if (byLine && out.length) out.push('<p class="hs-gap"></p>');
      prevBlank = true;
      continue;
    }

    const fmt = FMT_WORD.exec(plain);
    if (fmt) {
      flushPara(); flushList();
      out.push('<p class="hs-fmt"><b class="hs-fmt-label">' + esc(fmt[2]) + '</b> ' +
               '<b class="hs-cmd">' + lineHtmlFrom(line, fmt[0].length) + '</b></p>');
      lastWasFmt = true;
      continue;
    }
    if (lastWasFmt && FMT_CONT.test(plain)) {
      flushPara(); flushList();
      out.push('<p class="hs-fmt hs-fmt-cont"><b class="hs-cmd">' + lineHtmlFrom(line, 7) + '</b></p>');
      continue;
    }
    lastWasFmt = false;

    if (byLine) {
      // The server wraps long text at ~80 columns. A line that opens in lower
      // case continues the one above, so it joins it instead of starting a row.
      const lead = plain.length - plain.replace(/^\s+/, '').length;
      const prev = out.length ? out[out.length - 1] : '';
      if (/^\s*\p{Ll}/u.test(plain) && prev.startsWith('<p class="hs-line">') && !prevBlank) {
        out[out.length - 1] = prev.slice(0, -4) + ' ' + lineHtmlFrom(line, lead) + '</p>';
      } else {
        out.push('<p class="hs-line">' + lineHtml(line) + '</p>');
      }
      prevBlank = false;
      continue;
    }

    if (/^\s*[*•-]\s+/.test(plain)) {
      flushPara();
      list.push(lineHtmlFrom(line, /^(\s*)([*•-])\s+/.exec(plain)[0].length));
      continue;
    }
    flushList();
    para.push(lineHtml(line));
  }
  flushPara(); flushList(); flushPre();
  while (out.length && out[out.length - 1] === '<p class="hs-gap"></p>') out.pop();
  return cmdLinks(out.join('\n'), opts && opts.nonce);
}
