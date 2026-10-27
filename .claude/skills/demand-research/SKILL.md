---
name: demand-research
description: Research what hardware DIY people use now and write a ranked perspective list for the catalog (plans/PERSPECTIVE-*.md, like PERSPECTIVE-BOARDS.md and PERSPECTIVE-SCREENS.md) — measured demand signals, whether it is sold bare, whether a mechanical drawing exists, Tier A/B/C. Also how to split the work among research agents without burning the usage limit. Use for a new segment (boards, screens, sensors, batteries, connectors, …) or to refresh an old list.
---

# Demand research: a perspective list for the catalog

The result is one file, `plans/PERSPECTIVE-<SEGMENT>.md`, in English, in the
shape of `plans/PERSPECTIVE-BOARDS.md` and `plans/PERSPECTIVE-SCREENS.md`
(read one of them first: that is the format). Adding the entries afterwards
is the `add-board` skill.

## 1. The three criteria

An item belongs in the catalog only if it scores on all three:

1. **Demand, measured rather than guessed.** Numbers with their source and
   caveat, never "popular".
2. **Sold bare, needs a case.** Finished devices (in a shell, a tablet, a
   monitor in a housing) go to "Not candidates" with a word why.
3. **A drawing to transcribe from.** Official PDF / DXF / STEP / Eagle /
   KiCad keeps the rank; a community measurement means `verified: false`
   (≈); no drawing drops a tier. "Checked" means the file was opened and the
   numbers were read from it; anything else is marked unchecked.

Something that only varies an entry already in the catalog (same outline,
other ports) is cheap and moves up: always list the shared outlines.

## 2. The file

1. A short intro: the date, the goal, the criteria adapted to the segment
   (for screens: the active area and its offset are part of "a drawing").
2. **Signals**: a table `Signal | What it measures | Caveat`, then the raw
   counts. A segment with its own signals gets its own table.
3. **Tier A** — high demand and a checked drawing: a table with the outline,
   holes (count × Ø and spacing), the segment's key dimensions, *Why* (the
   numbers), *Drawing* (exact URLs), *Note* (shared outlines, variants).
4. **Tier B** — high demand without a drawing, or a narrower niche. **Tier
   C** — backlog. **Not candidates.** **Gaps** — what was not opened or
   measured, so the next session starts there.
5. **What the catalog needs for them** — features the entries would need
   that the code lacks (read `src/boards/schema.ts` and `docs/` first).

Rows, not prose. Every number carries where it came from.

## 3. Signals: where and how

Counts from public APIs go through `scripts/demand.mjs` — **never a
hand-written loop**: one Bash call with all the queries in a file, `--out`
so a stopped run resumes.

```bash
node scripts/demand.mjs github --file q.txt --out gh.tsv          # GitHub code search, 6.5 s per query (10/min)
node scripts/demand.mjs printables 'hyperpixel 4|hyperpixel' …    # total, top-60 names matching the regex, their downloads
node scripts/demand.mjs circuitpython 'magtag|feather_esp32s3'    # downloads and rank of 697 boards
node scripts/demand.mjs meshmap 'HELTEC|RAK|T_DECK'               # Meshtastic node share per hwModel
node scripts/demand.mjs pypi luma.oled adafruit-circuitpython-ssd1306
```

A GitHub run of 50 queries takes 6 minutes: run it in the background.

What worked, and its traps:

| Source | How | Trap |
|---|---|---|
| GitHub code search: ESPHome YAML (`"platform: X" extension:yaml` + `model:`), `#include <Lib.h>`, `X_DRIVER filename:platformio.ini`, Klipper `"lcd_type: X" extension:cfg`, board ids | `demand.mjs github` | Vendored libraries set a **floor**: every GxEPD2 copy holds every class (≈3k), `waveshare_epd` ≈150, Klipper forks carry all example configs. Only the margin above the floor counts. U8g2 constructor names are unusable (≈28k each). Short ids tokenise into junk (T-QT 484k); `…-LCD-2` also matches 2.1 and 2.8 |
| Printables | `demand.mjs printables` | The search's own total is fuzzy ("hdmi5" 735): use the name-matched top 60 and their downloads. One model can dominate the sum |
| CircuitPython `_data/files.json` | `demand.mjs circuitpython` | Window not documented; below ≈1,000 is noise |
| meshmap.net `nodes.json` | `demand.mjs meshmap` | Only nodes publishing a position over MQTT; skews to fixed ESP32 nodes |
| PyPI | `demand.mjs pypi` | CI and mirrors count; CircuitPython bundles do not |
| GitHub stars | `gh api repos/<o>/<r> --jq .stargazers_count` | Mindshare, not units; hype projects |
| GitHub issues | `gh api -X GET search/issues -f q='repo:<o>/<r> <model>' --jq .total_count` | Small numbers; problems, not users |
| PlatformIO registry | `api.registry.platformio.org/v3/packages/<owner>/library/<name>` → `popularity_rank` | A rank, no counts |
| The Pi Hut reviews | Reviews.io by SKU (the product page has it) | All-time: favours old products |
| Pimoroni | `shop.pimoroni.com/products/<handle>.json` (also links the dimension drawings) | Pimoroni only |
| Reddit | Arctic Shift archive, title search per subreddit and date | Word matches; order of magnitude only |
| Home Assistant | `analytics.home-assistant.io` | HA users only; ESPHome components are not reported |
| openHASP `user_setups/`, ESPHome `esphome-devices`, Meshtastic / MeshCore variants, WLED, Armbian `config/boards/*.conf/.csc`, TRMNL `usetrmnl.com/api/models` | `gh api` trees, one call | Yes/no support lists, not counts. Armbian's "popularity" sort is sponsors first |
| Amazon, Thingiverse, AliExpress | — | Behind bot walls or a token: do not spend calls on them |

## 4. Drawings: where they are

