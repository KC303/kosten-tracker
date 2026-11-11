// Diagramme als SVG, ohne fremde Bibliothek. Farben kommen aus styles.css (Klassen),
// Zahlen und Achsen aus logik.js. Beschriftungen tragen nie die Datenfarbe.
import * as L from './logik.js';

const SVG = 'http://www.w3.org/2000/svg';

function s(tag, eigenschaften = {}, ...kinder) {
  const knoten = document.createElementNS(SVG, tag);
  for (const [name, wert] of Object.entries(eigenschaften)) {
    if (wert !== null && wert !== undefined && wert !== false) knoten.setAttribute(name, wert);
  }
  knoten.append(...kinder.filter(Boolean));
  return knoten;
}

function h(tag, klasse, ...kinder) {
  const knoten = document.createElement(tag);
  if (klasse) knoten.className = klasse;
  knoten.append(...kinder.filter((k) => k !== null && k !== undefined && k !== false));
  return knoten;
}

const rund = (n) => Math.round(n * 10) / 10;
const KURZMONATE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const kurzMonat = (ym) => KURZMONATE[Number(ym.slice(5, 7)) - 1];
const ganzeEuro = (cent) => L.formatEuroKurz(Math.round(cent / 100) * 100);

// Waagerechte Hilfslinien mit Beschriftung links.
function gitter(achse, links, rechts, y) {
  const gruppe = s('g', { 'aria-hidden': 'true' });
  for (let wert = 0; wert <= achse.max; wert += achse.schritt) {
    gruppe.append(
      s('line', { class: wert === 0 ? 'd-achse' : 'd-gitter', x1: links, x2: rechts, y1: rund(y(wert)), y2: rund(y(wert)) }),
      s('text', { class: 'd-tick', x: links - 6, y: rund(y(wert)) + 3.5, 'text-anchor': 'end' }, L.formatEuroKurz(wert)),
    );
  }
  return gruppe;
}

// Rechteck mit runden oberen Ecken (das Datenende), unten gerade an der Grundlinie.
function saeulenPfad(x, oben, breite, hoehe, radius) {
  const r = Math.max(0, Math.min(radius, hoehe, breite / 2));
  const unten = oben + hoehe;
  return `M${rund(x)},${rund(unten)}V${rund(oben + r)}Q${rund(x)},${rund(oben)} ${rund(x + r)},${rund(oben)}`
    + `H${rund(x + breite - r)}Q${rund(x + breite)},${rund(oben)} ${rund(x + breite)},${rund(oben + r)}V${rund(unten)}Z`;
}

function legende(...eintraege) {
  return h('div', 'd-legende', ...eintraege.filter(Boolean).map(([klasse, text]) =>
    h('span', '', h('i', klasse), text)));
}

// ---------- Aufteilung eines Monats: dünner Balken, die Liste darunter nennt Namen und Beträge ----------

export function segmentBalken(teile) {
  const balken = h('div', 'segmente');
  balken.setAttribute('role', 'img');
  balken.setAttribute('aria-label', `Aufteilung: ${teile.map((t) => `${t.name} ${Math.round(t.anteil * 100)} %`).join(', ')}`);
  for (const teil of teile) {
    const stueck = h('span', `seg ${teil.klasse}`);
    stueck.style.flexGrow = String(Math.max(teil.anteil, 0.004));
    stueck.title = `${teil.name}: ${L.formatEuro(teil.cent)}`;
    balken.append(stueck);
  }
  return balken;
}

// ---------- Verlauf über mehrere Monate: gestapelte Säulen, der gewählte Monat ist hervorgehoben ----------

