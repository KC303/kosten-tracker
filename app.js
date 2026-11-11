// Oberfläche des Kosten-Trackers. Gerechnet wird in logik.js, gespeichert im localStorage des Geräts.
import * as L from './logik.js';
import * as D from './diagramme.js';

const $ = (id) => document.getElementById(id);

// Baut ein Element. Texte landen immer als Text im Dokument, nie als HTML.
function el(tag, eigenschaften = {}, ...kinder) {
  const knoten = document.createElement(tag);
  for (const [name, wert] of Object.entries(eigenschaften)) {
    if (wert === false || wert === null || wert === undefined) continue;
    if (name === 'class') knoten.className = wert;
    else if (name === 'onclick') knoten.addEventListener('click', wert);
    else if (wert === true) knoten.setAttribute(name, '');
    else knoten.setAttribute(name, wert);
  }
  knoten.append(...kinder.filter((k) => k !== null && k !== undefined && k !== false));
  return knoten;
}

// ---------- Zustand und Speicher ----------

let ladefehler = false;
let daten = laden();
let monat = L.monatVon(L.heuteISO());
let tab = 'ausgaben';
let bearbeiteAusgabe = null; // id oder null (neu)
let bearbeiteFix = null;

function laden() {
  let roh = null;
  try {
    roh = localStorage.getItem(L.SPEICHER_SCHLUESSEL);
    if (!roh) return L.leereDaten();
    return L.pruefeDaten(JSON.parse(roh));
  } catch (fehler) {
    // Unlesbare Daten nicht überschreiben, sondern zur Seite legen.
    ladefehler = true;
    try {
      if (roh) localStorage.setItem(`${L.SPEICHER_SCHLUESSEL}-defekt-${Date.now()}`, roh);
    } catch { /* Speicher voll oder gesperrt */ }
    return L.leereDaten();
  }
}

function speichern() {
  try {
    localStorage.setItem(L.SPEICHER_SCHLUESSEL, JSON.stringify(daten));
    return true;
  } catch {
    melde('Speichern fehlgeschlagen. Bitte unter „Mehr“ eine Sicherung anlegen.', 6000);
    return false;
  }
}

function neueId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// ---------- Kleine Helfer ----------

let meldungsUhr = null;
function melde(text, dauer = 2200) {
  const box = $('meldung');
  box.textContent = text;
  box.hidden = false;
  clearTimeout(meldungsUhr);
  meldungsUhr = setTimeout(() => { box.hidden = true; }, dauer);
}

// Rückfrage mit Ja und Abbrechen. Die Antwort kommt direkt vom Tipp auf den Knopf und nicht
// vom „close“-Ereignis des Dialogs: Das feuert der Browser erst mit dem nächsten Bildaufbau.
function frage(text, jaText = 'Ja') {
  return new Promise((antwort) => {
    const dlg = $('dlg-frage');
    $('frage-text').textContent = text;
    $('frage-ja').textContent = jaText;
    const fertig = (ja) => {
      dlg.removeEventListener('click', beiKlick);
      dlg.removeEventListener('cancel', beiAbbruch);
      if (dlg.open) dlg.close();
      antwort(ja);
    };
    const beiKlick = (ereignis) => {
      const knopf = ereignis.target.closest('button');
      if (knopf) {
        ereignis.preventDefault();
        fertig(knopf.value === 'ja');
      } else if (ereignis.target === dlg) {
        fertig(false); // neben den Dialog getippt
      }
    };
    const beiAbbruch = (ereignis) => {
      ereignis.preventDefault();
      fertig(false);
    };
    dlg.addEventListener('click', beiKlick);
    dlg.addEventListener('cancel', beiAbbruch);
    dlg.showModal();
  });
}

function zeigeFehler(id, text) {
  const p = $(id);
  p.textContent = text ?? '';
  p.hidden = !text;
}

const anzahl = (n, einzahl, mehrzahl) => `${n} ${n === 1 ? einzahl : mehrzahl}`;

// Farbklasse einer Kategorie (acht feste Farben, sonst Grau) und der farbige Punkt dazu.
function farbKlasse(kategorie) {
  const platz = Object.hasOwn(daten.farben, kategorie) ? daten.farben[kategorie] : L.FARBE_NEUTRAL;
  return platz >= 0 ? `kat-${platz}` : 'kat-n';
}
const punkt = (kategorie) => el('i', { class: `punkt ${farbKlasse(kategorie)}`, 'aria-hidden': 'true' });

function alleKategorien(zusatz) {
  const liste = [...daten.kategorien];
  if (zusatz && !liste.includes(zusatz)) liste.push(zusatz);
  return liste;
}

// ---------- Ansichten ----------

