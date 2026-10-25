// Entry point: state → worker → renderer and panel.
//
// Every solid of a case comes out of a boolean, so the main thread builds no
// geometry at all: it sends the state to the CSG worker after a short pause
// (PREVIEW_DELAY_MS) and draws what comes back. The preview is the exact
// case at a coarser arc resolution — the same pipeline that goes to the STL.

import './style.css';
import { el, make } from './ui/dom';
import { createScene } from './render/scene';
import type { ScenePart } from './render/scene';
import { renderControls } from './ui/controls';
import type { ControlsHandle } from './ui/controls';
import { caseControls } from './ui/caseCard';
import { lidControls } from './ui/lidCard';
import { renderBoardsCard } from './ui/boardsCard';
import type { BoardsCardHandle } from './ui/boardsCard';
import { renderBoardList } from './ui/boardPicker';
import { defaultCustomBoard } from './ui/customBoard';
import { addCut, renderCutsCard } from './ui/cutsCard';
import { renderExtras } from './ui/extrasCards';
import type { ExtrasHandle } from './ui/extrasCards';
import { labelRaster } from './ui/labelRaster';
import type { LabelRaster } from './geo/label';
import { labelPlacement } from './geo/label';
import { extrasWarnings, flatRegion } from './geo/extras';
import type { CutsCardHandle } from './ui/cutsCard';
import { cutWarnings, outerTopAt, portCutters } from './geo/ports';
import { extraCutters, MAX_EXTRA_CUTS } from './geo/cutters';
import { effectiveLid } from './geo/layout';
import { lidFaces } from './geo/lidSpec';
import { faceFrame as frameOf } from './geo/face';
import { postCollisions, postSpots, postsInOpenings, printedScrewWarnings } from './geo/fastening';
import { openingPolygon } from './geo/opening';
import { plateOf, shapeSpec } from './geo/shape';
import { setupAdjustmentButtons } from './ui/adjust';
import { createProgress } from './ui/progress';
import { renderPresetList } from './ui/presetList';
import type { PresetRow } from './ui/presetList';
import { applyStaticText } from './ui/staticText';
import { ENDONYMS, LANGS, initLang, isLang, lang, onLangChange, setLang, t, tDynamic, tm, autoPresetPrefixes } from './i18n';
import type { Key } from './i18n';
import { faceFrame } from './geo/face';
import type { Dims, Face } from './geo/face';
import type { PrintShape } from './geo/print';
import { caseDims, caseLayout, collisions, lidDepthMax, placeBoards } from './geo/layout';
import { boardGhost } from './geo/ghost';
import { MAX_BOARDS, NEW_BOARD_GAP, defaultPlacement } from './boards/placement';
import type { BoardDef } from './boards/schema';
import { bodyForPrint, lidWithScrews, printLayout, screwsForPrint, screwsInCase, PRINT_GAP_MM } from './geo/print';
import type { SurfaceMesh } from './geo/surface';
import { meshBounds, mergeMeshes } from './geo/surface';
import { encodeSTL } from './geo/stl';
import { assessExport, validateMesh } from './geo/validate';
import type { AppState, ExportMode } from './state/schema';
import { defaultState, sanitizeState, RESOLUTIONS } from './state/schema';
import { PRESETS, presetById } from './state/presets';
import { encodePresetFile, decodePresetFile, presetFileName } from './state/presetFile';
import type { UserPreset } from './state/userPresets';
import { loadUserPresets, saveUserPresets, nextPresetNumber } from './state/userPresets';
import { History } from './state/history';
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
const resolutionSel = el('resolution', HTMLSelectElement);
const exportBtn = el('exportBtn', HTMLButtonElement);
const partList = el('partList', HTMLUListElement);
const statusEl = el('status', HTMLParagraphElement);
const auditEl = el('audit', HTMLParagraphElement);
const warningsEl = el('warnings', HTMLParagraphElement);
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

const scene = createScene(view);
const csg = new CsgClient();
const history = new History<AppState>(defaultState());
let state: AppState = history.value;

setupAdjustmentButtons(panel);

// --- the panel: built at startup and again on every language switch ---

let caseRows: ControlsHandle<AppState>;
let lidRows: ControlsHandle<AppState>;
let boardRows: BoardsCardHandle;
let cutRows: CutsCardHandle;
let extraRows: ExtrasHandle;

