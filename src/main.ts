// Entry point: state → worker → renderer and panel.
//
// Every solid of a case comes out of a boolean, so the main thread builds no
// geometry at all: it sends the state to the CSG worker after a short pause
// (PREVIEW_DELAY_MS) and draws what comes back. The preview is the exact
// case at a coarser arc resolution — the same pipeline that goes to the STL.

import './style.css';
import { el, make } from './ui/dom';
import { createScene } from './render/scene';
import type { SceneCaption, ScenePart, SceneSpot } from './render/scene';
import { renderControls } from './ui/controls';
import type { Control, ControlsHandle } from './ui/controls';
import { caseControls } from './ui/caseCard';
import { lidControls } from './ui/lidCard';
import type { HalfView } from './ui/hingeCard';
import { angleControls, halfControls, hingeControls } from './ui/hingeCard';
import { renderBoardsCard } from './ui/boardsCard';
import type { BoardsCardHandle } from './ui/boardsCard';
import { renderBoardList } from './ui/boardPicker';
import { defaultCustomBoard } from './ui/customBoard';
import { addCut, renderCutsCard } from './ui/cutsCard';
import { renderExtras } from './ui/extrasCards';
import type { ExtrasHandle } from './ui/extrasCards';
import { labelRaster } from './ui/labelRaster';
import type { LabelRaster } from './geo/label';
import { labelBox, labelPlacement } from './geo/label';
import { SCREWS } from './geo/fasteners';
import { screwShape } from './geo/thread';
import { extrasWarnings, faceSpot, flatRegion } from './geo/extras';
import type { CutsCardHandle } from './ui/cutsCard';
import { cutWarnings, outerTopAt, portCutters } from './geo/ports';
import { extraCutters, MAX_EXTRA_CUTS } from './geo/cutters';
import { effectiveLid } from './geo/layout';
import { HEAD_FLOOR, headSeat, lidFaces } from './geo/lidSpec';
import { headLimitsOf, lidPosts } from './geo/lidPosts';
import { postCollisions, postsInOpenings, printedScrewWarnings } from './geo/fastening';
import { setupAdjustmentButtons } from './ui/adjust';
import { createProgress } from './ui/progress';
import { renderPresetList } from './ui/presetList';
import type { PresetRow } from './ui/presetList';
import { applyStaticText } from './ui/staticText';
import { ENDONYMS, LANGS, initLang, isLang, lang, onLangChange, setLang, t, tDynamic, tm, autoPresetPrefixes } from './i18n';
import type { Key } from './i18n';
import type { Message, MessageSpot } from './geo/message';
import { faceFrame } from './geo/face';
import { caseLayout, collisions, heldByLid, lidDepthMax, placeBoards } from './geo/layout';
import { boardGhost, portCaptionAnchor, spotMesh, standoffGhost } from './geo/ghost';
import {
  MAX_BOARDS, NEW_BOARD_GAP, backPortDefault, boardOf, defaultPlacement, ownPortDefault, portCut, withBackCut, withPortCut, withTopCut,
} from './boards/placement';
import type { BoardDef } from './boards/schema';
import { resolveVariant } from './boards/schema';
import { catalogBoard } from './boards/catalog';
import type { LidPlace, PrintArrange } from './geo/print';
import { LID_PLACES, PRINT_GAP_MAX, PRINT_GAP_MIN, bodyForPrint, bothForPrint, lidWithScrews, screwsInCase, withClamps } from './geo/print';
import { capsInCase, keyCaps, withCaps } from './geo/caps';
import { restWarnings } from './geo/rests';
import type { Affine, SurfaceMesh } from './geo/surface';
import { IDENTITY, applyAffine, composeAffine, meshBounds, mergeMeshes, rotateVec, transformMesh, translation } from './geo/surface';
import { ANGLE_DEFAULT, foldOf, upperPose } from './geo/hinge';
import { encodeSTL } from './geo/stl';
import { assessExport, validateMesh } from './geo/validate';
import type { AppState, ExportMode } from './state/schema';
import { defaultState, sanitizeState, RESOLUTIONS } from './state/schema';
import { PRESETS, presetById } from './state/presets';
import { encodePresetFile, decodePresetFile, presetFileName } from './state/presetFile';
import type { UserPreset } from './state/userPresets';
import { loadUserPresets, saveUserPresets, nextPresetNumber } from './state/userPresets';
import { History } from './state/history';
import type { Half } from './state/hinged';
import { casesOf, halfState, isHinged, withHalf } from './state/hinged';
import type { JobPart } from './worker/protocol';
import { CsgClient } from './worker/client';

/** Segments per quarter arc in the preview. */
const PREVIEW_SEGMENTS = 12;
/** Pause after the last edit before the worker rebuilds the case. */
const PREVIEW_DELAY_MS = 120;
/** Quiet time before a change becomes an undo step: a slider drag is one action. */
const HISTORY_DELAY_MS = 500;
/** How far the lid floats off the case in the exploded view, mm. */
const LIFT_MM = 30;

type ViewMode = 'exploded' | 'assembled' | 'print';

// The language comes before any rendering: the panel is built in it.
initLang();
applyStaticText(document);

const view = el('view', HTMLCanvasElement);
const panel = el('panel', HTMLElement);
const caseParams = el('caseParams', HTMLDivElement);
const boardCards = el('boardCards', HTMLDivElement);
const boardAdd = el('boardAdd', HTMLButtonElement);
const boardCustom = el('boardCustom', HTMLButtonElement);
const boardPicker = el('boardPicker', HTMLDivElement);
const boardPickerClose = el('boardPickerClose', HTMLButtonElement);
const boardSearch = el('boardSearch', HTMLInputElement);
const boardList = el('boardList', HTMLDivElement);
const viewBoards = el('viewBoards', HTMLInputElement);
const cutCards = el('cutCards', HTMLDivElement);
const extraOpenings = el('extraOpenings', HTMLDivElement);
const extraMounting = el('extraMounting', HTMLDivElement);
const cutAdd = el('cutAdd', HTMLButtonElement);
const lidParams = el('lidParams', HTMLDivElement);
const hingeCard = el('hingeCard', HTMLElement);
const hingeParams = el('hingeParams', HTMLDivElement);
const halfBar = el('halfBar', HTMLElement);
const halfParams = el('halfParams', HTMLDivElement);
const angleParams = el('angleParams', HTMLDivElement);
const printParams = el('printParams', HTMLDivElement);
const resolutionSel = el('resolution', HTMLSelectElement);
const exportBtn = el('exportBtn', HTMLButtonElement);
const partList = el('partList', HTMLUListElement);
const statusEl = el('status', HTMLParagraphElement);
const auditEl = el('audit', HTMLParagraphElement);
const warningsEl = el('warnings', HTMLDivElement);
const blockersEl = el('blockers', HTMLParagraphElement);
const presetBtn = el('presetBtn', HTMLButtonElement);
const presetsPanel = el('presets', HTMLDivElement);
const presetsClose = el('presetsClose', HTMLButtonElement);
const presetList = el('presetList', HTMLDivElement);
const saveBtn = el('saveBtn', HTMLButtonElement);
const fileOpenBtn = el('fileOpenBtn', HTMLButtonElement);
const fileSaveBtn = el('fileSaveBtn', HTMLButtonElement);
const fileInput = el('fileInput', HTMLInputElement);
const undoBtn = el('undoBtn', HTMLButtonElement);
const redoBtn = el('redoBtn', HTMLButtonElement);
const viewButtons: Record<ViewMode, HTMLButtonElement> = {
  exploded: el('viewExploded', HTMLButtonElement),
  assembled: el('viewAssembled', HTMLButtonElement),
  print: el('viewPrint', HTMLButtonElement),
};
const viewCaption = el('viewCaption', HTMLButtonElement);
const viewRow = el('viewRow', HTMLDivElement);
const viewBoardsLabel = el('viewBoardsLabel', HTMLLabelElement);
const exportCard = el('exportCard', HTMLElement);
/** How the case is shown — a view setting, not part of the project. */
let viewMode: ViewMode = 'exploded';
const viewXray = el('viewXray', HTMLInputElement);
const viewPortNames = el('viewPortNames', HTMLInputElement);
const viewWarnings = el('viewWarnings', HTMLInputElement);
const viewWarningsLabel = el('viewWarningsLabel', HTMLLabelElement);
const viewPortNamesLabel = el('viewPortNamesLabel', HTMLLabelElement);
const langSel = el('langSel', HTMLSelectElement);
const tabs: Record<ExportMode, HTMLButtonElement> = {
  body: el('tabBody', HTMLButtonElement),
  lid: el('tabLid', HTMLButtonElement),
  both: el('tabBoth', HTMLButtonElement),
};
const progress = createProgress({
  wrap: el('progressWrap', HTMLDivElement),
  fill: el('progressFill', HTMLDivElement),
  label: el('progressLabel', HTMLSpanElement),
});

