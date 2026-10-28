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
// a HAT display carried by the board under it: its window flush, its toggles in the board's box
label('carry');
await page.selectOption('#board0_top', 'pimoroni-hyperpixel-4');
await expectWatertight('carry:hyperpixel');
if (!(await page.locator('#board0_top_cut_display').count())) errors.push('[carry] no toggles for the carried display');
if (await page.isChecked('#board0_cut_gpio')) errors.push('[carry] the GPIO header under the display is open');
if (!(await page.evaluate(() => window.__case.drawn())).includes('glass')) errors.push('[carry] no glass drawn');
await page.selectOption('#board0_top', '');
await expectWatertight('carry:none');
// port captions over the ghosts: a click on one toggles its opening, undo brings it back
label('captions');
// the Pi 4's skirt warnings put badges over the case, and a badge hides the captions under it: count the captions alone
await page.uncheck('#viewWarnings');
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
await page.check('#viewWarnings');
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
// a keyboard: found by "keyboard", in its own group; it hangs, one window over its keys or a hole per key
label('keyboards');
await page.click('#boardAdd');
await page.fill('#boardSearch', 'keyboard');
const keyboardGroup = await page.evaluate(() => {
  const row = document.querySelector('#boardList [data-board="m5stack-cardkb-v1.1"]');
  let group = row?.previousElementSibling;
  while (group && !group.classList.contains('preset-group')) group = group.previousElementSibling;
  return group?.textContent ?? null;
});
if (keyboardGroup !== 'Keyboards') errors.push(`[keyboards] CardKB under ${keyboardGroup}, not Keyboards`);
await page.click('#boardList [data-board="m5stack-cardkb-v1.1"]');
await expectWatertight('keys:cardkb');
if (!(await page.locator('#board1_on_ceiling').getAttribute('class'))?.includes('active')) errors.push('[keyboards] the CardKB is not hung when added');
if (!(await page.locator('#board1_keys_window').getAttribute('class'))?.includes('active')) errors.push('[keyboards] the CardKB does not open a window');
if (!(await page.textContent('#warnings'))?.includes('under the lid')) errors.push('[keyboards] no word on how deep the keys sit');
// its keys are too low for holes: a hole per key says so
await page.click('#board1_keys_holes');
await expectWatertight('keys:holes');
if (!(await page.textContent('#warnings'))?.includes('a finger will not press')) errors.push('[keyboards] no warning for keys under the face in their holes');
await setRange('board1_keyFit', 2);
await expectWatertight('keys:fit');
if (!(await page.textContent('#warnings'))?.includes('of lid between')) errors.push('[keyboards] no warning for a thin web between holes');
// printed caps over the keys: drawn in their holes, and on the Lid tab next to the lid
await page.click('#board1_keys_caps');
await expectWatertight('keys:caps');
if (!(await drawn()).includes('cap')) errors.push(`[keyboards] caps chosen, drawn ${await drawn()}`);
await page.click('#tabLid');
await page.waitForTimeout(300);
if (!(await drawn()).includes('cap')) errors.push(`[keyboards] the Lid tab draws ${await drawn()}, no caps`);
await page.click('#tabBoth');
// square caps with rounded corners: the slider stops short of a sharp corner
await page.click('#board1_capShape_square');
await expectWatertight('keys:square-caps');
if (Number(await page.getAttribute('#board1_capR', 'min')) < 0.3) errors.push('[keyboards] a square cap\'s corner may go sharp');
await setRange('board1_capR', 0.3);
// the widest caps the neighbours leave room for: no thin web, the flanges still hold (at the caps' own fit:
// the 2 mm fit above lets no flange hold, whatever the size)
await setRange('board1_keyFit', 0.25);
await setRange('board1_capSize', await page.getAttribute('#board1_capSize', 'max'));
await expectWatertight('keys:caps-widest');
if ((await page.textContent('#warnings'))?.includes('may slip out')) errors.push('[keyboards] the widest caps slip out');
await page.waitForTimeout(200);
if (Number(await page.evaluate(() => window.__case.state().boards[1].capR)) < 0.3) errors.push('[keyboards] a square cap\'s corner went sharp');
await expectWatertight('keys:square-caps-r');
await page.click('#board1_keys_window');
// held by clamp bars instead of rails: they print with the lid that holds it
await page.click('#board1_hold_clamp');
await expectWatertight('keys:cardkb-clamp');
if ((await page.textContent('#board1'))?.includes('grooved rails')) errors.push('[keyboards] a clamped CardKB still says it is held by rails');
// sunk under the lid, it lies between the bars and the pads; the socket's note names the gap that hides it
// (on a 2 mm top: the slider extremes above left a 6 mm one, under which the socket hides anyway)
const floorBefore = await page.inputValue('#case_floor');
await setRange('case_floor', 2);
await setRange('board1_gap', 1.3);
await expectWatertight('keys:cardkb-pads');
const sinkTo = (await page.textContent('#warnings'))?.match(/the socket stands [0-9.]+ mm out of the lid through its slot; a Gap to the ceiling of ([0-9.]+) mm/)?.[1];
if (!sinkTo) errors.push('[keyboards] no word on how far the Grove socket stands out');
else {
  await setRange('board1_gap', sinkTo);
  await expectWatertight('keys:cardkb-sunk');
  if ((await page.textContent('#warnings'))?.includes('the socket stands')) errors.push(`[keyboards] the Grove socket still stands out at ${sinkTo} mm`);
}
await setRange('case_floor', floorBefore);
await page.click('#tabLid');
await page.waitForTimeout(300);
if (!(await drawn()).includes('clamp')) errors.push(`[keyboards] the Lid tab draws ${await drawn()}, no clamp bars`);
await page.click('#tabBoth');
await page.click('#board1_remove');
// the MacroPad's holes are among its switches: it stands on the floor, its keys through a hole each
await page.click('#boardAdd');
await page.fill('#boardSearch', 'macropad');
await page.click('#boardList [data-board="adafruit-macropad-rp2040"]');
await expectWatertight('keys:macropad');
if (!(await page.locator('#board1_on_floor').getAttribute('class'))?.includes('active')) errors.push('[keyboards] the MacroPad is not on the floor');
if (!(await page.locator('#board1_keys_holes').getAttribute('class'))?.includes('active')) errors.push('[keyboards] the MacroPad does not get a hole per key');
await page.click('#board1_remove');
// the BBQ20KBD: on the floor, a rest under each free corner (the worker builds them; the case stays closed)
await page.click('#boardAdd');
await page.fill('#boardSearch', 'bbq20');
await page.click('#boardList [data-board="solderparty-bbq20kbd"]');
await expectWatertight('keys:bbq20-rests');
await page.click('#board1_on_ceiling');
await expectWatertight('keys:bbq20-hung-rests');
await page.click('#board1_remove');
// the KeebDeck: its keypad's flange pressed by the lid (gap 0, no gap warning), a hole per key
await page.click('#boardAdd');
await page.fill('#boardSearch', 'keebdeck');
await page.click('#boardList [data-board="solderparty-keebdeck-basic"]');
await expectWatertight('keys:keebdeck');
if (Number(await page.inputValue('#board1_gap')) !== 0) errors.push('[keyboards] the KeebDeck is not pressed on its flange');
if ((await page.textContent('#warnings'))?.includes('glass thicker')) errors.push('[keyboards] a pressed flange warns about the gap');
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
// a Pi on its back: by the pattern, its turns, its standoffs drawn, its captions toggle its own openings
label('back');
await page.selectOption('#board1_back', 'raspberry-pi-5');
await expectWatertight('back:pi5');
if (!(await page.isDisabled('#board1_back_rot_0')) || (await page.isDisabled('#board1_back_rot_270'))) errors.push('[back] the Pi\'s turns are not the pattern\'s');
await page.click('#board1_back_rot_270');
await expectWatertight('back:270');
if (!(await page.locator('#board1_back_cut_usb-c').count())) errors.push('[back] no toggles for the Pi\'s ports');
// the camera eases after the turn: read the captions once it has stopped, just before the click
await page.waitForTimeout(600);
const backCaption = (await page.evaluate(() => window.__case.captions())).find((caption) => caption.key.startsWith('1b:'));
if (backCaption) {
  const portId = backCaption.key.slice(3);
  const backCut = (id) => page.evaluate((port) => {
    const board = window.__case.state().boards[1];
    return board ? (board.back?.cuts[port] ?? 'default') : `no board 1 (${window.__case.state().boards.length} boards)`;
  }, id);
  const before = await backCut(portId);
  const viewBox = await page.locator('#view').boundingBox();
  await page.mouse.click(viewBox.x + backCaption.x, viewBox.y + backCaption.y);
  await expectWatertight('back:caption');
  const after = await backCut(portId);
  if (after === before || String(after).startsWith('no board')) errors.push(`[back] a click on the ${portId} caption: ${before} → ${after}`);
}
await page.selectOption('#board1_back', '');
await expectWatertight('back:none');
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
// an automatic id follows the type: the toggle under the editor says so
const portIds = await page.evaluate(() => window.__case.state().boards[0].custom.ports.map((port) => port.id));
if (portIds.join() !== 'micro-hdmi-1,usb-c-2') errors.push(`[custom] port ids ${portIds.join()}`);
if (!(await page.locator('#board0_cut_micro-hdmi-1').count())) errors.push('[custom] no toggle for micro-hdmi-1');
// a part under the board is a negative Z on an edge: the hint says so
if (!(await page.locator('#board0_custom_port0_hint').textContent()).includes('under the board')) errors.push('[custom] the edge port hint does not explain Z');
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
// a key field on top goes through the plate from its base: the editor asks for it
await page.selectOption('#board0_custom_port1_type', 'keys');
if (!(await page.locator('#board0_custom_port1_base').count())) errors.push('[custom] a key field has no base field');
await page.fill('#board0_custom_port1_base', '1');
await expectWatertight('custom:keys');
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

