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
    // the second argument goes to the page function; options are the third
    undefined,
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

/** Roles drawn last (dev builds): 'body,board,…,lid'. */
async function drawn() {
  await page.waitForTimeout(150);
  return (await page.evaluate(() => window.__case.drawn())).join(',');
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
  if (await page.locator('#board0_pins').isVisible()) {
    await page.click('#board0_pins');
    await expectWatertight(`board:${id}:pins`);
  }
}
// pins soldered downwards: the board goes up with them, rails get a pin bed
label('pins');
await page.click('#board0_remove');
await page.click('#boardAdd');
await page.click('#boardList [data-board="arduino-nano"]');
if (!(await page.isChecked('#board0_pins'))) errors.push('[pins] the Nano ships with its pins soldered');
await page.uncheck('#board0_pins');
await setRange('board0_z', 0);
await expectWatertight('pins:bare');
const bareZ = await page.evaluate(() => window.__case?.state().boards[0].z);
await page.check('#board0_pins');
await expectWatertight('pins:bed');
const pinZ = await page.evaluate(() => window.__case?.state().boards[0].z);
if (bareZ !== undefined && !(pinZ > bareZ + 5)) errors.push(`[pins] z ${bareZ} → ${pinZ}: the board did not go up with its pins`);
// a family entry: the model brings its own parts and their toggles
label('variant');
await page.click('#board0_remove');
await page.click('#boardAdd');
await page.click('#boardList [data-board="seeed-xiao"]');
await page.selectOption('#board0_variant', 'rp2040');
await expectWatertight('variant:rp2040');
if (!(await page.locator('#board0_cut_rgb-led').count())) errors.push('[variant] the XIAO RP2040 has no RGB LED toggle');
if (await page.locator('#board0_cut_shield').count()) errors.push('[variant] the XIAO RP2040 kept the S3 shield');
label('ports');
await page.click('#board0_remove');
await page.click('#boardAdd');
await page.click('#boardList [data-board="raspberry-pi-4b"]');
await page.uncheck('#board0_cut_ethernet');
await expectWatertight('ports:ethernet-off');
await page.check('#board0_cut_ethernet');
// port captions over the ghosts: a click on one toggles its opening, undo brings it back
label('captions');
await expectWatertight('captions:shown');
const captions = await page.evaluate(() => window.__case.captions());
if (captions.length < 4) errors.push(`[captions] only ${captions.length} port captions shown`);
// USB-C when it shows; the camera keeps its distance from earlier steps, and an overlapped caption hides
const target = captions.find((caption) => caption.key === '0:usb-c') ?? captions[0];
if (!target) errors.push('[captions] no caption to click');
else {
  const portId = target.key.slice(target.key.indexOf(':') + 1);
  // read from the state: the card's checkbox may be mid-rebuild; a port at its default has no entry
  const portCutNow = () => page.evaluate((id) => window.__case.state().boards[0].cuts[id] ?? 'default', portId);
  const before = await portCutNow();
  const viewBox = await page.locator('#view').boundingBox();
  await page.mouse.click(viewBox.x + target.x, viewBox.y + target.y);
  await expectWatertight('captions:port-toggled');
  if ((await portCutNow()) === before) errors.push(`[captions] a click on the ${portId} caption left its opening as it was`);
  await page.click('#undoBtn');
  await expectWatertight('captions:undo');
  if ((await portCutNow()) !== before) errors.push(`[captions] undo did not bring the ${portId} opening back`);
}
await page.uncheck('#viewPortNames');
await page.waitForTimeout(150);
if ((await page.evaluate(() => window.__case.captions())).length) errors.push('[captions] names stay with "Connector names" off');
await page.check('#viewPortNames');
await page.uncheck('#viewBoards');
if ((await page.evaluate(() => window.__case.captions())).length) errors.push('[captions] captions stay with the boards hidden');
if (!(await page.locator('#viewPortNames').isDisabled())) errors.push('[captions] "Connector names" is live with the boards hidden');
await page.check('#viewBoards');
// a board against walls: the Pi 4 flush on the front and the right, the case shrinks
label('walls');
const sizeOf = async () => (await page.locator('#status').textContent()).trim();
const centred = await sizeOf();
await page.click('#board0_wall_right');
await page.click('#board0_wall_front');
await expectWatertight('walls:front-right');
if ((await sizeOf()) === centred) errors.push(`[walls] the case did not change against two walls: ${centred}`);
await setRange('board0_wallOffset', -1);
await expectWatertight('walls:recessed');
await page.click('#case_kind_cylinder');
if (await page.locator('#board0_wall').isVisible()) errors.push('[walls] a cylinder offers walls');
await page.click('#case_kind_box');
await page.click('#board0_wall_right');
await page.click('#board0_wall_front');
if (await page.locator('#board0_wallOffset').isVisible()) errors.push('[walls] the offset stays without walls');
if ((await sizeOf()) !== centred) errors.push(`[walls] back from the walls, the case is ${await sizeOf()}, not ${centred}`);
// a battery from the picker: placed beside the board, cells to a pack and back
label('battery');
await page.click('#boardAdd');
await page.fill('#boardSearch', '18650');
await page.click('#boardList [data-board="battery-18650"]');
await expectWatertight('battery:2x18650');
const cellsName = (await page.locator('#board1 .board-name').textContent()).trim();
if (!cellsName.includes('2 × 18650')) errors.push(`[battery] the card says "${cellsName}"`);
if ((await page.evaluate(() => window.__case.ghosts().length)) < 3) errors.push('[battery] no ghost for the battery');
if (!(await drawn()).includes('clamp')) errors.push(`[battery] the clamps are not drawn: ${await drawn()}`);
await page.click('#board1_cells_4');
await expectWatertight('battery:4x18650');
await page.click('#tabBody');
await page.click('#viewPrint');
await expectWatertight('battery:print');
if ((await drawn()) !== 'body,clamp') errors.push(`[battery] the body's print layout draws ${await drawn()}`);
await exportStl('battery:body');
await page.click('#tabBoth');
await page.click('#viewExploded');
await page.selectOption('#board1_battery', 'pack');
await setRange('board1_pack_h', 12);
await expectWatertight('battery:pack');
if (await page.locator('#board1_cells').isVisible()) errors.push('[battery] a pack offers a cell count');
await page.click('#board1_remove');
// a ready-made holder: its own group in the picker, screwed down like a board
await page.click('#boardAdd');
await page.fill('#boardSearch', 'battery');
if (!(await page.locator('#boardList [data-board="mpd-bh2aa-w"]').count())) errors.push('[holders] "battery" does not find the AA holder');
await page.click('#boardList [data-board="mpd-bh2aa-w"]');
await expectWatertight('holders:bh2aa');
await page.click('#board1_remove');
// a display: found by "screen", in its own group, its glass drawn
label('displays');
await page.click('#boardAdd');
await page.fill('#boardSearch', 'screen');
const displayGroup = await page.evaluate(() => {
  const row = document.querySelector('#boardList [data-board="lcdwiki-msp2807"]');
  let group = row?.previousElementSibling;
  while (group && !group.classList.contains('preset-group')) group = group.previousElementSibling;
  return group?.textContent ?? null;
});
if (displayGroup !== 'Displays') errors.push(`[displays] MSP2807 under ${displayGroup}, not Displays`);
await page.click('#boardList [data-board="lcdwiki-msp2807"]');
await expectWatertight('displays:msp2807');
if (!(await page.evaluate(() => window.__case.drawn())).includes('glass')) errors.push('[displays] no glass drawn');
// hung from the ceiling when added: the gap slider, not the standoff height; exploded, it goes up with the lid
if (!(await page.locator('#board1_on_ceiling').getAttribute('class'))?.includes('active')) errors.push('[hang] a display is not hung when added');
if (!(await page.locator('#board1_gap').isVisible()) || await page.locator('#board1_z').isVisible()) errors.push('[hang] a hung board shows the standoff height');
const lifted = await page.evaluate(() => {
  const parts = window.__case.drawnParts();
  return { lid: parts.find((part) => part.role === 'lid')?.offset?.[2] ?? 0, glass: parts.find((part) => part.role === 'glass')?.offset?.[2] ?? 0 };
});
if (Math.abs(lifted.lid - lifted.glass) > 1e-6 || lifted.lid <= 0) errors.push(`[hang] exploded, the lid rises ${lifted.lid} and the display ${lifted.glass}`);
await page.click('#board1_hole_nut');
await expectWatertight('hang:nut');
// the window's chamfer, on by default; off, the case still closes
if (!(await page.isChecked('#board1_bevel'))) errors.push('[window] a hung display\'s window is not chamfered');
await page.uncheck('#board1_bevel');
await expectWatertight('window:plain');
await page.check('#board1_bevel');
await setRange('board1_gap', 0);
if (!(await page.textContent('#warnings'))?.includes('0.3')) errors.push('[hang] no warning for a gap under 0.3 mm');
await page.click('#lid_face_bottom');
await expectWatertight('hang:bottom-lid');
// on a console it hangs from the slope; a tilted edge cannot stand against the front or back wall
await page.click('#case_kind_console');
await expectWatertight('hang:slope');
if (!(await page.isDisabled('#board1_wall_front')) || !(await page.isDisabled('#board1_wall_back'))) errors.push('[slope] a board on the slope offers the front or back wall');
await page.click('#case_kind_box');
await page.click('#lid_face_top');
await page.click('#board1_on_floor');
if (!(await page.locator('#board1_z').isVisible())) errors.push('[hang] back on the floor without its standoff height');
await expectWatertight('hang:floor');
await page.click('#board1_remove');
// a clamped panel: always hung, a clamp gap, its bars printed with the lid that holds it
label('clamp');
await page.click('#boardAdd');
await page.fill('#boardSearch', 'touch display 2');
await page.click('#boardList [data-board="raspberry-pi-touch-display-2-7"]');
await expectWatertight('clamp:td2');
if (await page.locator('#board1_on_floor').isVisible()) errors.push('[clamp] a clamped panel offers the floor');
if (!(await page.locator('#board1_clampPress').isVisible())) errors.push('[clamp] no clamp gap');
await setRange('board1_clampPress', -1);
await expectWatertight('clamp:gap');
await page.click('#tabLid');
await page.waitForTimeout(300);
if (!(await drawn()).includes('clamp')) errors.push(`[clamp] the Lid tab draws ${await drawn()}, no bars`);
await page.click('#tabBoth');
await page.click('#board1_remove');
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
await page.fill('#boardSearch', 'lora 32 v3');
const found = await page.locator('#boardList [data-board]').count();
if (found !== 1) errors.push(`[boards:search] "lora 32 v3" finds ${found}`);
await page.click('#boardList [data-board]');
await expectWatertight('boards:two');
label('boards:overlap');
// the Heltec has a screen, so it hangs when added: over the Pi that is no overlap; on the floor it is
await page.click('#board1_on_floor');
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
// box → console → box: the lid goes to the bottom and comes back on top;
// exploded, the bottom lid floats under the body, both above the grid
label('lid:console-and-back');
await page.click('#case_kind_console');
await expectWatertight('lid:console-bottom');
const lowest = await page.evaluate(() => Math.min(...window.__case.drawnParts().map((part) => {
  let low = Infinity;
  const p = part.mesh.positions;
  for (let i = 2; i < p.length; i += 3) low = Math.min(low, p[i] + (part.offset?.[2] ?? 0));
  return low;
})));
if (lowest < -1e-6) errors.push(`[lid] the exploded bottom lid goes under the grid: z = ${lowest.toFixed(2)}`);
await page.click('#case_kind_box');
const faceBack = await page.evaluate(() => window.__case.state().lid.face);
if (faceBack !== 'top') errors.push(`[lid] box → console → box leaves the lid on the ${faceBack}`);
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
// the head seat: a countersunk M3 is 6 mm by default; the user's diameter and depth, then the table back
label('fastening:head');
if (Number(await page.locator('#lid_headD').inputValue()) !== 6) errors.push('[head] a countersunk M3 seat is not 6 mm');
if (await page.locator('#lid_headDepth').isVisible()) errors.push('[head] a countersunk seat offers a counterbore depth');
await setRange('lid_headD', 7);
await expectWatertight('fastening:head:countersunk-7');
await page.click('#lid_head_counterbore');
// the sliders stop at what the lid takes: the plate less 0.6 mm, a wall to the lid's edge
await setRange('lid_headDepth', 5);
await expectWatertight('fastening:head:counterbore-deep');
const deepest = await page.evaluate(() => window.__case.state().lid.head.depth);
if (!(deepest > 1 && deepest < 2)) errors.push(`[head] the counterbore depth went to ${deepest} on a 2 mm plate`);
await setRange('lid_headD', 16);
await expectWatertight('fastening:head:widest');
const widest = await page.evaluate(() => window.__case.state().lid.head.d);
if (!(widest > 5.5 && widest < 12)) errors.push(`[head] the head seat went to ${widest} mm`);
await page.click('#lid_headReset');
if (await page.locator('#lid_headReset').isVisible()) errors.push('[head] the reset button stays after a reset');
if (Number(await page.locator('#lid_headD').inputValue()) !== 5.5) errors.push('[head] the reset does not bring the pan head back');
await page.click('#lid_face_left');
await expectWatertight('fastening:screws:left');
await page.click('#lid_face_top');
await page.click('#lid_fastening_magnets');
if (await page.locator('#lid_hole_tap').isVisible()) errors.push('[fastening] magnets offer screw holes');
await page.selectOption('#lid_magnet', '8x2');
await setRange('lid_magnetFit', 0.3);
await expectWatertight('fastening:magnets');
await page.click('#lid_face_bottom');
await expectWatertight('fastening:magnets:bottom');
await page.click('#lid_face_top');
label('fastening:printed');
await page.click('#lid_fastening_printed');
await page.selectOption('#lid_thread', 'P4');
await expectWatertight('fastening:printed:P4');
if (!(await page.locator('#warnings').textContent()).includes('may strip')) errors.push('[printed] no warning about the 4 mm thread');
await page.selectOption('#lid_thread', 'P8');
if ((await page.locator('#warnings').textContent()).includes('may strip')) errors.push('[printed] the 4 mm warning stays for 8 mm');
await setRange('lid_threadFit', 0.25);
await expectWatertight('fastening:printed');
if (!(await drawn()).includes('screw')) errors.push(`[printed] the screws are not drawn: ${await drawn()}`);
await page.click('#tabLid');
// the tab redraws from the last preview, which may still be on its way
await page.waitForFunction(() => window.__case.drawn().join(',') === 'lid,screw', null, { timeout: 5000 }).catch(() => {});
const lidTab = await drawn();
if (lidTab !== 'lid,screw') errors.push(`[printed] the Lid tab draws ${lidTab}`);
await exportStl('printed:lid');
await page.click('#tabBoth');
await page.click('#lid_face_right');
await expectWatertight('fastening:printed:right');
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
if (await page.locator('#mount_earAlong').isVisible()) errors.push('[ears] "along the wall" offered for one ear per wall');
await page.click('#mount_earCount_4');
await page.click('#mount_earWalls_frontBack');
await page.click('#mount_earAlong_ends');
if (await page.locator('#mount_spacing').isVisible()) errors.push('[ears] spacing offered for ears at the ends');
await expectWatertight('ears:4:frontBack:ends');
await page.click('#mount_earWalls_one');
await page.selectOption('#mount_earWall', 'left');
await page.click('#mount_earCount_1');
await expectWatertight('ears:1:left');
await page.click('#mount_earWalls_leftRight');
await page.click('#mount_earCount_2');
const trianglesBefore = await page.evaluate(() => window.__case.parts()?.lid.indices.length ?? 0);
await page.check('#on_label');
await page.fill('#label_text', 'Hello שלום Привет');
await page.waitForTimeout(1500);
await expectWatertight('label');
const trianglesAfter = await page.evaluate(() => window.__case.parts()?.lid.indices.length ?? 0);
if (!flags.has('preview') && trianglesAfter <= trianglesBefore) errors.push('[label] the lid did not change');
await page.check('#label_raised');
await expectWatertight('label:raised');
// a quick place: a corner and a quarter turn; the margin row shows only off the centre
if (await page.locator('#label_margin').isVisible()) errors.push('[label] the margin shows for the centre');
await page.click('#label_anchor_bottomRight');
await page.click('#label_turn_270');
await expectWatertight('label:corner');
const placed = await page.evaluate(() => window.__case.state().label);
if (placed.anchor !== 'bottomRight' || placed.angle !== -90) errors.push(`[label] anchor/turn not applied: ${JSON.stringify(placed)}`);
if (!(await page.locator('#label_margin').isVisible())) errors.push('[label] no margin for a corner');
await page.click('#label_anchor_centre');
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
const canvasBox = await page.locator('#view').boundingBox();
const [tapX, tapY] = [canvasBox.x + 200, canvasBox.y + 60];
// a tap on the canvas closes it
await page.mouse.click(tapX, tapY);
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
// with the sheet open, a drag on the canvas turns the case and leaves the sheet open
const turnedBefore = await page.evaluate(() => window.__case.project([[0, 0, 0], [100, 0, 0]]));
await page.mouse.move(tapX, tapY);
await page.mouse.down();
await page.mouse.move(tapX + 60, tapY + 10, { steps: 6 });
await page.mouse.up();
await page.waitForTimeout(300);
const turnedAfter = await page.evaluate(() => window.__case.project([[0, 0, 0], [100, 0, 0]]));
if (JSON.stringify(turnedBefore) === JSON.stringify(turnedAfter)) errors.push('[mobile] a drag over the open sheet does not turn the case');
if (!(await page.locator('#panel').evaluate((el) => el.classList.contains('open')))) errors.push('[mobile] a drag closed the sheet');
if (shotsDir) await page.screenshot({ path: `${shotsDir}/mobile.png` });

await app.close();

if (errors.length) {
  console.error(`smoke: ${errors.length} problem(s)`);
  for (const error of errors) console.error('  ' + error);
  process.exit(1);
}
console.log('smoke: ok');