const scene = createScene(view, el('portCaptions', HTMLDivElement));
const csg = new CsgClient();
const history = new History<AppState>(defaultState());
let state: AppState = history.value;

setupAdjustmentButtons(panel);

// --- the panel: built at startup and again on every language switch ---

let caseRows: ControlsHandle<AppState>;
let lidRows: ControlsHandle<AppState>;
let printRows: ControlsHandle<AppState>;
let hingeRows: ControlsHandle<AppState>;
let halfRows: ControlsHandle<HalfView>;
let angleRows: ControlsHandle<HalfView>;

/** Which half of a hinged case the cards edit, and how far it is open in the view — view settings, not the project. */
let halfView: HalfView = { half: 'a', angle: ANGLE_DEFAULT };

/** The case the cards edit: the state itself, or the half of a hinged case being edited. */
function edited(from: AppState = state): AppState {
  return isHinged(from) ? halfState(from, halfView.half) : from;
}

/** What a card did to the case it edits, into the state. */
function applyEdit(next: AppState): void {
  applyState(isHinged(state) ? withHalf(state, halfView.half, next) : next);
}

function setHalfView(next: HalfView): void {
  const switched = next.half !== halfView.half;
  halfView = next;
  halfRows.sync(halfView);
  angleRows.sync(halfView);
  if (switched) syncCards();
  else drawParts();
}

/**
 * Where the lid lies next to the body in the Both STL — the only parts tab
 * with two parts on the bed. Set where it is seen: in the print layout.
 */
function printControls(): Control<AppState>[] {
  const both = (s: AppState): boolean => s.exportMode === 'both';
  const notPrint = (s: AppState): boolean => effectiveView(s.exportMode) !== 'print';
  return [
    {
      kind: 'segmented', key: 'lid', label: 'print.lid', hint: 'print.lid.hint', when: both, disabled: notPrint,
      options: LID_PLACES.map((place) => ({ value: place, label: `print.lid.${place}` as const })),
      get: (s) => s.print.lid,
      set: (s, value) => ({ ...s, print: { ...s.print, lid: LID_PLACES.find((place): place is LidPlace => place === value) ?? s.print.lid } }),
    },
    {
      kind: 'range', key: 'gap', label: 'print.gap', hint: 'print.gap.hint', when: both, disabled: notPrint, min: PRINT_GAP_MIN, max: PRINT_GAP_MAX, step: 1,
      get: (s) => s.print.gap,
      set: (s, value) => ({ ...s, print: { ...s.print, gap: value } }),
    },
  ];
}
let boardRows: BoardsCardHandle;
let cutRows: CutsCardHandle;
let extraRows: ExtrasHandle;

function renderPanel(): void {
  caseRows = renderControls(caseParams, caseControls(), () => state, (next) => applyState(next), 'case');
  hingeRows = renderControls(hingeParams, hingeControls(), () => state, (next) => applyState(next), 'hinge');
  halfRows = renderControls(halfParams, halfControls(), () => halfView, setHalfView, 'edit');
  angleRows = renderControls(angleParams, angleControls(), () => halfView, setHalfView, 'view');
  boardRows = renderBoardsCard(boardCards, () => edited(), applyEdit,
    (text, name) => download(text, name, 'application/json'));
  cutRows = renderCutsCard(cutCards, () => edited(), applyEdit);
  extraRows = renderExtras(extraOpenings, extraMounting, () => edited(), applyEdit);
  lidRows = renderControls(lidParams, lidControls(), () => edited(), applyEdit, 'lid');
  printRows = renderControls(printParams, printControls(), () => state, (next) => applyState(next), 'print');
}
renderPanel();

function applyState(next: AppState, record = true): void {
  state = sanitizeState(next);
  if (record) rememberLater(state);
  else history.replace(state);
  syncPanel();
}

function syncPanel(): void {
  caseRows.sync(state);
  const hinged = isHinged(state);
  hingeCard.hidden = !hinged;
  halfBar.hidden = !hinged;
  angleParams.hidden = !hinged;
  hingeRows.sync(state);
  halfRows.sync(halfView);
  angleRows.sync(halfView);
  syncCards();
  printRows.sync(state);
  for (const [mode, tab] of Object.entries(tabs)) tab.setAttribute('aria-selected', String(mode === state.exportMode));
  syncView();
  resolutionSel.value = String(state.resolution);
  updateHistoryButtons();
  refresh();
}

/** The cards that edit one case: the state's, or the half being edited. */
function syncCards(): void {
  const one = edited();
  boardRows.sync(one);
  lidRows.sync(one);
  boardAdd.disabled = one.boards.length >= MAX_BOARDS;
  boardCustom.disabled = boardAdd.disabled;
  cutRows.sync(one);
  extraRows.sync(one);
  cutAdd.disabled = one.extraCuts.length >= MAX_EXTRA_CUTS;
}

let historyTimer: ReturnType<typeof setTimeout> | null = null;

function rememberLater(next: AppState): void {
  if (historyTimer) clearTimeout(historyTimer);
  historyTimer = setTimeout(() => {
    history.push(next);
    updateHistoryButtons();
  }, HISTORY_DELAY_MS);
}

function updateHistoryButtons(): void {
  undoBtn.disabled = !history.canUndo;
  redoBtn.disabled = !history.canRedo;
}

// --- preview ---

