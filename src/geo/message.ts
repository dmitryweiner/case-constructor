// Messages from the core and the worker to the user travel as a code plus
// parameters, never as a phrase. The core does not know the language (nor
// does the worker: the language may change mid-job); the UI turns the code
// into text (`tm` in src/i18n). Every code must be a dictionary key — `tm`
// makes tsc check that.

export type MessageCode =
  // mesh checks before export (validate)
  | 'mesh.nonFinite'
  | 'mesh.badIndices'
  | 'mesh.empty'
  | 'mesh.flat'
  | 'mesh.open'
  | 'mesh.inverted'
  | 'mesh.degenerate'
  | 'mesh.tooLarge'
  // layout checks (layout)
  | 'warn.boardsOverlap'
  | 'warn.standoffHitsBoard'
  // cutouts (ports)
  | 'warn.portFar'
  | 'info.cutSplit'
  | 'warn.cutUnderSkirt'
  | 'warn.cutInCorner'
  | 'info.extraSplit'
  | 'warn.extraUnderSkirt'
  // lid fastening
  | 'warn.postHitsBoard'
  | 'warn.postInOpening'
  | 'warn.threadSmall'
  // extras
  | 'warn.fanTooBig'
  | 'warn.keyholeNearStandoff'
  | 'warn.keyholeOffFlat'
  | 'warn.keyholeClosedRound'
  | 'warn.keyholePadsOnBed'
  | 'warn.labelTooBig'
  // worker job stages
  | 'progress.loading'
  | 'progress.shell'
  | 'progress.split'
  | 'progress.supports'
  | 'progress.fastening'
  | 'progress.cutouts'
  | 'progress.extras'
  | 'progress.lid'
  | 'progress.check';

export interface Message {
  code: MessageCode;
  params?: Readonly<Record<string, string | number>>;
}
