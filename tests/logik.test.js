import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../logik.js';

const ohneSonderleerzeichen = (s) => s.replace(/ /g, ' ');

test('parseBetrag liest deutsche Schreibweisen', () => {
  assert.equal(L.parseBetrag('12,50'), 1250);
  assert.equal(L.parseBetrag('12,5'), 1250);
  assert.equal(L.parseBetrag('7'), 700);
  assert.equal(L.parseBetrag('0,99'), 99);
  assert.equal(L.parseBetrag(',5'), 50);
  assert.equal(L.parseBetrag('1.234,56'), 123456);
  assert.equal(L.parseBetrag('1.234'), 123400);
  assert.equal(L.parseBetrag('1.234.567'), 123456700);
  assert.equal(L.parseBetrag(' 19,99 € '), 1999);
  assert.equal(L.parseBetrag('12.50'), 1250, 'Punkt mit zwei Stellen gilt als Dezimalpunkt');
  assert.equal(L.parseBetrag('12.5'), 1250);
  assert.equal(L.parseBetrag('4,35'), 435, 'keine Rundungsfehler aus Gleitkommazahlen');
  assert.equal(L.parseBetrag('1,15'), 115);
  assert.equal(L.parseBetrag('8,7'), 870);
});

test('parseBetrag weist Ungültiges ab', () => {
  for (const eingabe of ['', ' ', 'abc', '-5', '0', '0,00', '1,2,3', '12,345', '1.23.4', '1..2', ',', '.', '12a', '1e3']) {
    assert.equal(L.parseBetrag(eingabe), null, `"${eingabe}" muss ungültig sein`);
  }
  assert.equal(L.parseBetrag(null), null);
  assert.equal(L.parseBetrag(12), null);
  assert.equal(L.parseBetrag('999999999999'), null, 'absurd große Beträge sind Tippfehler');
});

test('formatEuro und formatZahl', () => {
  assert.equal(ohneSonderleerzeichen(L.formatEuro(123456)), '1.234,56 €');
  assert.equal(ohneSonderleerzeichen(L.formatEuro(5)), '0,05 €');
  assert.equal(ohneSonderleerzeichen(L.formatEuro(-1250)), '-12,50 €');
  assert.equal(L.formatZahl(123456), '1234,56');
  assert.equal(L.formatZahl(700), '7,00');
});

test('parseBetrag und formatZahl passen zusammen', () => {
  for (const cent of [1, 99, 100, 1250, 123456, 99999999]) {
    assert.equal(L.parseBetrag(L.formatZahl(cent)), cent);
  }
});

test('Datumshelfer', () => {
  assert.equal(L.heuteISO(new Date(2026, 10, 11, 23, 59)), '2026-11-11');
  assert.equal(L.heuteISO(new Date(2026, 0, 1, 0, 0)), '2026-01-01');
  assert.equal(L.monatVon('2026-11-11'), '2026-11');
  assert.equal(L.monatVerschieben('2026-11', 1), '2026-12');
  assert.equal(L.monatVerschieben('2026-12', 1), '2027-01');
  assert.equal(L.monatVerschieben('2026-01', -1), '2025-12');
  assert.equal(L.monatVerschieben('2026-11', -23), '2024-12');
  assert.equal(L.monatsName('2026-03'), 'März 2026');
  assert.equal(L.formatDatum('2026-11-05'), '05.11.2026');
  assert.equal(L.formatTag('2026-11-11'), 'Mi., 11. November');
  assert.equal(L.tageImMonat(2028, 2), 29);
  assert.equal(L.tageImMonat(2026, 2), 28);
  assert.ok(L.istDatum('2028-02-29'));
  assert.ok(!L.istDatum('2026-02-29'));
  assert.ok(!L.istDatum('2026-13-01'));
  assert.ok(!L.istDatum('11.11.2026'));
  assert.ok(L.istMonat('2026-11'));
  assert.ok(!L.istMonat('2026-00'));
});

const miete = { id: 'm', name: 'Miete', betragCent: 60000, kategorie: 'Wohnen', rhythmus: 'monatlich', start: '2026-01-01', ende: '' };
const versicherung = { id: 'v', name: 'Haftpflicht', betragCent: 6000, kategorie: 'Versicherung', rhythmus: 'jaehrlich', start: '2026-03-15', ende: '' };
const abo = { id: 'a', name: 'Musik', betragCent: 1099, kategorie: 'Abos', rhythmus: 'monatlich', start: '2026-01-31', ende: '2026-06-30' };
const quartal = { id: 'q', name: 'Rundfunk', betragCent: 5508, kategorie: 'Wohnen', rhythmus: 'vierteljaehrlich', start: '2026-02-15', ende: '' };

