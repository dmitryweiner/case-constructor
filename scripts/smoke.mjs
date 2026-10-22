#!/usr/bin/env node
// Browser smoke: what vitest cannot check — Three.js/WebGL, the WASM CSG
// worker, real clicks on the UI, real downloads.
//
//   node scripts/smoke.mjs              # dev server
//   node scripts/smoke.mjs --preview    # production build (vite preview)
//   node scripts/smoke.mjs --shots shots   # + a screenshot per shape
//
// The browser opens in en-US: checks read English text. The language step
// switches through all four and opens a fresh he-IL page.
//
// Export times are always printed — that is how the export cost is measured.
// Any console/page error → non-zero exit code (fit for CI).

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseArgs, openApp } from './lib/harness.mjs';

const flags = parseArgs(process.argv.slice(2), ['shots']);
const shotsDir = flags.get('shots');
if (shotsDir) mkdirSync(shotsDir, { recursive: true });

const app = await openApp({ preview: flags.has('preview') });
const { page, errors, label } = app;

/** The audit waits for the worker; returns its verdict once the build is in. */
async function verdict() {
  await page.waitForFunction(
    () => {
      const text = document.querySelector('#audit')?.textContent ?? '';
      return text.length > 0 && !text.includes('building');
    },
    { timeout: 20000 },
  );
  return (await page.locator('#audit').textContent()).trim();
}

/** Expects a watertight build and no blockers at the current step. */
async function expectWatertight(step) {
  const text = await verdict();
  if (!text.includes('watertight ✓')) errors.push(`[${step}] audit="${text}"`);
  const blockers = (await page.locator('#blockers').textContent()).trim();
  if (blockers) errors.push(`[${step}] blockers="${blockers}"`);
}

/** Moves a range input like a person would: value + input event. */
async function setRange(id, value) {
  await page.locator(`#${id}`).fill(String(value));
  await page.waitForTimeout(40);
}

/** Exports the current mode and checks the downloaded STL is a sane binary file. */
async function exportStl(step) {
  const started = Date.now();
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 60000 }),
    page.click('#exportBtn'),
  ]);
  const path = join(tmpdir(), `case-smoke-${Date.now()}.stl`);
  await download.saveAs(path);
  const bytes = readFileSync(path);
  const triangles = bytes.readUInt32LE(80);
  if (bytes.length !== 84 + triangles * 50 || triangles < 12) {
    errors.push(`[${step}] STL ${bytes.length} bytes, ${triangles} triangles`);
  }
  console.log(`  export ${step}: ${download.suggestedFilename()} ${triangles} triangles, ${Date.now() - started} ms`);
}

label('favicon');
const faviconStatus = await page.evaluate(() => fetch('./favicon.svg').then((r) => r.status, () => 0));
if (faviconStatus !== 200) errors.push(`[favicon] favicon.svg → ${faviconStatus}`);

label('boot');
await expectWatertight('boot');

// every shape builds watertight; the sliders' extremes do not break it
for (const kind of ['box', 'cylinder', 'console']) {
  label(`shape:${kind}`);
  await page.click(`#case_kind_${kind}`);
  await expectWatertight(`shape:${kind}`);
  if (shotsDir) await page.screenshot({ path: `${shotsDir}/shape-${kind}.png` });
}
await page.click('#case_kind_box');

label('slider-extremes');
const ranges = await page.$$eval('#caseParams input[type=range]:not(:disabled), #lidParams input[type=range]',
  (nodes) => nodes.filter((n) => n.closest('.row')?.hidden === false).map((n) => n.id));
for (const id of ranges) {
  for (const bound of ['min', 'max']) {
    await setRange(id, await page.locator(`#${id}`).getAttribute(bound));
  }
}
await expectWatertight('slider-extremes');