function kopfKarte(u, mitKnopf) {
  const k = L.kennzahlen(daten, monat, L.heuteISO());
  const karte = el('section', { class: 'karte held' });
  karte.append(
    el('div', { class: 'held-zeile' }, `Gesamt im ${L.monatsName(monat)}`),
    el('div', { class: 'gross', id: 'summe-gesamt' }, L.formatEuro(u.gesamt)),
    el('div', { class: 'held-zeile' }, `Ausgaben ${L.formatEuro(u.summeAusgaben)} · Fixkosten ${L.formatEuro(u.summeFix)}`),
  );
  if (u.budget !== null) {
    const anteil = Math.min(1, u.gesamt / u.budget);
    const balken = el('div', {
      class: u.rest < 0 ? 'fortschritt ueberzogen' : 'fortschritt',
      role: 'progressbar',
      'aria-valuemin': '0',
      'aria-valuemax': '100',
      'aria-valuenow': String(Math.round(anteil * 100)),
      'aria-label': 'Budget verbraucht',
    }, el('span'));
    balken.firstChild.style.width = `${Math.round(anteil * 100)}%`;
    karte.append(
      balken,
      el('div', { class: 'zeile-zwei' },
        el('strong', { id: 'budget-rest' }, u.rest >= 0
          ? `Noch ${L.formatEuro(u.rest)} übrig`
          : `! Budget um ${L.formatEuro(-u.rest)} überzogen`),
        el('span', { class: 'held-zeile betrag' }, `von ${L.formatEuroKurz(u.budget)}`),
      ),
    );
    if (k.proTagUebrig !== null) {
      karte.append(el('div', { class: 'held-zeile', id: 'pro-tag' },
        `Das sind ${L.formatEuro(k.proTagUebrig)} pro Tag für die restlichen ${anzahl(k.tageUebrig, 'Tag', 'Tage')}.`));
    }
  }
  if (mitKnopf) {
    karte.append(el('button', { type: 'button', class: 'held-knopf', id: 'budget-knopf', onclick: oeffneBudget },
      u.budget === null ? 'Budget festlegen' : 'Budget ändern'));
  }
  return karte;
}

function kachel(titel, wert, zusatz) {
  return el('div', { class: 'kachel' },
    el('div', { class: 'leise klein' }, titel),
    el('div', { class: 'kachel-wert' }, wert),
    zusatz ? el('div', { class: 'leise klein' }, zusatz) : null,
  );
}

function ansichtAusgaben() {
  const teile = [];
  const u = L.monatsUebersicht(daten, monat);
  teile.push(kopfKarte(u, false));

  const fix = L.fixkostenImMonat(daten.fixkosten, monat);
  if (fix.length > 0) {
    teile.push(el('details', { class: 'fixblock' },
      el('summary', {},
        el('span', { class: 'dreh' }, `Fixkosten (${fix.length})`),
        el('span', { class: 'betrag' }, L.formatEuro(u.summeFix)),
      ),
      el('ul', { class: 'liste' }, ...fix.map((f) => el('li', {},
        el('button', { type: 'button', class: 'posten', onclick: () => oeffneFix(f.fixId) },
          punkt(f.kategorie),
          el('span', { class: 'haupttext' },
            el('span', {}, f.name),
            el('span', { class: 'leise' }, `${L.formatDatum(f.datum)} · ${f.kategorie}`),
          ),
          el('span', { class: 'betrag' }, L.formatEuro(f.betragCent)),
        ),
      ))),
    ));
  }

  const ausgaben = L.ausgabenImMonat(daten.ausgaben, monat);
  if (ausgaben.length === 0) {
    teile.push(el('p', { class: 'leer' },
      monat === L.monatVon(L.heuteISO())
        ? 'Noch keine Ausgaben in diesem Monat. Tippe auf +, um eine zu erfassen.'
        : 'Keine Ausgaben in diesem Monat.'));
    return teile;
  }

  const jeTag = new Map();
  for (const a of ausgaben) {
    if (!jeTag.has(a.datum)) jeTag.set(a.datum, []);
    jeTag.get(a.datum).push(a);
  }
  for (const [datum, liste] of jeTag) {
    const summe = liste.reduce((s, a) => s + a.betragCent, 0);
    teile.push(
      el('h2', { class: 'abschnitt' },
        el('span', {}, L.formatTag(datum)),
        el('span', { class: 'betrag' }, L.formatEuro(summe)),
      ),
      el('ul', { class: 'liste' }, ...liste.map((a) => el('li', {},
        el('button', { type: 'button', class: 'posten', 'data-ausgabe': a.id, onclick: () => oeffneAusgabe(a.id) },
          punkt(a.kategorie),
          el('span', { class: 'haupttext' },
            el('span', {}, a.kategorie),
            a.notiz ? el('span', { class: 'leise' }, a.notiz) : null,
          ),
          el('span', { class: 'betrag' }, L.formatEuro(a.betragCent)),
        ),
      ))),
    );
  }
  return teile;
}