test('faelligkeitImMonat: Rhythmus, Beginn und Ende', () => {
  assert.equal(L.faelligkeitImMonat(miete, '2025-12'), null, 'vor dem Beginn');
  assert.equal(L.faelligkeitImMonat(miete, '2026-01'), '2026-01-01');
  assert.equal(L.faelligkeitImMonat(miete, '2031-07'), '2031-07-01');

  assert.equal(L.faelligkeitImMonat(versicherung, '2026-03'), '2026-03-15');
  assert.equal(L.faelligkeitImMonat(versicherung, '2026-04'), null);
  assert.equal(L.faelligkeitImMonat(versicherung, '2027-03'), '2027-03-15');

  assert.equal(L.faelligkeitImMonat(quartal, '2026-02'), '2026-02-15');
  assert.equal(L.faelligkeitImMonat(quartal, '2026-03'), null);
  assert.equal(L.faelligkeitImMonat(quartal, '2026-05'), '2026-05-15');
  assert.equal(L.faelligkeitImMonat(quartal, '2027-02'), '2027-02-15');

  const halb = { ...quartal, rhythmus: 'halbjaehrlich' };
  assert.equal(L.faelligkeitImMonat(halb, '2026-05'), null);
  assert.equal(L.faelligkeitImMonat(halb, '2026-08'), '2026-08-15');
});

test('faelligkeitImMonat: der 31. rutscht in kurzen Monaten auf den letzten Tag', () => {
  assert.equal(L.faelligkeitImMonat(abo, '2026-02'), '2026-02-28');
  assert.equal(L.faelligkeitImMonat(abo, '2026-04'), '2026-04-30');
  assert.equal(L.faelligkeitImMonat(abo, '2026-05'), '2026-05-31');
  assert.equal(L.faelligkeitImMonat(abo, '2026-06'), '2026-06-30', 'am Tag des Endes noch fällig');
  assert.equal(L.faelligkeitImMonat(abo, '2026-07'), null, 'nach dem Ende nicht mehr');
  const frueherSchluss = { ...abo, ende: '2026-06-29' };
  assert.equal(L.faelligkeitImMonat(frueherSchluss, '2026-06'), null, 'Ende vor dem Fälligkeitstag');
});

test('fixkostenImMonat sortiert nach Datum', () => {
  const liste = L.fixkostenImMonat([versicherung, abo, miete, quartal], '2026-03');
  assert.deepEqual(liste.map((f) => [f.name, f.datum]), [
    ['Miete', '2026-03-01'],
    ['Haftpflicht', '2026-03-15'],
    ['Musik', '2026-03-31'],
  ]);
});

test('naechsteFaelligkeit', () => {
  assert.equal(L.naechsteFaelligkeit(miete, '2026-11-11'), '2026-12-01');
  assert.equal(L.naechsteFaelligkeit(miete, '2026-11-01'), '2026-11-01', 'heute zählt mit');
  assert.equal(L.naechsteFaelligkeit(miete, '2025-06-10'), '2026-01-01', 'vor dem Beginn: erster Termin');
  assert.equal(L.naechsteFaelligkeit(versicherung, '2026-03-16'), '2027-03-15');
  assert.equal(L.naechsteFaelligkeit(versicherung, '2026-11-11'), '2027-03-15');
  assert.equal(L.naechsteFaelligkeit(quartal, '2026-11-11'), '2026-11-15');
  assert.equal(L.naechsteFaelligkeit(quartal, '2026-11-16'), '2027-02-15');
  assert.equal(L.naechsteFaelligkeit(abo, '2026-06-30'), '2026-06-30');
  assert.equal(L.naechsteFaelligkeit(abo, '2026-07-01'), null, 'beendet');
  assert.equal(L.naechsteFaelligkeit(abo, '2026-11-11'), null);
});

test('fixkostenProMonat rechnet jährliche und vierteljährliche Kosten um', () => {
  // 600,00 + 60,00/12 + 55,08/3 = 600 + 5 + 18,36 = 623,36; das beendete Abo zählt nicht mehr
  assert.equal(L.fixkostenProMonat([miete, versicherung, abo, quartal], '2026-11-11'), 62336);
  assert.equal(L.fixkostenProMonat([miete, versicherung, abo, quartal], '2026-05-01'), 62336 + 1099);
  assert.equal(L.fixkostenProMonat([], '2026-11-11'), 0);
});