function renderPanel(): void {
  caseRows = renderControls(caseParams, caseControls(), () => state, (next) => applyState(next), 'case');
  boardRows = renderBoardsCard(boardCards, () => state, (next) => applyState(next),
    (text, name) => download(text, name, 'application/json'));
  cutRows = renderCutsCard(cutCards, () => state, (next) => applyState(next));
  extraRows = renderExtras(extraOpenings, extraMounting, () => state, (next) => applyState(next));
  lidRows = renderControls(lidParams, lidControls(), () => state, (next) => applyState(next), 'lid');
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
  boardRows.sync(state);
  lidRows.sync(state);
  boardAdd.disabled = state.boards.length >= MAX_BOARDS;
  boardCustom.disabled = boardAdd.disabled;
  cutRows.sync(state);
  extraRows.sync(state);
  cutAdd.disabled = state.extraCuts.length >= MAX_EXTRA_CUTS;
  for (const [mode, tab] of Object.entries(tabs)) tab.setAttribute('aria-selected', String(mode === state.exportMode));
  syncView();
  resolutionSel.value = String(state.resolution);
  updateHistoryButtons();
  refresh();
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
/** The last preview from the worker, kept so view toggles redraw without a rebuild. */
let lastParts: { body: SurfaceMesh; lid: SurfaceMesh; screw: SurfaceMesh | null; state: AppState } | null = null;
/** The label's raster for the current state — the worker gets it with every job. */
let currentLabel: LabelRaster | null = null;
/** Board ghosts of the current state — drawn at once, the case follows from the worker. */
let ghosts: ScenePart[] = [];
/** Warnings the panel computes itself, before the worker answers. */
let baseWarnings: string[] = [];

function refresh(): void {
  generation++;
  const stamp = generation;
  const layout = caseLayout(state);
  const { dims } = layout;
  statusEl.textContent = t('status.size', { w: Math.round(dims.w), d: Math.round(dims.d), h: Math.round(dims.h) });

  baseWarnings = [];
  currentLabel = labelRaster(state.label, () => refresh());
  const depthMax = lidDepthMax(state.shape, state.lid, dims);
  if (state.lid.depth > depthMax) baseWarnings.push(t('warn.depthClamped', { max: depthMax.toFixed(1) }));
  baseWarnings.push(...collisions(layout).map(tm));
  const shapeBuilt = { ...state.shape, console: layout.console };
  const top = outerTopAt(shapeBuilt, dims, layout.console.frontH, layout.console.backH);
  const cutters = [...portCutters(layout, shapeBuilt), ...extraCutters(state.extraCuts, shapeBuilt, dims, top)];
  const lidBuilt = effectiveLid(shapeBuilt, state.lid, dims);
  if (lidBuilt.depth > state.lid.depth + 0.01) baseWarnings.push(t('info.depthRaised', { d: lidBuilt.depth.toFixed(1) }));
  if (state.lid.face !== state.lid.chosen && !lidFaces(state.shape.kind).includes(state.lid.chosen)) {
    baseWarnings.push(t('info.lidFaceMoved', { chosen: t(`face.${state.lid.chosen}`), face: t(`face.${state.lid.face}`) }));
  }
  baseWarnings.push(...cutWarnings(layout, shapeBuilt, lidBuilt, cutters, state.extraCuts).map(tm));
  if (lidBuilt.fastening !== 'snaps') {
    const { frame, plate, zp, spots } = lidPosts(state);
    baseWarnings.push(...postCollisions(spots, frame, zp, plate, lidBuilt, layout.boards).map(tm));
    baseWarnings.push(...postsInOpenings(spots, frame, zp, plate, lidBuilt, cutters).map(tm));
  }
  baseWarnings.push(...printedScrewWarnings(lidBuilt).map(tm));
  baseWarnings.push(...extrasWarnings(state, shapeBuilt, layout, lidBuilt).map(tm));
  if (currentLabel) {
    const place = labelPlacement(state.label, currentLabel, lidBuilt.face, dims);
    const region = flatRegion(shapeBuilt, dims, lidBuilt.face, 0);
    const reach = Math.hypot(place.w, place.h) / 2;
    const turned = Math.abs(Math.sin((state.label.angle * Math.PI) / 180));
    const hw = place.w / 2 * (1 - turned) + reach * turned;
    const hh = place.h / 2 * (1 - turned) + reach * turned;
    if (place.u - hw < region.u0 || place.u + hw > region.u1 || place.v - hh < region.v0 || place.v + hh > region.v1) {
      baseWarnings.push(tm({ code: 'warn.labelTooBig' }));
    }
  }
  showWarnings([]);
  ghosts = layout.boards.flatMap((board): ScenePart[] => {
    const ghost = boardGhost(board);
    return [{ role: 'board', mesh: ghost.pcb }, ...(ghost.ports ? [{ role: 'port' as const, mesh: ghost.ports }] : [])];
  });
  drawParts();
  renderPartList();

  auditEl.textContent = t('audit.building');
  if (previewTimer) clearTimeout(previewTimer);
  previewTimer = setTimeout(() => void showPreview(stamp), PREVIEW_DELAY_MS);
}

function showWarnings(extra: string[]): void {
  const all = [...baseWarnings, ...extra];
  warningsEl.textContent = all.length > 1 ? [t('status.warnings', { n: all.length }), ...all].join('\n') : all.join('\n');
}

async function showPreview(stamp: number): Promise<void> {
  const requested = state;
  try {
    const result = await progress.track(
      (onProgress) => csg.run({ kind: 'preview', state: requested, segments: PREVIEW_SEGMENTS, label: currentLabel }, onProgress),
      { label: 'progress.preview' },
    );
    if (!result || stamp !== generation) return;
    settled = stamp;
    const body = toMesh(partById(result.parts, 'body'));
    const lid = toMesh(partById(result.parts, 'lid'));
    const screwPart = result.parts.find((part) => part.id === 'screw');
    const screw = screwPart ? toMesh(screwPart) : null;
    lastParts = { body, lid, screw, state: requested };
    drawParts();
    audit(screw ? [body, lid, screw] : [body, lid], result.ms);
  } catch (error) {
    if (stamp !== generation) return;
    settled = stamp;
    auditEl.textContent = '';
    blockersEl.textContent = t('error.build', { error: message(error) });
    exportBtn.disabled = true;
  }
}

/** Body, lid and printed screws on the bed, left to right — the view and the STL of Both. */
function bothForPrint(
  body: SurfaceMesh, lid: SurfaceMesh, screw: SurfaceMesh | null, count: number, face: Face, dims: Dims, shape: PrintShape,
): SurfaceMesh[] {
  const parts = printLayout(body, lid, face, dims, shape);
  const screws = screw ? screwsForPrint(screw, count, meshBounds(parts[1]).max[0] + PRINT_GAP_MM) : null;
  return screws ? [...parts, screws] : parts;
}

/** The lid's corner posts as the worker builds them (in the lid's face frame) — for warnings and the printed screws. */
function lidPosts(current: AppState) {
  const layout = caseLayout(current);
  const { dims } = layout;
  const shape = { ...current.shape, console: layout.console };
  const lid = effectiveLid(shape, current.lid, dims);
  const frame = frameOf(lid.face, dims);
  const plate = plateOf(shape, lid.face);
  const zp = -(plate + lid.depth);
  const opening = openingPolygon(shapeSpec(shape, dims), frame, zp, lid.lip.h, 8);
  return { frame, plate, zp, spots: lid.fastening === 'snaps' ? [] : postSpots(opening, lid, shape.wall) };
}

function partById(parts: JobPart[], id: JobPart['id']): JobPart {
  const found = parts.find((part) => part.id === id);
  if (!found) throw new Error(`the worker sent no ${id}`);
  return found;
}

/**
 * Draws the last preview. The parts tab decides what — both parts, the body
 * with its boards, or the lid alone; the view decides how — exploded,
 * assembled, or laid out as in the STL (as far as it means anything for the
 * parts shown: see `effectiveView`).
 */
function drawParts(): void {
  if (!lastParts) return;
  const { body, lid, screw, state: built } = lastParts;
  const layout = caseLayout(built);
  const { dims } = layout;
  const showBody = built.exportMode !== 'lid';
  const showLid = built.exportMode !== 'body';
  const mode = effectiveView(built.exportMode);
  const posts = screw ? lidPosts(built).spots.map((spot) => spot.centre) : [];
  if (mode === 'print') {
    const shape = { kind: built.shape.kind, console: layout.console };
    const face = built.lid.face;
    const roles = (meshes: SurfaceMesh[], first: ScenePart['role'][]): ScenePart[] =>
      meshes.map((mesh, i): ScenePart => ({ role: first[i] ?? 'screw', mesh }));
    const parts: ScenePart[] = built.exportMode === 'both'
      ? roles(bothForPrint(body, lid, screw, posts.length, face, dims, shape), ['body', 'lid'])
      : built.exportMode === 'lid'
        ? roles(lidWithScrews(lid, screw, posts.length, face, dims), ['lid'])
        : [{ role: 'body', mesh: bodyForPrint(body, face, dims, shape) }];
    show(parts);
    return;
  }
  const parts: ScenePart[] = [];
  if (showBody) {
    parts.push({ role: 'body', mesh: body });
    if (viewBoards.checked) parts.push(...ghosts);
  }
  if (showLid && showBody) {
    const n = faceFrame(built.lid.face, dims).n;
    const lift = mode === 'exploded' ? LIFT_MM : 0;
    parts.push({ role: 'lid', mesh: lid, offset: [n[0] * lift, n[1] * lift, n[2] * lift] });
    // printed screws in their holes; exploded, they hover over the lifted lid
    const screws = screw ? screwsInCase(screw, posts, built.lid.face, dims, 2 * lift) : null;
    if (screws) parts.push({ role: 'screw', mesh: screws });
  }
  show(standOnGrid(parts));
}

/**
 * Parts raised together so that nothing goes under the grid: a bottom lid,
 * exploded, floats below the body — both above the grid.
 */
function standOnGrid(parts: ScenePart[]): ScenePart[] {
  let low = 0;
  for (const part of parts) {
    const dz = part.offset?.[2] ?? 0;
    const positions = part.mesh.positions;
    for (let i = 2; i < positions.length; i += 3) low = Math.min(low, positions[i] + dz);
  }
  if (low >= 0) return parts;
  return parts.map((part): ScenePart => {
    const [ox, oy, oz] = part.offset ?? [0, 0, 0];
    return { ...part, offset: [ox, oy, oz - low] };
  });
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
  if (view === 'print') return `${what} · ${t('caption.print')}`;
  const boards = viewBoards.checked && state.boards.length > 0 ? ` · ${t('caption.withBoards')}` : '';
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
  showWarnings(assessments.flatMap((assessment) => assessment.warnings).map(tm));
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
  const placed = placeBoards(state);
  const x = placed.length > 0 ? Math.max(...placed.map((board) => board.footprint.x1)) + NEW_BOARD_GAP + 3 : 0;
  applyState({ ...state, boards: [...state.boards, defaultPlacement(def, Math.round(x), 0)] });
}

boardAdd.addEventListener('click', openPicker);
boardCustom.addEventListener('click', () => {
  const placed = placeBoards(state);
  const x = placed.length > 0 ? Math.max(...placed.map((board) => board.footprint.x1)) + NEW_BOARD_GAP + 3 : 0;
  const custom = defaultCustomBoard();
  applyState({ ...state, boards: [...state.boards, { ...defaultPlacement(custom, Math.round(x), 0), board: 'custom', custom }] });
});
cutAdd.addEventListener('click', () => applyState(addCut(state)));
boardPickerClose.addEventListener('click', closePicker);
boardPicker.addEventListener('click', (event) => {
  if (event.target === boardPicker) closePicker();
});
boardSearch.addEventListener('input', () => renderBoardList(boardList, boardSearch.value, addBoard));
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !boardPicker.hidden) closePicker();
});
viewXray.addEventListener('change', () => scene.setXray(viewXray.checked));

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
      (onProgress) => csg.run({ kind: 'export', state: requested, label: currentLabel }, onProgress),
      { label: 'progress.export', delayMs: 0 },
    );
    if (!result) return;
    const blocking = result.parts.flatMap((part) => part.blocking);
    if (blocking.length > 0) {
      blockersEl.textContent = blocking.map(tm).join('\n');
      return;
    }
    blockersEl.textContent = '';
    const dims = caseDims(requested);
    const face = requested.lid.face;
    const body = toMesh(partById(result.parts, 'body'));
    const lid = toMesh(partById(result.parts, 'lid'));
    const screwPart = result.parts.find((part) => part.id === 'screw');
    const screw = screwPart ? toMesh(screwPart) : null;
    const count = screw ? lidPosts(requested).spots.length : 0;
    const layout = caseLayout(requested);
    const shape = { kind: requested.shape.kind, console: layout.console };
    // printed screws travel with the lid: same print job, same material
    const mesh = requested.exportMode === 'body'
      ? bodyForPrint(body, face, dims, shape)
      : requested.exportMode === 'lid'
        ? mergeMeshes(lidWithScrews(lid, screw, count, face, dims))
        : mergeMeshes(bothForPrint(body, lid, screw, count, face, dims, shape));
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
const panelBackdrop = el('panelBackdrop', HTMLDivElement);

const narrow = window.matchMedia('(max-width: 760px)');

function setPanelOpen(open: boolean): void {
  panel.classList.toggle('open', open);
  panelBackdrop.hidden = !open;
  panelBtn.hidden = open;
  // on a phone the sheet covers the lower part of the view: centre the case above it
  scene.setBottomInset(open && narrow.matches ? panel.offsetHeight : 0);
}

narrow.addEventListener('change', () => setPanelOpen(panel.classList.contains('open')));
// the sheet's height follows the window (max-height in vh)
window.addEventListener('resize', () => setPanelOpen(panel.classList.contains('open')));

panelBtn.addEventListener('click', () => setPanelOpen(true));
panelBackdrop.addEventListener('click', () => setPanelOpen(false));
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
    parts: () => lastParts,
    ghosts: () => ghosts,
    drawn: () => drawnRoles,
    drawnParts: () => drawnParts,
    project: (points: [number, number, number][]) => scene.project(points),
    lookFrom: (direction: [number, number, number]) => scene.lookFrom(direction),
    /** true when the worker has answered for the current state */
    built: () => generation > 0 && settled === generation,
  });
}

applyState(state, false);