function ansichtStatistik() {
  const heute = L.heuteISO();
  const u = L.monatsUebersicht(daten, monat);
  const k = L.kennzahlen(daten, monat, heute);
  const teile = [kopfKarte(u, true)];

  // Kennzahlen
  const kacheln = el('div', { class: 'kacheln', id: 'kacheln' });
  kacheln.append(kachel('Ø pro Tag', k.schnittProTag === null ? '–' : L.formatEuro(k.schnittProTag), 'ohne Fixkosten'));
  if (k.prognose !== null) {
    const zusatz = u.budget === null ? 'bei gleichem Tempo'
      : k.prognose > u.budget ? `! ${L.formatEuroKurz(k.prognose - u.budget)} über Budget` : 'im Budget';
    kacheln.append(kachel('Prognose Monatsende', L.formatEuroKurz(Math.round(k.prognose / 100) * 100), zusatz));
  } else {
    kacheln.append(kachel('Buchungen', String(k.anzahl), `${anzahl(u.anzahlFix, 'Fixkosten-Posten', 'Fixkosten-Posten')}`));
  }
  kacheln.append(
    kachel('Zum Vormonat', k.deltaVormonat === null ? '–' : L.formatProzent(k.deltaVormonat),
      `${L.monatsName(L.monatVerschieben(monat, -1)).split(' ')[0]}${k.vergleichBisTag ? ` bis ${k.vergleichBisTag}.` : ''}: ${L.formatEuroKurz(Math.round(k.vormonat / 100) * 100)}`),
    kachel('Größte Ausgabe', k.groesste ? L.formatEuro(k.groesste.betragCent) : '–',
      k.groesste ? `${k.groesste.kategorie} · ${L.formatDatum(k.groesste.datum).slice(0, 6)}` : 'noch keine'),
  );
  teile.push(kacheln);

  // Aufteilung nach Kategorie: Balken oben, Liste mit Namen und Beträgen darunter
  if (u.jeKategorie.length > 0) {
    const farbig = u.jeKategorie.filter((x) => farbKlasse(x.kategorie) !== 'kat-n');
    const grau = u.jeKategorie.filter((x) => farbKlasse(x.kategorie) === 'kat-n');
    const stuecke = farbig.map((x) => ({ name: x.kategorie, cent: x.cent, anteil: x.anteil, klasse: farbKlasse(x.kategorie) }));
    if (grau.length > 0) {
      stuecke.push({
        name: grau.length === 1 ? grau[0].kategorie : 'Weitere',
        cent: grau.reduce((sum, x) => sum + x.cent, 0),
        anteil: grau.reduce((sum, x) => sum + x.anteil, 0),
        klasse: 'kat-n',
      });
    }
    teile.push(
      el('h2', { class: 'abschnitt' }, el('span', {}, 'Wofür'), el('span', {}, 'Anteil')),
      el('section', { class: 'karte ohne-rand' },
        el('div', { class: 'karten-kopf' }, D.segmentBalken(stuecke)),
        el('ul', { class: 'liste flach', id: 'kategorien-liste' }, ...u.jeKategorie.map((x) => el('li', {},
          el('div', { class: 'posten' },
            punkt(x.kategorie),
            el('span', { class: 'haupttext' }, el('span', {}, x.kategorie)),
            el('span', { class: 'leise betrag' }, `${Math.round(x.anteil * 100)} %`),
            el('span', { class: 'betrag' }, L.formatEuro(x.cent)),
          ),
        ))),
      ),
    );
  }

  // Verlauf im Monat
  const tage = L.tagesVerlauf(daten, monat, heute);
  if (tage[tage.length - 1].kumuliert > 0) {
    teile.push(
      el('h2', { class: 'abschnitt' }, el('span', {}, 'Verlauf im Monat')),
      el('section', { class: 'karte', id: 'tagesverlauf' }, D.tagesDiagramm({ verlauf: tage, budget: u.budget })),
    );
  }

  // Verlauf über die Monate
  const verlauf = L.monatsVerlauf(daten, L.verlaufsEnde(monat, L.monatVon(heute)));
  if (verlauf.some((m) => m.gesamt > 0)) {
    // Der angefangene Monat würde den Schnitt drücken, deshalb zählen nur abgeschlossene Monate.
    const fertig = verlauf.filter((m) => m.gesamt > 0 && m.monat < L.monatVon(heute));
    const mitDaten = fertig.length > 0 ? fertig : verlauf.filter((m) => m.gesamt > 0);
    const schnitt = Math.round(mitDaten.reduce((sum, m) => sum + m.gesamt, 0) / mitDaten.length);
    teile.push(
      el('h2', { class: 'abschnitt' }, el('span', {}, 'Letzte 6 Monate'), el('span', {}, `Ø ${L.formatEuroKurz(Math.round(schnitt / 100) * 100)}`)),
      el('section', { class: 'karte', id: 'monatsverlauf' },
        D.monatsDiagramm({ verlauf, gewaehlt: monat, beiAuswahl: (ym) => { monat = ym; zeichne(); } }),
        el('p', { class: 'leise klein' }, 'Tippe auf einen Monat, um ihn auszuwählen.'),
      ),
    );
  } else {
    teile.push(el('p', { class: 'leer' }, 'Sobald etwas erfasst ist, erscheinen hier die Auswertungen.'));
  }
  return teile;
}