function beispiel() {
  const d = L.leereDaten();
  d.ausgaben = [
    { id: '1', betragCent: 2350, kategorie: 'Lebensmittel', datum: '2026-11-03', notiz: 'Wocheneinkauf', angelegt: 1 },
    { id: '2', betragCent: 1250, kategorie: 'Essen & Trinken', datum: '2026-11-03', notiz: '', angelegt: 2 },
    { id: '3', betragCent: 4000, kategorie: 'Lebensmittel', datum: '2026-11-10', notiz: '', angelegt: 3 },
    { id: '4', betragCent: 9900, kategorie: 'Freizeit', datum: '2026-10-28', notiz: 'Konzert', angelegt: 4 },
    { id: '5', betragCent: 500, kategorie: 'Wohnen', datum: '2026-11-30', notiz: '', angelegt: 5 },
  ];
  d.fixkosten = [miete, versicherung, abo, quartal];
  return d;
}

test('monatsUebersicht: Summen, Kategorien und Budget', () => {
  const d = beispiel();
  d.budgets = { standard: 100000, monate: { '2026-10': 5000 } };
  const u = L.monatsUebersicht(d, '2026-11');
  assert.equal(u.summeAusgaben, 2350 + 1250 + 4000 + 500);
  assert.equal(u.summeFix, 60000 + 5508);
  assert.equal(u.gesamt, 8100 + 65508);
  assert.equal(u.anzahlAusgaben, 4);
  assert.equal(u.anzahlFix, 2);
  assert.deepEqual(u.jeKategorie.map((k) => [k.kategorie, k.cent]), [
    ['Wohnen', 60000 + 5508 + 500],
    ['Lebensmittel', 6350],
    ['Essen & Trinken', 1250],
  ]);
  const anteile = u.jeKategorie.reduce((s, k) => s + k.anteil, 0);
  assert.ok(Math.abs(anteile - 1) < 1e-9);
  assert.equal(u.budget, 100000);
  assert.equal(u.rest, 100000 - 73608);

  const okt = L.monatsUebersicht(d, '2026-10');
  assert.equal(okt.budget, 5000, 'eigenes Budget des Monats geht vor');
  assert.equal(okt.rest, 5000 - (9900 + 60000), 'überzogen ergibt negativen Rest');
});

test('monatsUebersicht: leerer Monat und kein Budget', () => {
  const u = L.monatsUebersicht(L.leereDaten(), '2026-11');
  assert.equal(u.gesamt, 0);
  assert.deepEqual(u.jeKategorie, []);
  assert.equal(u.budget, null);
  assert.equal(u.rest, null);
});

test('budgetFuer', () => {
  assert.equal(L.budgetFuer({ standard: null, monate: {} }, '2026-11'), null);
  assert.equal(L.budgetFuer({ standard: 80000, monate: {} }, '2026-11'), 80000);
  assert.equal(L.budgetFuer({ standard: 80000, monate: { '2026-11': 90000 } }, '2026-11'), 90000);
  assert.equal(L.budgetFuer({ standard: 80000, monate: { '2026-11': 90000 } }, '2026-12'), 80000);
  assert.equal(L.budgetFuer(undefined, '2026-11'), null);
});

test('ausgabenImMonat: neueste zuerst, Monatsgrenzen sauber', () => {
  const liste = L.ausgabenImMonat(beispiel().ausgaben, '2026-11');
  assert.deepEqual(liste.map((a) => a.id), ['5', '3', '2', '1']);
});

