# AGENTS.md — rules for agents

Working notes on the repository are in `CLAUDE.md`; the plan is `PLAN.md`.

## Language

Everything in the repository is in English: code comments, README, `docs/`,
`PLAN.md`, `CLAUDE.md`, this file. Conversations with the user are in
Russian.

## Commits

Commit **and push** after every milestone of `PLAN.md` (and of
`PLAN-IMPROVEMENTS.md`) without asking (CI
builds every push and deploys `main` to GitHub Pages). Before each commit:
`npm run check` and `npm run smoke`. TDD: red → green → refactor; golden
tests pin geometry.

## Documentation

User documentation lives in `docs/` (index: `docs/README.md`). Added or
changed a feature, a parameter, its range, its default or an export mode —
update the matching file in `docs/` in the same commit; a new feature gets its
own file linked from `docs/README.md`.

## Translations

New visible text lands in all four dictionaries (`src/i18n/en.ts`, `ru.ts`,
`uk.ts`, `he.ts`) in the same commit. English is the reference.