// boards: every catalog board from the picker, hole kinds, rotation, removal
label('boards');
const catalog = await page.evaluate(async () => {
  document.querySelector('#boardAdd').click();
  await new Promise((r) => setTimeout(r, 50));
  const ids = [...document.querySelectorAll('#boardList [data-board]')].map((n) => n.dataset.board);
  document.querySelector('#boardPickerClose').click();
  return ids;
});
if (catalog.length < 4) errors.push(`[boards] picker lists ${catalog.length} boards`);
for (const id of catalog) {
  label(`board:${id}`);
  await page.click('#board0_remove');
  await page.click('#boardAdd');
  await page.click(`#boardList [data-board="${id}"]`);
  await expectWatertight(`board:${id}`);
  if (await page.locator('#board0_hole_nut').isVisible()) {
    await page.click('#board0_hole_nut');
    await expectWatertight(`board:${id}:nut`);
    await page.click('#board0_hole_insert');
    await page.click('#board0_rot_90');
    await expectWatertight(`board:${id}:insert:90`);
  }
}
label('ports');
await page.click('#board0_remove');
await page.click('#boardAdd');
await page.click('#boardList [data-board="raspberry-pi-4b"]');
await page.uncheck('#board0_cut_ethernet');
await expectWatertight('ports:ethernet-off');
await page.check('#board0_cut_ethernet');
label('openings');
await page.click('#cutAdd');
await page.click('#cut0_shape_round');
await setRange('cut0_d', 8);
await expectWatertight('openings:round');
await page.selectOption('#cut0_face', 'top');
await expectWatertight('openings:top');
await page.click('#cut0_remove');
label('custom-board');
await page.click('#board0_remove');
await page.click('#boardCustom');
await expectWatertight('custom:new');
await page.fill('#board0_custom_name', 'Smoke board');
await page.fill('#board0_custom_w', '64');
await page.click('#board0_custom_port_add');
await page.click('#board0_custom_port_add');
await page.selectOption('#board0_custom_port1_edge', 'top');
await page.selectOption('#board0_custom_port0_type', 'micro-hdmi');
await page.click('#board0_custom_hole_add');
await page.click('#board0_custom_hole4_remove');
await expectWatertight('custom:edited');
const [catalogFile] = await Promise.all([page.waitForEvent('download'), page.click('#board0_custom_save')]);
if (catalogFile.suggestedFilename() !== 'smoke-board.json') errors.push(`[custom] saved as ${catalogFile.suggestedFilename()}`);
const catalogPath = join(tmpdir(), `case-smoke-board-${Date.now()}.json`);
await catalogFile.saveAs(catalogPath);
const catalogJson = JSON.parse(readFileSync(catalogPath, 'utf8'));
if (catalogJson.size?.w !== 64 || catalogJson.ports?.length !== 2) errors.push(`[custom] catalog JSON ${JSON.stringify(catalogJson).slice(0, 120)}`);
await page.selectOption('#board0_custom_mount', 'rails');
await expectWatertight('custom:rails');
await page.click('#board0_remove');
await page.click('#boardAdd');
await page.click('#boardList [data-board="raspberry-pi-4b"]');
label('boards:search');
await page.click('#boardAdd');
await page.fill('#boardSearch', 'lora 32');
const found = await page.locator('#boardList [data-board]').count();
if (found !== 1) errors.push(`[boards:search] "lora 32" finds ${found}`);
await page.click('#boardList [data-board]');
await expectWatertight('boards:two');
label('boards:overlap');
await setRange('board1_x', 0);
await page.waitForTimeout(100);
if (!(await page.locator('#warnings').textContent()).includes('overlap')) errors.push('[boards:overlap] no warning');
label('boards:arrange');
const boardXY = () => page.evaluate(() => window.__case.state().boards.map((b) => [b.x, b.y]));
for (const mode of ['row', 'column', 'compact']) {
  await page.click(`#boardsArrange_${mode}`);
  await expectWatertight(`boards:arrange:${mode}`);
  if ((await page.locator('#warnings').textContent()).includes('overlap')) errors.push(`[boards:arrange] ${mode} leaves an overlap`);
}
await setRange('boards_gap', 10);
await page.click('#boardsArrange_row');
const [[x0], [x1]] = await boardXY();
if (!(x1 > x0 + 10)) errors.push(`[boards:arrange] the gap is not kept: ${x0}, ${x1}`);
await page.click('#board1_align summary');
if ((await page.locator('#board1_alignRef').inputValue()) !== '0') errors.push('[boards:align] board 2 is not aligned to board 1 by default');
await page.click('#board1_align_nextY');
await page.click('#board1_align_left');
await expectWatertight('boards:align');
const [[ax0, ay0], [ax1, ay1]] = await boardXY();
if (Math.abs(ax0 - ax1) > 1e-6 || !(ay1 > ay0)) errors.push(`[boards:align] behind and left: ${[ax0, ay0, ax1, ay1]}`);
if ((await page.locator('#warnings').textContent()).includes('overlap')) errors.push('[boards:align] an overlap');
await page.click('#undoBtn');
const [, [ux1]] = await boardXY();
if (Math.abs(ux1 - ax1) < 1e-6) errors.push('[boards:align] undo does not take the alignment back');
await page.click('#board1_remove');
if (await page.locator('#boardsArrange').isVisible()) errors.push('[boards:arrange] offered for a single board');
await page.click('#board0_remove');
await expectWatertight('boards:none');

