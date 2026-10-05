// Sanity check for public/data/ballistics-dataset.json. Run: npm run check:ballistics
// 1) "No Data" loads must have no numbers (blank, never placeholders).
// 2) Published loads must lose velocity and energy as distance increases.
import { readFileSync } from 'node:fs';

const data = JSON.parse(readFileSync(new URL('../public/data/ballistics-dataset.json', import.meta.url), 'utf8'));
const errors = [];

for (const [cartridge, { loads }] of Object.entries(data)) {
  for (const load of loads) {
    const name = `${cartridge} ${load.manufacturer} ${load.productLine}`;
    const yards = Object.keys(load.series).sort((a, b) => a - b);
    if (load.dataStatus === 'Published') {
      for (const key of ['velocity', 'energy']) {
        const vals = yards.map((y) => load.series[y][key]).filter((v) => v != null);
        if (vals.some((v, i) => i > 0 && v >= vals[i - 1])) {
          errors.push(`${name}: ${key} does not decrease with distance (${vals.join(', ')})`);
        }
      }
    } else {
      const filled = yards.filter((y) => ['velocity', 'energy', 'trajectory'].some((k) => load.series[y][k] != null));
      if (filled.length) errors.push(`${name}: marked "${load.dataStatus}" but has numbers at ${filled.join(', ')} yd`);
    }
  }
}

if (errors.length) {
  console.error('Ballistics dataset problems:\n- ' + errors.join('\n- '));
  process.exit(1);
}
console.log('Ballistics dataset OK');
