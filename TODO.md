# TODO

Small things not to forget; a bigger one becomes a plan in `plans/`.

- **`npm run smoke -- --preview` fails** (seen 2026-11-18 on `main` after
  M3 3d; broken since before M3): its first `window.__case` call stops it
  with `page.evaluate: TypeError: Cannot read properties of undefined
  (reading 'drawn')`. `src/main.ts` sets `window.__case` only under
  `import.meta.env.DEV`, and the smoke reads it in 41 places, so a
  production build cannot answer it. CI runs no smoke at all (check,
  build and the main chunk's manifold check), so nothing caught it. To be fixed in M3's m3-harness (maker-kit
  `plans/PLAN.md`, "M3 in detail", PR 5): either the build gets the
  handle behind an explicit switch, or the preview run checks only what
  it can see from the page. Then CI should run `smoke --preview`, as
  the kit's CI does.
