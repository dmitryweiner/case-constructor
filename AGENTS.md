# AGENTS.md — rules for agents

Working notes on the repository are in `CLAUDE.md`; the plan is `plans/PLAN.md`.

## Language

Everything in the repository is in English: code comments, README, `docs/`,
`plans/PLAN.md`, `CLAUDE.md`, this file. Conversations with the user are in
Russian.

## Commits

An iteration of improvements (one plan) goes on its **own branch**, never
on `main`: create it from `main` when the work starts
(`improvements-<date>`), commit **and push** to it after every item of the
plan without asking, and open a pull request when the first item lands (CI
runs on pull requests). The user reviews the branch and merges it into
`main` themselves — never merge, rebase onto or push to `main` (every push
to `main` deploys to GitHub Pages). Before each commit: `npm run check` and
`npm run smoke`. TDD: red → green → refactor; golden tests pin geometry.

## Documentation

User documentation lives in `docs/` (index: `docs/README.md`). Added or
changed a feature, a parameter, its range, its default or an export mode —
update the matching file in `docs/` in the same commit; a new feature gets its
own file linked from `docs/README.md`.

## Translations

New visible text lands in all four dictionaries (`src/i18n/en.ts`, `ru.ts`,
`uk.ts`, `he.ts`) in the same commit. English is the reference.
