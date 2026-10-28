/* Help search over the game's dump: one ranking for every reader.
 *
 * The site help browser (help.js), the in-game client (mudjs
 * src/components/windowletsPanel/helpSearchCore.js, a verbatim copy) and the
 * public MCP server (mcp-help/) all rank the same way, so a query finds the
 * same articles wherever it is typed. Edit this file, then copy it to mudjs;
 * `dl_tool help-search-sync` flags a copy that drifted.
 *
 * Plain ES5 plus the u regex flag, no DOM: a <script> tag sets
 * window.DLHelpSearch, require() gets module.exports, an ESM side-effect
 * import sets globalThis.DLHelpSearch.
 *
 * Data shapes are the site build's (site.js/build-help.js): index entries
 * { id, kwList, labels, toc: {ru,en,ua}, title: {ru,en,ua} }, bodies raw
 * mudjs markup keyed by id.
 */
(function (root, factory) {
    var api = factory();
    if (root) root.DLHelpSearch = api;
    if (typeof module === 'object' && module && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function () {
    'use strict';

    function squash(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
    function normQuery(q) { return squash(q).toLowerCase(); }

    function tr(obj, lang) { return (obj && (obj[lang] || obj.ru)) || ''; }
    // lang is 'ru' | 'en' | 'ua'; the first keyword stands in for a missing title
    function label(a, lang) {
        return tr(a.toc, lang) || tr(a.title, lang) || (a.kwList && a.kwList[0]) || ('#' + a.id);
    }

    function hasLabel(a, l) { return ((a && a.labels) || []).indexOf(l) >= 0; }

    /* The article's kind, from the facet labels the engine ships. Order
       matters: spell before skill, or every spell reads as a skill. */
    var KINDS = [
        { label: 'spell',        en: 'spell',    ua: 'закляття',  ru: 'заклинание' },
        { label: 'social',       en: 'social',   ua: 'соціал',    ru: 'социал' },
        { label: 'race',         en: 'race',     ua: 'раса',      ru: 'раса' },
        { label: 'raceaptitude', en: 'race',     ua: 'раса',      ru: 'раса' },
        { label: 'religion',     en: 'religion', ua: 'релігія',   ru: 'религия' },
        { label: 'class',        en: 'class',    ua: 'клас',      ru: 'класс' },
        { label: 'skillgroup',   en: 'group',    ua: 'група',     ru: 'группа' },
        { label: 'craftskill',   en: 'craft',    ua: 'ремесло',   ru: 'ремесло' },
        { label: 'craft',        en: 'craft',    ua: 'ремесло',   ru: 'ремесло' },
        { label: 'item',         en: 'behavior', ua: 'поведінка', ru: 'поведение' },
        { label: 'clanskill',    en: 'skill',    ua: 'вміння',    ru: 'умение' },
        { label: 'cardskill',    en: 'skill',    ua: 'вміння',    ru: 'умение' },
        { label: 'language',     en: 'language', ua: 'мова',      ru: 'язык' },
        { label: 'skill',        en: 'skill',    ua: 'вміння',    ru: 'умение' },
        { label: 'area',         en: 'zone',     ua: 'зона',      ru: 'зона' },
        { label: 'cmd',          en: 'command',  ua: 'команда',   ru: 'команда' },
    ];
    // the KINDS entry, or null
    function kind(a) {
        var labels = (a && a.labels) || [];
        for (var i = 0; i < KINDS.length; i++)
            if (labels.indexOf(KINDS[i].label) >= 0) return KINDS[i];
        return null;
    }

    /* A leading facet word narrows the search like `help spell fire` in game
       (plug-ins/comm/help.cpp help_facet_labels). "skill" takes spells too,
       as in game. Only a word with more query after it counts: a bare "race"
       still searches for the article called race. */
    var FACET_WORDS = [
        { words: ['skill', 'skills', 'умение', 'умения', 'вміння'],
          test: function (a) { return hasLabel(a, 'skill') || hasLabel(a, 'spell'); } },
        { words: ['spell', 'spells', 'заклинание', 'заклинания', 'закляття'],
          test: function (a) { return hasLabel(a, 'spell'); } },
        { words: ['class', 'класс', 'клас'], test: function (a) { return hasLabel(a, 'class'); } },
        { words: ['race', 'раса'], test: function (a) { return hasLabel(a, 'race') || hasLabel(a, 'raceaptitude'); } },
        { words: ['command', 'cmd', 'команда'], test: function (a) { return hasLabel(a, 'cmd'); } },
        { words: ['area', 'zone', 'зона'], test: function (a) { return hasLabel(a, 'area'); } },
        { words: ['religion', 'религия', 'релігія'], test: function (a) { return hasLabel(a, 'religion'); } },
        { words: ['clan', 'клан'], test: function (a) { return hasLabel(a, 'clan') || hasLabel(a, 'clanskill'); } },
    ];
    // q from normQuery; returns { q, test } with the facet word cut off
    function parseQuery(q) {
        var sp = q.indexOf(' ');
        if (sp < 0) return { q: q, test: null };
        var w = q.slice(0, sp);
        for (var i = 0; i < FACET_WORDS.length; i++)
            if (FACET_WORDS[i].words.indexOf(w) >= 0)
                return { q: q.slice(sp + 1), test: FACET_WORDS[i].test };
        return { q: q, test: null };
    }

    // ---- article text ----------------------------------------------------

    function plainText(markup) {
        return String(markup || '').replace(/<[^>]*>/g, '')
            .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    }

    // usage lines ("Format: c fireball", plus indented continuations) are noise in an
    // excerpt; a line longer than 80 chars has the description glued on, so it stays
    var USAGE_RE = /(^|\n)[ \t]*(Format|Syntax|Формат|Синтаксис)[ \t]*:[^\n]{0,80}(?=\n|$)(\n[ \t]+\S[^\n]{0,80}(?=\n|$))*/g;

    /* Skill and spell articles open with the same boilerplate ("Skill 'x' or
       'y'.", then indented stats and a Format: line), so a hit-less excerpt
       skips to the first paragraph of real prose. */
    var HEADER_RE = /'[^'\n]+' (or|или|або) '/;
    function leadParagraph(text) {
        // stats and tables are indented by two or more; some prose starts with one space
        var paras = text.split(/\n\s*\n/).map(function (para) {
            return squash(para.split('\n').filter(function (ln) {
                return ln.trim() && !/^\s{2,}/.test(ln) && !/^\s*[*\-=]/.test(ln);
            }).join(' '));
        }).filter(function (p) { return p && !HEADER_RE.test(p); });
        // a real paragraph first; failing that, any short line of prose
        for (var i = 0; i < paras.length; i++)
            if (paras[i].length >= 40) return paras[i];
        return paras.length ? paras[0] : '';   // header-only article
    }

    /* textCache(bodyOf) -> textFor(id): the stripped body per article, built
       once. flat (one line), low (flat, lowercased, what the query matches
       against), lead (first prose paragraph) and leadAt (where the prose
       starts: hits in the boilerplate above it lose). bodyOf(id) returns the
       raw markup in the reader's language. */
    function textCache(bodyOf) {
        var cache = {};
        return function (id) {
            if (cache[id] === undefined) {
                var raw = plainText(bodyOf(id)).replace(USAGE_RE, '$1');
                // bullets and ruler lines read as noise once the lines are joined
                var flat = squash(raw.replace(/(^|\n)[ \t]*\*[ \t]+/g, '$1· ').replace(/[-=]{4,}/g, ' '));
                var lead = leadParagraph(raw) || flat;
                cache[id] = { flat: flat, low: flat.toLowerCase(), lead: lead,
                              leadAt: Math.max(0, flat.indexOf(lead.slice(0, 40))) };
            }
            return cache[id];
        };
    }

    /* First hit of q at or after `from`, preferring one at the start of a word:
       "sword" should mark the sword, not pas[sword]. */
    var WORD_CH = /[\p{L}\p{N}]/u;
    function findHit(low, q, from) {
        var first = low.indexOf(q, from);
        for (var at = first; at >= 0; at = low.indexOf(q, at + 1))
            if (at === 0 || !WORD_CH.test(low.charAt(at - 1))) return { at: at, word: true };
        return { at: first, word: false };
    }

    var EXCERPT = 160;
    /* [before, match, after], plain text: match is '' when the query only hit
       a keyword and the excerpt is just the article's lead. */
    function excerpt(txt, q) {
        var flat = txt.flat;
        var at = findHit(txt.low, q, txt.leadAt).at;
        if (at < 0) {
            var lead = txt.lead;
            return [lead.length > EXCERPT ? lead.slice(0, EXCERPT).replace(/\s\S*$/, '') + '...' : lead, '', ''];
        }
        var from = Math.max(txt.leadAt, at - 50), cut = from > txt.leadAt;
        if (cut) {                                   // start on a word
            var sp0 = flat.indexOf(' ', from);
            if (sp0 >= 0 && sp0 < at) from = sp0 + 1;
        }
        var to = Math.min(flat.length, from + EXCERPT);
        if (to < flat.length) {
            var sp = flat.lastIndexOf(' ', to);
            if (sp > at + q.length) to = sp;
        }
        return [
            (cut ? '...' : '') + flat.slice(from, at).replace(/^[·\s]+/, ''),
            flat.slice(at, at + q.length),
            flat.slice(at + q.length, to) + (to < flat.length ? '...' : ''),
        ];
    }

    // ---- ranking ---------------------------------------------------------

    /* Exact keyword, then title substring or keyword prefix, then article text
       (word-start hits before mid-word ones), 3+ characters, prose only.
       q comes out of parseQuery. textFor is null until the bodies are in;
       test, when given, keeps only the articles it accepts. */
    function search(index, q, lang, textFor, limit, test) {
        if (!q) return [];
        limit = limit || 24;
        var exact = [], partial = [], inWord = [], inPart = [];
        for (var i = 0; i < index.length && exact.length + partial.length < limit; i++) {
            var a = index[i];
            if (test && !test(a)) continue;
            var kws = (a.kwList || []).map(function (k) { return k.toLowerCase(); });
            var title = label(a, lang).toLowerCase();
            if (kws.indexOf(q) >= 0) exact.push(a);
            else if (title.indexOf(q) >= 0 || kws.some(function (k) { return k.indexOf(q) === 0; })) partial.push(a);
            else if (textFor && inWord.length < limit && q.length >= 3) {
                var txt = textFor(a.id);
                var hit = findHit(txt.low, q, txt.leadAt);
                if (hit.at >= 0) (hit.word ? inWord : inPart).push(a);
            }
        }
        return exact.concat(partial, inWord, inPart).slice(0, limit);
    }

    return {
        squash: squash, normQuery: normQuery, label: label, hasLabel: hasLabel,
        KINDS: KINDS, kind: kind, FACET_WORDS: FACET_WORDS, parseQuery: parseQuery,
        plainText: plainText, textCache: textCache, findHit: findHit,
        excerpt: excerpt, search: search,
    };
});