function ansichtFix() {
  const heute = L.heuteISO();
  const teile = [];
  const proMonat = L.fixkostenProMonat(daten.fixkosten, heute);
  teile.push(el('section', { class: 'karte' },
    el('div', { class: 'leise' }, 'Fixkosten im Schnitt pro Monat'),
    el('div', { class: 'gross', id: 'fix-pro-monat' }, L.formatEuro(proMonat)),
    el('div', { class: 'leise' }, `Das sind ${L.formatEuro(proMonat * 12)} im Jahr.`),
  ));

  if (daten.fixkosten.length === 0) {
    teile.push(el('p', { class: 'leer' },
      'Hier stehen Kosten, die sich wiederholen: Miete, Abos, Versicherungen. Tippe auf +, um die erste einzutragen. Sie zählen dann jeden Monat automatisch mit.'));
    return teile;
  }

  const mitTermin = daten.fixkosten
    .map((f) => ({ f, naechste: L.naechsteFaelligkeit(f, heute) }))
    .sort((a, b) => {
      if ((a.naechste === null) !== (b.naechste === null)) return a.naechste === null ? 1 : -1;
      return (a.naechste ?? '').localeCompare(b.naechste ?? '') || a.f.name.localeCompare(b.f.name, 'de');
    });

  teile.push(el('ul', { class: 'liste', id: 'fix-liste' }, ...mitTermin.map(({ f, naechste }) => el('li', {},
    el('button', {
      type: 'button',
      class: naechste === null ? 'posten beendet' : 'posten',
      'data-fix': f.id,
      onclick: () => oeffneFix(f.id),
    },
      punkt(f.kategorie),
      el('span', { class: 'haupttext' },
        el('span', {}, f.name),
        el('span', { class: 'leise' },
          naechste === null
            ? `${f.kategorie} · beendet am ${L.formatDatum(f.ende)}`
            : `${f.kategorie} · ${L.rhythmusName(f.rhythmus)} · nächste am ${L.formatDatum(naechste)}`),
      ),
      el('span', { class: 'betrag' }, L.formatEuro(f.betragCent)),
    ),
  ))));
  return teile;
}

