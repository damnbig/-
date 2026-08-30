import { copyFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const outputDir = resolve('dist');
mkdirSync(outputDir, { recursive: true });

for (const file of ['manifest.json', 'service-worker.js']) {
  copyFileSync(resolve(file), resolve(outputDir, file));
}