// each lid face (the console has no lid on its slope, the cylinder only top and bottom)
label('lid-faces');
await page.click('#presetBtn');
await page.click('#presetList [data-preset="b:plain-box"]');
await expectWatertight('preset:plain-box');
for (const face of ['top', 'bottom', 'front', 'back', 'left', 'right']) {
  label(`lid:${face}`);
  await page.click(`#lid_face_${face}`);
  await setRange('lid_depth', 6);
  await expectWatertight(`lid:${face}`);
}
await page.click('#case_kind_cylinder');
if (!(await page.locator('#lid_face_left').isDisabled())) errors.push('[lid] the cylinder allows a side lid');
await page.click('#case_kind_console');
if (!(await page.locator('#lid_face_top').isDisabled())) errors.push('[lid] the console allows a lid on its slope');
await expectWatertight('lid:console');
await page.click('#case_kind_box');
await page.click('#lid_face_top');
await setRange('lid_depth', 0);

// lid fastening: screws with every hole and head kind, then back to snaps
label('fastening');
await page.click('#lid_fastening_screws');
await expectWatertight('fastening:screws');
for (const hole of ['tap', 'insert', 'nut']) {
  await page.click(`#lid_hole_${hole}`);
  for (const head of ['none', 'counterbore', 'countersunk']) {
    await page.click(`#lid_head_${head}`);
    await expectWatertight(`fastening:${hole}:${head}`);
  }
}
await page.click('#lid_face_left');
await expectWatertight('fastening:screws:left');
await page.click('#lid_face_top');
await page.click('#lid_fastening_snaps');
await setRange('case_edgeR', 4);
await expectWatertight('fastening:snaps:fillet');
if (!(await page.locator('#warnings').textContent()).includes('rounded corners end')) errors.push('[fastening] no note about the raised lid depth');
await setRange('case_edgeR', 0);