function ansichtMehr() {
  const teile = [];
  if (ladefehler) {
    teile.push(el('section', { class: 'karte' },
      el('strong', {}, 'Die gespeicherten Daten waren nicht lesbar.'),
      el('p', { class: 'leise' }, 'Sie wurden zur Seite gelegt und nicht gelöscht. Wenn du eine Sicherung hast, lies sie unten ein.'),
    ));
  }

  const budget = L.budgetFuer(daten.budgets, monat);
  teile.push(
    el('h2', { class: 'abschnitt' }, el('span', {}, 'Budget')),
    el('ul', { class: 'liste' }, el('li', {},
      el('button', { type: 'button', class: 'breit', onclick: oeffneBudget },
        budget === null ? 'Monatsbudget festlegen' : `Monatsbudget: ${L.formatEuro(budget)}`),
    )),
  );

  const eingabe = el('input', { type: 'text', id: 'neue-kategorie', maxlength: '40', placeholder: 'Neue Kategorie', autocomplete: 'off', enterkeyhint: 'done' });
  const hinzu = () => {
    const name = eingabe.value.trim();
    if (!name) return;
    if (daten.kategorien.some((k) => k.toLowerCase() === name.toLowerCase())) {
      melde('Diese Kategorie gibt es schon.');
      return;
    }
    daten.kategorien.push(name);
    daten.farben = L.farbSlots(daten.kategorien, daten.farben);
    speichern();
    zeichne();
  };
  eingabe.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); hinzu(); } });

  teile.push(
    el('h2', { class: 'abschnitt' }, el('span', {}, 'Kategorien')),
    el('ul', { class: 'liste', id: 'kat-verwaltung' },
      ...daten.kategorien.map((k) => el('li', { class: 'kat-zeile' },
        el('span', { class: 'mit-punkt' }, punkt(k), k),
        el('button', { type: 'button', 'aria-label': `Kategorie ${k} entfernen`, onclick: () => entferneKategorie(k) }, '×'),
      )),
      el('li', { class: 'neu-kat' }, eingabe, el('button', { type: 'button', class: 'haupt', onclick: hinzu }, 'Hinzufügen')),
    ),
  );

  const jetzt = L.heuteISO();
  teile.push(
    el('h2', { class: 'abschnitt' }, el('span', {}, 'Export als CSV')),
    el('ul', { class: 'liste' },
      el('li', {}, el('button', { type: 'button', class: 'breit', id: 'csv-monat', onclick: () =>
        gibDateiAus(`kosten-${monat}.csv`, L.csvFuerMonat(daten, monat), 'text/csv') }, `${L.monatsName(monat)} exportieren`)),
      el('li', {}, el('button', { type: 'button', class: 'breit', id: 'csv-alles', onclick: () =>
        gibDateiAus(`kosten-alles-${jetzt}.csv`, L.csvAlles(daten, jetzt), 'text/csv') }, 'Alles exportieren')),
    ),
    el('h2', { class: 'abschnitt' }, el('span', {}, 'Sicherung')),
    el('ul', { class: 'liste' },
      el('li', {}, el('button', { type: 'button', class: 'breit', id: 'sicherung-speichern', onclick: () =>
        gibDateiAus(`kosten-sicherung-${jetzt}.json`, JSON.stringify(daten, null, 2), 'application/json') }, 'Sicherung speichern')),
      el('li', {}, el('button', { type: 'button', class: 'breit', id: 'sicherung-einlesen', onclick: () => $('datei-einlesen').click() }, 'Sicherung einlesen')),
    ),
    el('p', { class: 'leise klein' },
      `${anzahl(daten.ausgaben.length, 'Ausgabe', 'Ausgaben')} und ${anzahl(daten.fixkosten.length, 'Fixkosten-Eintrag', 'Fixkosten-Einträge')} gespeichert. Alle Daten liegen nur auf diesem Gerät, es gibt kein Konto und keinen Server. Wer die App vom Home-Bildschirm löscht, löscht auch die Daten. Lege deshalb ab und zu eine Sicherung an.`),
  );
  return teile;
}

const ruhig = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// Lässt einen Betrag kurz hochzählen. Der Endwert steht schon im Element; läuft kein
// Bildaufbau (Seite im Hintergrund), bleibt er einfach stehen.
function zaehleHoch(knoten, cent) {
  if (!knoten || cent <= 0 || ruhig()) return;
  const start = performance.now();
  const dauer = 650;
  const schritt = (jetzt) => {
    if (!knoten.isConnected) return;
    const t = Math.min(1, (jetzt - start) / dauer);
    knoten.textContent = L.formatEuro(Math.round(cent * (1 - (1 - t) ** 3)));
    if (t < 1) requestAnimationFrame(schritt);
  };
  requestAnimationFrame(schritt);
}

// Startet eine einmalige CSS-Animation neu.
function spiele(knoten, klasse) {
  knoten.classList.remove(klasse);
  void knoten.offsetWidth;
  knoten.classList.add(klasse);
}

let letzteAnsicht = null; // Bereich und Monat des letzten Aufbaus
let letzterTab = null;
let hervorheben = null; // Kennung der gerade gespeicherten Ausgabe

const ANSICHTEN = { ausgaben: ansichtAusgaben, uebersicht: ansichtStatistik, fix: ansichtFix, mehr: ansichtMehr };
const TITEL = { fix: 'Fixkosten', mehr: 'Mehr' };

