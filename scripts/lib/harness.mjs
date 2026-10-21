// Shared harness of the browser scripts: flag parsing, starting a vite
// server, collecting console errors. Repository rule: extend these instead of
// writing throw-away scripts (CLAUDE.md).

import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

/** Ports of their own, so ClayForm's dev server on 5173 is never mistaken for ours. */
const DEV_PORT = 5273;
const PREVIEW_PORT = 4273;

/** Parses `--flag value` / `--flag`; valueFlags lists the flags that take a value. */
export function parseArgs(argv, valueFlags = [], repeatableFlags = []) {
  const values = new Set(valueFlags);
  const repeatable = new Set(repeatableFlags);
  const flags = new Map();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const name = arg.slice(2);
    const value = values.has(name) || repeatable.has(name) ? argv[++i] : 'true';
    if (repeatable.has(name)) {
      const list = flags.get(name) ?? [];
      list.push(value);
      flags.set(name, list);
    } else {
      flags.set(name, value);
    }
  }
  return flags;
}

export function baseUrl(preview) {
  return `http://localhost:${preview ? PREVIEW_PORT : DEV_PORT}`;
}

async function serverUp(base) {
  try {
    return (await fetch(base)).ok;
  } catch {
    return false;
  }
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: 'inherit' });
    proc.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} → ${code}`))));
  });
}

/** Starts a dev / preview server unless one already listens on the port. */
export async function ensureServer(preview) {
  const base = baseUrl(preview);
  if (await serverUp(base)) return { base, proc: null };
  // vite preview serves the last build; without a rebuild the smoke would
  // test last week's code and fail somewhere puzzling
  if (preview) await run('npx', ['vite', 'build']);
  const port = preview ? PREVIEW_PORT : DEV_PORT;
  const cmd = preview
    ? ['vite', 'preview', '--port', String(port), '--strictPort']
    : ['vite', '--port', String(port), '--strictPort'];
  const proc = spawn('npx', cmd, { stdio: 'ignore' });
  for (let i = 0; i < 40 && !(await serverUp(base)); i++) {
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!(await serverUp(base))) {
    console.error(`server did not start on :${port}`);
    process.exit(1);
  }
  return { base, proc };
}

/**
 * Opens the page and starts collecting errors. `label(text)` marks which
 * step of the scenario they happened at.
 *
 * `locale` is the browser language the app picks its interface language by.
 * English by default — the smoke reads English text.
 */
export async function openApp({ preview = false, width = 1280, height = 860, locale = 'en-US' } = {}) {
  const { base, proc } = await ensureServer(preview);
  // In a cloud container Playwright looks for its own chromium build while a
  // different one is preinstalled — CASE_BROWSER gives its path. Empty means
  // Playwright's default browser.
  const browser = await chromium.launch({ executablePath: process.env.CASE_BROWSER || undefined });
  const page = await browser.newPage({ viewport: { width, height }, acceptDownloads: true, locale });
  const errors = [];
  let context = 'app';
  let cdp = null;
  page.on('pageerror', (e) => errors.push(`[${context}] ${String(e)}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`[${context}] ${m.text()}`);
  });
  await page.goto(base, { waitUntil: 'load' });
  return {
    page,
    browser,
    base,
    errors,
    label: (text) => {
      context = text;
    },
    /**
     * Slows the page CPU `rate` times (1 removes it). On a fast machine much
     * happens before it can be seen — the progress bar, for one.
     */
    async throttle(rate) {
      cdp ??= await page.context().newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate });
    },
    async close() {
      await browser.close();
      proc?.kill();
    },
  };
}
