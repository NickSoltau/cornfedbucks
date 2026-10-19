// Cornfed Bucks — Ballistics Comparison Tool
// Loads /data/ballistics-dataset.json at runtime, then renders the picker + charts.
// Dataset shape: each load has a `published` layer (factory numbers as printed) and a
// `calculated` layer (ours). The default view only plots published numbers.

const MAXSEL = 4;
const COLOR_VARS = ['--ballistics-line-a', '--ballistics-line-b', '--ballistics-line-c', '--ballistics-line-d'];
const METRIC_KEY = { v: 'velocity', e: 'energy' };

let DATA = null;
let selected = []; // {id, cartridge, isGeneric, entry?}
let aligned = false; // "Line up zeros (calculated)" toggle

function loadKeyOf(cartridge, mfr, line) { return cartridge + '|' + mfr + '|' + line; }

function energyRank(cartridge, l) {
  const e = l.published && l.published.energy;
  if (!e) return -Infinity;
  if (e['100'] != null) return e['100'];
  if (e['0'] != null) return e['0'];
  return -Infinity;
}

function buildPicker() {
  const container = document.getElementById('groups');
  const cartridges = Object.keys(DATA);
  cartridges.forEach((cartridge, idx) => {
    const group = document.createElement('details');
    group.className = 'group';
    if (idx < 2) group.open = true;
    group.innerHTML = `<summary>${cartridge}<span class="cat">${DATA[cartridge].category}</span></summary>`;
    const list = document.createElement('div');
    list.className = 'loadlist';

    const genRow = makeRow(cartridge, null, `Generic ${cartridge}`, 'avg. of loads below', true, false, { cartridge, isGeneric: true });
    list.appendChild(genRow);

    const loadsSorted = [...DATA[cartridge].loads].sort((a, b) => {
      const aPub = a.dataStatus === 'Published', bPub = b.dataStatus === 'Published';
      if (aPub !== bPub) return aPub ? -1 : 1;
      return energyRank(cartridge, b) - energyRank(cartridge, a);
    });

    loadsSorted.forEach(l => {
      const disabled = l.dataStatus !== 'Published';
      const label = `${l.manufacturer} ${l.productLine}`;
      let meta = disabled ? 'no published ballistics data' : `${l.bulletWt}gr`;
      if (l.sourceType === 'third-party') meta += ' <span class="tag tag--src">ammo.com</span>';
      if (l.spotCheck) meta += ' <span class="tag tag--warn">unverified</span>';
      const row = makeRow(cartridge, loadKeyOf(cartridge, l.manufacturer, l.productLine), label, meta, false, disabled, { cartridge, isGeneric: false, entry: l });
      list.appendChild(row);
    });
    group.appendChild(list);
    container.appendChild(group);
  });
}

function makeRow(cartridge, key, label, meta, isGeneric, disabled, payload) {
  const row = document.createElement('label');
  row.className = 'loadrow' + (disabled ? ' disabled' : '');
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.disabled = disabled;
  cb.dataset.id = cartridge + '::' + (isGeneric ? 'GENERIC' : key);
  cb.addEventListener('change', () => onToggle(cb, payload));
  row._payload = payload;
  row.appendChild(cb);
  const txt = document.createElement('span');
  txt.innerHTML = `<span class="name">${label}</span><br><span class="meta">${meta}</span>`;
  row.appendChild(txt);
  return row;
}

// Chart/legend re-layout (and a changing X axis) can nudge scroll positions; restore them.
function preserveScroll(fn) {
  const picker = document.querySelector('.picker');
  const pickerTop = picker.scrollTop, pageY = window.scrollY;
  fn();
  picker.scrollTop = pickerTop;
  window.scrollTo(window.scrollX, pageY);
  requestAnimationFrame(() => { picker.scrollTop = pickerTop; });
}

function onToggle(cb, payload) {
  const id = cb.dataset.id;
  if (cb.checked) {
    if (selected.length >= MAXSEL) { cb.checked = false; return; }
    selected.push({ id, ...payload });
  } else {
    selected = selected.filter(s => s.id !== id);
  }
  preserveScroll(() => {
    updateSlotCount();
    renderCharts();
  });
}