export function monatsDiagramm({ verlauf, gewaehlt, beiAuswahl }) {
  const B = 340, H = 172;
  const links = 46, rechts = B - 6, oben = 20, unten = H - 24;
  const budget = verlauf.find((m) => m.monat === gewaehlt)?.budget ?? null;
  const achse = L.achse(Math.max(...verlauf.map((m) => m.gesamt), budget ?? 0));
  const y = (cent) => unten - ((unten - oben) * cent) / achse.max;
  const band = (rechts - links) / verlauf.length;
  const breite = Math.min(24, band * 0.5);

  const svg = s('svg', { class: 'diagramm', viewBox: `0 0 ${B} ${H}`, role: 'group',
    'aria-label': `Ausgaben der letzten ${verlauf.length} Monate` });
  svg.append(gitter(achse, links, rechts, y));
  if (budget !== null) {
    svg.append(s('line', { class: 'd-budget', x1: links, x2: rechts, y1: rund(y(budget)), y2: rund(y(budget)), 'aria-hidden': 'true' }));
  }

  verlauf.forEach((m, i) => {
    const mitte = links + band * (i + 0.5);
    const x = mitte - breite / 2;
    const aktiv = m.monat === gewaehlt;
    const gruppe = s('g', {
      class: aktiv ? 'd-monat aktiv' : 'd-monat',
      role: 'button',
      tabindex: '0',
      'aria-pressed': aktiv ? 'true' : 'false',
      'aria-label': `${L.monatsName(m.monat)}: ${L.formatEuro(m.gesamt)}, davon Fixkosten ${L.formatEuro(m.summeFix)}`,
    });

    const hFix = m.summeFix > 0 ? Math.max(2, unten - y(m.summeFix)) : 0;
    const hAus = m.summeAusgaben > 0 ? Math.max(2, unten - y(m.summeAusgaben)) : 0;
    if (hFix > 0 && hAus > 0) {
      const luecke = 2; // Abstand in Flächenfarbe trennt die beiden Teile
      gruppe.append(
        s('rect', { class: 'reihe-fix', x: rund(x), y: rund(unten - hFix), width: rund(breite), height: rund(hFix) }),
        s('path', { class: 'reihe-ausgaben', d: saeulenPfad(x, unten - hFix - hAus, breite, Math.max(1, hAus - luecke), 4) }),
      );
    } else if (hFix > 0) {
      gruppe.append(s('path', { class: 'reihe-fix', d: saeulenPfad(x, unten - hFix, breite, hFix, 4) }));
    } else if (hAus > 0) {
      gruppe.append(s('path', { class: 'reihe-ausgaben', d: saeulenPfad(x, unten - hAus, breite, hAus, 4) }));
    }

    if (aktiv && m.gesamt > 0) {
      gruppe.append(s('text', { class: 'd-wert', x: rund(mitte), y: rund(unten - hFix - hAus - 6), 'text-anchor': 'middle' }, ganzeEuro(m.gesamt)));
    }
    gruppe.append(
      s('text', { class: aktiv ? 'd-xlabel aktiv' : 'd-xlabel', x: rund(mitte), y: H - 7, 'text-anchor': 'middle' }, kurzMonat(m.monat)),
      // Trefferfläche über die ganze Spalte, viel größer als die Säule
      s('rect', { class: 'd-treffer', x: rund(mitte - band / 2), y: 0, width: rund(band), height: H }),
    );
    gruppe.style.setProperty('--n', String(i)); // Säulen wachsen nacheinander
    const waehle = () => beiAuswahl(m.monat);
    gruppe.addEventListener('click', waehle);
    gruppe.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); waehle(); }
    });
    svg.append(gruppe);
  });

  return h('div', 'd-rahmen', svg,
    legende(['schluessel reihe-ausgaben', 'Ausgaben'], ['schluessel reihe-fix', 'Fixkosten'], budget !== null && ['strich d-budget-strich', 'Budget']));
}

// ---------- Verlauf im Monat: aufgelaufene Summe je Tag, mit Budgetlinie und Fadenkreuz ----------

