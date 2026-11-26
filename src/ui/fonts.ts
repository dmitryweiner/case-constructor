// Label fonts. They live in public/fonts (woff2 subsets, the OFL licence next
// to them) and load only when a label is on: the interface does not need
// them. Never from a CDN: the font must be exactly the same on every build,
// or the label on the lid would drift. The loader is the kit's
// (`maker-kit/ui/fonts`). Rubik carries Latin, Cyrillic and Hebrew; Oswald
// has no Hebrew, so Hebrew letters fall back to Rubik — Oswald brings Rubik
// along.

import type { FontFile } from 'maker-kit/ui/fonts';
import { createFontLoader } from 'maker-kit/ui/fonts';
import type { LabelFont } from '../geo/extras';

export const LABEL_FONT_FILES: Record<LabelFont, FontFile> = {
  rubik: { family: 'case-rubik', label: 'Rubik', file: 'rubik', weight: '700', subsets: ['latin', 'cyrillic', 'hebrew'] },
  oswald: { family: 'case-oswald', label: 'Oswald', file: 'oswald', weight: '600', subsets: ['latin', 'cyrillic'] },
};

const fonts = createFontLoader(LABEL_FONT_FILES, `${import.meta.env.BASE_URL}fonts/`);

export function fontReady(font: LabelFont): boolean {
  return fonts.ready(font) && fonts.ready('rubik');
}

/** Loads a font once per session, every subset at once; Oswald brings Rubik along for Hebrew. */
export function loadFont(font: LabelFont): Promise<void> {
  return font === 'rubik' ? fonts.load('rubik') : Promise.all([fonts.load(font), fonts.load('rubik')]).then(() => undefined);
}