function updateSlotCount() {
  document.getElementById('slotCount').textContent = `${selected.length} / ${MAXSEL} selected`;
  document.querySelectorAll('.loadrow input').forEach(cb => {
    const row = cb.closest('.loadrow');
    if (selected.length >= MAXSEL && !cb.checked && !cb.disabled) {
      row.classList.add('maxed');
    } else {
      row.classList.remove('maxed');
    }
  });
}

function seedDefaults() {
  // ?loads=id1,id2 preselects loads (ids are the picker's data-id values).
  const wanted = (new URLSearchParams(location.search).get('loads') || '').split(',').map(x => x.trim()).filter(Boolean);
  const inputs = [...document.querySelectorAll('.loadrow input')];
  let any = false;
  wanted.slice(0, MAXSEL).forEach(id => {
    const cb = inputs.find(i => i.dataset.id === id);
    if (!cb || cb.disabled) return;
    cb.checked = true;
    const group = cb.closest('details');
    if (group) group.open = true;
    onToggle(cb, cb.closest('.loadrow')._payload);
    any = true;
  });
  if (any) return;
  const c1 = '.350 Legend', c2 = '.308 Winchester';
  const cb1 = document.querySelector(`input[data-id="${c1}::GENERIC"]`);
  const cb2 = document.querySelector(`input[data-id="${c2}::GENERIC"]`);
  if (cb1) { cb1.checked = true; onToggle(cb1, { cartridge: c1, isGeneric: true }); }
  if (cb2) { cb2.checked = true; onToggle(cb2, { cartridge: c2, isGeneric: true }); }
}

// ---- series building -------------------------------------------------------
// A point is {x, y, calc, low?, ...}. calc = our calculation (drawn dashed);
// low = low-confidence calculation (drawn lighter).

function sortedEntries(obj) {
  return Object.entries(obj || {}).map(([y, v]) => [Number(y), v]).filter(([, v]) => v != null).sort((a, b) => a[0] - b[0]);
}

function maxKey(...objs) {
  let m = 0;
  objs.forEach(o => Object.keys(o || {}).forEach(k => { m = Math.max(m, Number(k)); }));
  return m;
}

// Longest distance the factory printed for a load (maxPublishedRange is the hard cutoff).
function loadMaxDist(l) {
  const m = maxKey(l.published.velocity, l.published.energy, ...(l.published.trajectory || []).map(t => t.inches));
  return l.maxPublishedRange ? Math.min(m, l.maxPublishedRange) : m;
}

function selMaxDist(sel) {
  if (!sel.isGeneric) return loadMaxDist(sel.entry);
  const g = DATA[sel.cartridge].generic;
  return maxKey(g.published && g.published.velocity, g.published && g.published.energy, g.calculated && g.calculated.trajectory);
}

// The factory table drawn in the "As published" view: the 100 yd-zero table if there is one, else the first.
function pickTable(l) {
  const t = l.published.trajectory || [];
  return t.find(x => x.zeroYd === 100) || t[0];
}

function pubTrajectory(l, limit) {
  const t = pickTable(l);
  const pts = [{ x: 0, y: -l.sightHeightIn, calc: false, sightHeight: true }];
  if (!t) return pts;
  const info = { zeroYd: t.zeroYd, zeroUnknown: !!t.zeroUnknown, printedZeroYd: t.printedZeroYd, labelNote: t.labelNote };
  sortedEntries(t.inches).forEach(([x, y]) => { if (x !== 0 && x <= limit) pts.push({ x, y, calc: false, ...info }); });
  // The zero distance is 0 by definition; draw it even where the factory table leaves it out.
  if (t.zeroYd > 0 && t.zeroYd <= limit && !pts.some(p => p.x === t.zeroYd)) pts.push({ x: t.zeroYd, y: 0, calc: false, ...info });
  return pts.sort((a, b) => a.x - b.x);
}

