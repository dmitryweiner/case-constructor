// The panel's messages as maker-kit's message list: the blockers first, a
// badge's number on each line with a place on the model, the counts.

import { messageCounts, messageLines, numberNotices } from '../src/ui/messages';
import type { Notice } from '../src/ui/messages';
import type { MessageSpot } from '../src/geo/message';

const spot: MessageSpot = { holder: 'body', at: [0, 0, 0], boxes: [] };

describe('numberNotices', () => {
  it('numbers the lines with a place in list order, the rest without a number', () => {
    const notices: Notice[] = [
      { text: 'a', info: false, spot },
      { text: 'b', info: true },
      { text: 'c', info: true, spot },
    ];
    expect(numberNotices(notices).map((line) => line.n)).toEqual([1, undefined, 2]);
  });
});

describe('messageLines', () => {
  it('puts the blockers first, in the bad colour, a warning and a note after them', () => {
    const lines = messageLines(
      [{ text: 'Open mesh', code: 'kit.mesh.open' }],
      numberNotices([
        { text: 'Boards overlap', info: false, code: 'warn.overlap', spot },
        { text: 'Depth raised', info: true, code: 'info.depthRaised' },
      ]),
    );
    expect(lines).toEqual([
      { severity: 'bad', text: 'Open mesh', code: 'kit.mesh.open' },
      { severity: 'warn', text: 'Boards overlap', code: 'warn.overlap', mark: '⚠ 1' },
      { severity: 'info', text: 'Depth raised', code: 'info.depthRaised' },
    ]);
  });

  it('marks a note with a place by ℹ and its number, and leaves a code out when there is none', () => {
    expect(messageLines([{ text: 'Could not build' }], numberNotices([{ text: 'Screws', info: true, spot }]))).toEqual([
      { severity: 'bad', text: 'Could not build' },
      { severity: 'info', text: 'Screws', mark: 'ℹ 1' },
    ]);
  });
});

describe('messageCounts', () => {
  it('counts warnings and notes apart once there are two lines', () => {
    const warn = { text: 'w', info: false };
    const note = { text: 'n', info: true };
    expect(messageCounts([warn, warn, warn, note, note])).toBe('3 warnings · 2 notes');
    expect(messageCounts([warn, note])).toBe('1 warning · 1 note');
    expect(messageCounts([note, note])).toBe('2 notes');
  });

  it('says nothing over one line or none', () => {
    expect(messageCounts([{ text: 'w', info: false }])).toBe('');
    expect(messageCounts([])).toBe('');
  });
});
