/* The guide's five tabs as FindView wants them: rows, filters and actions.
 * Plain data with t(key) and tr(key, ...args) passed in, so node can check it. */
import { ALIGNS, HORSE_SLOTS, STATS, STAT_STEMS, num, overallScore, statGain, hasMinus } from './site.js';
import { word } from '../find/common';
import {
  questRow, questDetail, questFits, questZoneOk, itemRow, itemDetail, skillRow, infoDetail, raceValues,
} from './guide.js';

const yesNo = t => [
  { value: 'yes', label: t('guide.yes') },
  { value: 'no', label: t('guide.no') },
];

const LEVELS = Array.from({ length: 100 }, (_, i) => i + 1);
const levelOptions = extra => {
  const list = LEVELS.slice();
  if (extra && !list.includes(extra)) list.push(extra);
  return list.map(n => ({ value: String(n), label: String(n) }));
};

const GAPS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20, 25, 30, 40, 50];

/* The five tabs: {rows, filters, actions, empty, start, sig} each. */
export function buildViews(t, tr, site, ctx, opts, setCtx, setOpt, goTo, readHelp) {
  const classes = site.classNames();
  const myClass = classes.find(c => c === String(ctx.class || '').toLowerCase()) || '';
  const level = parseInt(ctx.level, 10) || 1;
  const align = ALIGNS.includes(ctx.align) ? ctx.align : '';
  const classLabel = c => {
    const a = site.classArticle(c);
    return a ? site.title(a) : c;
  };

  const character = [
    {
      id: 'level', label: t('guide.level'), value: String(level), options: levelOptions(level),
      onChange: v => setCtx('level', parseInt(v, 10) || 1),
    },
    {
      id: 'class', label: t('guide.class'), value: myClass,
      options: [{ value: '', label: t('guide.anyclass') }].concat(classes.map(c => ({ value: c, label: classLabel(c) }))),
      onChange: v => setCtx('class', v),
    },
    {
      id: 'align', label: t('guide.align'), value: align,
      options: ALIGNS.map(a => ({ value: a, label: t('guide.align.' + (a || 'any')) })),
      onChange: v => setCtx('align', v),
    },
  ];

  // How far above your level a zone may start; null: any.
  const gapValue = opts.zone_gap == null ? 5 : num(opts.zone_gap);
  const gap = gapValue == null || gapValue >= 100 ? null : gapValue;

  // Quests
  const fits = opts.fits !== false;
  const danger = opts.zone_danger == null || opts.zone_danger === 'any' ? null : num(opts.zone_danger);
  const quests = site
    .zoneQuests()
    .sort((a, b) => a.low - b.low || cmp(a.zone.toLowerCase(), b.zone.toLowerCase()))
    .filter(q => (!fits || questFits(q, level, align)) && questZoneOk(q, level, gap, danger))
    .map(q => ({ key: q.key, label: questRow(tr, q), words: q.zone + ' ' + q.text, detail: () => questDetail(tr, site, q), data: q }));
  const gaps = GAPS.includes(gap) || gap == null ? GAPS : GAPS.concat([gap]).sort((a, b) => a - b);
  const questsV = {
    rows: quests,
    sig: '',
    filters: character.concat([
      { id: 'fits', label: t('guide.mylevel'), value: fits ? 'yes' : 'no', options: yesNo(t), onChange: v => setOpt('fits', v === 'yes') },
      {
        id: 'gap', label: t('guide.zonegap'), value: gap == null ? 'any' : String(gap),
        options: gaps.map(n => ({ value: String(n), label: String(n) })).concat([{ value: 'any', label: t('guide.gap.any') }]),
        onChange: v => setOpt('zone_gap', v === 'any' ? 100 : parseInt(v, 10)),
      },
      {
        id: 'danger', label: t('guide.zonedanger'), value: danger == null ? 'any' : String(danger),
        options: [
          { value: 'any', label: t('guide.danger.any') },
          { value: '2', label: t('guide.danger.tough') },
          { value: '1', label: t('guide.danger.easy') },
        ],
        onChange: v => setOpt('zone_danger', v),
      },
    ]),
    actions: [
      { id: 'go', key: 'g', label: t('guide.go'), run: r => goTo(site.zoneNames(r.data.zoneId).concat([r.data.zone])) },
      { id: 'help', key: 'h', label: t('guide.zonehelp'), run: r => readHelp(r.data.zoneId) },
    ],
  };

  // Items: one choice for the kind and the slot, "weapon:sword", "armor:".
  const slotChoices = [
    { value: 'weapon:', label: t('guide.weapons.any') },
    { value: 'weapon:mine', label: t('guide.mineweapons') },
  ]
    .concat(site.slots('weapon').map(v => ({ value: 'weapon:' + v, label: tr('guide.weapon.one', word('items.wc.', v)) })))
    .concat([{ value: 'armor:', label: t('guide.armor.any') }])
    .concat(site.slots('armor').map(v => ({ value: 'armor:' + v, label: tr('guide.armor.one', word('items.wear.', v)) })));
  const slotValue = slotChoices.some(c => c.value === opts.slot) ? opts.slot : 'weapon:';
  const [kind, slot] = slotValue.split(':');
  const mine = kind === 'weapon' && slot === 'mine';
  // Stored as [low, high], high null meaning "my level", so the range follows
  // the character as it levels up unless set apart from it.
  const lv = Array.isArray(opts.levels) ? opts.levels : [1, null];
  // Level 0 is real: some items, random ones among them, have no level.
  const low = num(lv[0]) == null ? 1 : Math.max(0, num(lv[0]));
  const high = num(lv[1]) || Math.max(1, level);
  let found = site.items(kind, low, high, align || null, kind === 'armor' && slot ? slot : null, kind === 'weapon' && slot && !mine ? slot : null);
  if (kind === 'armor' && !slot) found = found.filter(it => !HORSE_SLOTS.includes(it.wearloc));
  if (mine) {
    const allowed = new Set(myClass ? site.classWeapons(myClass) : []);
    found = found.filter(it => allowed.has(it.wclass));
  }
  const stat = opts.stat === 'overall' || STATS.some(([k]) => k === opts.stat) ? opts.stat : '';
  const byLevel = it => -(num(it.level) || 0);
  if (stat === 'overall') {
    found = found.filter(it => overallScore(it) > 0).sort((a, b) => overallScore(b) - overallScore(a) || byLevel(a) - byLevel(b));
  } else if (stat) {
    found = found.filter(it => statGain(it, stat) > 0).sort((a, b) => statGain(b, stat) - statGain(a, stat) || byLevel(a) - byLevel(b));
  }
  if (opts.nominus) found = found.filter(it => !hasMinus(it));
  const zone = ['any', 'near', 'near2', 'near1'].includes(opts.item_zone) ? opts.item_zone : 'near';
  if (zone !== 'any') {
    const maxDanger = { near2: 2, near1: 1 }[zone];
    found = found.filter(it => questZoneOk(site.zoneInfo(site.itemPlace(it)[0]), level, gap, maxDanger == null ? null : maxDanger));
  }
  const placeNames = it => [site.itemPlace(it)[0], it.areaEn, it.area, it.areaUa].filter(Boolean);
  const seen = new Map(); // vnum can be missing or repeat: keys must stay unique
  const items = found.map(it => {
    const label = itemRow(tr, site, it, kind);
    const base = kind + (it.vnum != null ? it.vnum : '-' + label);
    const n = seen.get(base) || 0;
    seen.set(base, n + 1);
    return { key: n ? base + '#' + n : base, label, words: label + ' ' + site.itemPlace(it).join(' '), detail: () => itemDetail(tr, site, it, kind), data: it };
  });
  const gapN = gap == null ? 100 : gap;
  const itemsV = {
    rows: items,
    sig: '',
    filters: character.concat([
      { id: 'slot', label: t('guide.slot'), value: slotValue, options: slotChoices, onChange: v => setOpt('slot', v) },
      {
        id: 'from', label: t('guide.from'), value: String(low),
        options: [{ value: '0', label: '0' }].concat(levelOptions(low || 1)),
        onChange: v => setOpt('levels', [parseInt(v, 10) || 0, lv[1] == null ? null : lv[1]]),
      },
      {
        id: 'to', label: t('guide.to'), value: String(high), options: levelOptions(high),
        onChange: v => {
          const n = parseInt(v, 10) || 1;
          setOpt('levels', [low, n === level ? null : n]);
        },
      },
      {
        id: 'stat', label: t('guide.stat'), value: stat,
        options: [{ value: '', label: t('guide.anystat') }, { value: 'overall', label: t('guide.overall') }].concat(
          STATS.map(([k, l]) => ({ value: k, label: t('items.stat.' + l) }))
        ),
        onChange: v => setOpt('stat', v),
      },
      { id: 'nominus', label: t('guide.nominus'), value: opts.nominus ? 'yes' : 'no', options: yesNo(t), onChange: v => setOpt('nominus', v === 'yes') },
      {
        id: 'zone', label: t('guide.itemzone'), value: zone,
        options: [
          { value: 'any', label: t('guide.zone.any') },
          { value: 'near', label: tr('guide.zone.near', gapN) },
          { value: 'near2', label: tr('guide.zone.near2', gapN) },
          { value: 'near1', label: tr('guide.zone.near1', gapN) },
        ],
        onChange: v => setOpt('item_zone', v),
      },
    ]),
    actions: [
      { id: 'go', key: 'g', label: t('guide.go'), when: r => placeNames(r.data).length > 0, run: r => goTo(placeNames(r.data)) },
      {
        id: 'help', key: 'h', label: t('guide.zonehelp'),
        when: r => site.areaArticle(placeNames(r.data)) != null,
        run: r => readHelp(site.areaArticle(placeNames(r.data))),
      },
    ],
  };

  // Skills
  const teachers = site.skillTeachers();
  const skills = myClass
    ? site.classSkillList(myClass).map((sk, i) => {
        const te = teachers.get(sk.id) || {};
        const label = skillRow(tr, sk, te, level);
        return {
          key: 's' + i,
          label,
          dim: sk.level <= level,
          detail: () => {
            const text = site.articleText(sk.id);
            return label + (sk.id && text ? '\n\n' + text : '');
          },
          data: { sk, te },
        };
      })
    : [];
  // Begin on the first skill of your level, or the next level that has any.
  const startAt = skills.findIndex(r => r.data.sk.level >= level);
  const skillsV = {
    rows: skills,
    sig: myClass + ':' + level,
    start: skills.length ? skills[startAt >= 0 ? startAt : skills.length - 1].key : undefined,
    empty: myClass ? undefined : t('guide.pickclass'),
    filters: character,
    actions: [
      { id: 'help', key: 'h', label: t('guide.readhelp'), when: r => !!r.data.sk.id, run: r => readHelp(r.data.sk.id) },
      {
        id: 'teacher', key: 't', label: t('guide.goteacher'), when: r => !!r.data.te.zoneId,
        run: r => goTo(site.zoneNames(r.data.te.zoneId)),
      },
    ],
  };

  const helpAction = { id: 'help', key: 'h', label: t('guide.readhelp'), run: r => readHelp(r.data.id) };

  // Gods
  const godFields = ['paths', 'patron', 'gifts', 'restrict'];
  const godsV = {
    rows: site.religions().map(r => ({ key: 'g' + r.id, label: r.name, detail: () => infoDetail(site, r, godFields), data: r })),
    sig: '',
    filters: character,
    actions: [helpAction],
  };

  // Races: by name, or by the highest value of one stat in your class.
  const bonus = myClass ? site.classStats(myClass) : {};
  const raceFields = ['align', 'stats', 'classes', 'resist', 'vuln', 'size'];
  const raceMax = rec => {
    const values = raceValues(rec, bonus);
    const text = STAT_STEMS.map(([k]) => t('guide.maxstat.' + k) + ' ' + values[k]).join(', ');
    return Object.keys(bonus).length ? tr('guide.maxstats', classLabel(myClass), text) : tr('guide.maxstats.noclass', text);
  };
  const raceDetail = rec => {
    const text = infoDetail(site, rec, raceFields);
    const cut = text.indexOf('\n\n');
    const head = cut < 0 ? text : text.slice(0, cut);
    return head + '\n' + raceMax(rec) + (cut < 0 ? '' : text.slice(cut));
  };
  const sortKey = STAT_STEMS.some(([k]) => k === opts.race_sort) ? opts.race_sort : '';
  let races = site.races().map(r => ({ key: 'r' + r.id, label: r.name, words: r.name, detail: () => raceDetail(r), data: r }));
  if (sortKey) {
    races = races
      .map(row => ({ row, v: raceValues(row.data, bonus)[sortKey] }))
      .sort((a, b) => b.v - a.v || cmp(a.row.data.name.toLowerCase(), b.row.data.name.toLowerCase()))
      .map(({ row, v }) => Object.assign({}, row, { label: row.data.name + ', ' + t('guide.maxstat.' + sortKey) + ' ' + v }));
  }
  const racesV = {
    rows: races,
    sig: '',
    filters: character.concat([
      {
        id: 'racesort', label: t('guide.racesort'), value: sortKey,
        options: [{ value: '', label: t('guide.byname') }].concat(STAT_STEMS.map(([k]) => ({ value: k, label: t('guide.maxstat.' + k) }))),
        onChange: v => setOpt('race_sort', v),
      },
    ]),
    actions: [helpAction],
  };

  return { quests: questsV, items: itemsV, skills: skillsV, gods: godsV, races: racesV };
}

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
