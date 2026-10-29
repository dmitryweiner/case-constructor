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
  // a hinged case (hinge, ports)
  | 'warn.hingeUnprintable'
  | 'warn.knuckleNoWall'
  | 'warn.cutHitsKnuckle'
  | 'warn.extraHitsKnuckle'
  | 'info.hingeScrews'
  | 'info.hingeSnap'
  | 'warn.cableAtCorner'
  | 'warn.cablesOverlap'
  | 'info.cableLength'
  | 'info.leafScrews.tap'
  | 'info.leafScrews.insert'
  | 'info.leafScrews.nut'
  | 'warn.leafNoWall'
  | 'warn.leafPadHitsBoard'
  | 'warn.gapSmall'
  | 'info.gapAuto'
  | 'warn.magnetHitsBoard'
  // layout checks (layout)
  | 'warn.boardsOverlap'
  | 'warn.standoffHitsBoard'
  | 'warn.notAgainstWall'
  | 'warn.notAgainstWallSize'
  | 'info.portsRecessed'
  | 'info.portsRecessedOut'
  | 'warn.bottomPartOnSupport'
  | 'warn.topPartOnSupport'
  | 'warn.glassGap'
  | 'warn.clampBlocked'
  | 'warn.carriedOnParts'
  | 'warn.windowInCorner'
  | 'info.keysProud'
  | 'info.keysSunk'
  | 'warn.keysUnderFace'
  | 'warn.keyWebThin'
  | 'warn.keysPlateHigh'
  | 'info.keyCaps'
  | 'info.buttonCaps'
  | 'warn.capFlangeSmall'
  | 'warn.capOverPart'
  | 'warn.restTooLong'
  | 'warn.restBlocked'
  | 'info.plugProud'
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
  | 'warn.mountOnLid'
  | 'warn.mountOnSnaps'
  | 'warn.earOnBed'
  | 'warn.earsOnParting'
  | 'warn.labelTooBig'
  | 'warn.labelOverScrew'
  | 'warn.labelOnParting'
  | 'warn.labelOverOpening'
  | 'warn.labelOnBed'
  | 'warn.labelsOverlap'
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

/** An axis-aligned box in the case frame, mm. */
export interface SpotBox {
  min: readonly [number, number, number];
  max: readonly [number, number, number];
}

/**
 * Where a message points on the model: red boxes over the place and a badge
 * at `at`, case frame. `holder` is what the place moves with in the
 * exploded view: the body, the lid, or a board (index) — with the lid when
 * the lid holds it.
 */
export interface MessageSpot {
  at: readonly [number, number, number];
  boxes: readonly SpotBox[];
  holder: 'body' | 'lid' | { board: number };
}

export interface Message {
  code: MessageCode;
  params?: Readonly<Record<string, string | number>>;
  spot?: MessageSpot;
}

/** A spot over one box: the badge on the middle of its top. */
export function boxSpot(box: SpotBox, holder: MessageSpot['holder']): MessageSpot {
  return { at: [(box.min[0] + box.max[0]) / 2, (box.min[1] + box.max[1]) / 2, box.max[2]], boxes: [box], holder };
}

/** A spot over boxes: the badge on the first one (none without boxes). */
export function spotOf(boxes: readonly SpotBox[], holder: MessageSpot['holder']): MessageSpot | undefined {
  const [first] = boxes;
  return first ? { ...boxSpot(first, holder), boxes } : undefined;
}

/** The box around points. */
export function boxAround(points: readonly (readonly number[])[]): SpotBox {
  const min = [0, 1, 2].map((k) => Math.min(...points.map((p) => p[k])));
  const max = [0, 1, 2].map((k) => Math.max(...points.map((p) => p[k])));
  return { min: [min[0], min[1], min[2]], max: [max[0], max[1], max[2]] };
}

/** A board in a message: its number and its name (the UI puts them together); `key` for a second board. */
export function boardParams(board: { index: number; def: { name: string } }, key = 'board'): Record<string, string | number> {
  return { [key]: board.index + 1, [`${key}Name`]: board.def.name };
}
