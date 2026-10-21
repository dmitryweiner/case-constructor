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
label('boards:search');
await page.click('#boardAdd');
await page.fill('#boardSearch', 'heltec');
const found = await page.locator('#boardList [data-board]').count();
if (found !== 1) errors.push(`[boards:search] "heltec" finds ${found}`);
await page.click('#boardList [data-board]');
await expectWatertight('boards:two');
label('boards:overlap');
await setRange('board1_x', 0);
await page.waitForTimeout(100);
if (!(await page.locator('#warnings').textContent()).includes('overlap')) errors.push('[boards:overlap] no warning');
await page.click('#board1_remove');
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

// view toggles
label('view');
await page.selectOption('#viewLid', 'lifted');
await page.selectOption('#viewLid', 'hidden');
await page.check('#viewXray');
await page.waitForTimeout(100);
await page.selectOption('#viewLid', 'assembled');
await page.uncheck('#viewXray');

// languages: switch through all four, the choice is remembered
label('lang');
const expected = { en: 'Case', ru: 'Корпус', uk: 'Корпус', he: 'מארז' };
for (const [code, title] of Object.entries(expected)) {
  await page.selectOption('#langSel', code);
  await page.waitForTimeout(80);
  const heading = (await page.locator('#panel h2').first().textContent()).trim();
  if (heading !== title) errors.push(`[lang:${code}] heading "${heading}"`);
  if ((await page.locator('html').getAttribute('lang')) !== code) errors.push(`[lang:${code}] html lang`);
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
await page.waitForTimeout(200);
await page.click('#panelBackdrop', { position: { x: 200, y: 60 } });
await page.waitForTimeout(350);
if (!(await page.locator('#panelBtn').isVisible())) errors.push('[mobile] no settings button after closing the sheet');
await page.click('#panelBtn');
await page.waitForTimeout(350);
if (!(await page.locator('#case_wall').isVisible())) errors.push('[mobile] the sheet did not open');
if (shotsDir) await page.screenshot({ path: `${shotsDir}/mobile.png` });

await app.close();

if (errors.length) {
  console.error(`smoke: ${errors.length} problem(s)`);
  for (const error of errors) console.error('  ' + error);
  process.exit(1);
}
console.log('smoke: ok');