function zeichne() {
  const mitMonat = tab === 'ausgaben' || tab === 'uebersicht';
  $('titel').textContent = mitMonat ? L.monatsName(monat) : TITEL[tab];
  $('monat-zurueck').classList.toggle('unsichtbar', !mitMonat);
  $('monat-vor').classList.toggle('unsichtbar', !mitMonat);
  $('neu').hidden = tab === 'mehr';
  $('neu').setAttribute('aria-label', tab === 'fix' ? 'Fixkosten eintragen' : 'Ausgabe erfassen');
  for (const knopf of document.querySelectorAll('.tabs button')) {
    if (knopf.dataset.tab === tab) knopf.setAttribute('aria-current', 'page');
    else knopf.removeAttribute('aria-current');
  }
  const reihenfolge = ['ausgaben', 'uebersicht', 'fix', 'mehr'];
  $('tabs').style.setProperty('--tab', String(reihenfolge.indexOf(tab)));
  if (letzterTab !== null && letzterTab !== tab) spiele($('tab-blase'), 'schwappt');
  letzterTab = tab;

  const ansicht = `${tab} ${mitMonat ? monat : ''}`;
  const frisch = ansicht !== letzteAnsicht;
  letzteAnsicht = ansicht;
  $('inhalt').classList.toggle('frisch', frisch);
  $('inhalt').replaceChildren(...ANSICHTEN[tab]());
  if (frisch) {
    const summe = $('summe-gesamt');
    if (summe) zaehleHoch(summe, L.monatsUebersicht(daten, monat).gesamt);
    const fix = $('fix-pro-monat');
    if (fix) zaehleHoch(fix, L.fixkostenProMonat(daten.fixkosten, L.heuteISO()));
  }
  if (hervorheben) {
    const zeile = document.querySelector(`[data-ausgabe="${CSS.escape(hervorheben)}"]`);
    if (zeile) {
      zeile.classList.add('neu-zeile');
      zeile.scrollIntoView({ block: 'nearest', behavior: ruhig() ? 'auto' : 'smooth' });
    }
    hervorheben = null;
  }
}

// ---------- Ausgabe erfassen, ändern, löschen ----------

function fuelleChips(gewaehlt) {
  $('a-kategorien').replaceChildren(...alleKategorien(gewaehlt).map((k) =>
    el('label', {},
      el('input', { type: 'radio', name: 'a-kategorie', value: k, checked: k === gewaehlt }),
      el('span', {}, punkt(k), k),
    )));
}

function oeffneAusgabe(id = null) {
  bearbeiteAusgabe = id;
  const a = id ? daten.ausgaben.find((x) => x.id === id) : null;
  if (id && !a) return;
  $('dlg-ausgabe-titel').textContent = a ? 'Ausgabe ändern' : 'Neue Ausgabe';
  $('a-betrag').value = a ? L.formatZahl(a.betragCent) : '';
  // Neue Ausgaben landen heute; wer in einem anderen Monat blättert, bekommt dessen letzten bzw. ersten Tag nicht untergeschoben.
  $('a-datum').value = a ? a.datum : L.heuteISO();
  $('a-notiz').value = a ? a.notiz : '';
  fuelleChips(a ? a.kategorie : (daten.letzteKategorie ?? daten.kategorien[0]));
  $('a-loeschen').hidden = !a;
  zeigeFehler('a-fehler', null);
  $('dlg-ausgabe').showModal();
  if (!a) $('a-betrag').focus();
}

$('form-ausgabe').addEventListener('submit', (ereignis) => {
  ereignis.preventDefault();
  const betragCent = L.parseBetrag($('a-betrag').value);
  if (betragCent === null) {
    zeigeFehler('a-fehler', 'Bitte einen Betrag eingeben, zum Beispiel 12,50.');
    $('a-betrag').focus();
    return;
  }
  const datum = $('a-datum').value;
  if (!L.istDatum(datum)) {
    zeigeFehler('a-fehler', 'Bitte ein Datum wählen.');
    return;
  }
  const kategorie = document.querySelector('input[name="a-kategorie"]:checked')?.value ?? daten.kategorien[0] ?? 'Sonstiges';
  const notiz = $('a-notiz').value.trim().slice(0, 200);

  if (bearbeiteAusgabe) {
    const a = daten.ausgaben.find((x) => x.id === bearbeiteAusgabe);
    Object.assign(a, { betragCent, kategorie, datum, notiz });
    hervorheben = a.id;
  } else {
    hervorheben = neueId();
    daten.ausgaben.push({ id: hervorheben, betragCent, kategorie, datum, notiz, angelegt: Date.now() });
  }
  daten.letzteKategorie = daten.kategorien.includes(kategorie) ? kategorie : daten.letzteKategorie;
  const neu = !bearbeiteAusgabe;
  speichern();
  $('dlg-ausgabe').close();
  monat = L.monatVon(datum); // dorthin springen, wo der Eintrag jetzt steht
  if (tab !== 'uebersicht') tab = 'ausgaben';
  zeichne();
  if (neu) spiele($('neu'), 'puls');
  melde(neu ? `${L.formatEuro(betragCent)} gespeichert` : 'Geändert');
});

$('a-loeschen').addEventListener('click', async () => {
  const a = daten.ausgaben.find((x) => x.id === bearbeiteAusgabe);
  if (!a) return;
  const ja = await frage(`Ausgabe über ${L.formatEuro(a.betragCent)} vom ${L.formatDatum(a.datum)} löschen?`, 'Löschen');
  if (!ja) return;
  daten.ausgaben = daten.ausgaben.filter((x) => x.id !== a.id);
  speichern();
  $('dlg-ausgabe').close();
  zeichne();
  melde('Gelöscht');
});

