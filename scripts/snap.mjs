#!/usr/bin/env node
// A spot screenshot of the app in a given state. Extend with flags rather
// than writing throw-away scripts (CLAUDE.md).
//
//   node scripts/snap.mjs --out shots/x.png
//   node scripts/snap.mjs --out shots/x.png --click '#case_kind_cylinder' --set case_edgeR=6
//
// Flags:
//   --out <path>          where to save (required)
//   --preset <id>         a built-in preset by id
//   --lang en|ru|uk|he    interface language (default en)
//   Actions (--check/--uncheck/--set/--upload/--click) run in command-line
//   order — a click may reveal a slider that is set next.
//   --set <id>=<value>    any input/select by element id (repeatable)
//   --check <id>          tick a checkbox (repeatable)
//   --uncheck <id>        untick a checkbox (repeatable)
//   --click <selector>    click a selector (repeatable)
//   --upload <id>=<path>  hand a file to an <input type=file> (repeatable)
//   --view                only the 3D view, without the panel
//   --clip x,y,w,h        a piece of the frame — to look at a joint closely
//   --camera <name>       iso (the default view), top, bottom, front, back, left, right,
//                         under (iso from below); dev builds only, applied after the actions
//   --orbit dx,dy         orbit the camera with the mouse (after --camera)
//   --panel open|hidden   narrow screens: show or hide the settings sheet (after the actions)
//   --wait <ms>           extra pause before the shot
//   --width / --height    window size
//   --preview             production build instead of the dev server
//   --url <path>          shoot any server path (the icon, an asset)
//   --eval <js>           evaluate an expression in the page after the shot and print it
//                         (dev builds expose window.__case: state(), parts(), ghosts(),
//                         drawn(), drawnParts(), project([[x, y, z], …]), built())
//
// On the dev server the snap waits for the app's first build before the
// actions and for the build of each action's state after it. A page reload
// in between (Vite's HMR, while another process edits files) is an error:
// the actions would have gone to the old page.

import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseArgs, openApp } from './lib/harness.mjs';

const flags = parseArgs(
  process.argv.slice(2),
  ['out', 'preset', 'wait', 'width', 'height', 'url', 'clip', 'orbit', 'lang', 'eval', 'panel', 'camera'],
  ['set', 'check', 'uncheck', 'click', 'upload'],
);

const out = flags.get('out');
if (!out) {
  console.error('--out <path> is required');
  process.exit(2);
}
mkdirSync(dirname(out), { recursive: true });

const LOCALES = { en: 'en-US', ru: 'ru-RU', uk: 'uk-UA', he: 'he-IL' };

const app = await openApp({
  preview: flags.has('preview'),
  width: Number(flags.get('width') ?? 1280),
  height: Number(flags.get('height') ?? 860),
  locale: LOCALES[flags.get('lang') ?? 'en'] ?? 'en-US',
});
const { page, errors, label } = app;

const rawUrl = flags.get('url');
if (rawUrl) {
  // A static asset: no app, just open the path.
  label(`url:${rawUrl}`);
  await page.goto(new URL(rawUrl, page.url()).href);
  await page.waitForTimeout(Number(flags.get('wait') ?? 300));
  await page.screenshot({ path: out });
  await app.close();
  console.log(`snap → ${out}`);
  process.exit(errors.length ? 1 : 0);
}

label('boot');
await page.waitForFunction(
  () => (document.querySelector('#status')?.textContent ?? '').length > 0,
  { timeout: 20000 },
);

// Dev builds report when the worker has answered for the current state; the
// production build has no hook, and there the audit's text is all there is.
const dev = await page.evaluate(() => typeof window.__case?.built === 'function');
async function settle() {
  if (dev) {
    await page.waitForFunction(() => window.__case?.built(), undefined, { timeout: 30000 });
    return;
  }
  await page.waitForFunction(
    () => {
      const text = document.querySelector('#audit')?.textContent ?? '';
      return text.length > 0 && !/building|сборка|збирання|בונה/.test(text);
    },
    undefined,
    { timeout: 30000 },
  ).catch(() => {});
}
await settle();

// From here on a navigation of the main frame is a reload under our feet.
let reloaded = false;
page.on('framenavigated', (frame) => {
  if (frame === page.mainFrame()) reloaded = true;
});
function checkReload(step) {
  if (!reloaded) return;
  console.error(`the page reloaded during the actions (at ${step}): the dev server saw a file change. Run the snap again.`);
  process.exit(3);
}

const preset = flags.get('preset');
if (preset) {
  label(`preset:${preset}`);
  await page.click('#presetBtn');
  await page.click(`#presetList [data-preset="b:${preset}"]`);
  await page.waitForTimeout(150);
  await settle();
  checkReload(`preset:${preset}`);
}