let previewTimer: ReturnType<typeof setTimeout> | null = null;
/** Grows with every rebuild: a late answer from an old build must not overwrite a fresh one. */
let generation = 0;
/** The generation whose build has answered (a preview or an error) — for scripts/snap.mjs. */
let settled = 0;
/** The parts the worker built for one case — the state's, or a half of a hinged one (in that half's frame). */
interface BuiltCase {
  half: Half | null;
  body: SurfaceMesh;
  lid: SurfaceMesh;
  screw: SurfaceMesh | null;
  clamps: SurfaceMesh | null;
  lidClamps: SurfaceMesh | null;
}
/** The last preview from the worker, kept so view toggles redraw without a rebuild. */
let lastParts: { state: AppState; cases: BuiltCase[] } | null = null;
/** The labels' rasters for the current state (a single case's is the lower half's) — the worker gets them with every job. */
let currentLabels: Record<Half, LabelRaster | null> = { a: null, b: null };
/** Board ghosts and their port captions per case — drawn at once, the case follows from the worker. */
let ghostGroups: GhostGroup[] = [];
/** A line of the warnings list: its text, and whether it only informs (grey, ℹ, not counted). */
interface Notice {
  text: string;
  info: boolean;
  /** where it points on the model */
  spot?: MessageSpot;
  /** its badge's number, given in list order to the lines with a spot */
  n?: number;
  /** a hinged case: the half whose frame the spot is in */
  half?: Half;
}
const notice = (message: Message): Notice => ({
  text: tm(message), info: message.code.startsWith('info.'), ...(message.spot ? { spot: message.spot } : {}),
});
const said = (key: Key, params?: Readonly<Record<string, string | number>>): Notice => ({ text: t(key, params), info: key.startsWith('info.') });
/** Warnings the panel computes itself, before the worker answers. */
let baseWarnings: Notice[] = [];

/** A line of one half of a hinged case: it says which, and its spot is posed with that half. */
function inHalf(line: Notice, half: Half): Notice {
  return { ...line, text: t('half.line', { half: t(`half.${half}`), text: line.text }), half };
}

/** What the panel says about one case (the state's, or a half of a hinged one) before the worker answers. */
function caseNotices(one: AppState, label: LabelRaster | null): Notice[] {
  const out: Notice[] = [];
  const layout = caseLayout(one);
  const { dims } = layout;
  const depthMax = lidDepthMax(one.shape, one.lid, dims);
  if (one.lid.depth > depthMax) out.push(said('warn.depthClamped', { max: depthMax.toFixed(1) }));
  out.push(...collisions(layout).map(notice));
  out.push(...restWarnings(layout, one.shape.floor).map(notice));
  const shapeBuilt = { ...one.shape, console: layout.console };
  const top = outerTopAt(shapeBuilt, dims, layout.console.frontH, layout.console.backH);
  const cutters = [...portCutters(layout, shapeBuilt), ...extraCutters(one.extraCuts, shapeBuilt, dims, top)];
  const lidBuilt = effectiveLid(shapeBuilt, one.lid, dims);
  if (lidBuilt.depth > one.lid.depth + 0.01) out.push(said('info.depthRaised', { d: lidBuilt.depth.toFixed(1) }));
  if (one.lid.face !== one.lid.chosen && !lidFaces(one.shape.kind).includes(one.lid.chosen)) {
    out.push(said('info.lidFaceMoved', { chosen: t(`face.${one.lid.chosen}`), face: t(`face.${one.lid.face}`) }));
  }
  out.push(...cutWarnings(layout, shapeBuilt, lidBuilt, cutters, one.extraCuts).map(notice));
  if (lidBuilt.fastening !== 'snaps') {
    const { frame, plate, zp, spots } = lidPosts(one);
    const limits = headLimitsOf(one);
    if (lidBuilt.fastening === 'screws' && lidBuilt.screw.head !== 'none' && headSeat(lidBuilt).d > limits.d + 1e-6) {
      out.push(said('warn.headDClamped', { max: limits.d.toFixed(1) }));
    }
    // the table's depth was always capped quietly; a depth the user set is worth a word
    if (lidBuilt.fastening === 'screws' && lidBuilt.screw.head === 'counterbore' && lidBuilt.head.depth !== null
      && headSeat(lidBuilt).depth > plate - HEAD_FLOOR) {
      out.push(said('warn.headDepthClamped', { max: (plate - HEAD_FLOOR).toFixed(1) }));
    }
    out.push(...postCollisions(spots, frame, zp, plate, lidBuilt, layout.boards).map(notice));
    out.push(...postsInOpenings(spots, frame, zp, plate, lidBuilt, cutters).map(notice));
  }
  out.push(...printedScrewWarnings(lidBuilt).map(notice));
  out.push(...extrasWarnings(state, shapeBuilt, layout, lidBuilt).map(notice));
  if (label) {
    const place = labelPlacement(one.label, label, lidBuilt.face, dims, shapeBuilt);
    const region = flatRegion(shapeBuilt, dims, lidBuilt.face, 0);
    const { hw, hh } = labelBox(place.w, place.h, one.label.angle);
    const labelSpot = faceSpot(lidBuilt.face, dims, shapeBuilt, lidBuilt, place.u - hw, place.v - hh, place.u + hw, place.v + hh);
    if (place.u - hw < region.u0 || place.u + hw > region.u1 || place.v - hh < region.v0 || place.v + hh > region.v1) {
      out.push(notice({ code: 'warn.labelTooBig', spot: labelSpot }));
    }
    // a screw head on the lid: the label must keep clear of it
    const head = lidBuilt.fastening === 'screws' ? (lidBuilt.screw.head === 'none' ? SCREWS[lidBuilt.screw.size].headD : headSeat(lidBuilt).d) / 2 + 0.5
      : lidBuilt.fastening === 'printed' ? screwShape(lidBuilt.thread.size, 0, 0).headD / 2 + 0.5 : 0;
    if (head > 0 && lidPosts(one).spots.some((spot) => {
      const du = Math.max(0, Math.abs(spot.centre[0] - place.u) - hw);
      const dv = Math.max(0, Math.abs(spot.centre[1] - place.v) - hh);
      return Math.hypot(du, dv) < head;
    })) {
      out.push(notice({ code: 'warn.labelOverScrew', spot: labelSpot }));
    }
  }
  return out;
}

/** The board ghosts of one case and their port captions, in its own frame. */
interface GhostGroup {
  half: Half | null;
  parts: ScenePart[];
  /** which parts and captions the lid holds (a board hung under a top lid): exploded, they go with it */
  partsOnLid: boolean[];
  captions: SceneCaption[];
  captionsOnLid: boolean[];
}

function caseGhosts(one: AppState, half: Half | null): GhostGroup {
  const layout = caseLayout(one);
  const numbered = layout.boards.length > 1;
  const captions = layout.boards.flatMap((board) => board.def.ports.map((port): SceneCaption => ({
    // a board on a display's back: its own toggles, under the display's number; the upper half's start with 'u'
    key: `${half === 'b' ? 'u' : ''}${board.index}${board.carried ? 't' : board.attached !== undefined ? 'b' : ''}:${port.id}`,
    text: `${numbered ? `${board.index + 1}: ` : ''}${tDynamic(`port.${port.type}`)} · ${port.id}`,
    at: portCaptionAnchor(board, port),
    dim: !portCut(board.placement, port.id, port.cut),
  })));
  const captionsOnLid = layout.boards.flatMap((board) => board.def.ports.map(() => heldByLid(board, one.lid.face)));
  const groups = layout.boards.map((board) => {
    const ghost = boardGhost(board);
    const standoffs = standoffGhost(board);
    const parts: ScenePart[] = [
      { role: 'board', mesh: ghost.pcb },
      ...(ghost.glass ? [{ role: 'glass' as const, mesh: ghost.glass }] : []),
      ...(standoffs ? [{ role: 'glass' as const, mesh: standoffs }] : []),
      ...(ghost.ports ? [{ role: 'port' as const, mesh: ghost.ports }] : []),
    ];
    return { parts, onLid: heldByLid(board, one.lid.face) };
  });
  return {
    half,
    parts: groups.flatMap((group) => group.parts),
    partsOnLid: groups.flatMap((group) => group.parts.map(() => group.onLid)),
    captions,
    captionsOnLid,
  };
}