// ---------- Fixkosten ----------

function oeffneFix(id = null) {
  bearbeiteFix = id;
  const f = id ? daten.fixkosten.find((x) => x.id === id) : null;
  if (id && !f) return;
  $('dlg-fix-titel').textContent = f ? 'Fixkosten ändern' : 'Neue Fixkosten';
  $('f-name').value = f ? f.name : '';
  $('f-betrag').value = f ? L.formatZahl(f.betragCent) : '';
  const gewaehlt = f ? f.kategorie : (daten.kategorien.includes('Abos & Verträge') ? 'Abos & Verträge' : daten.kategorien[0]);
  $('f-kategorie').replaceChildren(...alleKategorien(gewaehlt).map((k) => el('option', { value: k, selected: k === gewaehlt }, k)));
  $('f-kategorie').value = gewaehlt;
  $('f-rhythmus').replaceChildren(...L.RHYTHMEN.map((r) => el('option', { value: r.id }, r.name)));
  $('f-rhythmus').value = f ? f.rhythmus : 'monatlich';
  $('f-start').value = f ? f.start : `${L.monatVon(L.heuteISO())}-01`;
  $('f-ende').value = f ? f.ende : '';
  $('f-loeschen').hidden = !f;
  zeigeFehler('f-fehler', null);
  $('dlg-fix').showModal();
  if (!f) $('f-name').focus();
}

$('form-fix').addEventListener('submit', (ereignis) => {
  ereignis.preventDefault();
  const name = $('f-name').value.trim().slice(0, 60);
  if (!name) {
    zeigeFehler('f-fehler', 'Bitte einen Namen eingeben.');
    $('f-name').focus();
    return;
  }
  const betragCent = L.parseBetrag($('f-betrag').value);
  if (betragCent === null) {
    zeigeFehler('f-fehler', 'Bitte einen Betrag eingeben, zum Beispiel 9,99.');
    $('f-betrag').focus();
    return;
  }
  const start = $('f-start').value;
  const ende = $('f-ende').value;
  if (!L.istDatum(start)) {
    zeigeFehler('f-fehler', 'Bitte das Datum der ersten Fälligkeit wählen.');
    return;
  }
  if (ende && (!L.istDatum(ende) || ende < start)) {
    zeigeFehler('f-fehler', 'Das Ende liegt vor der ersten Fälligkeit.');
    return;
  }
  const eintrag = {
    name,
    betragCent,
    kategorie: $('f-kategorie').value || 'Sonstiges',
    rhythmus: $('f-rhythmus').value,
    start,
    ende,
  };
  if (bearbeiteFix) Object.assign(daten.fixkosten.find((x) => x.id === bearbeiteFix), eintrag);
  else daten.fixkosten.push({ id: neueId(), ...eintrag });
  speichern();
  $('dlg-fix').close();
  zeichne();
  melde(bearbeiteFix ? 'Geändert' : `${name} gespeichert`);
});

$('f-loeschen').addEventListener('click', async () => {
  const f = daten.fixkosten.find((x) => x.id === bearbeiteFix);
  if (!f) return;
  const ja = await frage(`„${f.name}“ ganz löschen? Der Eintrag verschwindet dann auch aus allen früheren Monaten. Bei einer Kündigung lieber „Endet am“ eintragen.`, 'Löschen');
  if (!ja) return;
  daten.fixkosten = daten.fixkosten.filter((x) => x.id !== f.id);
  speichern();
  $('dlg-fix').close();
  zeichne();
  melde('Gelöscht');
});

// ---------- Budget ----------

function oeffneBudget() {
  const eigen = daten.budgets.monate[monat];
  const aktuell = L.budgetFuer(daten.budgets, monat);
  $('b-betrag').value = aktuell === null ? '' : L.formatZahl(aktuell);
  $('b-nur-monat').checked = Number.isInteger(eigen);
  $('b-nur-monat-text').textContent = `Nur für ${L.monatsName(monat)}`;
  zeigeFehler('b-fehler', null);
  $('dlg-budget').showModal();
}

$('form-budget').addEventListener('submit', (ereignis) => {
  ereignis.preventDefault();
  const eingabe = $('b-betrag').value.trim();
  const cent = eingabe === '' ? null : L.parseBetrag(eingabe);
  if (eingabe !== '' && cent === null) {
    zeigeFehler('b-fehler', 'Bitte einen Betrag eingeben, zum Beispiel 800.');
    return;
  }
  if ($('b-nur-monat').checked) {
    if (cent === null) delete daten.budgets.monate[monat];
    else daten.budgets.monate[monat] = cent;
  } else {
    daten.budgets.standard = cent;
    delete daten.budgets.monate[monat]; // sonst würde der alte Monatswert das neue Budget verdecken
  }
  speichern();
  $('dlg-budget').close();
  zeichne();
  melde(cent === null ? 'Budget entfernt' : 'Budget gespeichert');
});