// extras: vents of every pattern, a fan, both wall mounts, a label in a real font
label('extras');
await page.check('#on_vents');
for (const pattern of ['slots', 'hex', 'round']) {
  await page.click(`#vents_pattern_${pattern}`);
  await expectWatertight(`vents:${pattern}`);
}
await page.check('#vents_face_bottom');
await page.check('#on_fan');
await page.selectOption('#fan_face', 'top');
await page.click('#fan_size_30');
await expectWatertight('fan');
await page.click('#mount_kind_keyholes');
await expectWatertight('keyholes');
await page.click('#mount_keyhole_closed');
await expectWatertight('keyholes:closed');
if (!(await page.locator('#warnings').textContent()).includes('supports')) errors.push('[keyholes:closed] no warning about the pads on the bed');
await page.click('#mount_keyhole_through');
await page.click('#mount_kind_ears');
await expectWatertight('ears');
const trianglesBefore = await page.evaluate(() => window.__case.parts()?.lid.indices.length ?? 0);
await page.check('#on_label');
await page.fill('#label_text', 'Hello שלום Привет');
await page.waitForTimeout(1500);
await expectWatertight('label');
const trianglesAfter = await page.evaluate(() => window.__case.parts()?.lid.indices.length ?? 0);
if (!flags.has('preview') && trianglesAfter <= trianglesBefore) errors.push('[label] the lid did not change');
await page.check('#label_raised');
await expectWatertight('label:raised');
await page.uncheck('#on_label');
await page.uncheck('#on_vents');
await page.uncheck('#on_fan');
await page.click('#mount_kind_none');

// each export mode with a real download
for (const mode of ['body', 'lid', 'both']) {
  label(`export:${mode}`);
  await page.click(`#tab${mode[0].toUpperCase()}${mode.slice(1)}`);
  await expectWatertight(`export:${mode}`);
  await exportStl(mode);
}

// undo / redo
label('undo');
const wallBefore = await page.locator('#case_wall').inputValue();
await setRange('case_wall', 3.5);
await page.waitForTimeout(700);
await page.click('#undoBtn');
await page.waitForTimeout(100);
if ((await page.locator('#case_wall').inputValue()) !== wallBefore) errors.push('[undo] the wall did not come back');
await page.click('#redoBtn');
await page.waitForTimeout(100);
if ((await page.locator('#case_wall').inputValue()) !== '3.5') errors.push('[redo] the wall did not return to 3.5');

// a preset saved to localStorage comes back after a reload
label('user-preset');
page.once('dialog', (dialog) => dialog.accept('Smoke preset'));
await page.click('#saveBtn');
await page.reload();
await verdict();
await page.click('#presetBtn');
await page.click('#presetList [data-preset="u:Smoke preset"]');
await page.waitForTimeout(100);
if ((await page.locator('#case_wall').inputValue()) !== '3.5') errors.push('[user-preset] the wall is not 3.5');

// the project file round trip: save, change, open
label('file');
page.once('dialog', (dialog) => dialog.accept('Smoke file'));
const [saved] = await Promise.all([page.waitForEvent('download'), page.click('#fileSaveBtn')]);
const filePath = join(tmpdir(), `case-smoke-${Date.now()}.json`);
await saved.saveAs(filePath);
await setRange('case_wall', 2);
await page.setInputFiles('#fileInput', filePath);
await page.waitForTimeout(150);
if ((await page.locator('#case_wall').inputValue()) !== '3.5') errors.push('[file] the wall is not 3.5 after opening');
await expectWatertight('file');
const junk = join(tmpdir(), `case-smoke-junk-${Date.now()}.json`);
writeFileSync(junk, '{"hello": "world"}');
await page.setInputFiles('#fileInput', junk);
await page.waitForTimeout(100);
if (!(await page.locator('#blockers').textContent()).includes('not a Case Constructor')) {
  errors.push('[file] a foreign JSON was not refused');
}