test('csvFuerMonat: Semikolon, Komma, BOM und Maskierung', () => {
  const d = beispiel();
  d.ausgaben.push({ id: '6', betragCent: 123456, kategorie: 'Einkäufe', datum: '2026-11-05', notiz: 'Tisch; "Eiche"', angelegt: 6 });
  d.ausgaben.push({ id: '7', betragCent: 100, kategorie: 'Sonstiges', datum: '2026-11-06', notiz: '=SUMME(A1)', angelegt: 7 });
  const csv = L.csvFuerMonat(d, '2026-11');
  assert.ok(csv.startsWith('﻿'), 'BOM für Excel');
  const zeilen = csv.slice(1).trimEnd().split('\r\n');
  assert.equal(zeilen[0], 'Datum;Betrag;Kategorie;Notiz;Art');
  assert.equal(zeilen[1], '01.11.2026;600,00;Wohnen;Miete;Fixkosten');
  assert.ok(zeilen.includes('03.11.2026;23,50;Lebensmittel;Wocheneinkauf;Ausgabe'));
  assert.ok(zeilen.includes('05.11.2026;1234,56;Einkäufe;"Tisch; ""Eiche""";Ausgabe'));
  assert.ok(zeilen.includes("06.11.2026;1,00;Sonstiges;'=SUMME(A1);Ausgabe"), 'Formeln werden entschärft');
  assert.equal(zeilen.length, 1 + 6 + 2);
  const daten = zeilen.slice(1).map((z) => z.slice(6, 10) + z.slice(3, 5) + z.slice(0, 2));
  assert.deepEqual(daten, [...daten].sort(), 'nach Datum sortiert');
});

test('csvAlles: vom ersten Eintrag bis zum laufenden Monat', () => {
  const d = L.leereDaten();
  d.ausgaben = [{ id: '1', betragCent: 1000, kategorie: 'Freizeit', datum: '2026-09-20', notiz: '', angelegt: 1 }];
  d.fixkosten = [{ ...miete, start: '2026-10-01' }];
  const zeilen = L.csvAlles(d, '2026-11-11').slice(1).trimEnd().split('\r\n');
  assert.deepEqual(zeilen.slice(1), [
    '20.09.2026;10,00;Freizeit;;Ausgabe',
    '01.10.2026;600,00;Wohnen;Miete;Fixkosten',
    '01.11.2026;600,00;Wohnen;Miete;Fixkosten',
  ]);
  assert.equal(L.csvAlles(L.leereDaten(), '2026-11-11').slice(1).trimEnd(), 'Datum;Betrag;Kategorie;Notiz;Art');
});

test('pruefeDaten: eigene Daten überstehen Speichern und Laden unverändert', () => {
  const d = beispiel();
  d.budgets = { standard: 100000, monate: { '2026-10': 5000 } };
  d.letzteKategorie = 'Freizeit';
  const wieder = L.pruefeDaten(JSON.parse(JSON.stringify(d)));
  assert.deepEqual(wieder, d);
});

test('pruefeDaten: weist Fremdes und Kaputtes ab', () => {
  assert.throws(() => L.pruefeDaten(null));
  assert.throws(() => L.pruefeDaten([]));
  assert.throws(() => L.pruefeDaten({ ausgaben: [] }));
  assert.throws(() => L.pruefeDaten({ version: 99, ausgaben: [], fixkosten: [] }), /neueren Version/);
  const kaputt = (ausgabe) => ({ ausgaben: [ausgabe], fixkosten: [] });
  assert.throws(() => L.pruefeDaten(kaputt({ id: 'x', betragCent: 12.5, datum: '2026-11-01' })), /Ausgabe 1/);
  assert.throws(() => L.pruefeDaten(kaputt({ id: 'x', betragCent: -100, datum: '2026-11-01' })));
  assert.throws(() => L.pruefeDaten(kaputt({ id: 'x', betragCent: 100, datum: '2026-02-30' })));
  assert.throws(() => L.pruefeDaten(kaputt({ betragCent: 100, datum: '2026-11-01' })), /Kennung/);
  assert.throws(() =>
    L.pruefeDaten({
      ausgaben: [
        { id: 'x', betragCent: 100, datum: '2026-11-01' },
        { id: 'x', betragCent: 200, datum: '2026-11-02' },
      ],
      fixkosten: [],
    }),
  );
  assert.throws(() => L.pruefeDaten({ ausgaben: [], fixkosten: [{ id: 'f', betragCent: 100, start: '2026-11-01', ende: 'bald' }] }));
});

test('pruefeDaten: füllt Fehlendes sinnvoll auf', () => {
  const d = L.pruefeDaten({
    ausgaben: [{ id: 'x', betragCent: 100, datum: '2026-11-01' }],
    fixkosten: [{ id: 'f', betragCent: 100, start: '2026-11-01', rhythmus: 'wöchentlich' }],
    kategorien: ['  Hobby ', 'Hobby', '', 7],
    budgets: { standard: 'viel', monate: { '2026-11': 5000, quatsch: 1, '2026-12': -5 } },
    letzteKategorie: 'gibt es nicht',
  });
  assert.equal(d.ausgaben[0].kategorie, 'Sonstiges');
  assert.equal(d.ausgaben[0].notiz, '');
  assert.equal(d.fixkosten[0].rhythmus, 'monatlich');
  assert.equal(d.fixkosten[0].name, 'Ohne Namen');
  assert.deepEqual(d.kategorien, ['Hobby']);
  assert.deepEqual(d.farben, { Hobby: 0 });
  assert.deepEqual(d.budgets, { standard: null, monate: { '2026-11': 5000 } });
  assert.equal(d.letzteKategorie, null);
});

