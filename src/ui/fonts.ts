// Label fonts. They live in public/fonts (woff2 subsets, the OFL licence next
// to them) and load only when a label is on: the interface does not need
// them. Never from a CDN: the font must be exactly the same on every build,
// or the label on the lid would drift. Rubik carries Latin, Cyrillic and
// Hebrew; Oswald has no Hebrew, so Hebrew letters fall back to Rubik.

import type { LabelFont } from '../geo/extras';

interface FontFile {
  /** family name in document.fonts — our own, so the page never competes */
  family: string;
  /** shown in the picker — the font's own name */
  label: string;
  file: string;
  weight: string;
  subsets: readonly Subset[];
}

type Subset = 'latin' | 'cyrillic' | 'hebrew';

export const LABEL_FONT_FILES: Record<LabelFont, FontFile> = {
  rubik: { family: 'case-rubik', label: 'Rubik', file: 'rubik', weight: '700', subsets: ['latin', 'cyrillic', 'hebrew'] },
  oswald: { family: 'case-oswald', label: 'Oswald', file: 'oswald', weight: '600', subsets: ['latin', 'cyrillic'] },
};

/** Subset ranges, as Google Fonts cuts them. */
const RANGES: Record<Subset, string> = {
  latin: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, '
    + 'U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
  cyrillic: 'U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116',
  hebrew: 'U+0307-0308, U+0590-05FF, U+200C-2010, U+20AA, U+25CC, U+FB1D-FB4F',
};

const loading = new Map<LabelFont, Promise<void>>();
const ready = new Set<LabelFont>();

export function fontReady(font: LabelFont): boolean {
  return ready.has(font) && (font === 'rubik' || ready.has('rubik'));
}

/**
 * Loads a font once per session, every subset at once: the browser would
 * fetch Cyrillic only on the first Cyrillic letter on the canvas, and the
 * raster must be complete. Oswald brings Rubik along for Hebrew.
 */
export function loadFont(font: LabelFont): Promise<void> {
  const known = loading.get(font);
  if (known) return known;
  const spec = LABEL_FONT_FILES[font];
  const faces = spec.subsets.map((subset) => new FontFace(
    spec.family,
    `url(${import.meta.env.BASE_URL}fonts/${spec.file}-${subset}.woff2) format('woff2')`,
    { weight: spec.weight, unicodeRange: RANGES[subset] },
  ));
  const own = Promise.all(faces.map((face) => face.load())).then((loaded) => {
    for (const face of loaded) document.fonts.add(face);
    ready.add(font);
  });
  const promise = font === 'rubik' ? own : Promise.all([own, loadFont('rubik')]).then(() => undefined);
  loading.set(font, promise);
  // a failure is not forever: the next request tries again
  promise.catch(() => loading.delete(font));
  return promise;
}