export function tagesDiagramm({ verlauf, budget }) {
  const B = 340, H = 164;
  const links = 46, rechts = B - 12, oben = 16, unten = H - 24;
  const ende = verlauf[verlauf.length - 1].kumuliert;
  const achse = L.achse(Math.max(ende, budget ?? 0));
  const x = (tag) => links + ((rechts - links) * (tag - 1)) / (verlauf.length - 1);
  const y = (cent) => unten - ((unten - oben) * cent) / achse.max;
  const punkt = (p) => `${rund(x(p.tag))},${rund(y(p.kumuliert))}`;

  const vergangen = verlauf.filter((p) => !p.zukunft);
  const heute = vergangen[vergangen.length - 1] ?? null;
  const kommend = heute ? verlauf.slice(heute.tag - 1) : verlauf;

  const svg = s('svg', { class: 'diagramm fadenkreuz', viewBox: `0 0 ${B} ${H}`, role: 'img',
    'aria-label': heute
      ? `Verlauf im Monat: bis zum ${heute.tag}. sind ${L.formatEuro(heute.kumuliert)} aufgelaufen, bis Monatsende bekannt ${L.formatEuro(ende)}`
      : `Verlauf im Monat: bisher bekannt ${L.formatEuro(ende)}` });
  svg.append(gitter(achse, links, rechts, y));

  const tage = [...new Set([1, 8, 15, 22, verlauf.length])];
  for (const tag of tage) {
    svg.append(s('text', { class: 'd-xlabel', x: rund(x(tag)), y: H - 7, 'text-anchor': 'middle', 'aria-hidden': 'true' }, `${tag}.`));
  }

  if (budget !== null) {
    svg.append(s('line', { class: 'd-budget', x1: links, x2: rechts, y1: rund(y(budget)), y2: rund(y(budget)) }));
  }
  if (kommend.length > 1) {
    svg.append(s('polyline', { class: 'd-linie kommend', points: kommend.map(punkt).join(' ') }));
  }
  if (vergangen.length > 1) {
    svg.append(
      s('polygon', { class: 'd-flaeche', points: `${rund(x(1))},${unten} ${vergangen.map(punkt).join(' ')} ${rund(x(heute.tag))},${unten}` }),
      s('polyline', { class: 'd-linie', pathLength: '1', points: vergangen.map(punkt).join(' ') }),
    );
  }
  if (heute) {
    const px = x(heute.tag), py = y(heute.kumuliert);
    const nachLinks = px > B - 80;
    svg.append(
      s('circle', { class: 'd-punkt', cx: rund(px), cy: rund(py), r: 4.5 }),
      s('text', { class: 'd-wert', x: rund(px + (nachLinks ? -8 : 8)), y: rund(Math.max(12, py - 8)), 'text-anchor': nachLinks ? 'end' : 'start' }, ganzeEuro(heute.kumuliert)),
    );
  }

  // Fadenkreuz: Finger oder Maus zeigt den Stand am jeweiligen Tag.
  const lot = s('line', { class: 'd-lot', y1: oben, y2: unten, visibility: 'hidden' });
  const marke = s('circle', { class: 'd-punkt', r: 4.5, visibility: 'hidden' });
  const flaeche = s('rect', { class: 'd-treffer', x: links - 8, y: 0, width: rechts - links + 16, height: H });
  svg.append(lot, marke, flaeche);
  const tipp = h('div', 'd-tipp');
  tipp.hidden = true;
  const rahmen = h('div', 'd-rahmen', svg, tipp);

  const zeige = (ereignis) => {
    const kasten = svg.getBoundingClientRect();
    const xImBild = ((ereignis.clientX - kasten.left) / kasten.width) * B;
    const anteil = Math.min(1, Math.max(0, (xImBild - links) / (rechts - links)));
    const p = verlauf[Math.round(anteil * (verlauf.length - 1))];
    const px = x(p.tag), py = y(p.kumuliert);
    lot.setAttribute('x1', rund(px)); lot.setAttribute('x2', rund(px)); lot.setAttribute('visibility', 'visible');
    marke.setAttribute('cx', rund(px)); marke.setAttribute('cy', rund(py)); marke.setAttribute('visibility', 'visible');
    tipp.replaceChildren(
      h('strong', '', L.formatEuro(p.kumuliert)),
      h('span', '', `${L.formatTag(p.datum)}${p.zukunft ? ' · geplant' : ''}`),
      p.cent > 0 ? h('span', '', `an dem Tag ${L.formatEuro(p.cent)}`) : null,
    );
    tipp.hidden = false;
    const mitte = (px / B) * kasten.width;
    const halb = tipp.offsetWidth / 2;
    tipp.style.left = `${Math.min(kasten.width - halb - 4, Math.max(halb + 4, mitte))}px`;
  };
  const verbirg = () => {
    lot.setAttribute('visibility', 'hidden');
    marke.setAttribute('visibility', 'hidden');
    tipp.hidden = true;
  };
  flaeche.addEventListener('pointerdown', zeige);
  flaeche.addEventListener('pointermove', zeige);
  flaeche.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') verbirg(); });

  rahmen.append(legende(
    heute && ['strich d-linie-strich', kommend.length > 1 ? 'bis heute' : 'aufgelaufen'],
    kommend.length > 1 && ende > (heute?.kumuliert ?? 0) && ['strich d-linie-strich kommend', 'schon bekannt (Fixkosten)'],
    budget !== null && ['strich d-budget-strich', 'Budget'],
  ));
  return rahmen;
}