test('leereDaten gibt jedes Mal eine frische Kopie', () => {
  const a = L.leereDaten();
  a.kategorien.push('Neu');
  a.budgets.monate['2026-11'] = 1;
  const b = L.leereDaten();
  assert.equal(b.kategorien.includes('Neu'), false);
  assert.deepEqual(b.budgets.monate, {});
  assert.deepEqual(L.pruefeDaten(b), b);
});

test('farbSlots: feste Farbe je Kategorie, Sonstiges und Überzählige grau', () => {
  const start = L.farbSlots(L.STANDARD_KATEGORIEN);
  assert.equal(start.Lebensmittel, 0);
  assert.equal(start['Abos & Verträge'], 7);
  assert.equal(start.Sonstiges, L.FARBE_NEUTRAL);
  const farbig = Object.values(start).filter((s) => s >= 0);
  assert.equal(new Set(farbig).size, farbig.length, 'keine Farbe doppelt');

  // Entfernen verschiebt nichts, eine neue Kategorie bekommt den frei gewordenen Platz
  const ohneWohnen = L.STANDARD_KATEGORIEN.filter((k) => k !== 'Wohnen');
  const danach = L.farbSlots([...ohneWohnen, 'Hobby', 'Urlaub'], start);
  assert.equal(danach.Mobilität, start.Mobilität);
  assert.equal(danach.Hobby, start.Wohnen);
  assert.equal(danach.Urlaub, L.FARBE_NEUTRAL, 'neunte Farbe gibt es nicht');
  assert.equal('Wohnen' in danach, false);

  // Unsinn in gespeicherten Farben wird repariert
  assert.deepEqual(L.farbSlots(['A', 'B', 'C'], { A: 3, B: 3, C: 99 }), { A: 3, B: 0, C: 1 });
  assert.deepEqual(L.farbSlots(['__proto__', 'A']), JSON.parse('{"__proto__":0,"A":1}'));
});

test('verlaufsEnde und monatsVerlauf', () => {
  assert.equal(L.verlaufsEnde('2026-11', '2026-11'), '2026-11');
  assert.equal(L.verlaufsEnde('2026-06', '2026-11'), '2026-11', 'passt noch ins Fenster');
  assert.equal(L.verlaufsEnde('2026-05', '2026-11'), '2026-05', 'zu weit zurück');
  assert.equal(L.verlaufsEnde('2026-12', '2026-11'), '2026-12', 'Zukunft');

  const v = L.monatsVerlauf(beispiel(), '2026-11', 3);
  assert.deepEqual(v.map((m) => m.monat), ['2026-09', '2026-10', '2026-11']);
  assert.deepEqual(v.map((m) => m.summeAusgaben), [0, 9900, 8100]);
  assert.deepEqual(v.map((m) => m.summeFix), [60000, 60000, 65508]);
  assert.deepEqual(v.map((m) => m.gesamt), [60000, 69900, 73608]);
});

test('tagesVerlauf: Tagesbeträge, laufende Summe, Zukunft', () => {
  const v = L.tagesVerlauf(beispiel(), '2026-11', '2026-11-11');
  assert.equal(v.length, 30);
  assert.equal(v[0].cent, 60000, 'Miete am 1.');
  assert.equal(v[2].cent, 2350 + 1250);
  assert.equal(v[2].kumuliert, 63600);
  assert.equal(v[10].kumuliert, 67600, 'Stand heute');
  assert.equal(v[10].zukunft, false);
  assert.equal(v[11].zukunft, true);
  assert.equal(v[14].cent, 5508, 'Rundfunk am 15.');
  assert.equal(v[29].kumuliert, 73608, 'endet bei der Monatssumme');
  assert.equal(L.tagesVerlauf(L.leereDaten(), '2028-02', '2026-11-11').length, 29);
});