function refresh(): void {
  generation++;
  const stamp = generation;
  const cases = casesOf(state);
  const dims = cases.map((one) => caseLayout(one.state).dims);
  statusEl.textContent = isHinged(state)
    ? t('status.sizeHinged', { w: Math.round(dims[0].w), d: Math.round(dims[0].d), ha: Math.round(dims[0].h), hb: Math.round(dims[1].h) })
    : t('status.size', { w: Math.round(dims[0].w), d: Math.round(dims[0].d), h: Math.round(dims[0].h) });

  baseWarnings = [];
  currentLabels = { a: null, b: null };
  for (const { half, state: one } of cases) {
    const label = labelRaster(one.label, () => refresh());
    currentLabels[half ?? 'a'] = label;
    const notices = caseNotices(one, label);
    baseWarnings.push(...(half ? notices.map((line) => inHalf(line, half)) : notices));
  }
  showWarnings([]);
  ghostGroups = cases.map(({ half, state: one }) => caseGhosts(one, half));
  drawParts();
  renderPartList();

  auditEl.textContent = t('audit.building');
  if (previewTimer) clearTimeout(previewTimer);
  previewTimer = setTimeout(() => void showPreview(stamp), PREVIEW_DELAY_MS);
}

/** The lines shown now, numbered; the one hovered and the one picked (a tap on its badge or line). */
let shownNotices: Notice[] = [];
let hoveredWarning: number | null = null;
let pickedWarning: number | null = null;
const activeWarning = (): number | null => hoveredWarning ?? pickedWarning;

function showWarnings(extra: Notice[]): void {
  let count = 0;
  shownNotices = [...baseWarnings, ...extra].map((line) => (line.spot ? { ...line, n: ++count } : line));
  if (pickedWarning !== null && pickedWarning > count) pickedWarning = null;
  const all = shownNotices;
  const warned = all.filter((line) => !line.info).length;
  const noted = all.length - warned;
  const counts = [...(warned ? [t('status.warnings', { n: warned })] : []), ...(noted ? [t('status.notes', { n: noted })] : [])];
  warningsEl.replaceChildren(
    ...(all.length > 1 ? [make('div', 'warn-head', counts.join(' · '))] : []),
    ...all.map((line) => {
      const row = make('div', line.info ? 'warn-line info' : 'warn-line');
      if (line.n !== undefined) {
        const n = line.n;
        row.dataset.warn = String(n);
        row.append(make('span', line.info ? 'warn-num info' : 'warn-num', `${line.info ? 'ℹ' : '⚠'} ${n}`));
        row.addEventListener('mouseenter', () => hoverWarning(n));
        row.addEventListener('mouseleave', () => hoverWarning(null));
        row.addEventListener('click', () => pickWarning(n));
      }
      row.append(line.info && line.n === undefined ? `ℹ ${line.text}` : line.text);
      return row;
    }),
  );
  drawWarnings();
}

function hoverWarning(n: number | null): void {
  hoveredWarning = n;
  drawWarnings();
}

/** A tap on a badge or a line opens its message; again, closes it. */
function pickWarning(n: number): void {
  pickedWarning = pickedWarning === n ? null : n;
  drawWarnings();
}

/** Where the last drawParts put things: a holder's frame in the view, in its half (null in the print layout). */
let placeInView: ((holder: MessageSpot['holder'], half: Half | undefined) => Affine) | null = null;
/** The port captions the last drawParts showed: the badges join them. */
let shownPortCaptions: SceneCaption[] = [];

/** The warnings' red boxes and badges over the model, the active one bright and open. */
function drawWarnings(): void {
  const place = viewWarnings.checked ? placeInView : null;
  const active = activeWarning();
  for (const row of warningsEl.querySelectorAll<HTMLElement>('[data-warn]')) row.classList.toggle('hot', Number(row.dataset.warn) === active);
  const spotted = place ? shownNotices.flatMap((line) => (line.spot && line.n !== undefined ? [{ ...line, spot: line.spot, n: line.n }] : [])) : [];
  // a note's place shows only when it is picked: the red is for what needs a look
  scene.setSpots(place ? spotted.flatMap((line): SceneSpot[] => (line.info && line.n !== active ? [] : [{
    mesh: transformMesh(spotMesh(line.spot), place(line.spot.holder, line.half)), offset: [0, 0, 0], hot: line.n === active,
  }])) : []);
  scene.setCaptions([...shownPortCaptions, ...(place ? spotted.map((line): SceneCaption => {
    const badge = `${line.info ? 'ℹ' : '⚠'} ${line.n}`;
    return {
      key: `warn:${line.n}`,
      text: line.n === active ? `${badge} ${line.text}` : badge,
      at: applyAffine(place(line.spot.holder, line.half), line.spot.at),
      dim: false,
      warn: { open: line.n === active, info: line.info },
    };
  }) : [])]);
}

async function showPreview(stamp: number): Promise<void> {
  const requested = state;
  try {
    const result = await progress.track(
      (onProgress) => csg.run({
        kind: 'preview', state: requested, segments: PREVIEW_SEGMENTS, label: currentLabels.a, labelB: currentLabels.b,
      }, onProgress),
      { label: 'progress.preview' },
    );
    if (!result || stamp !== generation) return;
    settled = stamp;
    const cases = builtCases(result.parts);
    lastParts = { state: requested, cases };
    drawParts();
    audit(cases.flatMap(caseMeshes), result.ms);
  } catch (error) {
    if (stamp !== generation) return;
    settled = stamp;
    auditEl.textContent = '';
    blockersEl.textContent = t('error.build', { error: message(error) });
    exportBtn.disabled = true;
  }
}

/** The worker's parts sorted into cases: one, or a hinged case's two halves. */
function builtCases(parts: JobPart[]): BuiltCase[] {
  const halves: (Half | null)[] = parts.some((part) => part.half) ? ['a', 'b'] : [null];
  return halves.map((half): BuiltCase => {
    const own = parts.filter((part) => (part.half ?? null) === half);
    return {
      half,
      body: toMesh(partById(own, 'body')),
      lid: toMesh(partById(own, 'lid')),
      screw: optionalPart(own, 'screw'),
      clamps: optionalPart(own, 'clamp'),
      lidClamps: optionalPart(own, 'lidClamp'),
    };
  });
}

function caseMeshes(one: BuiltCase): SurfaceMesh[] {
  return [one.body, one.lid, ...[one.screw, one.clamps, one.lidClamps].flatMap((mesh) => (mesh ? [mesh] : []))];
}

/** Where the last print layout of Both put the lid: the caption names it (auto decides by the meshes). */
let lidPlaced: 'right' | 'behind' = 'right';

/**
 * The parts on the bed as the parts tab picks them — the print layout of the
 * view and of the STL: Both is body, lid, printed screws and every clamp bar;
 * Body is the body and the bars that go into it (batteries', a panel's the
 * body holds); Lid is the lid, its screws and the bars of a panel it holds.
 */