// Everything on a 100 yd zero: factory 100 yd-zero value where there is one, else our calculation.
function alignedTrajectory(l, limit) {
  const t100 = (l.published.trajectory || []).find(t => t.zeroYd === 100);
  const map = new Map();
  map.set(0, { x: 0, y: -l.sightHeightIn, calc: false, sightHeight: true });
  if (t100) sortedEntries(t100.inches).forEach(([x, y]) => { if (x !== 0 && x <= limit) map.set(x, { x, y, calc: false, zeroYd: 100 }); });
  Object.entries(l.calculated || {}).forEach(([x, p]) => {
    x = Number(x);
    if (p.trajectory != null && x !== 0 && x <= limit && !map.has(x)) map.set(x, { x, y: p.trajectory, calc: true, low: !!p.lowConfidence });
  });
  if (limit >= 100 && !map.has(100)) map.set(100, { x: 100, y: 0, calc: true, low: false, isZero: true });
  return [...map.values()].sort((a, b) => a.x - b.x);
}

function seriesFor(sel, metric) {
  if (sel.isGeneric) {
    const g = DATA[sel.cartridge].generic;
    if (metric === 't') return sortedEntries(g.calculated && g.calculated.trajectory).map(([x, y]) => ({ x, y, calc: true, low: false, generic: true }));
    const key = METRIC_KEY[metric];
    const pts = sortedEntries(g.published && g.published[key]).map(([x, y]) => ({ x, y, calc: false, generic: true }));
    if (aligned) sortedEntries(g.calculated && g.calculated[key]).forEach(([x, y]) => {
      if (!pts.some(p => p.x === x)) pts.push({ x, y, calc: true, low: false, generic: true });
    });
    return pts.sort((a, b) => a.x - b.x);
  }
  const l = sel.entry, limit = loadMaxDist(l);
  if (metric === 't') return aligned ? alignedTrajectory(l, limit) : pubTrajectory(l, limit);
  const key = METRIC_KEY[metric];
  const pts = sortedEntries(l.published[key]).filter(([x]) => x <= limit).map(([x, y]) => ({ x, y, calc: false }));
  if (aligned) Object.entries(l.calculated || {}).forEach(([x, p]) => {
    x = Number(x);
    if (p[key] != null && x <= limit && !pts.some(q => q.x === x)) pts.push({ x, y: p[key], calc: true, low: !!p.lowConfidence });
  });
  return pts.sort((a, b) => a.x - b.x);
}

function labelFor(sel) {
  if (sel.isGeneric) return `Generic ${sel.cartridge}`;
  const third = sel.entry.sourceType === 'third-party' ? ` (${sel.entry.sourceLabel})` : '';
  return `${sel.cartridge} — ${sel.entry.manufacturer} ${sel.entry.productLine}${third}`;
}

function repEnergy(sel) {
  if (sel.isGeneric) {
    const e = DATA[sel.cartridge].generic.published && DATA[sel.cartridge].generic.published.energy;
    return e && e['100'] != null ? e['100'] : -Infinity;
  }
  return energyRank(sel.cartridge, sel.entry);
}

const METRICS = {
  e: { label: 'Energy', unit: 'ft·lbs', short: 'ft·lbs' },
  t: { label: 'Trajectory', unit: 'in, factory zero', short: 'in' },
  v: { label: 'Velocity', unit: 'fps', short: 'fps' },
};
const PRIORITY = ['e', 't', 'v']; // side-slot order when a metric isn't the hero
let heroMetric = 't';
let charts = {};   // metric -> Chart instance
let cards = {};    // metric -> card DOM element

function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

// Extra detail lines for one tooltip row.
function pointDetails(ds, pt, metric) {
  const lines = [];
  if (pt.generic) {
    lines.push(metric === 't' ? 'average of calculated values, 100 yd zero' : (pt.calc ? 'calculated average' : 'average of factory values'));
  } else if (metric === 't') {
    if (pt.sightHeight) lines.push(`start: −${Math.abs(pt.y)} in sight height`);
    else if (pt.calc) lines.push(pt.isZero ? 'zeroed at 100 yd' : 'calculated, zeroed at 100 yd' + (pt.low ? ' · estimate' : ''));
    else if (pt.zeroUnknown) lines.push('zero not stated');
    else if (pt.zeroYd != null) {
      lines.push(`zeroed at ${pt.zeroYd} yd`);
      if (pt.printedZeroYd != null && pt.printedZeroYd !== pt.zeroYd && pt.labelNote) lines.push(pt.labelNote);
    }
  } else if (pt.calc) {
    lines.push('calculated from the factory velocity table' + (pt.low ? ' · estimate' : ''));
  }
  if (ds.meta && ds.meta.thirdParty) lines.push(ds.meta.thirdParty);
  return lines;
}