// ---------- Kategorien ----------

async function entferneKategorie(name) {
  if (daten.kategorien.length <= 1) {
    melde('Eine Kategorie muss bleiben.');
    return;
  }
  const benutzt = daten.ausgaben.filter((a) => a.kategorie === name).length
    + daten.fixkosten.filter((f) => f.kategorie === name).length;
  const text = benutzt > 0
    ? `Kategorie „${name}“ entfernen? ${anzahl(benutzt, 'vorhandener Eintrag behält', 'vorhandene Einträge behalten')} sie, sie wird nur nicht mehr zur Auswahl angeboten.`
    : `Kategorie „${name}“ entfernen?`;
  if (!(await frage(text, 'Entfernen'))) return;
  daten.kategorien = daten.kategorien.filter((k) => k !== name);
  daten.farben = L.farbSlots(daten.kategorien, daten.farben); // der Farbplatz wird frei
  if (daten.letzteKategorie === name) daten.letzteKategorie = null;
  speichern();
  zeichne();
}

// ---------- Export und Sicherung ----------

async function gibDateiAus(name, inhalt, typ) {
  const blob = new Blob([inhalt], { type: `${typ};charset=utf-8` });
  // Auf dem Handy über das Teilen-Menü („In Dateien sichern“, Mail, AirDrop), am Rechner als Download.
  const amHandy = matchMedia('(pointer: coarse)').matches;
  if (amHandy && navigator.canShare) {
    const datei = new File([blob], name, { type: typ });
    if (navigator.canShare({ files: [datei] })) {
      try {
        await navigator.share({ files: [datei] });
        return;
      } catch (fehler) {
        if (fehler.name === 'AbortError') return; // abgebrochen
      }
    }
  }
  const adresse = URL.createObjectURL(blob);
  const link = el('a', { href: adresse, download: name });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(adresse), 30_000);
  melde(`${name} gespeichert`);
}

$('datei-einlesen').addEventListener('change', async (ereignis) => {
  const datei = ereignis.target.files?.[0];
  ereignis.target.value = '';
  if (!datei) return;
  let neu;
  try {
    neu = L.pruefeDaten(JSON.parse(await datei.text()));
  } catch (fehler) {
    melde(fehler instanceof SyntaxError ? 'Die Datei ist keine gültige Sicherung.' : fehler.message, 5000);
    return;
  }
  const ja = await frage(
    `Sicherung einlesen? Sie enthält ${anzahl(neu.ausgaben.length, 'Ausgabe', 'Ausgaben')} und ${anzahl(neu.fixkosten.length, 'Fixkosten-Eintrag', 'Fixkosten-Einträge')} und ersetzt alles, was jetzt in der App steht (${anzahl(daten.ausgaben.length, 'Ausgabe', 'Ausgaben')}, ${anzahl(daten.fixkosten.length, 'Fixkosten-Eintrag', 'Fixkosten-Einträge')}).`,
    'Ersetzen',
  );
  if (!ja) return;
  daten = neu;
  ladefehler = false;
  speichern();
  zeichne();
  melde('Sicherung eingelesen');
});

// ---------- Bedienung ----------

$('monat-zurueck').addEventListener('click', () => { monat = L.monatVerschieben(monat, -1); zeichne(); });
$('monat-vor').addEventListener('click', () => { monat = L.monatVerschieben(monat, 1); zeichne(); });
$('titel').addEventListener('click', () => { monat = L.monatVon(L.heuteISO()); zeichne(); });
$('neu').addEventListener('click', () => (tab === 'fix' ? oeffneFix() : oeffneAusgabe()));

for (const knopf of document.querySelectorAll('.tabs button')) {
  knopf.addEventListener('click', () => {
    tab = knopf.dataset.tab;
    zeichne();
    window.scrollTo(0, 0);
  });
}

for (const knopf of document.querySelectorAll('[data-schliessen]')) {
  knopf.addEventListener('click', () => knopf.closest('dialog').close());
}

// Tippen neben den Dialog schließt ihn.
for (const dlg of document.querySelectorAll('dialog')) {
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
}

// Kommt die App nach Mitternacht oder einem Monatswechsel wieder nach vorn, stimmen Termine und „heute“ wieder.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !document.querySelector('dialog[open]')) zeichne();
});

zeichne();

// Den Browser bitten, die Daten nicht von sich aus wegzuräumen.
navigator.storage?.persist?.().catch(() => {});

// Offline-Betrieb. Nur über https oder am eigenen Rechner möglich.
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