test('kennzahlen: laufender Monat', () => {
  const d = beispiel();
  d.budgets = { standard: 100000, monate: {} };
  const k = L.kennzahlen(d, '2026-11', '2026-11-11');
  assert.equal(k.tageImMonat, 30);
  assert.equal(k.tageVergangen, 11);
  assert.equal(k.tageUebrig, 20, 'heute zählt mit');
  assert.equal(k.anzahl, 4);
  assert.equal(k.schnittProTag, Math.round(7600 / 11), 'nur Ausgaben bis heute');
  // Fixkosten 655,08 + schon für den 30. eingetragen 5,00 + Hochrechnung 76,00 / 11 * 30
  assert.equal(k.prognose, 65508 + 500 + Math.round((7600 / 11) * 30));
  assert.equal(k.proTagUebrig, Math.floor((100000 - 73608) / 20));
  assert.equal(k.groesste.id, '3');
  // Vergleich nur bis zum 11.: Oktober bis dahin 600,00 (Miete), November 676,00
  assert.equal(k.vergleichBisTag, 11);
  assert.equal(k.vormonat, 60000);
  assert.ok(Math.abs(k.deltaVormonat - 7600 / 60000) < 1e-12);
});

test('kennzahlen: vergangener, künftiger und leerer Monat', () => {
  const d = beispiel();
  const okt = L.kennzahlen(d, '2026-10', '2026-11-11');
  assert.equal(okt.tageVergangen, 31);
  assert.equal(okt.schnittProTag, Math.round(9900 / 31));
  assert.equal(okt.prognose, null);
  assert.equal(okt.tageUebrig, null);
  assert.equal(okt.proTagUebrig, null);
  assert.equal(okt.groesste.id, '4');
  assert.equal(okt.vergleichBisTag, null);
  assert.equal(okt.vormonat, 60000, 'ganzer September');
  assert.ok(Math.abs(okt.deltaVormonat - 9900 / 60000) < 1e-12);

  // Am 31. gegen einen Monat mit 30 Tagen: der ganze Vormonat zählt
  const ende = L.kennzahlen(d, '2026-12', '2026-12-31');
  assert.equal(ende.vergleichBisTag, 31);
  assert.equal(ende.vormonat, 73608);

  const dez = L.kennzahlen(d, '2026-12', '2026-11-11');
  assert.equal(dez.tageVergangen, 0);
  assert.equal(dez.schnittProTag, null);
  assert.equal(dez.prognose, null);

  const leer = L.kennzahlen(L.leereDaten(), '2026-11', '2026-11-11');
  assert.equal(leer.schnittProTag, 0);
  assert.equal(leer.prognose, 0);
  assert.equal(leer.groesste, null);
  assert.equal(leer.deltaVormonat, null);
  assert.equal(leer.proTagUebrig, null, 'ohne Budget kein Tagesbetrag');

  const ueberzogen = beispiel();
  ueberzogen.budgets = { standard: 1000, monate: {} };
  assert.equal(L.kennzahlen(ueberzogen, '2026-11', '2026-11-11').proTagUebrig, null);
});

test('achse: runde Werte', () => {
  assert.deepEqual(L.achse(73608), { max: 75000, schritt: 25000 });
  assert.deepEqual(L.achse(100000), { max: 100000, schritt: 50000 });
  assert.deepEqual(L.achse(123456), { max: 150000, schritt: 50000 });
  assert.deepEqual(L.achse(0), { max: 100, schritt: 100 });
  assert.deepEqual(L.achse(950), { max: 1000, schritt: 500 });
  for (const max of [1, 99, 100, 4321, 99999, 250000, 7654321]) {
    const a = L.achse(max);
    assert.ok(a.max >= max && a.max % a.schritt === 0 && a.max / a.schritt <= 4, `Achse für ${max}`);
    assert.ok(a.schritt % 100 === 0, 'Schritte in ganzen Euro');
  }
});

test('formatEuroKurz und formatProzent', () => {
  assert.equal(ohneSonderleerzeichen(L.formatEuroKurz(150000)), '1.500 €');
  assert.equal(ohneSonderleerzeichen(L.formatEuroKurz(250)), '2,50 €');
  assert.equal(ohneSonderleerzeichen(L.formatEuroKurz(0)), '0 €');
  assert.equal(L.formatProzent(0.123), '+12 %');
  assert.equal(L.formatProzent(-0.5), '−50 %');
  assert.equal(L.formatProzent(0.001), '±0 %');
});