// Actions run in command-line order: a click may reveal the slider set next.
const ACTIONS = new Set(['check', 'uncheck', 'set', 'upload', 'click']);
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const name = argv[i].startsWith('--') ? argv[i].slice(2) : '';
  if (!ACTIONS.has(name)) continue;
  const arg = argv[++i];
  label(`${name}:${arg}`);
  const eq = arg.indexOf('=');
  // a control the current state disables would make Playwright wait 30 s and fail: say so at once
  const selector = name === 'click' ? arg : `#${name === 'set' || name === 'upload' ? arg.slice(0, eq) : arg}`;
  const target = page.locator(selector).first();
  if (!(await target.count())) {
    console.error(`${name} ${arg}: no element ${selector} in this state`);
    process.exit(2);
  }
  if (await target.isDisabled()) {
    console.error(`${name} ${arg}: ${selector} is disabled in this state (e.g. the boards toggle in the print view)`);
    process.exit(2);
  }
  if (name === 'check') {
    await page.check(`#${arg}`);
    await page.waitForTimeout(80);
  } else if (name === 'uncheck') {
    await page.uncheck(`#${arg}`);
    await page.waitForTimeout(80);
  } else if (name === 'set') {
    const id = arg.slice(0, eq);
    const value = arg.slice(eq + 1);
    const tag = await page.locator(`#${id}`).evaluate((n) => n.tagName);
    if (tag === 'SELECT') await page.selectOption(`#${id}`, value);
    else await page.fill(`#${id}`, value);
    await page.waitForTimeout(80);
  } else if (name === 'upload') {
    await page.setInputFiles(`#${arg.slice(0, eq)}`, arg.slice(eq + 1));
    await page.waitForTimeout(300);
  } else {
    await page.click(arg);
    await page.waitForTimeout(120);
  }
  // a slider or a board added: the next action and the shot see its build
  await settle();
  checkReload(`${name}:${arg}`);
}

// The sheet's backdrop cannot be clicked by selector (its centre is under the
// sheet), so the panel is toggled through its own controls.
const panelMode = flags.get('panel');
if (panelMode) {
  label(`panel:${panelMode}`);
  if (panelMode === 'hidden') await page.evaluate(() => document.getElementById('panelBackdrop')?.click());
  else if (await page.locator('#panelBtn').isVisible()) await page.click('#panelBtn');
  // the sheet and the picture move for 0.25 s
  await page.waitForTimeout(400);
}

// Camera presets: directions in the screen frame (y up; the model's front is +z).
const CAMERAS = {
  iso: [140, 110, 170], under: [140, -110, 170],
  top: [0, 1, 0.001], bottom: [0, -1, 0.001],
  front: [0, 0.25, 1], back: [0, 0.25, -1], left: [-1, 0.25, 0], right: [1, 0.25, 0],
};
const cameraName = flags.get('camera');
if (cameraName) {
  const direction = CAMERAS[cameraName];
  if (!direction) {
    console.error(`--camera takes ${Object.keys(CAMERAS).join(', ')}`);
    process.exit(2);
  }
  if (!dev) {
    console.error('--camera needs the dev server (the production build has no window.__case)');
    process.exit(2);
  }
  label(`camera:${cameraName}`);
  await page.evaluate((d) => window.__case.lookFrom(d), direction);
  await page.waitForTimeout(150);
}

// Orbiting is a plain drag over the canvas, as a person does it.
const orbit = flags.get('orbit');
if (orbit) {
  const [dx, dy] = orbit.split(',').map(Number);
  label(`orbit:${orbit}`);
  const box = await page.locator('#view').boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(150);
}

// the case comes from the worker: wait for its verdict, then the extra pause
await settle();
await page.waitForTimeout(Number(flags.get('wait') ?? 300));
checkReload('shot');

// Clipping works on the whole page: a locator has its own coordinates, and
// counting from the window's top-left corner is simpler.
const clip = flags.get('clip');
if (clip) {
  const [x, y, width, height] = clip.split(',').map(Number);
  await page.screenshot({ path: out, clip: { x, y, width, height } });
} else {
  const target = flags.has('view') ? page.locator('#viewWrap') : page;
  await target.screenshot({ path: out });
}

const evalExpr = flags.get('eval');
const evalResult = evalExpr ? await page.evaluate((expr) => {
  // eslint-disable-next-line no-eval
  const value = (0, eval)(expr);
  return JSON.stringify(value, null, 1);
}, evalExpr) : null;
const status = await page.locator('#status').textContent();
const audit = (await page.locator('#audit').textContent()).trim();
const warnings = (await page.locator('#warnings').textContent()).trim();
const blockers = (await page.locator('#blockers').textContent()).trim();
await app.close();

console.log(`snap → ${out}`);
console.log(`status: ${status}`);
if (evalResult !== null) console.log(`eval: ${evalResult}`);
console.log(`audit: ${audit}`);
if (warnings) console.log(`warnings: ${warnings}`);
if (blockers) console.log(`blockers: ${blockers}`);
if (errors.length) {
  console.error(`console errors (${errors.length}):`);
  for (const e of errors) console.error('  ' + e);
  process.exit(1);
}
