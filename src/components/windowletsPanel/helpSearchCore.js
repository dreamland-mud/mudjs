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

    /* Exact title (any language), then exact keyword, so a keyword shared by
       several articles ("midgaard") puts its own article first; then title substring or keyword prefix, then article text
       (word-start hits before mid-word ones), 3+ characters, prose only.
       q comes out of parseQuery. textFor is null until the bodies are in;
       test, when given, keeps only the articles it accepts. */
    function search(index, q, lang, textFor, limit, test) {
        if (!q) return [];
        limit = limit || 24;
        var named = [], exact = [], partial = [], inWord = [], inPart = [];
        for (var i = 0; i < index.length && named.length + exact.length + partial.length < limit; i++) {
            var a = index[i];
            if (test && !test(a)) continue;
            var kws = (a.kwList || []).map(function (k) { return k.toLowerCase(); });
            var title = label(a, lang).toLowerCase();
            if (['en', 'ua', 'ru'].some(function (l) { return label(a, l).toLowerCase() === q; })) named.push(a);
            else if (kws.indexOf(q) >= 0) exact.push(a);
            else if (title.indexOf(q) >= 0 || kws.some(function (k) { return k.indexOf(q) === 0; })) partial.push(a);
            else if (textFor && inWord.length < limit && q.length >= 3) {
                var txt = textFor(a.id);
                var hit = findHit(txt.low, q, txt.leadAt);
                if (hit.at >= 0) (hit.word ? inWord : inPart).push(a);
            }
        }
        return named.concat(exact, partial, inWord, inPart).slice(0, limit);
    }

    // ---- suggestions on a miss -------------------------------------------
    /* A port of the game's FuzzySearch (dreamland_code plug-ins/comm/help.cpp):
       the query typed in the wrong keyboard layout, then per-word fuzzy
       matching against keyword words only. Same weights and cut-offs, so the
       site, the client and the MCP server suggest what `help` suggests in game.
       Run it only when search() found nothing. */
    var WORD_EXACT = 100, WORD_PREFIX = 90, WORD_FUZZY = 80, WORD_STEM = 70, WORD_WEAK = 1;
    var FUZZY_STEP = 15, DF_BONUS = 50, MULTI_MIN_WORDS = 2, MAX_RESULTS = 5;
    var PREFIX_MIN = 3, STEM_MIN_PREFIX = 5, STEM_ABBR_PREFIX = 4;
    var FUZZY_MIN_LEN = 5, SHORT_TYPO_LEN = 4, FLIP_MIN_LEN = 3, MAX_WORDS = 8;

    function fuzzyCutoff(n) {
        if (n < FUZZY_MIN_LEN) return 0;
        if (n <= 5) return 1;
        if (n <= 8) return 2;
        return 3;
    }

    // git's Damerau-Levenshtein with weights: w swap, s substitution, a insertion, d deletion
    function levenshtein(s1, s2, w, s, a, d) {
        var len1 = s1.length, len2 = s2.length, i, j, t;
        var row0 = [], row1 = [], row2 = [];
        for (j = 0; j <= len2; j++) { row0.push(0); row1.push(j * a); row2.push(0); }
        for (i = 0; i < len1; i++) {
            row2[0] = (i + 1) * d;
            for (j = 0; j < len2; j++) {
                row2[j + 1] = row1[j] + s * (s1.charAt(i) !== s2.charAt(j) ? 1 : 0);
                if (i > 0 && j > 0 && s1.charAt(i - 1) === s2.charAt(j) && s1.charAt(i) === s2.charAt(j - 1)
                        && row2[j + 1] > row0[j - 1] + w)
                    row2[j + 1] = row0[j - 1] + w;
                if (row2[j + 1] > row1[j + 1] + d) row2[j + 1] = row1[j + 1] + d;
                if (row2[j + 1] > row2[j] + a) row2[j + 1] = row2[j] + a;
            }
            t = row0; row0 = row1; row1 = row2; row2 = t;
        }
        return row1[len2];
    }

    function commonPrefix(a, b) {
        var n = 0, limit = Math.min(a.length, b.length);
        while (n < limit && a.charAt(n) === b.charAt(n)) n++;
        return n;
    }

    /* The common prefix when it counts as the same stem, else 0. A shorter one
       passes only for an abbreviation with at most one trailing letter wrong
       (invey -> inventory). */
    function stemLen(q, k) {
        var p = commonPrefix(q, k);
        if (p >= STEM_MIN_PREFIX) return p;
        if (p >= STEM_ABBR_PREFIX && q.length <= p + 1 && k.length >= q.length) return p;
        return 0;
    }

    /* One query word against one keyword word, 0 for no match. A glued pair
       (fire ball -> fireball) gets neither the stem rule nor the weak
       substitution: that would be a guess on a guess. */
    function wordScore(q, k, glued) {
        if (q === k) return WORD_EXACT;
        if (q.length >= PREFIX_MIN && k.length > q.length && k.indexOf(q) === 0) return WORD_PREFIX;

        var best = 0, cut = fuzzyCutoff(q.length);
        if (cut > 0) {
            if (Math.abs(q.length - k.length) <= cut) {
                var dist = levenshtein(q, k, 1, 1, 1, 1);
                if (dist <= cut) best = WORD_FUZZY - FUZZY_STEP * dist;
            }
        } else if (q.length === SHORT_TYPO_LEN) {
            // a swap (bsah) or a plural letter (мечи) at four letters; one
            // substituted letter (шлем/шлеп) only breaks ties
            if (k.length === SHORT_TYPO_LEN && levenshtein(q, k, 1, 2, 2, 2) === 1)
                best = WORD_FUZZY - FUZZY_STEP;
            else if (k.length + 1 === q.length && q.indexOf(k) === 0)
                best = WORD_FUZZY - FUZZY_STEP;
            else if (!glued && k.length === SHORT_TYPO_LEN && levenshtein(q, k, 1, 1, 1, 1) === 1)
                best = WORD_WEAK;
        }

        var p = glued ? 0 : stemLen(q, k);
        if (p > 0) {
            var sc = Math.max(WORD_STEM - (Math.max(q.length, k.length) - p), WORD_WEAK + 1);
            if (sc > best) best = sc;
        }
        return best;
    }

    // lowercase words of a query or a keyword, quotes dropped (split_words)
    function splitWords(text) {
        return String(text || '').replace(/['"]/g, '').toLowerCase().split(/\s+/).filter(Boolean);
    }
    function keywordWords(a) {
        var out = [];
        (a.kwList || []).forEach(function (k) { out.push.apply(out, splitWords(k)); });
        return out;
    }

    // keyboard layout flip, plug-ins/interpret/translit.cpp
    var EN_KEYS = "qwertyuiop[{]}asdfghjkl;:'\"zxcvbnm,<.>/?`~";
    var RU_KEYS = 'йцукенгшщзххъъфывапролджжээячсмитьббюю..ёё';
    var UA_KEYS = 'йцукенгшщзххїїфівапролджжєєячсмитьббюю..ґґ';
    function translit(lang, s) {
        var to = lang === 'ua' ? UA_KEYS : RU_KEYS, out = '';
        for (var i = 0; i < s.length; i++) {
            var c = s.charAt(i).toLowerCase(), at = EN_KEYS.indexOf(c);
            if (at >= 0) { out += to.charAt(at); continue; }
            at = RU_KEYS.indexOf(c);
            if (at < 0) at = UA_KEYS.indexOf(c);
            // Cyrillic back to the key; '.' is both '/' and the ю key, keep it
            out += (at >= 0 && c !== '.') ? EN_KEYS.charAt(at) : c;
        }
        return out;
    }

    /* is_name(): every query word starts some keyword word, or the whole query
       starts a whole keyword. What HelpFinder matches with in game. */
    function prefixMatch(a, words, q) {
        var kws = (a.kwList || []).map(function (k) { return k.replace(/['"]/g, '').toLowerCase(); });
        if (kws.some(function (k) { return k.indexOf(q) === 0; })) return true;
        var kw = keywordWords(a);
        return words.every(function (w) { return kw.some(function (k) { return k.indexOf(w) === 0; }); });
    }

    function searchFlipped(index, query, words, lang, test, facetWord) {
        for (var i = 0; i < words.length; i++)
            if (words[i].length < FLIP_MIN_LEN) return [];
        var langs = lang === 'ua' ? ['ua', 'ru'] : ['ru', 'ua'], tried = '';
        for (var li = 0; li < 2; li++) {
            var flipped = translit(langs[li], query);
            if (flipped === query || flipped === tried) continue;
            tried = flipped;
            // the facet word was typed right, only the rest is flipped
            var p = parseQuery(normQuery(facetWord ? facetWord + ' ' + flipped : flipped));
            var fw = splitWords(p.q), hits = [];
            for (var j = 0; j < index.length && hits.length < MAX_RESULTS; j++) {
                var a = index[j];
                if ((p.test && !p.test(a)) || (test && !test(a))) continue;
                if (fw.length && prefixMatch(a, fw, fw.join(' ')))
                    hits.push({ article: a, hint: flipped, kind: 'flip' });
            }
            if (hits.length) return hits;
        }
        return [];
    }

    /* Articles matching every word win; otherwise the most words, a rare word
       outranking a common one. Glued neighbours count for both words. */
    function searchWords(index, words, test) {
        var n = words.length, pairs = [], cands = [], i, j;
        for (i = 0; i + 1 < n; i++) pairs.push(words[i] + words[i + 1]);

        index.forEach(function (a) {
            if (test && !test(a)) return;
            var kw = keywordWords(a), best = [], hint = [], any = false;
            for (i = 0; i < n; i++) {
                best.push(0); hint.push('');
                for (j = 0; j < kw.length; j++) {
                    var sc = wordScore(words[i], kw[j], false);
                    if (sc > best[i]) { best[i] = sc; hint[i] = kw[j]; if (sc === WORD_EXACT) break; }
                }
                if (best[i] > 0) any = true;
            }
            for (i = 0; i < pairs.length; i++) {
                var pb = 0, ph = '';
                for (j = 0; j < kw.length; j++) {
                    var ps = wordScore(pairs[i], kw[j], true);
                    if (ps > pb) { pb = ps; ph = kw[j]; if (ps === WORD_EXACT) break; }
                }
                if (pb <= 0) continue;
                any = true;
                for (var w = i; w <= i + 1; w++)
                    if (pb > best[w]) { best[w] = pb; hint[w] = ph; }
            }
            if (any) cands.push({ article: a, best: best, hint: hint });
        });
        if (!cands.length) return [];

        // weak matches stay out of the count, so they cannot make a word look rare
        var df = [];
        for (i = 0; i < n; i++) df.push(0);
        cands.forEach(function (c) { for (var k = 0; k < n; k++) if (c.best[k] > WORD_WEAK) df[k]++; });

        var need = n >= 3 ? MULTI_MIN_WORDS : 1, full = false, anyStrong = false;
        var ranked = cands.map(function (c) {
            var r = { strong: 0, weak: 0, score: 0, c: c, hintWord: 0 }, bestWord = -1;
            for (var k = 0; k < n; k++) {
                var b = c.best[k], sc = 0;
                if (b <= 0) continue;
                if (b > WORD_WEAK) { sc = b + Math.floor(DF_BONUS / df[k]); r.strong++; r.score += sc; }
                else r.weak++;
                if (sc > bestWord) { bestWord = sc; r.hintWord = k; }
            }
            if (r.strong === n) full = true;
            if (r.strong > 0 && r.strong + r.weak >= need) anyStrong = true;
            return r;
        });
        ranked.sort(function (x, y) {
            return (y.strong - x.strong) || (y.score - x.score) || (y.weak - x.weak) || (x.c.article.id - y.c.article.id);
        });

        var hits = [];
        for (i = 0; i < ranked.length && hits.length < MAX_RESULTS; i++) {
            var r = ranked[i];
            if (full ? r.strong < n : (r.strong + r.weak < need || (anyStrong && r.strong === 0))) continue;
            hits.push({ article: r.c.article, hint: r.c.hint[r.hintWord], kind: 'text' });
        }
        return hits;
    }

    function fuzzyPass(index, query, lang, test, facetWord) {
        var words = splitWords(query).slice(0, MAX_WORDS);
        if (!words.length) return [];
        var hits = searchFlipped(index, words.join(' '), words, lang, test, facetWord);
        return hits.length ? hits : searchWords(index, words, test);
    }

    /* Up to five { article, hint, kind: 'flip' | 'text' } for a query search()
       missed. hint is the flipped query, or the keyword word that matched.
       test, when given, keeps only the articles it accepts (the site's type
       picker). A leading facet word filters; nothing found that way, the
       whole query is tried again, as in game. */
    function fuzzy(index, query, lang, test) {
        var q = normQuery(query), sp = q.indexOf(' ');
        if (!q || /^\d+$/.test(q)) return [];
        if (sp > 0) {
            var p = parseQuery(q);
            if (p.test) {
                var t = test ? function (a) { return p.test(a) && test(a); } : p.test;
                var hits = fuzzyPass(index, p.q, lang, t, q.slice(0, sp));
                if (hits.length) return hits;
            }
        }
        return fuzzyPass(index, q, lang, test, '');
    }

    /* The hint, when it tells the reader something the title does not: not
       for a match in the other script, not when the title already shows it;
       a layout flip always, the flipped text is the point. */
    function fuzzyHint(hit, lang) {
        if (!hit.hint) return '';
        if (hit.kind === 'text') {
            var cyr = /[Ѐ-ӿ]/.test(hit.hint);
            if ((lang === 'en') === cyr) return '';
            if (label(hit.article, lang).toLowerCase().indexOf(hit.hint) >= 0) return '';
        }
        return hit.hint;
    }

    return {
        squash: squash, normQuery: normQuery, label: label, hasLabel: hasLabel,
        KINDS: KINDS, kind: kind, FACET_WORDS: FACET_WORDS, parseQuery: parseQuery,
        plainText: plainText, textCache: textCache, findHit: findHit,
        excerpt: excerpt, search: search, fuzzy: fuzzy, fuzzyHint: fuzzyHint,
        translit: translit, wordScore: wordScore, levenshtein: levenshtein,
    };
});