// the hinged preset: two halves, a printed hinge, a cable, magnets
label('preset:meshtastic-clamshell');
await page.click('#presetBtn');
await page.click('#presetList [data-preset="b:meshtastic-clamshell"]');
await expectWatertight('preset:meshtastic-clamshell');
if ((await page.locator('#warnings .warn-line:not(.info)').count()) > 0) errors.push('[preset:meshtastic-clamshell] warnings');
if (!(await drawn()).includes('hinge')) errors.push('[preset:meshtastic-clamshell] no printed hinge drawn');
await page.click('#presetBtn');
await page.click('#presetList [data-preset="b:plain-box"]');

// a hinged case: two halves, each with its own boards and lid (plans/PLAN-HINGED.md)
label('hinged');
await page.click('#case_kind_hinged');
await expectWatertight('hinged');
if (!(await page.locator('#hingeCard').isVisible()) || !(await page.locator('#halfBar').isVisible())) errors.push('[hinged] no hinge card or half switch');
if (!(await page.locator('#lid_face_front').isDisabled())) errors.push('[hinged] a half allows a side lid');
if (await page.locator('#mount_kind').isVisible()) errors.push('[hinged] a hinged case offers a wall mount');
await page.click('#edit_half_b');
await page.click('#boardAdd');
await page.click('#boardList [data-board="esp32-devkitc-v4"]');
await page.click('#lid_face_bottom');
await expectWatertight('hinged:upper');
const halves = await page.evaluate(() => {
  const state = window.__case.state();
  return [state.boards.length, state.hinge.b.boards.length, state.lid.face, state.hinge.b.lid.face, window.__case.parts().cases.length].join();
});
if (halves !== '0,1,top,bottom,2') errors.push(`[hinged] boards, lids, built halves: ${halves}`);
// both lids on the bottom: knuckles printed with the halves would hang under the bed
await page.click('#edit_half_a');
await page.click('#lid_face_bottom');
if (!(await page.textContent('#warnings'))?.includes('below the bed')) errors.push('[hinged] no warning for knuckles with both lids on the bottom');
await page.click('#lid_face_top');
await page.click('#hinge_layout_full');
await page.click('#hinge_knuckles_5');
if (await page.locator('#hinge_length').isVisible()) errors.push('[hinged] one block along the edge offers a knuckle length');
await expectWatertight('hinged:knuckles-full');
await page.click('#hinge_layout_ends');
await setRange('hinge_pinD', 3);
await expectWatertight('hinged:knuckles-3mm');
await page.click('#hinge_axle_screw');
await page.click('#hinge_screw_M3');
if (await page.locator('#hinge_pinD').isVisible()) errors.push('[hinged] a screw axle offers a pin diameter');
if (!(await page.textContent('#warnings'))?.includes('× M3 screw')) errors.push('[hinged] no word on the hinge screws to buy');
await expectWatertight('hinged:screw');
await page.click('#hinge_axle_snap');
if (await page.locator('#hinge_screw').isVisible()) errors.push('[hinged] a snap offers a screw');
if (!(await page.textContent('#warnings'))?.includes('split rings')) errors.push('[hinged] no word on how a snap goes together');
await expectWatertight('hinged:snap');
await page.click('#hinge_axle_pin');
await page.click('#cableAdd');
if (!(await page.locator('#cable0_w').isVisible())) errors.push('[hinged] no cable card');
await page.click('#cable0_kind_round');
if (await page.locator('#cable0_t').isVisible()) errors.push('[hinged] a round cable offers a thickness');
await setRange('cable0_plugH', 5);
if (!(await page.textContent('#warnings'))?.includes('from slot to slot')) errors.push('[hinged] no word on the cable\'s length');
await expectWatertight('hinged:cable');
await page.click('#cable0_remove');
// a printed hinge on screws: any lids, cones printed in place
if (!(await page.locator('#hinge_axle_cones').isDisabled())) errors.push('[hinged] knuckles offer cones');
await page.click('#hinge_kind_leaves');
await page.click('#hinge_axle_cones');
await page.click('#hinge_leafHole_nut');
await page.click('#edit_half_a');
await page.click('#lid_face_bottom');
await page.click('#edit_half_b');
await page.click('#lid_face_bottom');
if ((await page.textContent('#warnings'))?.includes('below the bed')) errors.push('[hinged] a printed hinge warns about lids on the bottom');
if (!(await page.textContent('#warnings'))?.includes('Printed hinge:')) errors.push('[hinged] no word on the printed hinge\'s screws');
await expectWatertight('hinged:leaves');
if (!(await drawn()).includes('hinge')) errors.push('[hinged] the printed hinge is not drawn');
await page.click('#viewPrint');
if (!(await drawn()).includes('hinge')) errors.push('[hinged] the printed hinge is not on the bed');
await exportStl('hinged:leaves');
await page.click('#viewExploded');
await page.click('#hinge_kind_knuckles');
await page.click('#lid_face_top');
await page.click('#edit_half_a');
await page.click('#lid_face_top');
// the gap from what stands out, set by hand; magnets inside
if (!(await page.locator('#hinge_gap').isDisabled())) errors.push('[hinged] the automatic gap can be dragged');
await page.click('#hinge_gapAuto');
await setRange('hinge_gap', 2.5);
await page.click('#hinge_magnets');
if (!(await page.locator('#hinge_magnet').isVisible())) errors.push('[hinged] no magnet size');
await expectWatertight('hinged:magnets');
await page.click('#hinge_magnets');
await page.click('#hinge_gapAuto');
if (await page.locator('#board0_remove').count()) errors.push('[hinged] the lower half shows the upper half\'s board');
if ((await page.locator('#lid_face_top').getAttribute('class'))?.includes('active') !== true) errors.push('[hinged] the lower half shows the upper half\'s lid');
await setRange('view_angle', 0);
await page.click('#viewAssembled');
await expectWatertight('hinged:closed');
if (!(await page.locator('#viewCaption').textContent()).includes('open by 0°')) errors.push('[hinged] the caption does not say the angle');
await page.click('#viewPrint');
if (!(await page.locator('#viewCaption').textContent()).includes('upper half behind')) errors.push('[hinged] the print caption does not place the upper half');
if (!(await page.locator('#view_angle').isDisabled())) errors.push('[hinged] the angle is live in the print layout');
await page.click('#viewExploded');
await exportStl('hinged');
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
// a user's project (tests/fixtures/korpus-1.json): its messages name the wall and the board in the way; notes are grey, not counted
label('file:user');
await page.setInputFiles('#fileInput', join(process.cwd(), 'tests/fixtures/korpus-1.json'));
await page.waitForTimeout(150);
await expectWatertight('file:user');
const userLines = await page.locator('#warnings .warn-line').allTextContents();
if (!userLines.some((line) => line.includes('not against the right wall: board 3 “KaRadio ESP32”'))) errors.push(`[file:user] ${userLines.join(' | ').slice(0, 200)}`);
if ((await page.locator('#warnings .warn-line.info').count()) !== 2) errors.push('[file:user] not two notes');
if ((await page.locator('#warnings .warn-head').textContent()) !== '3 warnings · 2 notes') errors.push(`[file:user] head ${await page.locator('#warnings .warn-head').textContent()}`);
// on the model: a badge per message with a place, a hover on a line opens its badge, the toggle hides them
label('file:user:spots');
await page.waitForTimeout(150);
const badges = await page.evaluate(() => window.__case.warnings());
if (badges.length !== 5) errors.push(`[file:user:spots] ${badges.length} badges: ${JSON.stringify(badges).slice(0, 200)}`);
await page.hover('#warnings [data-warn="1"]');
const opened = await page.evaluate(() => window.__case.warnings().find((badge) => badge.n === 1));
if (!opened?.open || !opened.text.includes('right wall')) errors.push(`[file:user:spots] hover: ${JSON.stringify(opened)}`);
if (!(await page.locator('#warnings [data-warn="1"]').evaluate((row) => row.classList.contains('hot')))) errors.push('[file:user:spots] the hovered line is not lit');
await page.mouse.move(0, 0);
await page.uncheck('#viewWarnings');
if ((await page.evaluate(() => window.__case.warnings())).length !== 0) errors.push('[file:user:spots] the toggle does not hide the badges');
await page.check('#viewWarnings');

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
// the lid's place on the bed: behind the body, then right of it; the caption names it
label('view:print-lid');
await page.click('#viewPrint');
const lidBox = () => page.evaluate(() => {
  const parts = window.__case.drawnParts();
  const box = (role) => {
    const { positions: p } = parts.find((part) => part.role === role).mesh;
    let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
    for (let i = 0; i < p.length; i += 3) { x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]); y0 = Math.min(y0, p[i + 1]); y1 = Math.max(y1, p[i + 1]); }
    return { x0, y0, x1, y1 };
  };
  return { body: box('body'), lid: box('lid') };
});
await page.click('#print_lid_behind');
await setRange('print_gap', 20);
await page.waitForTimeout(150);
const behind = await lidBox();
if (Math.abs(behind.lid.y0 - behind.body.y1 - 20) > 0.01 || Math.abs(behind.lid.x0) > 0.01) errors.push(`[view:print-lid] behind: ${JSON.stringify(behind)}`);
if (!(await page.locator('#viewCaption').textContent()).includes('lid behind')) errors.push('[view:print-lid] the caption does not say behind');
await page.click('#print_lid_right');
await page.waitForTimeout(150);
const right = await lidBox();
if (Math.abs(right.lid.x0 - right.body.x1 - 20) > 0.01) errors.push(`[view:print-lid] right: ${JSON.stringify(right)}`);
await exportStl('both:right');
await page.click('#print_lid_auto');
await setRange('print_gap', 10);
await page.click('#viewExploded');
if (!(await page.locator('#print_lid_auto').isDisabled()) || !(await page.locator('#print_gap').isDisabled())) errors.push('[view:print-lid] the lid\'s place is offered outside the print layout');
await page.click('#tabLid');
if (await page.locator('#print_lid_auto').isVisible()) errors.push('[view:print-lid] the Lid tab offers the lid\'s place');
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
