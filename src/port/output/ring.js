/* The recent output as plain lines, for the output tools: read a recent line,
 * find, word completion, the links list. The terminal keeps only ~300 KB in
 * the page and reloads it all the time, so the lines are kept here, as plain
 * data (no page elements), fed from every new chunk of output.
 *
 * A line: { seq, text, echo, chunk, links: [{ kind, label, action, echo,
 * href, menu: [{ label, action }] }] }. kind is cmd, builtin, menu or url.
 * seq grows by one per line and never repeats, so a place in the ring stays
 * valid while old lines drop off the front. */
import { onOutputChunk } from '../../components/terminal';

const KEEP = 5000;
const LINK = '.manip-cmd, .builtin-cmd, .dropdown-toggle, a.manip-link[href]';

const ring = [];
let nextSeq = 1;
let open = false; // the last chunk ended mid-line: the next one goes on with it
let seeded = false;
const subscribers = new Set();

export const lines = () => ring;
export const firstSeq = () => (ring.length ? ring[0].seq : nextSeq);
export const bySeq = seq => ring[seq - firstSeq()];

/* fn(newLines) after each chunk. */
export function onLines(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

function linkOf(el) {
  const label = el.textContent.replace(/\xa0/g, ' ').replace(/\s+/g, ' ').trim();
  if (el.classList.contains('dropdown-toggle')) {
    const box = el.parentElement && el.parentElement.querySelector('.dropdown-menu');
    const menu = box
      ? Array.from(box.querySelectorAll('.dropdown-item'))
          .map(a => ({ label: a.textContent.trim(), action: a.getAttribute('data-action') || '' }))
          .filter(m => m.action)
      : [];
    return { kind: 'menu', label, menu };
  }
  const action = el.getAttribute('data-action') || '';
  if (el.classList.contains('builtin-cmd')) return { kind: 'builtin', label, action, echo: el.getAttribute('data-echo') || '' };
  if (el.classList.contains('manip-cmd')) return { kind: 'cmd', label, action, echo: el.getAttribute('data-echo') || '' };
  return { kind: 'url', label, href: el.getAttribute('href') || '' };
}

/* The chunk's lines with their links. ends: the chunk ended with a newline. */
function parse(root) {
  const out = [];
  let cur = { text: '', links: [] };
  const push = () => {
    out.push(cur);
    cur = { text: '', links: [] };
  };
  const walk = node => {
    if (node.nodeType === 3) {
      node.nodeValue
        .replace(/\xa0/g, ' ')
        .split('\n')
        .forEach((part, i) => {
          if (i > 0) push();
          cur.text += part;
        });
      return;
    }
    if (node.nodeType !== 1) return;
    // An item's menu of actions is hidden text: read from its toggle instead.
    if (node.classList.contains('dropdown-menu')) return;
    if (node.tagName === 'BR' || node.tagName === 'HR') return push();
    const isLink = node.matches(LINK);
    const startLine = cur;
    node.childNodes.forEach(walk);
    if (isLink && cur === startLine) {
      const l = linkOf(node);
      if (l.label && (l.action || l.href || l.kind === 'menu')) cur.links.push(l);
    }
    if (node.tagName === 'DIV' || node.tagName === 'P') {
      if (cur.text || cur.links.length) push();
    }
  };
  root.childNodes.forEach(walk);
  const ends = !cur.text;
  if (cur.text) push();
  return { parsed: out, ends };
}

function add(el, id, isEcho) {
  const { parsed, ends } = parse(el);
  const fresh = [];
  const last = ring[ring.length - 1];
  if (open && !isEcho && last && !last.echo && parsed.length) {
    const first = parsed.shift();
    last.text += first.text;
    last.links.push(...first.links);
    fresh.push(last);
  }
  parsed.forEach(p => {
    const line = { seq: nextSeq++, text: p.text, links: p.links, echo: isEcho, chunk: id };
    ring.push(line);
    fresh.push(line);
  });
  open = !ends && !isEcho;
  if (ring.length > KEEP + 500) ring.splice(0, ring.length - KEEP);
  return fresh;
}

/* After a page load the terminal holds output read back from the history:
 * taken in once, before the first new chunk. */
function seed(beforeId) {
  seeded = true;
  const term = document.querySelector('.terminal');
  if (!term) return;
  term.querySelectorAll(':scope > div[data-chunk-id]').forEach(div => {
    const id = parseInt(div.getAttribute('data-chunk-id'));
    if (!(id < beforeId)) return;
    add(div, id, !!div.querySelector('.echo-with-anchor'));
  });
}

onOutputChunk((el, id, isEcho) => {
  if (!seeded) seed(id);
  const fresh = add(el, id, isEcho);
  subscribers.forEach(fn => fn(fresh));
});

/* Non-blank lines, newest first, at most n of them (all when n is 0). */
export function recentLines(n) {
  const out = [];
  for (let i = ring.length - 1; i >= 0 && (!n || out.length < n); i--) if (ring[i].text.trim()) out.push(ring[i]);
  return out;
}
