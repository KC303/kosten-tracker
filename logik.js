// Rechenlogik des Kosten-Trackers. Keine Zugriffe auf Browser oder Speicher,
// damit sich alles mit `node --test` prüfen lässt. Beträge sind immer Cent (ganze Zahl).

export const DATEN_VERSION = 1;
export const SPEICHER_SCHLUESSEL = 'kosten-tracker';

// Acht Kategorien bekommen eine eigene Farbe, „Sonstiges“ bleibt grau.
export const STANDARD_KATEGORIEN = [
  'Lebensmittel',
  'Essen & Trinken',
  'Wohnen',
  'Mobilität',
  'Freizeit',
  'Einkäufe',
  'Gesundheit',
  'Abos & Verträge',
  'Sonstiges',
];

export const ANZAHL_FARBEN = 8; // mehr Farbtöne lassen sich nicht mehr sicher unterscheiden
export const FARBE_NEUTRAL = -1;

export const RHYTHMEN = [
  { id: 'monatlich', name: 'monatlich', monate: 1 },
  { id: 'vierteljaehrlich', name: 'vierteljährlich', monate: 3 },
  { id: 'halbjaehrlich', name: 'halbjährlich', monate: 6 },
  { id: 'jaehrlich', name: 'jährlich', monate: 12 },
];

const MONATSNAMEN = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];
const WOCHENTAGE = ['So.', 'Mo.', 'Di.', 'Mi.', 'Do.', 'Fr.', 'Sa.'];

const MAX_CENT = 99_999_999_99; // knapp 100 Millionen Euro, alles darüber ist ein Tippfehler

// ---------- Beträge ----------

// Liest eine Eingabe wie "12,50", "1.234,56", "12.5" oder "7" und gibt Cent zurück.
// Ungültiges, Null und Negatives ergibt null.
export function parseBetrag(text) {
  if (typeof text !== 'string') return null;
  let t = text.replace(/[\s €]/g, '');
  if (!/^[\d.,]+$/.test(t) || !/\d/.test(t)) return null;

  if (t.includes(',')) {
    if (t.indexOf(',') !== t.lastIndexOf(',')) return null;
    t = t.replace(/\./g, '').replace(',', '.'); // Punkte sind hier Tausenderpunkte
  } else if (t.includes('.')) {
    const teile = t.split('.');
    const istDezimalpunkt = teile.length === 2 && teile[1].length <= 2;
    const sindTausender = teile[0].length > 0 && teile.slice(1).every((x) => x.length === 3);
    if (!istDezimalpunkt) {
      if (!sindTausender) return null;
      t = teile.join('');
    }
  }

  const treffer = /^(\d*)(?:\.(\d{0,2}))?$/.exec(t);
  if (!treffer) return null;
  const euro = treffer[1] === '' ? 0 : Number(treffer[1]);
  const cent = Number((treffer[2] ?? '').padEnd(2, '0'));
  const gesamt = euro * 100 + cent;
  if (!Number.isSafeInteger(gesamt) || gesamt <= 0 || gesamt > MAX_CENT) return null;
  return gesamt;
}

const euroFormat = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
const euroKurzFormat = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const zahlFormat = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: false,
});

// 123456 -> "1.234,56 €"
export function formatEuro(cent) {
  return euroFormat.format(cent / 100);
}

// 123456 -> "1234,56" (für Eingabefelder und CSV)
export function formatZahl(cent) {
  return zahlFormat.format(cent / 100);
}

// ---------- Datum ----------

const zwei = (n) => String(n).padStart(2, '0');