// view modes and export tabs: what is drawn follows both
label('view');
await page.click('#presetBtn');
await page.click('#presetList [data-preset="b:pi4-desktop"]');
await expectWatertight('view:preset');
const drawn = async () => {
  await page.waitForTimeout(150);
  return (await page.evaluate(() => window.__case.drawn())).join(',');
};
const tabOrder = await page.$$eval('.tabs .tab', (nodes) => nodes.map((n) => n.id));
if (tabOrder[0] !== 'tabBoth') errors.push(`[view] the first export tab is ${tabOrder[0]}`);
await page.click('#tabBoth');
await page.click('#viewExploded');
if (!/body.*board.*lid/.test(await drawn())) errors.push(`[view] exploded/both draws ${await drawn()}`);
await page.click('#viewAssembled');
if (!/body.*board.*lid/.test(await drawn())) errors.push(`[view] assembled/both draws ${await drawn()}`);
await page.click('#viewExploded');
await page.click('#tabLid');
await expectWatertight('view:lid');
if ((await drawn()) !== 'lid') errors.push(`[view] the Lid tab draws ${await drawn()}`);
if (await page.locator('#viewRow').isVisible()) errors.push('[view] the Lid tab offers a view');
if (await page.locator('#viewBoards').isVisible()) errors.push('[view] the Lid tab offers boards');
if (!(await page.locator('#viewCaption').textContent()).includes('print layout')) errors.push('[view] the Lid tab caption does not say print layout');
// in the print layout the lid lies on its outer face: most of its footprint is on the bed
const lidOnBed = await page.evaluate(() => {
  const [part] = window.__case.drawnParts();
  const { positions: p, indices: ix } = part.mesh;
  const dz = part.offset?.[2] ?? 0;
  let minZ = Infinity;
  let x0 = Infinity; let x1 = -Infinity; let y0 = Infinity; let y1 = -Infinity;
  for (let i = 0; i < p.length; i += 3) {
    minZ = Math.min(minZ, p[i + 2] + dz);
    x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]); y0 = Math.min(y0, p[i + 1]); y1 = Math.max(y1, p[i + 1]);
  }
  let bed = 0;
  for (let t = 0; t < ix.length; t += 3) {
    const [a, b, c] = [ix[t] * 3, ix[t + 1] * 3, ix[t + 2] * 3];
    if (Math.max(p[a + 2], p[b + 2], p[c + 2]) + dz > minZ + 0.01) continue;
    bed += Math.abs((p[b] - p[a]) * (p[c + 1] - p[a + 1]) - (p[c] - p[a]) * (p[b + 1] - p[a + 1])) / 2;
  }
  return { minZ, share: bed / ((x1 - x0) * (y1 - y0)) };
});
if (Math.abs(lidOnBed.minZ) > 0.01 || lidOnBed.share < 0.5) errors.push(`[view] the Lid tab does not show the lid on its outer face: ${JSON.stringify(lidOnBed)}`);
await page.click('#tabBody');
await expectWatertight('view:body');
if ((await drawn()).includes('lid') || !(await drawn()).includes('board')) errors.push(`[view] the Body tab draws ${await drawn()}`);
if (await page.locator('#viewExploded').isVisible()) errors.push('[view] the Body tab offers exploded');
if ((await page.locator('#viewAssembled').getAttribute('aria-checked')) !== 'true') errors.push('[view] the Body tab is not shown assembled');
await page.uncheck('#viewBoards');
if ((await drawn()).includes('board')) errors.push('[view] the boards toggle does nothing');
await page.check('#viewBoards');
await page.click('#tabBoth');
if ((await page.locator('#viewExploded').getAttribute('aria-checked')) !== 'true') errors.push('[view] Both did not bring exploded back');
await page.click('#viewPrint');
await expectWatertight('view:print');
if ((await drawn()) !== 'body,lid') errors.push(`[view] the print layout draws ${await drawn()}`);
if (!(await page.locator('#viewCaption').textContent()).includes('print layout')) errors.push('[view] the caption does not say print layout');
if (!(await page.locator('#viewBoards').isDisabled())) errors.push('[view] the boards toggle is live in the print layout');
await page.check('#viewXray');
await page.waitForTimeout(100);
await page.uncheck('#viewXray');
await page.click('#viewExploded');