function printParts(built: AppState, one: BuiltCase, arrange: PrintArrange = built.print): ScenePart[] {
  const { body, lid, screw, clamps, lidClamps } = one;
  const layout = caseLayout(built);
  const { dims } = layout;
  const shape = { kind: built.shape.kind, console: layout.console };
  const face = built.lid.face;
  const count = screw ? lidPosts(built).spots.length : 0;
  const roles = (meshes: SurfaceMesh[], names: ScenePart['role'][]): ScenePart[] =>
    meshes.map((mesh, i): ScenePart => ({ role: names[i] ?? 'screw', mesh }));
  // printed key caps print with the lid, after everything else on its bed
  const caps = built.exportMode === 'body' ? [] : keyCaps(layout, { ...built.shape, console: layout.console });
  const capped = (parts: ScenePart[]): ScenePart[] => {
    const placed = withCaps(parts.map((part) => part.mesh), caps, arrange.gap);
    return placed.length > parts.length ? [...parts, { role: 'cap', mesh: placed[placed.length - 1] }] : parts;
  };
  if (built.exportMode === 'lid') {
    const lidParts = lidWithScrews(lid, screw, count, face, dims);
    return capped(roles(withClamps(lidParts, lidClamps), [...(['lid', 'screw'] as const).slice(0, lidParts.length), 'clamp']));
  }
  const both = built.exportMode === 'both' ? bothForPrint(body, lid, screw, count, face, dims, shape, arrange) : null;
  if (both) lidPlaced = both.place;
  const placed = both ? both.parts : [bodyForPrint(body, face, dims, shape)];
  const names: ScenePart['role'][] = built.exportMode === 'both' ? ['body', 'lid', 'screw'] : ['body'];
  const bars = built.exportMode === 'both' && lidClamps ? (clamps ? mergeMeshes([clamps, lidClamps]) : lidClamps) : clamps;
  const withClampBars = withClamps(placed, bars);
  return capped(roles(withClampBars, [...names.slice(0, placed.length), 'clamp']));
}

/** Every case's parts on one bed: a hinged case's upper half behind the lower one. */
function printAll(built: AppState, cases: BuiltCase[], arrange: PrintArrange = built.print): ScenePart[] {
  const out: ScenePart[] = [];
  for (const one of cases) {
    const parts = printParts(one.half ? halfState(built, one.half) : built, one, arrange);
    const behind = out.length > 0 ? Math.max(...out.map((part) => meshBounds(part.mesh).max[1])) + arrange.gap : 0;
    out.push(...(behind > 0 ? parts.map((part): ScenePart => ({ ...part, mesh: transformMesh(part.mesh, translation(0, behind, 0)) })) : parts));
  }
  return out;
}

/** A part the worker sends only sometimes (printed screws, battery clamps), as a mesh. */
function optionalPart(parts: JobPart[], id: JobPart['id']): SurfaceMesh | null {
  const found = parts.find((part) => part.id === id);
  return found ? toMesh(found) : null;
}

function partById(parts: JobPart[], id: JobPart['id']): JobPart {
  const found = parts.find((part) => part.id === id);
  if (!found) throw new Error(`the worker sent no ${id}`);
  return found;
}

/** Where a half lies in the view: the lower half (or a single case) where it is built, the upper one open by the view's angle. */
function poseOf(built: AppState, half: Half | null): Affine {
  if (half !== 'b') return IDENTITY;
  const a = caseLayout(halfState(built, 'a')).dims;
  const b = caseLayout(halfState(built, 'b')).dims;
  return upperPose(foldOf(a.d, a.h, b.h, built.hinge.gap), halfView.angle);
}

type Vec = [number, number, number];
const plus = (p: readonly number[], q: readonly number[]): Vec => [p[0] + q[0], p[1] + q[1], p[2] + q[2]];

/**
 * Draws the last preview. The parts tab decides what — both parts, the body
 * with its boards, or the lid alone; the view decides how — exploded,
 * assembled, or laid out as in the STL (as far as it means anything for the
 * parts shown: see `effectiveView`). A hinged case draws both halves, the
 * upper one open by the view's angle.
 */
function drawParts(): void {
  if (!lastParts) return;
  const { state: built, cases } = lastParts;
  const showBody = built.exportMode !== 'lid';
  const showLid = built.exportMode !== 'body';
  const mode = effectiveView(built.exportMode);
  if (mode === 'print') {
    // the lid's place changes no part: the current one, before the worker answers
    show(printAll(built, cases, state.print));
    // the parts are turned on the bed: no place in the case is a place there
    placeInView = null;
    shownPortCaptions = [];
    drawWarnings();
    // auto has just decided where the lid goes
    viewCaption.textContent = describeView(state);
    return;
  }
  const parts: ScenePart[] = [];
  const captions: SceneCaption[] = [];
  const withBoards = showBody && viewBoards.checked;
  const lidLift = showLid && mode === 'exploded' ? LIFT_MM : 0;
  /** per case: what a spot's holder is posed by — the case's pose, and the lid's lift when the lid holds it */
  const holders = new Map<Half | null, (holder: MessageSpot['holder']) => Affine>();
  for (const one of cases) {
    const own = one.half ? halfState(built, one.half) : built;
    const layout = caseLayout(own);
    const { dims } = layout;
    const pose = poseOf(built, one.half);
    const posed = (part: ScenePart): ScenePart => (pose === IDENTITY ? part
      : { ...part, mesh: transformMesh(part.mesh, pose), offset: rotateVec(pose, part.offset ?? [0, 0, 0]) });
    // exploded with the lid shown, the boards the lid holds go with it
    const n = faceFrame(own.lid.face, dims).n;
    const lifted = (onLid: boolean | undefined, share = 1): Vec => (onLid
      ? [n[0] * lidLift * share, n[1] * lidLift * share, n[2] * lidLift * share] : [0, 0, 0]);
    const group = ghostGroups.find((candidate) => candidate.half === one.half);
    const local: ScenePart[] = [];
    if (showBody) {
      local.push({ role: 'body', mesh: one.body });
      if (withBoards && group) {
        local.push(...group.parts.map((ghost, i): ScenePart => ({ ...ghost, offset: plus(ghost.offset ?? [0, 0, 0], lifted(group.partsOnLid[i])) })));
      }
      // battery clamps on their posts; exploded, lifted off the battery (a panel's bars under a slope stay put)
      const liftedBars = mode === 'exploded' && own.boards.some((board) => board.board === 'battery');
      if (one.clamps) local.push({ role: 'clamp', mesh: one.clamps, offset: [0, 0, liftedBars ? LIFT_MM / 2 : 0] });
    }
    if (showLid && showBody) {
      local.push({ role: 'lid', mesh: one.lid, offset: lifted(true) });
      // a panel's clamp bars belong to the lid that holds it; exploded, halfway out, under the panel
      if (one.lidClamps) local.push({ role: 'clamp', mesh: one.lidClamps, offset: lifted(true, 0.5) });
      // printed screws in their holes; exploded, they hover over the lifted lid
      const posts = one.screw ? lidPosts(own).spots.map((spot) => spot.centre) : [];
      const screws = one.screw ? screwsInCase(one.screw, posts, own.lid.face, dims, 2 * lidLift) : null;
      if (screws) local.push({ role: 'screw', mesh: screws });
      // printed key caps in their holes; exploded, over the lifted lid
      const caps = capsInCase(keyCaps(layout, { ...own.shape, console: layout.console }), n, 2 * lidLift);
      if (caps) local.push({ role: 'cap', mesh: caps });
    }
    parts.push(...local.map(posed));
    if (withBoards && viewPortNames.checked && group) {
      captions.push(...group.captions.map((caption, i): SceneCaption => ({
        ...caption, at: applyAffine(pose, plus(caption.at, lifted(group.captionsOnLid[i]))),
      })));
    }
    // a spot moves with what holds it: the lid, a board the lid holds, or the body
    holders.set(one.half, (holder) => {
      const board = typeof holder === 'object' ? layout.boards.find((placed) => placed.index === holder.board) : undefined;
      const onLid = holder === 'lid' || (board !== undefined && heldByLid(board, own.lid.face));
      return composeAffine(pose, translation(...lifted(onLid)));
    });
  }
  const lift = gridLift(parts);
  show(lift > 0 ? parts.map((part): ScenePart => ({ ...part, offset: plus(part.offset ?? [0, 0, 0], [0, 0, lift]) })) : parts);
  shownPortCaptions = captions.map((caption): SceneCaption => ({ ...caption, at: plus(caption.at, [0, 0, lift]) }));
  placeInView = (holder, half) => composeAffine(translation(0, 0, lift), (holders.get(half ?? null) ?? (() => IDENTITY))(holder));
  drawWarnings();
}