Cache every file with `node scripts/fetch.mjs <url>` (into `drawings/`,
found again by the next session), read it with the repo's tools —
`scripts/dxf.mjs` (DXF and vector PDF: extents, circles), `scripts/step.mjs`
(STEP parts and holes), `scripts/board.mjs --brd/--kicad` (Eagle/KiCad),
`pdftotext -layout -f N -l N` (a PDF's page text). Text first; render an
image only when the numbers are in the picture.

| Vendor | Where |
|---|---|
| Raspberry Pi | `datasheets.raspberrypi.com`, product briefs and STEP on `pip-assets.raspberrypi.com/categories/<id>-<product>/documents/` |
| Radxa | `dl.radxa.com/<board>/docs/` (PDF, DXF, STEP) |
| Waveshare | wiki images `waveshare.com/img/devkit/LCD/<product>/…details-size.jpg`, files `files.waveshare.com/wiki/<product>/` and `/upload/` (2D zips, STEP) |
| LCDwiki (the generic AliExpress modules) | `lcdwiki.com/res/<SKU>/<SKU>_Size.pdf` — vector PDFs with every dimension; TLS is intermittent, retry |
| BIGTREETECH | GitHub `bigtreetech/<product>` and `BIGTREETECH-TouchScreenHardware` (SIZE pdf + STEP) |
| Pimoroni | dimension PNGs on `cdn.shopify.com/s/files/1/0174/1800/files/`, linked from the product JSON |
| Adafruit | STEP in `github.com/adafruit/Adafruit_CAD_Parts/<PID> <name>`, Eagle in `adafruit/Adafruit-<product>-PCB`, fab prints on learn.adafruit.com |
| LilyGO | `github.com/Xinyuan-LilyGO/<product>/dimensions` (DXF, DWG, STEP; holes are often polylines, not circles) |
| Sunton / Guition | no vendor site: community mirrors of the doc bundle on GitHub, `3-Structure_Diagram/Dimensions.png` and `2-Specification/` |
| Elecrow | `github.com/Elecrow-RD/<product>` → `Datasheet/*Outline_Dimensions.pdf`, `3D file/` |
| Soldered (Inkplate), WeAct | `github.com/SolderedElectronics/*-hardware-design/OUTPUTS/`, `github.com/WeActStudio/*/Hardware` |
| Seeed | `files.seeedstudio.com/wiki/…` (DXF, STEP) |
| Heltec | `resource.heltec.cn/download/<product>/` datasheets |
| Orange Pi, Banana Pi | Google Drive: a person downloads it (`fetch.mjs --file`) |
| FriendlyElec, Khadas | `wiki.friendlyelec.com/wiki/images/…_DXF.zip`, `dl.khadas.com/products/<board>/blueprints/dxf/` |

## 5. Agents and the usage limit

The limit is spent by **context re-read on every tool call**, not by the
task text: each call sends the agent's whole transcript again, so an agent's
cost grows roughly with the square of its calls. One screens agent made 110
calls and ended at 224k tokens — about ten million tokens read in all; four
of them in parallel on the big model hit the weekly limit in one evening.

1. **The main session plans and writes; agents only gather.** Split the
   segment yourself (from section 3 and what the catalog has: `ls
   src/boards/data`, the old PERSPECTIVE file's tiers) and give each agent
   the list to skip.
2. **Gathering agents on the smaller model**: `model: "sonnet"` in the
   Agent call. Counting, fetching and reading numbers off a drawing do not
   need the big one; the synthesis stays here.
3. **Narrow and capped.** One vendor family or one signal source per agent,
   **at most ~25 tool calls** (say so in the prompt). Ten short agents cost
   less than two long ones.
4. **Two at a time, not four.** The total is the same, but the 5-hour
   window survives.
5. **Findings to a file as they go**: the agent appends rows to
   `<scratchpad>/research/<slice>.md` (and counts to `--out` TSVs). If it
   stops on the limit, a **fresh** agent continues from the file. Do not
   resume an old one after an hour: the cache has expired and its whole
   transcript is read again at full price. If you must resume, ask it only to
   write the report from what it has, no more research.
6. **Cheap tools first.** `demand.mjs` with a query file in one call;
   WebFetch with a precise question ("the hole spacing and the active area
   offset on this page"), not "summarise the page"; `pdftotext` on the one
   page, `dxf.mjs`/`step.mjs` summaries instead of reading files. **Images
   are the most expensive thing an agent reads**: only for Tier A
   candidates, one page at a time, at a modest resolution.
7. **A fixed, terse report**: the rows of section 2, no prose, no repeated
   caveats; under ~3,000 words.

Prompt skeleton for one agent:

```
Gather data for plans/PERSPECTIVE-<SEGMENT>.md (Case Constructor: printed
cases around hobby hardware). Slice: <one vendor family / one signal>.
Already covered, skip: <list>. Do not edit the repo; do not install anything.
Read .claude/skills/demand-research/SKILL.md sections 1, 3 and 4 and use its
tools: counts only through scripts/demand.mjs (one call, --file, --out),
drawings through scripts/fetch.mjs and dxf/step/board.mjs.
Budget: at most 25 tool calls. Append each finding as you get it to
<scratchpad>/research/<slice>.md, so a fresh agent can continue.
For each item: name, key dimensions (outline, holes, <segment's dimension>),
demand numbers with source, drawing URL (checked / unchecked), shared
outlines. Return rows for Tier A / B / C / not candidates / gaps; no prose.
```

## 6. Writing it up

Merge the slices in the main session: one signals table per segment,
duplicates folded into "same outline" notes, the tier decided by the three
criteria rather than by the agent's guess, every unchecked number marked.
Finish with "What the catalog needs for them" and point to the file in your
answer. Do not commit unless asked.
