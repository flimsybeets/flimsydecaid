# FlimsyDecaid

A Decaid skin for a Decent DE1, built for someone with a lot of profiles.
Svelte 5 + TypeScript + Vite. Static build; Decaid serves it and the skin
talks to Decaid over REST and WebSockets on port 8080.

## Commands

```bash
npm run dev                 # dev server (mock data unless a gateway is set)
npm run check               # svelte-check type check
npm test                    # vitest unit tests (pure logic in src/lib)
npm run package             # build + release/flimsydecaid-<version>.zip
npm run install:tablet -- <tablet IP>   # package + install on the tablet over Wi-Fi
```

Dev URLs (`src/api/config.ts`):
- `http://localhost:5173/?mock=1` simulated machine, scale, profiles, beans
- `http://localhost:5173/?gateway=<tablet IP>` real Decaid on the tablet (remembered)
- `?gateway=` clears the remembered gateway. Open `http://<laptop IP>:5173` on the tablet itself to test touch.

Run `npm run check && npm test` before committing.

## What the skin does

- Top tabs: Home, Profiles, History, Beans, Settings.
- **Home is a wizard**: big category tiles → profiles in that category → side panel to pick a bag and set grind, dose, yield, temperature → Load / Start shot.
- **Categories are for organising only.** They never affect settings. Create/edit in `CategoryDialog` (name, colour, icon, move earlier/later, delete; Edit on the category page). Deleting a category never touches its profiles.
- **Guide me** (last tile on Home): set to one profile + one coffee (Change on the tile). Uses the coffee's newest open bag and its dial-in, loads it onto the machine on open, then walks through weigh (live scale, green within ±0.1 g, add/take-out amounts) → spray → grinder setting → grind → funnel → settle and tamp → paper → pull (Start shot, or wait for the group head on GHC) → shot view → knock out → rinse group and portafilter (you press the machine's flush button and hold the portafilter under it; the guide follows the machine into `flush` and back out) → summary. Animated SVG scene per step (`features/guide/GuideArt.svelte`); pure parts in `lib/guide.ts`. In mock mode `__flimsyMock.setWeight(g)` drives the scale and `__flimsyMock.pressFlush()` stands in for the flush button.
- **Dial-in is per bag + profile.** Each bag remembers grind, dose, yield and temp offset for every profile used with it.
- **Bottom bar** (always visible): scale name, weight, connection (tap to tare, or to scan when disconnected); water and puck temps; steam heater on/off with live steam temp. Tapping steam opens the steam modal (heater toggle, temperature, flow).
- **Shot view** takes over while pulling and stays until "Done". While pouring, four car-style dials sit above the graph: flow in (machine, ml/s, with target), flow out (scale `weightFlow`, g/s), pressure (with target, red zone from 10 bar), and water + puck on one dial (thin coral and thick gold needles, both targets). Dials hide when the shot ends so the graph gets the room. The target yield is a bold dashed line on the graph with its value in a pill. Temperatures get their own panel under pressure/flow/weight.
- **History**: shot list grouped by day (filter chips per open bag) beside the selected shot's numbers and graph. Refetches after a pull ends.
- **Profile editor** (Profiles tab: New profile / Edit, or Edit in BrewPanel): full screen, one scrolling page under a fixed title bar (chart, then a sticky step strip, then step settings in as many columns as fit beside the profile panel; stacked under 820px). The tablet is about 960×600 CSS px: check layouts there, not just 1280×800. Planned-shape chart (pressure/flow targets with smooth ramps, exits, limiters, temperatures in their own lane, last real shot faint behind), step strip, every step setting visible, profile panel (stop at weight/volume, count-from step, tank preheat, type, author, notes, categories, checks). Undo/redo (Ctrl+Z / Ctrl+Shift+Z, held steppers coalesce), tap a number to type it, DE1-limit warnings that don't block, discard confirmation. Pure logic in `lib/profileEdit.ts`.
- **Bag photos** from the tablet camera when adding a bag.
- **Editing and deleting** (all destructive actions go through `ConfirmDialog`): coffees (`CoffeeDialog`: edit; Remove = archive coffee + its bags), bags (`BagDialog`: roast date, weight, left, frozen, photo, reopen, delete for good + photo key), profiles (editor → Delete profile = every version `hidden`, out of categories and Guide me), shots (History: rate 0–10 + notes via `PUT /shots/{id}` `annotations`, delete), Guide me setup (Remove).
- **Screensaver** (Settings): a photo picked from the tablet's files, shown while the machine sleeps, with a 50% white clock drifting over it, screen dimmed to 12% (restored after). Off until a photo is chosen. Tap wakes the machine; if it stays asleep, the screensaver returns after a minute.