// Chart.js draws its default tooltip on the canvas, which clips long load names
// at the chart edge. This renders the tooltip as an HTML element instead.
function externalTooltip(context) {
  const { chart, tooltip } = context;
  let el = document.getElementById('ballistics-tooltip');
  if (!el) {
    el = document.createElement('div');
    el.id = 'ballistics-tooltip';
    el.style.cssText = 'position:fixed;z-index:9999;pointer-events:none;max-width:min(320px, calc(100vw - 16px));white-space:normal;overflow-wrap:anywhere;padding:10px;border-radius:4px;font-size:12px;line-height:1.4;opacity:0;left:0;top:0;';
    document.body.appendChild(el);
  }
  if (tooltip.opacity === 0 || !(tooltip.dataPoints || []).length) { el.style.opacity = '0'; return; }

  el.style.background = cssVar('--ballistics-surface');
  el.style.color = cssVar('--ballistics-text');
  el.style.border = `1px solid ${cssVar('--ballistics-border')}`;
  el.textContent = '';

  const metric = chart.$metric;
  const unit = METRICS[metric].short;
  const x = tooltip.dataPoints[0].parsed.x;

  const title = document.createElement('div');
  title.style.fontWeight = '600';
  title.style.marginBottom = '4px';
  title.textContent = `${x} yd`;
  el.appendChild(title);

  // One row per selected load, including loads with no value at this distance.
  chart.data.datasets.forEach(ds => {
    const pt = ds.data.find(p => p.x === x);
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:flex-start;gap:6px;margin-top:3px;';
    const swatch = document.createElement('span');
    swatch.style.cssText = `flex:none;width:10px;height:10px;margin-top:3px;border-radius:2px;background:${ds.borderColor};`;
    const text = document.createElement('span');
    const main = document.createElement('div');
    if (pt) {
      main.textContent = `${ds.label}: ${pt.y} ${unit}`;
    } else {
      main.textContent = `${ds.label}: not published`;
      main.style.opacity = '0.7';
    }
    text.appendChild(main);
    const lines = pt ? pointDetails(ds, pt, metric) : (ds.meta && ds.meta.thirdParty ? [ds.meta.thirdParty] : []);
    lines.forEach(t => {
      const d = document.createElement('div');
      d.style.cssText = 'font-size:11px;opacity:0.75;';
      d.textContent = t;
      text.appendChild(d);
    });
    row.appendChild(swatch);
    row.appendChild(text);
    el.appendChild(row);
  });

  const rect = chart.canvas.getBoundingClientRect();
  const margin = 8, offset = 12;
  const px = rect.left + tooltip.caretX;
  const py = rect.top + tooltip.caretY;
  el.style.opacity = '1';
  const w = el.offsetWidth, h = el.offsetHeight;
  let left = px + offset;
  if (left + w > window.innerWidth - margin) left = px - offset - w;
  left = Math.max(margin, Math.min(left, window.innerWidth - w - margin));
  let top = Math.max(margin, Math.min(py - h / 2, window.innerHeight - h - margin));
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
}

function resolvedColor(varName) {
  const probe = document.createElement('div');
  probe.style.color = `var(${varName})`;
  document.body.appendChild(probe);
  const c = getComputedStyle(probe).color;
  probe.remove();
  return c;
}

function lighter(color) {
  const m = color.match(/rgba?\(([^)]+)\)/);
  if (!m) return color;
  const p = m[1].split(/[ ,/]+/).filter(Boolean);
  return `rgba(${p[0]}, ${p[1]}, ${p[2]}, 0.4)`;
}

