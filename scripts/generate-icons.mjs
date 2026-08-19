/**
 * Regenerates the extension icons from the brand logo.
 *
 *   node scripts/generate-icons.mjs
 *
 * Source of truth is Assests/assistfill-logo.png. The rounded-square mark is the leftmost
 * element of that lockup, so the ink bounding box is measured and a square of that height is
 * taken from the left edge — no hand-tuned pixel offsets to go stale when the logo is redrawn.
 *
 * Outputs (apps/extension/public/icons, copied into dist by Vite's publicDir):
 *   icon-16 / 32 / 48 / 128.png   manifest + toolbar
 *   wordmark.png                  the panel header lockup
 * and the 512px store tile at Assests/assistigo-mark-512.png, deliberately outside the bundle.
 *
 * Needs `sharp`, which is present as a transitive dependency of Next. If that ever stops being
 * true, `npm i -D sharp`.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let sharp;
try {
  sharp = createRequire(path.join(root, 'package.json'))('sharp');
} catch {
  console.error('generate-icons: sharp is not installed. Run `npm i -D sharp` and try again.');
  process.exit(1);
}

const SOURCE = path.join(root, 'Assests/assistfill-logo.png');
const ICONS = path.join(root, 'apps/extension/public/icons');
const STORE_TILE = path.join(root, 'Assests/assistigo-mark-512.png');

const MANIFEST_SIZES = [16, 32, 48, 128];
/** Keeps the rounded square off the very edge of the tile. */
const PAD_RATIO = 0.04;
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

const trimmed = await sharp(SOURCE).trim({ threshold: 10 }).toBuffer({ resolveWithObject: true });

const left = -(trimmed.info.trimOffsetLeft ?? 0);
const top = -(trimmed.info.trimOffsetTop ?? 0);
const side = trimmed.info.height;

const mark = await sharp(SOURCE).extract({ left, top, width: side, height: side }).png().toBuffer();

await mkdir(ICONS, { recursive: true });

for (const size of MANIFEST_SIZES) {
  const pad = Math.round(size * PAD_RATIO);
  await sharp(mark)
    .resize(size - pad * 2, size - pad * 2, { fit: 'contain', background: TRANSPARENT })
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: TRANSPARENT })
    .png({ compressionLevel: 9 })
    .toFile(path.join(ICONS, `icon-${size}.png`));
}

await sharp(SOURCE)
  .trim({ threshold: 10 })
  .resize({ height: 72, fit: 'contain', background: TRANSPARENT })
  .png({ compressionLevel: 9 })
  .toFile(path.join(ICONS, 'wordmark.png'));

await sharp(mark)
  .resize(512, 512, { fit: 'contain', background: TRANSPARENT })
  .png()
  .toFile(STORE_TILE);

console.log(`✓ icons ${MANIFEST_SIZES.join('/')} + wordmark → apps/extension/public/icons`);
console.log('✓ 512px store tile → Assests/assistigo-mark-512.png');