export function istDatum(text) {
  if (typeof text !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const [j, m, t] = text.split('-').map(Number);
  return m >= 1 && m <= 12 && t >= 1 && t <= tageImMonat(j, m);
}

export function istMonat(text) {
  return typeof text === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(text);
}

// Heutiges Datum in Ortszeit als "JJJJ-MM-TT" (nicht UTC, sonst springt der Tag um Mitternacht falsch).
export function heuteISO(jetzt = new Date()) {
  return `${jetzt.getFullYear()}-${zwei(jetzt.getMonth() + 1)}-${zwei(jetzt.getDate())}`;
}

export function monatVon(datum) {
  return datum.slice(0, 7);
}

export function tageImMonat(jahr, monat) {
  return new Date(jahr, monat, 0).getDate();
}

const monatsIndex = (ym) => Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1;
const monatAusIndex = (i) => `${Math.floor(i / 12)}-${zwei((i % 12) + 1)}`;

export function monatVerschieben(ym, schritte) {
  return monatAusIndex(monatsIndex(ym) + schritte);
}

// "2026-11" -> "November 2026"
export function monatsName(ym) {
  return `${MONATSNAMEN[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
}

// "2026-11-11" -> "11.11.2026"
export function formatDatum(datum) {
  const [j, m, t] = datum.split('-');
  return `${t}.${m}.${j}`;
}

// "2026-11-11" -> "Mi., 11. November"
export function formatTag(datum) {
  const [j, m, t] = datum.split('-').map(Number);
  const wochentag = WOCHENTAGE[new Date(j, m - 1, t).getDay()];
  return `${wochentag}, ${t}. ${MONATSNAMEN[m - 1]}`;
}

// ---------- Wiederkehrende Kosten ----------

function rhythmusMonate(id) {
  return RHYTHMEN.find((r) => r.id === id)?.monate ?? 1;
}

export function rhythmusName(id) {
  return RHYTHMEN.find((r) => r.id === id)?.name ?? 'monatlich';
}

// Fälligkeitsdatum eines Eintrags im Monat ym, oder null.
// Ein 31. wird in kurzen Monaten zum letzten Tag des Monats.
export function faelligkeitImMonat(fix, ym) {
  const abstand = monatsIndex(ym) - monatsIndex(monatVon(fix.start));
  if (abstand < 0 || abstand % rhythmusMonate(fix.rhythmus) !== 0) return null;
  const jahr = Number(ym.slice(0, 4));
  const monat = Number(ym.slice(5, 7));
  const tag = Math.min(Number(fix.start.slice(8, 10)), tageImMonat(jahr, monat));
  const datum = `${ym}-${zwei(tag)}`;
  if (fix.ende && datum > fix.ende) return null;
  return datum;
}

// Alle wiederkehrenden Kosten, die im Monat ym fällig werden, nach Datum sortiert.
export function fixkostenImMonat(fixkosten, ym) {
  const liste = [];
  for (const fix of fixkosten) {
    const datum = faelligkeitImMonat(fix, ym);
    if (datum) {
      liste.push({
        fixId: fix.id,
        name: fix.name,
        betragCent: fix.betragCent,
        kategorie: fix.kategorie,
        datum,
      });
    }
  }
  return liste.sort((a, b) => a.datum.localeCompare(b.datum) || a.name.localeCompare(b.name, 'de'));
}

// Nächste Fälligkeit ab einem Stichtag (einschließlich), oder null, wenn der Eintrag beendet ist.
export function naechsteFaelligkeit(fix, ab) {
  const schritt = rhythmusMonate(fix.rhythmus);
  const start = monatsIndex(monatVon(fix.start));
  let i = Math.max(start, monatsIndex(monatVon(ab)));
  i += (schritt - ((i - start) % schritt)) % schritt; // auf den Rhythmus einrasten
  for (let versuch = 0; versuch < 2; versuch += 1, i += schritt) {
    const datum = faelligkeitImMonat(fix, monatAusIndex(i));
    if (datum === null) return null; // hinter dem Ende
    if (datum >= ab) return datum;
  }
  return null;
}

// Durchschnittliche Belastung pro Monat aus allen noch laufenden Einträgen (Cent, gerundet).
export function fixkostenProMonat(fixkosten, stichtag) {
  let summe = 0;
  for (const fix of fixkosten) {
    if (naechsteFaelligkeit(fix, stichtag) !== null) {
      summe += fix.betragCent / rhythmusMonate(fix.rhythmus);
    }
  }
  return Math.round(summe);
}

// ---------- Budget und Monatsübersicht ----------

// Budget für einen Monat: eigener Wert des Monats, sonst das Standardbudget, sonst null.
export function budgetFuer(budgets, ym) {
  const eigen = budgets?.monate?.[ym];
  if (Number.isInteger(eigen) && eigen > 0) return eigen;
  const standard = budgets?.standard;
  return Number.isInteger(standard) && standard > 0 ? standard : null;
}

export function ausgabenImMonat(ausgaben, ym) {
  return ausgaben
    .filter((a) => monatVon(a.datum) === ym)
    .sort((a, b) => b.datum.localeCompare(a.datum) || (b.angelegt ?? 0) - (a.angelegt ?? 0));
}

// Summen eines Monats: Einzelausgaben, wiederkehrende Kosten, je Kategorie, Budget und Rest.
export function monatsUebersicht(daten, ym) {
  const ausgaben = ausgabenImMonat(daten.ausgaben, ym);
  const fix = fixkostenImMonat(daten.fixkosten, ym);
  const summeAusgaben = ausgaben.reduce((s, a) => s + a.betragCent, 0);
  const summeFix = fix.reduce((s, f) => s + f.betragCent, 0);
  const gesamt = summeAusgaben + summeFix;

  const jeKat = new Map();
  for (const posten of [...ausgaben, ...fix]) {
    jeKat.set(posten.kategorie, (jeKat.get(posten.kategorie) ?? 0) + posten.betragCent);
  }
  const jeKategorie = [...jeKat.entries()]
    .map(([kategorie, cent]) => ({ kategorie, cent, anteil: gesamt > 0 ? cent / gesamt : 0 }))
    .sort((a, b) => b.cent - a.cent || a.kategorie.localeCompare(b.kategorie, 'de'));

  const budget = budgetFuer(daten.budgets, ym);
  return {
    monat: ym,
    summeAusgaben,
    summeFix,
    gesamt,
    jeKategorie,
    budget,
    rest: budget === null ? null : budget - gesamt,
    anzahlAusgaben: ausgaben.length,
    anzahlFix: fix.length,
  };
}

// ---------- Statistik ----------

// Farbplatz je Kategorie. Eine Kategorie behält ihre Farbe, solange es sie gibt;
// neue bekommen den niedrigsten freien Platz, danach und für „Sonstiges“ gibt es Grau.
export function farbSlots(kategorien, bisher = {}) {
  const plaetze = new Map();
  const belegt = new Set();
  for (const k of kategorien) {
    const alt = Object.hasOwn(bisher ?? {}, k) ? bisher[k] : undefined;
    if (Number.isInteger(alt) && alt >= 0 && alt < ANZAHL_FARBEN && !belegt.has(alt)) {
      plaetze.set(k, alt);
      belegt.add(alt);
    } else if (alt === FARBE_NEUTRAL) {
      plaetze.set(k, FARBE_NEUTRAL);
    }
  }
  for (const k of kategorien) {
    if (plaetze.has(k)) continue;
    let frei = 0;
    while (belegt.has(frei)) frei += 1;
    if (k === 'Sonstiges' || frei >= ANZAHL_FARBEN) {
      plaetze.set(k, FARBE_NEUTRAL);
    } else {
      plaetze.set(k, frei);
      belegt.add(frei);
    }
  }
  return Object.fromEntries(kategorien.map((k) => [k, plaetze.get(k)]));
}

// Letzter Monat des Verlaufs-Diagramms: der laufende, solange der gewählte Monat
// noch ins Fenster passt, sonst der gewählte. So springt das Diagramm beim Antippen nicht.
export function verlaufsEnde(ym, laufend, anzahl = 6) {
  const abstand = monatsIndex(laufend) - monatsIndex(ym);
  return abstand >= 0 && abstand < anzahl ? laufend : ym;
}

// Summen der letzten Monate bis einschließlich `ende`, ältester zuerst.
export function monatsVerlauf(daten, ende, anzahl = 6) {
  const liste = [];
  for (let i = anzahl - 1; i >= 0; i -= 1) {
    const u = monatsUebersicht(daten, monatVerschieben(ende, -i));
    liste.push({ monat: u.monat, summeAusgaben: u.summeAusgaben, summeFix: u.summeFix, gesamt: u.gesamt, budget: u.budget });
  }
  return liste;
}

// Je Tag des Monats: Betrag des Tages und aufgelaufene Summe. `zukunft` markiert Tage nach heute
// (dort stehen nur schon bekannte Posten, vor allem Fixkosten).
export function tagesVerlauf(daten, ym, heute) {
  const tage = tageImMonat(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)));
  const jeTag = new Array(tage).fill(0);
  for (const posten of [...ausgabenImMonat(daten.ausgaben, ym), ...fixkostenImMonat(daten.fixkosten, ym)]) {
    jeTag[Number(posten.datum.slice(8, 10)) - 1] += posten.betragCent;
  }
  let kumuliert = 0;
  return jeTag.map((cent, i) => {
    kumuliert += cent;
    const datum = `${ym}-${zwei(i + 1)}`;
    return { tag: i + 1, datum, cent, kumuliert, zukunft: datum > heute };
  });
}

// Kennzahlen eines Monats. Schnitt und Prognose beziehen sich auf die Einzelausgaben;
// Fixkosten stehen fest und werden in der Prognose voll dazugerechnet.
export function kennzahlen(daten, ym, heute) {
  const laufend = monatVon(heute);
  const tageGesamt = tageImMonat(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)));
  const istLaufend = ym === laufend;
  const tageVergangen = ym < laufend ? tageGesamt : istLaufend ? Number(heute.slice(8, 10)) : 0;
  const u = monatsUebersicht(daten, ym);
  const ausgaben = ausgabenImMonat(daten.ausgaben, ym);
  const bisher = ausgaben.filter((a) => a.datum <= heute).reduce((s, a) => s + a.betragCent, 0);
  const spaeter = u.summeAusgaben - bisher; // schon mit künftigem Datum eingetragen

  let groesste = null;
  for (const a of ausgaben) {
    if (groesste === null || a.betragCent > groesste.betragCent) groesste = a;
  }

  // Vergleich mit dem Vormonat. Im laufenden Monat nur bis zum selben Tag, sonst wäre er immer „besser“.
  let aktuell = u.gesamt;
  let vormonat = monatsUebersicht(daten, monatVerschieben(ym, -1)).gesamt;
  if (istLaufend) {
    const vor = tagesVerlauf(daten, monatVerschieben(ym, -1), heute);
    vormonat = vor[Math.min(tageVergangen, vor.length) - 1].kumuliert;
    aktuell = tagesVerlauf(daten, ym, heute)[tageVergangen - 1].kumuliert;
  }
  const tageUebrig = istLaufend ? tageGesamt - tageVergangen + 1 : null; // heute zählt mit
  return {
    tageImMonat: tageGesamt,
    tageVergangen,
    tageUebrig,
    anzahl: ausgaben.length,
    schnittProTag: tageVergangen > 0 ? Math.round(bisher / tageVergangen) : null,
    prognose: istLaufend ? u.summeFix + spaeter + Math.round((bisher / tageVergangen) * tageGesamt) : null,
    proTagUebrig: istLaufend && u.rest !== null && u.rest > 0 ? Math.floor(u.rest / tageUebrig) : null,
    groesste,
    vormonat,
    vergleichBisTag: istLaufend ? tageVergangen : null,
    deltaVormonat: vormonat > 0 ? (aktuell - vormonat) / vormonat : null,
  };
}

// Runde Achse für ein Diagramm: Höchstwert und Schrittweite in Cent (höchstens rund drei Schritte).
export function achse(maxCent, schritte = 3) {
  const roh = Math.max(maxCent, 300) / schritte;
  const potenz = 10 ** Math.floor(Math.log10(roh));
  const faktor = [1, 2, 2.5, 5, 10].find((f) => f * potenz >= roh);
  const schritt = Math.max(100, Math.round(faktor * potenz));
  return { max: Math.max(schritt, Math.ceil(maxCent / schritt) * schritt), schritt };
}

// 150000 -> "1.500 €", 250 -> "2,50 €" (für Achsen und Kacheln, ohne unnötige Nullen)
export function formatEuroKurz(cent) {
  return cent % 100 === 0 ? euroKurzFormat.format(cent / 100) : euroFormat.format(cent / 100);
}

// 0.123 -> "+12 %", -0.5 -> "−50 %"
export function formatProzent(anteil) {
  const p = Math.round(anteil * 100);
  return `${p > 0 ? '+' : p < 0 ? '−' : '±'}${Math.abs(p)} %`;
}

// ---------- CSV ----------

// Ein Feld für CSV mit Semikolon als Trenner (so öffnet es deutsches Excel und Numbers richtig).
function csvFeld(wert) {
  let text = String(wert ?? '');
  // Text, der wie eine Formel beginnt, würde die Tabellenkalkulation ausrechnen.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csvZeilen(posten) {
  const kopf = ['Datum', 'Betrag', 'Kategorie', 'Notiz', 'Art'];
  const zeilen = posten.map((p) =>
    [formatDatum(p.datum), formatZahl(p.betragCent), csvFeld(p.kategorie), csvFeld(p.notiz), p.art].join(';'),
  );
  // BOM vorneweg, damit Excel die Umlaute richtig liest.
  return `﻿${[kopf.join(';'), ...zeilen].join('\r\n')}\r\n`;
}

function postenImMonat(daten, ym) {
  const einzel = ausgabenImMonat(daten.ausgaben, ym).map((a) => ({
    datum: a.datum,
    betragCent: a.betragCent,
    kategorie: a.kategorie,
    notiz: a.notiz ?? '',
    art: 'Ausgabe',
  }));
  const fix = fixkostenImMonat(daten.fixkosten, ym).map((f) => ({
    datum: f.datum,
    betragCent: f.betragCent,
    kategorie: f.kategorie,
    notiz: f.name,
    art: 'Fixkosten',
  }));
  return [...einzel, ...fix].sort((a, b) => a.datum.localeCompare(b.datum));
}

export function csvFuerMonat(daten, ym) {
  return csvZeilen(postenImMonat(daten, ym));
}

// Alles vom ersten Eintrag bis zum laufenden Monat (wiederkehrende Kosten nicht in die Zukunft).
export function csvAlles(daten, heute) {
  const starts = [
    ...daten.ausgaben.map((a) => monatVon(a.datum)),
    ...daten.fixkosten.map((f) => monatVon(f.start)),
  ];
  if (starts.length === 0) return csvZeilen([]);
  const laufend = monatVon(heute);
  const erster = starts.reduce((a, b) => (a < b ? a : b));
  const letzter = [...daten.ausgaben.map((a) => monatVon(a.datum)), laufend].reduce((a, b) => (a > b ? a : b));
  const posten = [];
  for (let ym = erster; ym <= letzter; ym = monatVerschieben(ym, 1)) {
    posten.push(...postenImMonat(daten, ym));
  }
  return csvZeilen(posten);
}

// ---------- Daten ----------

export function leereDaten() {
  return {
    version: DATEN_VERSION,
    ausgaben: [],
    fixkosten: [],
    kategorien: [...STANDARD_KATEGORIEN],
    farben: farbSlots(STANDARD_KATEGORIEN),
    budgets: { standard: null, monate: {} },
    letzteKategorie: null,
  };
}

const text = (wert, max) => (typeof wert === 'string' ? wert.trim().slice(0, max) : '');
const gueltigerBetrag = (n) => Number.isInteger(n) && n > 0 && n <= MAX_CENT;

// Prüft geladene oder eingelesene Daten und gibt eine saubere Kopie zurück.
// Wirft einen Fehler, wenn die Grundform nicht stimmt; einzelne kaputte Zeilen ebenfalls,
// damit eine Sicherung nie stillschweigend unvollständig eingelesen wird.
export function pruefeDaten(roh) {
  if (!roh || typeof roh !== 'object' || !Array.isArray(roh.ausgaben) || !Array.isArray(roh.fixkosten)) {
    throw new Error('Das ist keine Kosten-Tracker-Sicherung.');
  }
  if (Number(roh.version) > DATEN_VERSION) {
    throw new Error('Die Sicherung stammt aus einer neueren Version der App.');
  }
  const ids = new Set();
  const eindeutig = (id, wo) => {
    if (typeof id !== 'string' || id === '' || ids.has(id)) throw new Error(`Fehlerhafte Kennung bei ${wo}.`);
    ids.add(id);
    return id;
  };

  const ausgaben = roh.ausgaben.map((a, i) => {
    if (!a || !gueltigerBetrag(a.betragCent) || !istDatum(a.datum)) {
      throw new Error(`Ausgabe ${i + 1} ist fehlerhaft.`);
    }
    return {
      id: eindeutig(a.id, `Ausgabe ${i + 1}`),
      betragCent: a.betragCent,
      kategorie: text(a.kategorie, 40) || 'Sonstiges',
      datum: a.datum,
      notiz: text(a.notiz, 200),
      angelegt: Number.isFinite(a.angelegt) ? a.angelegt : 0,
    };
  });

  const fixkosten = roh.fixkosten.map((f, i) => {
    if (!f || !gueltigerBetrag(f.betragCent) || !istDatum(f.start) || (f.ende && !istDatum(f.ende))) {
      throw new Error(`Fixkosten-Eintrag ${i + 1} ist fehlerhaft.`);
    }
    return {
      id: eindeutig(f.id, `Fixkosten-Eintrag ${i + 1}`),
      name: text(f.name, 60) || 'Ohne Namen',
      betragCent: f.betragCent,
      kategorie: text(f.kategorie, 40) || 'Sonstiges',
      rhythmus: RHYTHMEN.some((r) => r.id === f.rhythmus) ? f.rhythmus : 'monatlich',
      start: f.start,
      ende: f.ende || '',
    };
  });

  const kategorien = [];
  for (const k of Array.isArray(roh.kategorien) ? roh.kategorien : STANDARD_KATEGORIEN) {
    const name = text(k, 40);
    if (name && !kategorien.includes(name)) kategorien.push(name);
  }
  if (kategorien.length === 0) kategorien.push(...STANDARD_KATEGORIEN);

  const monate = {};
  for (const [ym, cent] of Object.entries(roh.budgets?.monate ?? {})) {
    if (istMonat(ym) && gueltigerBetrag(cent)) monate[ym] = cent;
  }
  const standard = gueltigerBetrag(roh.budgets?.standard) ? roh.budgets.standard : null;

  return {
    version: DATEN_VERSION,
    ausgaben,
    fixkosten,
    kategorien,
    farben: farbSlots(kategorien, roh.farben && typeof roh.farben === 'object' ? roh.farben : {}),
    budgets: { standard, monate },
    letzteKategorie: kategorien.includes(roh.letzteKategorie) ? roh.letzteKategorie : null,
  };
}