/**
 * How far the parts go up together so that nothing is under the grid: a
 * bottom lid, exploded, floats below the body — both above the grid.
 */
function gridLift(parts: ScenePart[]): number {
  let low = 0;
  for (const part of parts) {
    const dz = part.offset?.[2] ?? 0;
    const positions = part.mesh.positions;
    for (let i = 2; i < positions.length; i += 3) low = Math.min(low, positions[i] + dz);
  }
  return -low;
}

/** Roles of what was drawn last — for the smoke (window.__case.drawn()). */
let drawnRoles: string[] = [];
/** What was drawn last, meshes and offsets — for the smoke (window.__case.drawnParts()). */
let drawnParts: ScenePart[] = [];

function show(parts: ScenePart[]): void {
  drawnRoles = parts.map((part) => part.role);
  drawnParts = parts;
  scene.setParts(parts);
}

/**
 * The view as it applies to the parts shown. Both parts: any of the three.
 * The body alone: exploded is the same as assembled. The lid alone: no
 * choice at all — it is shown as it prints and as its STL is: outer face
 * down, the skirt up.
 * The chosen mode is kept, so going back to Both brings exploded back.
 */
function effectiveView(parts: ExportMode): ViewMode {
  if (parts === 'lid') return 'print';
  if (parts === 'body' && viewMode === 'exploded') return 'assembled';
  return viewMode;
}

/** The caption over the view: which parts, how, and whether boards are in. */
function describeView(state: AppState): string {
  const parts = state.exportMode;
  const what = t(parts === 'both' ? 'caption.both' : parts === 'body' ? 'caption.body' : 'caption.lid');
  const view = effectiveView(parts);
  if (view === 'print') {
    return `${what} · ${t('caption.print')}${parts === 'both' ? ` · ${t(lidPlaced === 'behind' ? 'caption.lidBehind' : 'caption.lidRight')}` : ''}`;
  }
  const boards = viewBoards.checked && casesOf(state).some((one) => one.state.boards.length > 0) ? ` · ${t('caption.withBoards')}` : '';
  // the body alone has nothing to explode
  if (parts === 'body') return `${what}${boards}`;
  return `${what} · ${t(view === 'exploded' ? 'view.exploded' : 'view.assembled')}${boards}`;
}

function syncView(): void {
  const parts = state.exportMode;
  const view = effectiveView(parts);
  for (const [mode, button] of Object.entries(viewButtons)) button.setAttribute('aria-checked', String(mode === view));
  // only the choices that change something for the parts shown
  viewRow.hidden = parts === 'lid';
  viewButtons.exploded.hidden = parts !== 'both';
  viewBoardsLabel.hidden = parts === 'lid';
  // boards are not printed: the toggle means nothing in the print layout
  viewBoards.disabled = view === 'print';
  // the names hang over the board ghosts: nothing to name without them
  viewPortNamesLabel.hidden = parts === 'lid';
  viewPortNames.disabled = view === 'print' || !viewBoards.checked;
  // the parts are turned in the print layout: a place in the case is not a place there
  viewWarningsLabel.hidden = parts === 'lid';
  viewWarnings.disabled = view === 'print';
  // the lid's place on the bed is seen only there
  printRows.sync(state);
  viewCaption.textContent = describeView(state);
}

/** Verdict over both parts: closed, and nothing that would block the export. */
function audit(meshes: SurfaceMesh[], ms: number): void {
  const reports = meshes.map((mesh) => validateMesh(mesh));
  const assessments = reports.map((report) => assessExport(report, true));
  const triangles = reports.reduce((sum, report) => sum + report.triangleCount, 0);
  const blocking = assessments.flatMap((assessment) => assessment.blocking);
  auditEl.textContent = reports.every((report) => report.watertight)
    ? t('audit.watertight', { k: (triangles / 1000).toFixed(1), ms: Math.round(ms) })
    : t('audit.open');
  showWarnings(assessments.flatMap((assessment) => assessment.warnings).map(notice));
  blockersEl.textContent = blocking.map(tm).join('\n');
  exportBtn.disabled = blocking.length > 0;
}

function renderPartList(): void {
  const rows: [Key, string][] = state.exportMode === 'both'
    ? [['part.both', '']]
    : [[state.exportMode === 'body' ? 'part.body' : 'part.lid', '']];
  partList.replaceChildren(...rows.map(([key, note]) => {
    const item = make('li');
    item.append(make('span', 'part-name', t(key)));
    if (note) item.append(make('span', 'part-note', note));
    return item;
  }));
}

function toMesh(part: JobPart): SurfaceMesh {
  return { positions: part.positions, indices: part.indices, normals: part.normals };
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

for (const [mode, button] of Object.entries(viewButtons)) {
  button.addEventListener('click', () => {
    viewMode = mode === 'assembled' || mode === 'print' ? mode : 'exploded';
    syncView();
    drawParts();
  });
}
viewCaption.addEventListener('click', () => {
  setPanelOpen(true);
  exportCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
viewBoards.addEventListener('change', () => {
  syncView();
  drawParts();
});

// --- board picker ---

function openPicker(): void {
  boardSearch.value = '';
  renderBoardList(boardList, '', addBoard);
  boardPicker.hidden = false;
  boardSearch.focus();
}

function closePicker(): void {
  boardPicker.hidden = true;
}

/** A new board goes to the right of the ones already placed. */
function addBoard(def: BoardDef): void {
  closePicker();
  const one = edited();
  const placed = placeBoards(one);
  const x = placed.length > 0 ? Math.max(...placed.map((board) => board.footprint.x1)) + NEW_BOARD_GAP + 3 : 0;
  applyEdit({ ...one, boards: [...one.boards, defaultPlacement(def, Math.round(x), 0)] });
}

boardAdd.addEventListener('click', openPicker);
boardCustom.addEventListener('click', () => {
  const one = edited();
  const placed = placeBoards(one);
  const x = placed.length > 0 ? Math.max(...placed.map((board) => board.footprint.x1)) + NEW_BOARD_GAP + 3 : 0;
  const custom = defaultCustomBoard();
  applyEdit({ ...one, boards: [...one.boards, { ...defaultPlacement(custom, Math.round(x), 0), board: 'custom', custom }] });
});
cutAdd.addEventListener('click', () => applyEdit(addCut(edited())));
boardPickerClose.addEventListener('click', closePicker);
boardPicker.addEventListener('click', (event) => {
  if (event.target === boardPicker) closePicker();
});
boardSearch.addEventListener('input', () => renderBoardList(boardList, boardSearch.value, addBoard));
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !boardPicker.hidden) closePicker();
});
viewXray.addEventListener('change', () => scene.setXray(viewXray.checked));
viewPortNames.addEventListener('change', drawParts);
viewWarnings.addEventListener('change', drawWarnings);

