# Handoff — ASTRA independent demo

The owner authorized continued development of the independent demo, preservation of prior work, an additional public delivery-candidate repository and updates to two Sites. It is not an official NASA submission. The current source implements a finite exploration slice; the broader `GOAL.md` remains a goal, not completed acceptance.

## Run and current behavior

Use Node 24: `npm ci`, `npm run check`, `npm run dev`; `npm run build` produces static `dist/`. See `README.md` for controls. Five connected regions cover academy, floor-assisted orbit, habitat, canyon and greenhouse. The player can restore systems, select cargo (45 kg) and a field loadout (18 kg), repair Scout, collect ice, grow food and seek shelter. Three auxiliary ports and a restricted three-slot field kit have modeled costs and effects. Optional Cometa follows or waits; her interactions do not create resources. The episode has ten state-driven beats with causal actions, and local SVG portraits.

Thirteen GLBs comprise eight reused original legacy assets and five new skinned, keyframed characters. They are original parametric assets, not scanned mission hardware. Eight labelled AI concept boards are design references, not runtime captures. NASA Blue Marble credit and transformations are recorded in `public/science/earth-provenance.json`; terrain is fictional.

## Code map and contracts

- `src/simulation/index.ts`: pure version 3 state, ordered fixed ticks, resource accounting, actions, evidence and validation. The UI enforces proximity; simulation does not independently know world coordinates.
- `src/app/clock.ts` and `src/app/save.ts`: time policy, save envelope version 4 and earlier-envelope migrations. Paused panels and hidden tabs pause mission time; 3× advances simulated costs and hazards. Saves are browser-local.
- `src/world/manifest.ts`, `src/world/createGameWorld.ts`, `src/actors/`: finite regions, targets, movement, rendering and actors. Babylon does not own resource truth.
- `src/presentation/`, `src/main.ts`: local HUD, dialogue, SVG portraits, journal and controls. `public/assets/manifest.json` inventories source and rights.

## Evidence and remaining work

The initial Wave 3 CPU check recorded 64 passing unit tests in eight files. Full final-gate status belongs to `TEST_REPORT.md` and `ACCEPTANCE.json`; browser execution and snapshots belong to `docs/demo/E2E_REPORT.json` and `docs/demo/evidence/`. Earlier Chromium 156 SwiftShader runs included failures and a slow aborted run; they do not prove hardware-GPU acceptance. The third economy run passed 25 assertions before the radiation deadline blocked the route; its overall status is failed/incomplete. Review the raw report. A separate staged visual audit passed six checks and produced six fresh captures; it verifies the three reported regressions only within prepared states and does not establish navigation or hardware acceptance. Real-device GPU, accessibility, performance and human playtesting remain to be established. The quality economy mode reduces resolution by a factor of three and disables shadows; high quality is unchanged.

The orbital cabin is not 6DoF; terrain, biology and safety are educational abstractions. Freeform building, vehicles, additional planets and a tutor LLM remain out of scope. `docs/demo/SCIENCE_ASSUMPTIONS.md` documents model rates and limitations. Continue from actual evidence and `MASTER_GOAL.md`, rather than treating older planned features as acceptance.

## Publication and provenance

The independent original repository remains https://github.com/andrecodexvictor/astra-lunar-frontier; the separate public delivery candidate is https://github.com/andrecodexvictor/astra-junior-astronaut-mission-trainer. Its complete shared history was pushed without rewriting dates. The original Site is https://astra-lunar-frontier-academy.andrevictorandrade.chatgpt.site and the second public Site is https://astra-mission-trainer.andrevictorandrade.chatgpt.site. Both publications succeeded (original version 5, candidate version 1). `docs/PUBLICATIONS.json` records exact GitHub snapshots, independent Sites source commits, version/deployment IDs and URLs. Later metadata commits do not change those published app snapshots. `source.config.json` supplies per-site source links.

Preserve the real history, reuse and AI/third-party credits in `docs/PRIOR_WORK.md`, `AI_USAGE.md` and `NOTICE`. The official challenge resource list and rules governing prior work remain unverified; do not claim eligibility or submit on that basis.

## Latest visual/export batch — 15 November 2026

The resource HUD now uses graphical bars, qualitative states and authored Cometa/PIP reminders with a static low-reserve edge. New staged evidence has 16 passing checks and seven captures; physical-GPU/full-route limits remain. Thirteen new concept boards in `docs/art/production-vision/` and the 30-slide, three-minute pitch illustrate the possible child-facing product. Photos would be restyled as original avatars; knowledge brooches would be wearable; multiplayer, voice, AI and the parental app are future work. Continue with `docs/presentation/NEXT_GOAL.md`; export instructions are in `docs/presentation/EXPORT_GUIDE.md`.