// languages: switch through all four, the choice is remembered
label('lang');
const expected = { en: 'Case', ru: 'Корпус', uk: 'Корпус', he: 'מארז' };
for (const [code, title] of Object.entries(expected)) {
  await page.selectOption('#langSel', code);
  await page.waitForTimeout(80);
  const heading = (await page.locator('#panel h2').first().textContent()).trim();
  if (heading !== title) errors.push(`[lang:${code}] heading "${heading}"`);
  if ((await page.locator('html').getAttribute('lang')) !== code) errors.push(`[lang:${code}] html lang`);
  // the open preset (pi4-desktop, from the view section) keeps its one name
  const presetText = (await page.locator('#presetBtn').textContent()).trim();
  if (presetText !== 'Pi 4 desktop case') errors.push(`[lang:${code}] the preset is called "${presetText}"`);
}
await page.reload();
await page.waitForTimeout(200);
if ((await page.locator('#langSel').inputValue()) !== 'he') errors.push('[lang] the choice was not remembered');
await page.selectOption('#langSel', 'en');

// a fresh Hebrew browser: Hebrew text, layout still left-to-right
label('lang:he-IL');
const heApp = await openApp({ preview: flags.has('preview'), locale: 'he-IL' });
const heading = (await heApp.page.locator('#panel h2').first().textContent()).trim();
if (heading !== 'מארז') errors.push(`[he-IL] heading "${heading}"`);
const panelBox = await heApp.page.locator('#panel').boundingBox();
const viewBox = await heApp.page.locator('#viewWrap').boundingBox();
if (!(panelBox.x < viewBox.x)) errors.push('[he-IL] the panel is not on the left');
if ((await heApp.page.locator('html').getAttribute('dir')) !== 'ltr') errors.push('[he-IL] the page direction changed');
errors.push(...heApp.errors);
await heApp.browser.close();

// the mobile panel: a bottom sheet with a settings button
label('mobile');
await page.setViewportSize({ width: 390, height: 780 });
await page.waitForTimeout(400);
// the drawn parts' bounding box on screen: the sheet may move it, never scale or stretch it
const onScreen = () => page.evaluate(() => {
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (const part of window.__case.drawnParts()) {
    const p = part.mesh.positions;
    const o = part.offset ?? [0, 0, 0];
    for (let i = 0; i < p.length; i += 3) {
      for (let k = 0; k < 3; k++) {
        lo[k] = Math.min(lo[k], p[i + k] + o[k]);
        hi[k] = Math.max(hi[k], p[i + k] + o[k]);
      }
    }
  }
  const corners = [];
  for (const x of [lo[0], hi[0]]) for (const y of [lo[1], hi[1]]) for (const z of [lo[2], hi[2]]) corners.push([x, y, z]);
  const screen = window.__case.project(corners);
  const xs = screen.map((q) => q[0]);
  const ys = screen.map((q) => q[1]);
  return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys), cy: (Math.max(...ys) + Math.min(...ys)) / 2 };
});
const withSheet = await onScreen();
await page.click('#panelBackdrop', { position: { x: 200, y: 60 } });
await page.waitForTimeout(400);
if (!(await page.locator('#panelBtn').isVisible())) errors.push('[mobile] no settings button after closing the sheet');
const withoutSheet = await onScreen();
if (Math.abs(withSheet.w - withoutSheet.w) > 1 || Math.abs(withSheet.h - withoutSheet.h) > 1) {
  errors.push(`[mobile] the sheet changes the picture's size or proportions: ${JSON.stringify({ withSheet, withoutSheet })}`);
}
if (!(withoutSheet.cy > withSheet.cy + 20)) errors.push('[mobile] the case is not centred above the sheet');
await page.click('#panelBtn');
await page.waitForTimeout(400);
if (!(await page.locator('#case_wall').isVisible())) errors.push('[mobile] the sheet did not open');
if (shotsDir) await page.screenshot({ path: `${shotsDir}/mobile.png` });

await app.close();

if (errors.length) {
  console.error(`smoke: ${errors.length} problem(s)`);
  for (const error of errors) console.error('  ' + error);
  process.exit(1);
}
console.log('smoke: ok');