// Series have different lengths, so "index" mode would pair the wrong points.
// Snap to the nearest plotted distance (x) across all datasets and hit every point there.
function registerSnapMode() {
  Chart.Interaction.modes.xSnap = function (chart, e) {
    let best = Infinity, bestX = null;
    chart.data.datasets.forEach((ds, di) => {
      if (!chart.isDatasetVisible(di)) return;
      chart.getDatasetMeta(di).data.forEach((el, i) => {
        const d = Math.abs(el.x - e.x);
        if (d < best) { best = d; bestX = ds.data[i].x; }
      });
    });
    const items = [];
    if (bestX === null) return items;
    chart.data.datasets.forEach((ds, di) => {
      if (!chart.isDatasetVisible(di)) return;
      const meta = chart.getDatasetMeta(di);
      ds.data.forEach((p, i) => { if (p.x === bestX) items.push({ element: meta.data[i], datasetIndex: di, index: i }); });
    });
    return items;
  };
}

function makeChart(canvasId, metric) {
  const ctx = document.getElementById(canvasId).getContext('2d');
  const chart = new Chart(ctx, {
    type: 'line',
    data: { datasets: [] },
    options: {
      responsive: true, maintainAspectRatio: false,
      layout: { padding: { right: 8 } },
      interaction: { mode: 'xSnap', intersect: false },
      plugins: {
        legend: { display: false, position: 'bottom', labels: { color: cssVar('--ballistics-text-dim'), font: { family: "'Work Sans'", size: 11.5 }, boxWidth: 12, padding: 12 } },
        tooltip: { enabled: false, external: externalTooltip }
      },
      scales: {
        x: { type: 'linear', min: 0, max: 300, title: { display: true, text: 'Yardage', color: cssVar('--ballistics-text-dim') }, ticks: { color: cssVar('--ballistics-text-dim'), font: { size: 10.5 }, stepSize: 50 }, grid: { color: cssVar('--ballistics-border') } },
        y: { ticks: { color: cssVar('--ballistics-text-dim'), font: { size: 10.5 } }, grid: { color: cssVar('--ballistics-border') } }
      }
    }
  });
  chart.$metric = metric;
  return chart;
}

function buildCard(metric) {
  const m = METRICS[metric];
  const card = document.createElement('div');
  card.className = 'chartcard';
  card.dataset.metric = metric;
  card.innerHTML = `
    <h3>${m.label} <span class="unit">${m.unit}</span><span class="swap-hint">click to view large ↗</span></h3>
    <div class="chart-holder"><canvas id="chart-${metric}"></canvas></div>
    <div class="legend-note hero-only"><span><span class="dash-sample"></span> dashed = our calculation (lighter = estimate)</span></div>
  `;
  card.addEventListener('click', () => { if (metric !== heroMetric) setHero(metric); });
  cards[metric] = card;
  return card;
}

function setHero(metric) {
  heroMetric = metric;
  layoutCards();
  renderCharts();
}

function layoutCards() {
  const heroSlot = document.getElementById('heroSlot');
  const sideSlot = document.getElementById('sideSlot');
  heroSlot.innerHTML = '';
  sideSlot.innerHTML = '';

  const heroCard = cards[heroMetric];
  heroCard.classList.remove('sidecard', 'pos0', 'pos1');
  heroCard.querySelector('.legend-note').style.display = 'flex';
  heroCard.querySelector('.swap-hint').style.display = 'none';
  heroSlot.appendChild(heroCard);

  const sideMetrics = PRIORITY.filter(m => m !== heroMetric);
  sideMetrics.forEach((m, i) => {
    const c = cards[m];
    c.classList.add('sidecard');
    c.classList.remove('pos0', 'pos1');
    c.classList.add(i === 0 ? 'pos0' : 'pos1');
    c.querySelector('.legend-note').style.display = 'none';
    c.querySelector('.swap-hint').style.display = 'inline';
    sideSlot.appendChild(c);
  });

  Object.entries(charts).forEach(([m, chart]) => {
    chart.options.plugins.legend.display = (m === heroMetric);
    chart.resize();
  });
}

