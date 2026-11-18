// 📄 New opens the blank preset (maker-kit's `{ id: 'blank', listed: false }`):
// plain-box's state under its own name, out of the presets list, but known
// by its ref, so a reload finds the project still is it.

import { BLANK_PRESET, PRESETS, presetById, presetSignature } from '../src/state/presets';
import { DICTS, LANGS } from '../src/i18n';

describe('the blank preset', () => {
  it('is plain-box’s state: no boards, 100 × 70 × 35', () => {
    const plain = presetById('plain-box');
    expect(plain).toBeDefined();
    const blank = BLANK_PRESET.build();
    expect(presetSignature(blank)).toBe(presetSignature(plain?.build() ?? blank));
    expect(blank.boards).toEqual([]);
    expect(blank.shape.size).toEqual({ w: 100, d: 70, h: 35 });
  });

  it('is not in the presets list, and is found by its id', () => {
    expect(BLANK_PRESET).toMatchObject({ id: 'blank', listed: false });
    expect(PRESETS.map((preset) => preset.id)).not.toContain('blank');
    expect(presetById('blank')).toBe(BLANK_PRESET);
  });

  it('is named “New case” in every language, as a built-in preset’s name is one everywhere', () => {
    for (const lang of LANGS) expect(DICTS[lang]['preset.blank.name'], lang).toBe('New case');
  });
});