## Architecture

```
src/
  api/        the ONLY code that touches the network
    config.ts   gateway resolution (?gateway, ?mock, localStorage, VITE_GATEWAY)
    gateway.ts  Gateway interface + HTTP/WebSocket implementation
    mock.ts     in-memory Gateway with simulated telemetry (same interface)
    socket.ts   one WebSocket reconnect policy: exponential backoff + jitter
    types.ts    Decaid API types used by the skin
  lib/        pure logic, unit tested in test/ (no DOM, no Svelte)
    profiles.ts   lineage roots, newest-per-lineage, temperature shift
    dialIn.ts     per bag + profile dial-in storage and lookup
    categories.ts category document in the KV store
    steam.ts      steam heater rules and ranges
    shot.ts       ShotRecorder (live graph) + samplesFromMeasurements (saved shots)
    history.ts    day grouping, ratio, stop-reason wording, shot stats
    screensaver.ts  clock text, fitting the photo under the store limit
    profileEdit.ts  step ops, planned curve, validation, undo history, save rules
    guide.ts      Guide me: setup, bag pick, brew plan, weigh state, step order
    gauge.ts      dial geometry (240° sweep), ticks, temperature dial range
    photo.ts      camera + JPEG downscale
  state/app.svelte.ts  single app state (Svelte 5 runes class) + actions
  components/  BottomBar, SteamModal, ShotView, ShotChart, Gauge, Screensaver, Stepper (typeable), Segmented, Modal, ConfirmDialog
  features/    home (wizard + BrewPanel), profiles (+ ProfileEditor, ProfileCurve, StepInspector), guide (Guide, GuideArt, GuideSetup), beans (+ AddBag), history, settings
  styles.css   design tokens
```

Rules:
- UI never calls `fetch`/`WebSocket`; add methods to `Gateway` and implement them in **both** `gateway.ts` and `mock.ts`.
- Logic that can be pure goes in `src/lib` with a test.
- Never `structuredClone` Svelte state (proxies throw). Use JSON round-trips or `$state.snapshot`.

## Where data lives (decided)

| Thing | Storage | Notes |
|---|---|---|
| Categories | KV `/api/v1/store/flimsydecaid/categories` | Decaid has no profile tags. Profiles referenced by **lineage root id** |
| Beans | `/api/v1/beans` | Official Decaid model, shared with other skins |
| Bags | `/api/v1/beans/{beanId}/batches`, `/api/v1/bean-batches/{id}` | "Finished" = `archived: true` |
| Dial-in | `BeanBatch.extras.flimsydecaid.dialIn[<profileRootId>]` = `{grind, dose, yield, tempOffset, updatedAt}` | Always preserve other keys in `extras` |
| Bag photo | KV `flimsydecaid/photo:<batchId>` (JPEG data URL, ~900px) | Not in `extras`, so listing beans stays light |
| Last steam temp | KV `flimsydecaid/lastSteamTemp` | Restored when the heater is switched back on |
| Guide me setup | KV `flimsydecaid/guide` = `{profileRoot, beanId}` | A coffee, not a bag, so it survives finishing bags |
| Screensaver photo | KV `flimsydecaid/screensaver` (JPEG data URL, up to 1920px) | Shrunk until under 950k chars: the KV body limit is 1 MiB |
| Shot ↔ bag link | `PUT /api/v1/workflow` `context.beanBatchId`, `coffeeName`, `coffeeRoaster`, `grinderSetting`, `targetDoseWeight`, `targetYield` | Decaid stores this on every shot |