// --- export ---

for (const [mode, tab] of Object.entries(tabs)) {
  tab.addEventListener('click', () => {
    const exportMode = mode === 'body' || mode === 'lid' ? mode : 'both';
    applyState({ ...state, exportMode });
  });
}

for (const value of RESOLUTIONS) {
  const option = document.createElement('option');
  option.value = String(value);
  option.textContent = String(value);
  resolutionSel.append(option);
}
resolutionSel.addEventListener('change', () => {
  applyState({ ...state, resolution: Number(resolutionSel.value) });
});

exportBtn.addEventListener('click', () => {
  void runExport();
});

async function runExport(): Promise<void> {
  const requested = state;
  exportBtn.disabled = true;
  exportBtn.textContent = t('export.busy');
  try {
    const result = await progress.track(
      (onProgress) => csg.run({ kind: 'export', state: requested, label: currentLabels.a, labelB: currentLabels.b }, onProgress),
      { label: 'progress.export', delayMs: 0 },
    );
    if (!result) return;
    const blocking = result.parts.flatMap((part) => part.blocking);
    if (blocking.length > 0) {
      blockersEl.textContent = blocking.map(tm).join('\n');
      return;
    }
    blockersEl.textContent = '';
    // printed screws travel with the lid, battery clamps with the body: same print job, same material
    const placed = printAll(requested, builtCases(result.parts));
    const mesh = mergeMeshes(placed.map((part) => part.mesh));
    download(encodeSTL(mesh, { name: requested.exportMode }), `case-constructor-${requested.exportMode}.stl`);
  } catch (error) {
    blockersEl.textContent = t('error.export', { error: message(error) });
  } finally {
    exportBtn.textContent = t('export.button');
    exportBtn.disabled = false;
  }
}

function download(data: BlobPart, filename: string, type = 'model/stl'): void {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// --- presets ---

let userPresets: UserPreset[] = loadUserPresets();
/** Name of the last opened preset — the suggestion when saving to a file. */
let presetName = '';
/** Which preset is open: 'b:<id>', 'u:<name>' or empty — the list highlights it. */
let presetRef = '';

function builtinName(id: string): string {
  return presetById(id)?.name ?? id;
}

function presetRows(): PresetRow[] {
  return [
    ...userPresets.map((preset) => ({ ref: `u:${preset.name}`, name: preset.name, mine: true })),
    ...PRESETS.map((preset) => ({
      ref: `b:${preset.id}`,
      name: builtinName(preset.id),
      note: tDynamic(`preset.${preset.id}.note`),
      mine: false,
    })),
  ];
}

function setPresetRef(ref: string, name: string): void {
  presetRef = ref;
  presetName = name;
  presetBtn.textContent = name || t('topbar.presets');
  if (!presetsPanel.hidden) renderPresets();
}

function autoPresetName(): string {
  return t('presets.auto', { n: nextPresetNumber(userPresets, autoPresetPrefixes()) });
}

function renderPresets(): void {
  renderPresetList(presetList, presetRows(), presetRef, { onPick: openPreset, onDelete: deletePreset });
}

function openPresets(): void {
  renderPresets();
  presetsPanel.hidden = false;
}

function closePresets(): void {
  presetsPanel.hidden = true;
}

function openPreset(ref: string): void {
  closePresets();
  const name = ref.slice(2);
  if (ref.startsWith('b:')) {
    const preset = presetById(name);
    if (!preset) return;
    applyState(preset.build());
    setPresetRef(ref, builtinName(name));
  } else {
    const preset = userPresets.find((item) => item.name === name);
    if (!preset) return;
    applyState(preset.state);
    setPresetRef(ref, name);
  }
}

function deletePreset(ref: string): void {
  const name = ref.slice(2);
  const next = userPresets.filter((item) => item.name !== name);
  if (!saveUserPresets(next)) {
    blockersEl.textContent = t('error.presetDelete');
    return;
  }
  userPresets = next;
  if (presetRef === ref) setPresetRef('', '');
  renderPresets();
}

presetBtn.addEventListener('click', () => {
  if (presetsPanel.hidden) openPresets();
  else closePresets();
});
presetsClose.addEventListener('click', closePresets);
presetsPanel.addEventListener('click', (event) => {
  if (event.target === presetsPanel) closePresets();
});
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !presetsPanel.hidden) closePresets();
});

saveBtn.addEventListener('click', () => {
  const name = prompt(t('presets.prompt'), autoPresetName())?.trim();
  if (!name) return;
  userPresets = [...userPresets.filter((item) => item.name !== name), { name, state }];
  if (saveUserPresets(userPresets)) {
    setPresetRef(`u:${name}`, name);
    flash(saveBtn, '✓');
  } else {
    blockersEl.textContent = t('error.presetSave');
  }
});

// --- project file ---

fileSaveBtn.addEventListener('click', () => {
  const name = prompt(t('presets.prompt'), presetName || autoPresetName())?.trim();
  if (!name) return;
  download(encodePresetFile(name, state), presetFileName(name), 'application/json');
  setPresetRef(presetRef, name);
  flash(fileSaveBtn, '✓');
});

fileOpenBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  fileInput.value = '';
  if (file) void openPresetFile(file);
});

document.addEventListener('dragover', (event) => {
  if (event.dataTransfer?.types.includes('Files')) event.preventDefault();
});
document.addEventListener('drop', (event) => {
  const file = event.dataTransfer?.files[0];
  if (!file) return;
  event.preventDefault();
  void openPresetFile(file);
});

/** An opened file applies like any state but does not join "Mine": that is a separate 💾. */
async function openPresetFile(file: File): Promise<void> {
  const decoded = decodePresetFile(await file.text().catch(() => ''));
  if (!decoded) {
    blockersEl.textContent = t('error.notPreset', { name: file.name });
    return;
  }
  applyState(decoded.state);
  setPresetRef('', decoded.name);
  flash(fileOpenBtn, '✓');
}

function flash(button: HTMLButtonElement, mark: string): void {
  const original = button.textContent;
  button.textContent = mark;
  setTimeout(() => {
    button.textContent = original;
  }, 900);
}

// --- undo / redo ---

undoBtn.addEventListener('click', () => stepHistory('undo'));
redoBtn.addEventListener('click', () => stepHistory('redo'));

function stepHistory(direction: 'undo' | 'redo'): void {
  // a pending batch becomes an entry first, or undo would skip it
  if (historyTimer) {
    clearTimeout(historyTimer);
    historyTimer = null;
    history.push(state);
  }
  const restored = direction === 'undo' ? history.undo() : history.redo();
  if (restored) applyState(restored, false);
}