function renderCharts() {
  const orderedSel = [...selected].sort((a, b) => repEnergy(b) - repEnergy(a));
  // The X axis runs to the longest published distance among the selected loads.
  const xmax = orderedSel.length ? Math.max(...orderedSel.map(selMaxDist)) : 300;
  const step = xmax <= 100 ? 25 : (xmax > 300 ? 100 : 50);

  cards.t.querySelector('.unit').textContent = aligned ? 'in, 100-yd zero' : 'in, factory zero';

  Object.keys(METRICS).forEach(metric => {
    if (!charts[metric]) charts[metric] = makeChart(`chart-${metric}`, metric);
    const chart = charts[metric];
    chart.options.plugins.legend.display = (metric === heroMetric);
    chart.options.scales.x.max = xmax;
    chart.options.scales.x.ticks.stepSize = step;
    chart.data.datasets = orderedSel.map((sel, i) => {
      const series = seriesFor(sel, metric);
      const color = resolvedColor(COLOR_VARS[i % COLOR_VARS.length]);
      const faint = lighter(color);
      return {
        label: labelFor(sel),
        data: series,
        parsing: false,
        meta: { thirdParty: !sel.isGeneric && sel.entry.sourceType === 'third-party' ? sel.entry.sourceLabel : null },
        borderColor: color,
        backgroundColor: color,
        borderWidth: 2.4,
        pointRadius: 3,
        pointBackgroundColor: series.map(pt => pt.calc ? 'transparent' : color),
        pointBorderColor: series.map(pt => pt.low ? faint : color),
        segment: {
          borderDash: ctx => (series[ctx.p1DataIndex] && series[ctx.p1DataIndex].calc) ? [5, 4] : undefined,
          borderColor: ctx => (series[ctx.p1DataIndex] && series[ctx.p1DataIndex].low) ? faint : color,
        },
        cubicInterpolationMode: 'monotone',
        spanGaps: true,
      };
    });
    chart.update();
  });

  Object.values(cards).forEach(c => {
    const holder = c.querySelector('.chart-holder');
    let empty = c.querySelector('.empty');
    if (selected.length === 0) {
      if (!empty) { empty = document.createElement('div'); empty.className = 'empty'; empty.textContent = 'Select up to 4 loads on the left.'; c.appendChild(empty); }
      holder.style.display = 'none';
    } else {
      if (empty) empty.remove();
      holder.style.display = 'block';
    }
  });
}

function syncHeights() {
  const picker = document.querySelector('.picker');
  const heroSlot = document.getElementById('heroSlot');
  const sideSlot = document.getElementById('sideSlot');
  if (window.innerWidth <= 1150) {
    picker.style.height = '';
    heroSlot.style.height = '';
    sideSlot.style.height = '';
  } else {
    // Setting height:auto to measure collapses the picker's scroll area and
    // resets scrollTop to 0, so remember it and put it back afterwards.
    const prevScroll = picker.scrollTop;
    picker.style.height = 'auto';
    const natural = picker.scrollHeight;
    const maxAllowed = window.innerHeight - 64;
    const h = Math.min(natural, maxAllowed);
    picker.style.height = h + 'px';
    heroSlot.style.height = h + 'px';
    sideSlot.style.height = h + 'px';
    picker.scrollTop = prevScroll;
  }
  Object.values(charts).forEach(c => c.resize());
}

async function init() {
  const res = await fetch('/data/ballistics-dataset.json');
  DATA = await res.json();
  registerSnapMode();

  let resizeTimer;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(syncHeights, 120); });

  buildPicker();
  updateSlotCount();
  Object.keys(METRICS).forEach(buildCard);
  layoutCards();
  const toggle = document.getElementById('alignZeros');
  if (toggle) {
    toggle.checked = false;
    toggle.addEventListener('change', () => {
      aligned = toggle.checked;
      preserveScroll(renderCharts);
    });
  }
  seedDefaults();
  document.getElementById('groups').addEventListener('toggle', syncHeights, true);
  syncHeights();
}

init();