Dial-in lookup order: this bag + profile → most recent other bag of the same bean + profile → profile defaults.

## Decaid facts that matter here

Source of truth: `assets/api/rest_v1.yml`, `assets/api/websocket_v1.yml` and `doc/Skins.md` in https://github.com/decentespresso/decaid. Clone it and grep rather than guessing payloads.

- **Profile ids are content hashes.** Editing a profile creates a new id with `parentId` → old id. Key anything long-lived by `lineageRoot()`. Show `latestPerLineage()` in lists.
- **Saving profiles** (`saveProfile` in `lib/profileEdit.ts`): the id hashes only execution fields (version, beverage_type, steps, tank_temperature, target_weight/volume, count start), not title/author/notes. `POST /profiles {profile, parentId}` makes a version; if the hash exists Decaid returns the existing record unchanged, so a title/notes-only edit is then `PUT /profiles/{id}` (refused for Decaid's defaults). Never `PUT` an execution change: it replaces the record under a new id and orphans the lineage. Never hide old versions: `lineageRoot` walks visible profiles only.
- **Brew temperature lives in profile steps**, not the workflow. Apply a bag's offset with `shiftTemperature()` and send the shifted profile inline in `PUT /workflow`. Never save it as a new profile.
- **`PUT /workflow` deep-merges.** `targetYield` and every `steamSettings` field must never be `null` (400). Other context fields accept `null`, which clears them. `targetYield` 0 = stop-at-weight off.
- **Steam heater = temperature.** `steamSettings.targetTemperature` 0 = off; DE1 range 135–160 °C (Bengle 165). `duration` is max run time only. Live boiler temp is `steamTemperature` on the machine snapshot. Steam flow range in `lib/steam.ts` (0.4–2.5) is a guess; verify on the machine.
- **Temperatures**: `mixTemperature` = water entering the group ("Water", thin coral line); `groupTemperature` = group head sensor, closest to the puck ("Puck", thick gold line). Always °C. During hot water on a classic DE1, `mixTemperature` is not the outlet temperature.
- **Sockets**: `ws/v1/machine/snapshot` (~10 Hz) stays open while no machine is attached and re-binds across a machine power-cycle. `ws/v1/scale/snapshot` sends `{status}` frames on open/connection change and weight frames while connected; a status frame is not a 0 g reading. Use `ws/v1/devices` for connected/disconnected. Reconnect only on socket close. Decaid rate-limits upgrades per client (429), hence backoff with jitter.
- **The machine zeroes the inactive pump target** (targetPressure is 0 on flow steps); `ShotRecorder` drops those so dashed targets break instead of diving to 0.
- **Don't hammer the API.** Decaid doesn't debounce and drops requests that queue too long. Edits are drafts until Save/Load.
- **Camera** (`doc/Skins.md` § Live Camera Access): `getUserMedia({video:true,audio:false})` works only from the *installed* skin's `http://localhost:<port>` origin with per-skin consent; never from the dev server or live-edit. Uses the **front** camera (the tablet is mounted facing you): `facingMode: 'user'`, preview mirrored, saved photo not. `AddBag` falls back to `<input type="file" accept="image/*" capture="user">`; Android's camera app may still open on whichever camera it used last.
- **Background reloads**: Decaid unloads the WebView after ~10 min in the background and reloads the skin. Keep anything important in Decaid (KV store, beans, workflow), not in memory. `sessionStorage` doesn't survive.
- **Shots**: `GET /shots` is paginated (`limit` ≤ 100, `offset`, newest first) and has no measurements; `GET /shots/{id}` has `measurements: [{machine, scale, volume}]` covering the whole espresso state, so trim to preinfusion/pouring like the live graph (`samplesFromMeasurements`). `annotations.actualYield` is often null; use the last scale weight. `stopReason` is an open set. `enjoyment` is 0–10.
- **Screen while asleep**: Decaid's wake-lock is auto-managed (screen allowed off while the machine sleeps). The screensaver holds `POST /api/v1/display/wakelock` while showing and `DELETE`s it on close, and dims via `PUT /display/brightness`, restoring the previous `requestedBrightness` (calls are queued so a quick close can't leave it dark). Request bodies are capped (1 MiB for the KV store, `bounded_request_body.dart`).
- **Settings**: Decaid's bundled settings plugin lives at `/api/v1/plugins/settings.reaplugin/ui?backName=FlimsyDecaid`.
- **GHC machines**: the Group Head Controller owns shot start. `GET /api/v1/machine/info` → `GHC: true`; read each time the machine connects. BrewPanel then shows "Then start the shot on the group head" instead of Start shot. `?mock=1&ghc=1` fakes it.
- **Archived beans and bags are hidden by default**: `GET /beans` and `GET /bean-batches` need `?includeArchived=true` (dial-in carry-over from a finished bag, "Show finished bags", old shots' bag names all depend on it). Filter `archived` in the UI instead.
- **Batch PUT merges top-level fields only**: `extras` is replaced whole, hence `withDialIn` copies other keys. Missing KV keys answer 200 `null`, not 404.
- **Layers**: profile editor 25, guide 27, shot view 30, modals 60/61, screensaver 100. Full-screen views with oversized decoration use `overflow: clip` (not hidden), so focus/scrollIntoView can't shift them.
- **On-screen keyboard** (`src/keyboard.ts`): while a text field has focus and the visible area shrinks, `<html>` gets `kb-open` and `--kb` = the part of the page the keyboard covers (0 when the WebView resizes instead). The bottom bar hides, modals fill all the room above it with a slim title and buttons, Enter moves to the next text field and on the last one presses the dialog's last action button (stepper tap-to-type boxes excluded: Enter just confirms the number), the profile editor folds its chart and step strip, and the focused field is scrolled into view. Any new full-screen form should honour `--kb` / `kb-open` too.
- **Glass + scrolling**: a `.glass` element must not be the scroll container (its `::before` rim scrolls away). Scroll an inner element instead, as BrewPanel and Modal do.
- **Manifest**: `public/skin-manifest.json`. Keep `id` = `flimsydecaid` forever (it's the install folder and update identity). Version is numeric dot-segments only; `npm run package` stamps it from `package.json` or the `v*` tag.

## Design

Tablet next to the machine, read at arm's length, wet hands.
- Base: deep ink-teal (`--ink`), cream text (`--paper`), over a fixed backdrop of soft colour pools (in `styles.css` on `body`) for the glass to refract. One loud element: the category tiles in riso-label colours (`--cat-1…8`), as tinted glass. Keep everything else quiet.
- **Glass (Apple-style materials), global classes in `styles.css`:** `.glass` (blurred translucent fill, rim light via `::before`, sheen, soft shadow), `.glass.thick` (sheets: modal, brew panel, graphs), `.glass.solid` (bright prominent action, dark text), `.glass.lit` / `aria-pressed|checked="true"` (selected), `.well` (recessed: steppers, inputs). A component's scoped `background`/`color` beats these, so drop them from elements that use the classes. `.glass` needs its `::before` free. Blur cost is unknown on the tablet; `--glass-blur` is the one knob to turn down.
- Font: Sen (bundled via @fontsource-variable/sen, weights 400–800, works offline; don't load it from Google Fonts). No italic, so don't use `font-style: italic` (it would be faked). Tabular figures everywhere.
- Touch targets ≥ 48px (`--touch`), small buttons ≥ 40px, primary actions ~60px+. The whole UI is at 75% of its first sizes (first use on the tablet felt zoomed in); text tokens are a little larger than 75% so they still read at arm's length. Keep new UI on the tokens rather than fixed px.
- Graph colours are fixed across every graph: pressure green, flow blue, weight brown, water coral (thin), puck gold (thick). Targets dashed.
- Copy: plain, sentence case, says what happens ("Load", "Start shot", "Save steam settings").

## Next up

1. Grind stepper should use the grinder's `settingSmallStep` / preset values (`/api/v1/grinders`).
2. Decrement `weightRemaining` after each shot: Decaid does **not** (its `decrementBatchWeight` is never called).
3. Test camera capture on the installed skin.
4. History extras: "Brew this again" (load its profile, bag and dial-in), a "Shots" link from each bag on the Beans tab.