window.addEventListener('keydown', (event) => {
  if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z') return;
  if (event.target instanceof HTMLInputElement && event.target.type === 'text') return;
  event.preventDefault();
  stepHistory(event.shiftKey ? 'redo' : 'undo');
});

// --- mobile panel ---

const panelBtn = el('panelBtn', HTMLButtonElement);

const narrow = window.matchMedia('(max-width: 760px)');

function setPanelOpen(open: boolean): void {
  panel.classList.toggle('open', open);
  panelBtn.hidden = open;
  // on a phone the sheet covers the lower part of the view: centre the case above it
  scene.setBottomInset(open && narrow.matches ? panel.offsetHeight : 0);
}

narrow.addEventListener('change', () => setPanelOpen(panel.classList.contains('open')));
// the sheet's height follows the window (max-height in vh)
window.addEventListener('resize', () => setPanelOpen(panel.classList.contains('open')));

panelBtn.addEventListener('click', () => setPanelOpen(true));
/** A tap on a port's caption: its opening on or off, as its checkbox in the board card does — in the caption's half. */
function togglePortCut(caption: string): void {
  // the upper half's captions start with 'u'
  const half: Half = caption.startsWith('u') ? 'b' : 'a';
  const key = half === 'b' ? caption.slice(1) : caption;
  const one = isHinged(state) ? halfState(state, half) : state;
  const apply = (next: AppState): void => applyState(isHinged(state) ? withHalf(state, half, next) : next);
  const colon = key.indexOf(':');
  const onBack = key.slice(0, colon).endsWith('b');
  const onTop = key.slice(0, colon).endsWith('t');
  const index = Number(key.slice(0, onBack || onTop ? colon - 1 : colon));
  const placement = one.boards[index];
  const top = placement?.top;
  if (onTop) {
    const entry = top ? catalogBoard(top.board) : undefined;
    const port = entry ? resolveVariant(entry, top?.variant).ports.find((one) => one.id === key.slice(colon + 1)) : undefined;
    if (!top || !port) return;
    const value = !(top.cuts[port.id] ?? port.cut);
    apply({ ...one, boards: one.boards.map((one, i) => (i === index ? { ...one, top: { ...top, cuts: withTopCut(top, port, value) } } : one)) });
    return;
  }
  const back = placement?.back;
  if (onBack) {
    const entry = back ? catalogBoard(back.board) : undefined;
    const port = entry ? resolveVariant(entry, back?.variant).ports.find((one) => one.id === key.slice(colon + 1)) : undefined;
    if (!back || !port) return;
    const value = !(back.cuts[port.id] ?? backPortDefault(port));
    apply({ ...one, boards: one.boards.map((one, i) => (i === index ? { ...one, back: { ...back, cuts: withBackCut(back, port, value) } } : one)) });
    return;
  }
  const port = placement ? boardOf(placement).ports.find((one) => one.id === key.slice(colon + 1)) : undefined;
  if (!placement || !port) return;
  // a board carrying a display keeps its top parts closed by default
  const own = { id: port.id, cut: ownPortDefault(placement, port) };
  const boards = one.boards.map((one, i) => (i === index ? withPortCut(one, own, !portCut(one, port.id, own.cut)) : one));
  apply({ ...one, boards });
}

// The canvas stays live under the open sheet: drags turn the case, pinches
// zoom it; only a tap (one finger, short, still) on it closes the sheet.
const TAP_MOVE_PX = 6;
const TAP_MS = 300;
const pressed = new Map<number, { x: number; y: number; t: number }>();
let gesture = false;
view.addEventListener('pointerdown', (event) => {
  pressed.set(event.pointerId, { x: event.clientX, y: event.clientY, t: event.timeStamp });
  if (pressed.size > 1) gesture = true;
});
view.addEventListener('pointermove', (event) => {
  // a mouse over a badge opens it (a touch has no hover: a tap does)
  if (event.pointerType === 'mouse' && pressed.size === 0) {
    const box = view.getBoundingClientRect();
    const key = scene.captionAt(event.clientX - box.left, event.clientY - box.top);
    const n = key?.startsWith('warn:') ? Number(key.slice(5)) : null;
    if (n !== hoveredWarning) hoverWarning(n);
  }
  const start = pressed.get(event.pointerId);
  if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > TAP_MOVE_PX) gesture = true;
});
const release = (event: PointerEvent): void => {
  const start = pressed.get(event.pointerId);
  pressed.delete(event.pointerId);
  const tap = start && !gesture && event.timeStamp - start.t < TAP_MS
    && Math.hypot(event.clientX - start.x, event.clientY - start.y) <= TAP_MOVE_PX;
  if (pressed.size === 0) gesture = false;
  if (!tap) return;
  const box = view.getBoundingClientRect();
  const caption = scene.captionAt(event.clientX - box.left, event.clientY - box.top);
  if (caption?.startsWith('warn:')) pickWarning(Number(caption.slice(5)));
  else if (caption) togglePortCut(caption);
  else if (narrow.matches && panel.classList.contains('open')) setPanelOpen(false);
};
view.addEventListener('pointerup', release);
view.addEventListener('pointercancel', (event) => {
  pressed.delete(event.pointerId);
  if (pressed.size === 0) gesture = false;
});
setPanelOpen(true);

// --- language ---

for (const code of LANGS) {
  const option = document.createElement('option');
  option.value = code;
  option.textContent = ENDONYMS[code];
  langSel.append(option);
}
langSel.value = lang();
langSel.addEventListener('change', () => {
  if (isLang(langSel.value)) setLang(langSel.value);
});

onLangChange(() => {
  applyStaticText(document);
  langSel.value = lang();
  const scroll = panel.scrollTop;
  renderPanel();
  panel.scrollTop = scroll;
  // preset names are not translated: only the button's placeholder is
  setPresetRef(presetRef, presetName);
  exportBtn.textContent = t('export.button');
  progress.refresh();
  syncPanel();
});

// Dev builds only: a handle for scripts/snap.mjs --eval to look at what is drawn.
if (import.meta.env.DEV) {
  Reflect.set(window, '__case', {
    state: () => state,
    /** the last preview's parts: a single case's, or the lower half's (`cases` has both halves) */
    parts: () => (lastParts ? { ...lastParts.cases[0], state: lastParts.state, cases: lastParts.cases } : null),
    ghosts: () => ghostGroups.flatMap((group) => group.parts),
    /** the port captions shown now and where on the canvas */
    captions: () => scene.shownCaptions().filter((caption) => !caption.key.startsWith('warn:')),
    /** the warnings' badges shown now: number, message, where on the canvas, open or not, and how many boxes */
    warnings: () => scene.shownCaptions().flatMap((caption) => {
      const n = caption.key.startsWith('warn:') ? Number(caption.key.slice(5)) : NaN;
      const line = shownNotices.find((one) => one.n === n);
      return line ? [{ n, text: line.text, x: caption.x, y: caption.y, open: n === activeWarning(), boxes: line.spot?.boxes.length ?? 0 }] : [];
    }),
    drawn: () => drawnRoles,
    drawnParts: () => drawnParts,
    project: (points: [number, number, number][]) => scene.project(points),
    lookFrom: (direction: [number, number, number]) => scene.lookFrom(direction),
    /** true when the worker has answered for the current state */
    built: () => generation > 0 && settled === generation,
  });
}

applyState(state, false);
