// Cornfed Bucks — Ballistics Comparison Tool
// Loads /data/ballistics-dataset.json at runtime, then renders the picker + charts.

const GRID = [0, 50, 100, 150, 200, 250, 300];
const MAXSEL = 4;
const COLOR_VARS = ['--ballistics-line-a', '--ballistics-line-b', '--ballistics-line-c', '--ballistics-line-d'];

let DATA = null;
let selected = []; // {id, cartridge, isGeneric, entry?}

function loadKeyOf(cartridge, mfr, line) { return cartridge + '|' + mfr + '|' + line; }

function energyRank(cartridge, l) {
  const s = l.series;
  const e = s['100'] && s['100'].energy != null ? s['100'].energy : (s['0'] ? s['0'].energy : null);
  return e == null ? -Infinity : e;
}

function buildPicker() {
  const container = document.getElementById('groups');
  const cartridges = Object.keys(DATA);
  const swcSet = new Set(['.350 Legend', '.400 Legend', '.450 Bushmaster', '.360 Buckhammer', '.45-70 Govt']);
  cartridges.forEach((cartridge, idx) => {
    const group = document.createElement('details');
    group.className = 'group';
    if (idx < 2) group.open = true;
    const cat = swcSet.has(cartridge) ? 'SWC' : 'Shouldered';
    group.innerHTML = `<summary>${cartridge}<span class="cat">${cat}</span></summary>`;
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
      const meta = disabled ? 'no manufacturer ballistics data' : `${l.bulletWt}gr`;
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
  row.appendChild(cb);
  const txt = document.createElement('span');
  txt.innerHTML = `<span class="name">${label}</span><br><span class="meta">${meta}</span>`;
  row.appendChild(txt);
  return row;
}

function onToggle(cb, payload) {
  const id = cb.dataset.id;
  if (cb.checked) {
    if (selected.length >= MAXSEL) { cb.checked = false; return; }
    selected.push({ id, ...payload });
  } else {
    selected = selected.filter(s => s.id !== id);
  }
  updateSlotCount();
  renderCharts();
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
  const c1 = '.350 Legend', c2 = '.308 Winchester';
  const cb1 = document.querySelector(`input[data-id="${c1}::GENERIC"]`);
  const cb2 = document.querySelector(`input[data-id="${c2}::GENERIC"]`);
  if (cb1) { cb1.checked = true; onToggle(cb1, { cartridge: c1, isGeneric: true }); }
  if (cb2) { cb2.checked = true; onToggle(cb2, { cartridge: c2, isGeneric: true }); }
}

function seriesFor(sel) {
  if (sel.isGeneric) {
    const g = DATA[sel.cartridge].generic;
    return GRID.map(y => ({ y, v: g[y]?.velocity, e: g[y]?.energy, t: g[y]?.trajectory, calc: false }));
  }
  const s = sel.entry.series;
  return GRID.map(y => ({
    y, v: s[y]?.velocity, e: s[y]?.energy, t: s[y]?.trajectory,
    calc: !!(s[y]?.trajectoryCalculated)
  }));
}

function labelFor(sel) {
  return sel.isGeneric ? `Generic ${sel.cartridge}` : `${sel.cartridge} — ${sel.entry.manufacturer} ${sel.entry.productLine}`;
}

function repEnergy(sel) {
  if (sel.isGeneric) {
    const g = DATA[sel.cartridge].generic;
    return g['100'] && g['100'].energy != null ? g['100'].energy : -Infinity;
  }
  return energyRank(sel.cartridge, sel.entry);
}

const METRICS = {
  e: { label: 'Energy', unit: 'ft·lbs' },
  t: { label: 'Trajectory', unit: 'in, 100-yd zero' },
  v: { label: 'Velocity', unit: 'fps' },
};
const PRIORITY = ['e', 't', 'v']; // side-slot order when a metric isn't the hero
let heroMetric = 't';
let charts = {};   // metric -> Chart instance
let cards = {};    // metric -> card DOM element

function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

function resolvedColor(varName) {
  const probe = document.createElement('div');
  probe.style.color = `var(${varName})`;
  document.body.appendChild(probe);
  const c = getComputedStyle(probe).color;
  probe.remove();
  return c;
}

function makeChart(canvasId) {
  const ctx = document.getElementById(canvasId).getContext('2d');
  return new Chart(ctx, {
    type: 'line',
    data: { labels: GRID, datasets: [] },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false, position: 'bottom', labels: { color: cssVar('--ballistics-text-dim'), font: { family: "'Work Sans'", size: 11.5 }, boxWidth: 12, padding: 12 } },
        tooltip: { backgroundColor: cssVar('--ballistics-surface'), titleColor: cssVar('--ballistics-text'), bodyColor: cssVar('--ballistics-text'), borderColor: cssVar('--ballistics-border'), borderWidth: 1, padding: 10 }
      },
      scales: {
        x: { title: { display: true, text: 'Yardage', color: cssVar('--ballistics-text-dim') }, ticks: { color: cssVar('--ballistics-text-dim'), font: { size: 10.5 } }, grid: { color: cssVar('--ballistics-border') } },
        y: { ticks: { color: cssVar('--ballistics-text-dim'), font: { size: 10.5 } }, grid: { color: cssVar('--ballistics-border') } }
      }
    }
  });
}

function buildCard(metric) {
  const m = METRICS[metric];
  const card = document.createElement('div');
  card.className = 'chartcard';
  card.dataset.metric = metric;
  card.innerHTML = `
    <h3>${m.label} <span class="unit">${m.unit}</span><span class="swap-hint">click to view large ↗</span></h3>
    <div class="chart-holder"><canvas id="chart-${metric}"></canvas></div>
    <div class="legend-note hero-only"><span><span class="dash-sample"></span> calculated / converted point (see footer)</span></div>
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

  Object.keys(METRICS).forEach(metric => {
    if (!charts[metric]) charts[metric] = makeChart(`chart-${metric}`);
    const chart = charts[metric];
    chart.options.plugins.legend.display = (metric === heroMetric);
    chart.data.datasets = orderedSel.map((sel, i) => {
      const series = seriesFor(sel);
      const color = resolvedColor(COLOR_VARS[i % COLOR_VARS.length]);
      return {
        label: labelFor(sel),
        data: series.map(pt => pt[metric]),
        borderColor: color,
        backgroundColor: color,
        borderWidth: 2.4,
        pointRadius: 3,
        pointBackgroundColor: series.map(pt => pt.calc ? 'transparent' : color),
        pointBorderColor: color,
        segment: {
          borderDash: ctx => {
            const p1 = series[ctx.p1DataIndex];
            return (p1 && p1.calc) ? [5, 4] : undefined;
          }
        },
        tension: 0.25,
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
    picker.style.height = 'auto';
    const natural = picker.scrollHeight;
    const maxAllowed = window.innerHeight - 64;
    const h = Math.min(natural, maxAllowed);
    picker.style.height = h + 'px';
    heroSlot.style.height = h + 'px';
    sideSlot.style.height = h + 'px';
  }
  Object.values(charts).forEach(c => c.resize());
}

async function init() {
  const res = await fetch('/data/ballistics-dataset.json');
  DATA = await res.json();

  let resizeTimer;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(syncHeights, 120); });

  buildPicker();
  updateSlotCount();
  Object.keys(METRICS).forEach(buildCard);
  layoutCards();
  seedDefaults();
  document.getElementById('groups').addEventListener('toggle', syncHeights, true);
  syncHeights();
}

init();
