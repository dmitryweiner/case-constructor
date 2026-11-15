// The panel's messages as maker-kit's message list (ui/messageList): the
// blockers first, then the warnings and notes the panel and the worker give.
// A line with a place on the model gets its badge's number ("⚠ 3", "ℹ 4"),
// the same as its badge over the model; the boxes, the hover and the picked
// line are main.ts's.

import type { MessageLine } from 'maker-kit/ui/messageList';
import type { MessageSpot } from '../geo/message';
import { t } from '../i18n';
import type { Half } from '../state/hinged';

/** A warning or a note: its text, and whether it only informs (not counted as a warning). */
export interface Notice {
  text: string;
  info: boolean;
  /** its message's code, as the line's `data-code` */
  code?: string;
  /** where it points on the model */
  spot?: MessageSpot;
  /** its badge's number, given in list order to the lines with a spot */
  n?: number;
  /** a hinged case: the half whose frame the spot is in */
  half?: Half;
}

/** What stops the export: a broken mesh, a failed build, a refused file. */
export interface Blocker {
  text: string;
  code?: string;
}

/** The lines with a place numbered 1, 2, … in list order. */
export function numberNotices(notices: readonly Notice[]): Notice[] {
  let count = 0;
  return notices.map((line) => (line.spot ? { ...line, n: ++count } : line));
}

export function messageLines(blockers: readonly Blocker[], notices: readonly Notice[]): MessageLine[] {
  return [
    ...blockers.map((line): MessageLine => ({ severity: 'bad', text: line.text, ...(line.code ? { code: line.code } : {}) })),
    ...notices.map((line): MessageLine => ({
      severity: line.info ? 'info' : 'warn',
      text: line.text,
      ...(line.code ? { code: line.code } : {}),
      ...(line.n !== undefined ? { mark: `${line.info ? 'ℹ' : '⚠'} ${line.n}` } : {}),
    })),
  ];
}

/** "3 warnings · 2 notes" over the list once it has two lines; nothing over one. */
export function messageCounts(notices: readonly Notice[]): string {
  if (notices.length < 2) return '';
  const warned = notices.filter((line) => !line.info).length;
  const noted = notices.length - warned;
  return [...(warned ? [t('status.warnings', { n: warned })] : []), ...(noted ? [t('status.notes', { n: noted })] : [])].join(' · ');
}
