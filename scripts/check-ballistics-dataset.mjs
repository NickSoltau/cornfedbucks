// Sanity check for the two-layer ballistics dataset (published / calculated).
// Usage: node check-ballistics-layered.mjs [path-to-dataset.json]
// Rules come from our accuracy standard: factory numbers stay exactly as printed, and our own numbers are labeled.
import { readFileSync } from 'node:fs';

const file = process.argv[2] ?? new URL('../public/data/ballistics-dataset.json', import.meta.url);
const data = JSON.parse(readFileSync(file, 'utf8'));
const errors = [];
const num = (v) => typeof v === 'number' && Number.isFinite(v);

for (const [cartridge, { loads, category }] of Object.entries(data)) {
  if (!category) errors.push(`${cartridge}: missing category`);
  for (const load of loads) {
    const name = `${cartridge} / ${load.manufacturer} ${load.productLine}`;
    const pub = load.published ?? {};
    const calc = load.calculated ?? {};

    if (load.dataStatus !== 'Published') {
      if (Object.keys(pub).length || Object.keys(calc).length) errors.push(`${name}: marked "${load.dataStatus}" but has numbers`);
      continue;
    }
    if (!num(load.sightHeightIn)) errors.push(`${name}: sightHeightIn missing`);
    // source labeling: anything not from the factory must say so, with a link to where it came from
    if (load.sourceType !== undefined && !['factory', 'third-party'].includes(load.sourceType)) errors.push(`${name}: sourceType must be "factory" or "third-party"`);
    if (load.sourceType === 'third-party') {
      if (!load.sourceLabel) errors.push(`${name}: third-party load needs a sourceLabel`);
      if (!load.sourceUrl) errors.push(`${name}: third-party load needs a sourceUrl`);
    }

    // 1) published velocity and energy fall with distance, and are real numbers (no nulls, no placeholders)
    for (const key of ['velocity', 'energy']) {
      const pts = Object.entries(pub[key] ?? {}).map(([y, v]) => [Number(y), v]).sort((a, b) => a[0] - b[0]);
      if (!pts.length) errors.push(`${name}: published ${key} is empty`);
      pts.forEach(([y, v], i) => {
        if (!num(v)) errors.push(`${name}: published ${key} at ${y} yd is not a number`);
        if (i > 0 && v >= pts[i - 1][1]) errors.push(`${name}: published ${key} does not fall at ${y} yd`);
      });
    }

    // 2) published trajectory tables: zero point is 0, muzzle (if printed) equals minus the sight height
    const tables = pub.trajectory ?? [];
    if (!tables.length) errors.push(`${name}: no published trajectory table`);
    for (const t of tables) {
      if (!num(t.zeroYd) && !t.zeroUnknown) errors.push(`${name}: trajectory table without zeroYd (set zeroUnknown only if the factory does not state it)`);
      for (const [y, v] of Object.entries(t.inches ?? {})) {
        if (!num(v)) errors.push(`${name}: table(${t.zeroYd}yd zero) value at ${y} yd is not a number`);
        if (Number(y) === t.zeroYd && v !== 0) errors.push(`${name}: table(${t.zeroYd}yd zero) not zero at its zero`);
        if (Number(y) === 0 && Math.abs(v + load.sightHeightIn) > 0.011) errors.push(`${name}: printed muzzle value ${v} is not -${load.sightHeightIn}`);
      }
    }

    // 3) nothing past the last distance the factory printed (rimfire etc.)
    if (load.maxPublishedRange) {
      for (const layer of [pub.velocity, pub.energy, ...tables.map((t) => t.inches), calc]) {
        for (const y of Object.keys(layer ?? {})) if (Number(y) > load.maxPublishedRange) errors.push(`${name}: value at ${y} yd is past the ${load.maxPublishedRange} yd the factory published`);
      }
    }

    // 4) the calculated layer never repeats or overwrites something the factory printed, and always says how it was made
    const t100 = tables.find((t) => t.zeroYd === 100)?.inches ?? {};
    for (const [y, p] of Object.entries(calc)) {
      if ('velocity' in p && y in (pub.velocity ?? {})) errors.push(`${name}: calculated velocity at ${y} yd duplicates a published value`);
      if ('trajectory' in p && y in t100) errors.push(`${name}: calculated trajectory at ${y} yd duplicates a published 100 yd-zero value`);
      if (!Array.isArray(p.basis) || !p.basis.length) errors.push(`${name}: calculated point at ${y} yd has no basis`);
      if (typeof p.lowConfidence !== 'boolean') errors.push(`${name}: calculated point at ${y} yd has no lowConfidence flag`);
    }
  }
}

if (errors.length) {
  console.error('Ballistics dataset problems:\n- ' + errors.join('\n- '));
  process.exit(1);
}
console.log('Ballistics dataset OK (layered)');
