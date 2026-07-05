// "Who" panel race + clan names, keyed by the short code the server sends.
// Terse (<=8 chars) to fit the narrow panel column. EN = the engine's own <nameWho>
// (races/*.xml); RU = the historical panel abbrev; UA from RACES_UA.md / clans/*.xml.
// Game text everywhere else is localized on the server; these stay client-side because
// the who prompt sends only a 2-letter code, not a full localized name.

const RACE_NAMES = {
    ar: { en: 'Arial', ru: 'Ариал',   ua: 'Аріал' },
    ce: { en: 'Centa', ru: 'Кентавр', ua: 'Кентавр' },
    cl: { en: 'ClGia', ru: 'ОбВелик', ua: 'ХмВелет' },
    da: { en: 'D-Elf', ru: 'ТемЭльф', ua: 'ТемЕльф' },
    dr: { en: 'Drow',  ru: 'Дроу',    ua: 'Дроу' },
    du: { en: 'Duerg', ru: 'Дуэргар', ua: 'Дуергар' },
    dw: { en: 'Dwarf', ru: 'Дварф',   ua: 'Дварф' },
    el: { en: 'Elf',   ru: 'Эльф',    ua: 'Ельф' },
    fa: { en: 'Faery', ru: 'Фея',     ua: 'Фея' },
    fe: { en: 'Felar', ru: 'Фелар',   ua: 'Фелар' },
    fi: { en: 'FiGia', ru: 'ОгВелик', ua: 'ВгВелет' },
    fr: { en: 'FrGia', ru: 'ИнВелик', ua: 'КрВелет' },
    gi: { en: 'Githy', ru: 'Гитианк', ua: 'Гітіанки' },
    gn: { en: 'Gnome', ru: 'Гном',    ua: 'Гном' },
    ha: { en: 'H-Elf', ru: 'ПолЭльф', ua: 'НапЕльф' },
    ho: { en: 'Hobbi', ru: 'Хоббит',  ua: 'Гобіт' },
    hu: { en: 'Human', ru: 'Человек', ua: 'Людина' },
    ke: { en: 'Kendr', ru: 'Кендер',  ua: 'Кендер' },
    ma: { en: 'Mawg',  ru: 'Чес',     ua: 'Псюрень' },
    ro: { en: 'Rocks', ru: 'Роксир',  ua: 'Роксір' },
    sa: { en: 'Satyr', ru: 'Сатир',   ua: 'Сатир' },
    st: { en: 'StGia', ru: 'ШтВелик', ua: 'ШтВелет' },
    sv: { en: 'Svirf', ru: 'Свирф',   ua: 'Свірф' },
    tr: { en: 'Troll', ru: 'Тролль',  ua: 'Троль' },
    ur: { en: 'Urkhi', ru: 'Урукха',  ua: 'Урукхай' },
};

const CLAN_NAMES = {
    b: { en: 'Fury',     ru: 'Ярости',     ua: 'Ярості' },
    c: { en: 'Chaos',    ru: 'Хаос',       ua: 'Хаос' },
    e: { en: 'Exiles',   ru: 'Изгои',      ua: 'Ізгої' },
    f: { en: 'Flowers',  ru: 'Цветы',      ua: 'Квіти' },
    g: { en: 'Ghosts',   ru: 'Призраки',   ua: 'Привиди' },
    h: { en: 'Hunters',  ru: 'Охотники',   ua: 'Мисливці' },
    i: { en: 'Invaders', ru: 'Захватчики', ua: 'Загарбники' },
    k: { en: 'Knights',  ru: 'Рыцари',     ua: 'Лицарі' },
    l: { en: 'Lions',    ru: 'Львы',       ua: 'Леви' },
    o: { en: 'Loners',   ru: 'Одиночки',   ua: 'Одинаки' },
    r: { en: 'Rulers',   ru: 'Правители',  ua: 'Правителі' },
    s: { en: 'Shalafi',  ru: 'Шалафи',     ua: 'Шалафі' },
    n: { en: '',         ru: '',           ua: '' },
};

// Look up a localized who-panel name; fall back to EN, then the raw code.
export function raceName(code, lang) {
    const e = RACE_NAMES[code];
    if (e == null) return code || '';
    return e[lang] || e.en;
}

export function clanName(letter, lang) {
    const e = CLAN_NAMES[letter];
    if (e == null) return letter || '';
    return e[lang] || e.en;
}
