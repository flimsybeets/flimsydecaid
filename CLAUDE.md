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

- Top tabs: Home, Profiles, History, Beans, Settings. Top right: machine status, then a Sleep / Wake button (`PUT /machine/state/sleeping|idle`), offered only while the machine is idle, heating or asleep.
- **Home is a wizard**: big category tiles → profiles in that category → brew panel to pick a bag and set grind, dose, yield, temperature → Start shot. Once a profile is chosen the brew panel takes the whole Home area (the profile list is hidden) in two columns at 960×600, so nothing scrolls: left = bag list (scrolls inside itself if there are many bags), right = dial-in steppers, sync note and Start shot pinned at the bottom. Back (top left, "‹ Profiles") returns to the profile list with nothing selected. Under 760px it stacks into one column, with the bags and dial-in scrolling and Start shot pinned. No Load button: the panel puts its profile, bag and dial-in on the machine by itself, 600 ms after the last change (one request per burst, sends serialised, duplicates skipped, nothing sent mid-shot). The dial-in is written to the bag only when it changed or a shot is started with it, never just from opening the panel (that would reorder carry-over). Beans on the scale are checked against the dose (`doseCheck` in `lib/guide.ts`): a meter above Start shot goes amber with how much to add, green within ±0.1 g, coral with how much to take out; it stays hidden for an empty scale or anything over 1.5× the dose, like a cup.
- **Categories are for organising only.** They never affect settings. Create/edit in `CategoryDialog` (name, colour, icon, move earlier/later, delete; Edit on the category page). Deleting a category never touches its profiles.
- **Guide me** (last tile on Home): set to one profile + one coffee (Change on the tile). Uses the coffee's newest open bag and its dial-in, loads it onto the machine on open, then walks through weigh (live scale, green within ±0.1 g, add/take-out amounts; with no scale, a Tap to connect button, or tapping the scale in the picture, runs the bottom bar's `scanForScale`, showing "Looking for the scale…" until it connects) → spray → grinder setting → grind (one screen: on, beans in, wait, off, tap the bellows) → convex basket check → funnel (cup on funnel, pull the bell, tap) → tamp → paper → one drop of minerals → pull (Start shot, or wait for the group head on GHC) → shot view → knock out → rinse group and portafilter (you press the machine's flush button and hold the portafilter under it; the guide follows the machine into `flush` and back out) → summary. Animated scene per step in the "frosted glass objects" style (`features/guide/GuideArt.svelte`): translucent objects with a light rim, soft underside and gradient fills, one accent colour per scene. The static SVG is generated (`npm run art:guide` → `scripts/guide-art/build.cjs` writes `features/guide/guideScenes.ts`, a lazy chunk): every object is modelled in millimetres and projected orthographically (yaw −32°, elevation ~20–26°; `geo.cjs`), and the shared objects are drawn once in `objects.cjs` and reused (Bookoo Themis Mini 80×80×15 with the live weight in dot-matrix on its left display, dosing cup, espresso cup, naked portafilter with convex basket and marbled purple/black handle from the Decent handle drawing, grinder, Weber-style catch cup, DE1 from its dimension drawing with the group head controller on top: water 12, steam 3, brew 6, flush 9). Framing comes from measured bounding boxes (`frames.json`, `node scripts/guide-art/measure.cjs`, needs Playwright). No SVG/CSS filters or drop shadows; animation is CSS only (transform/opacity/dashoffset) keyed on the generated `k-*` classes, static and complete under reduced motion (`fx` parts hide). The dial scene's glowing orange arc is generated once in the ring's frame (`pathLength="90"`) and cut at runtime to the bag's grind with `stroke-dasharray` from `dialArc` in `lib/dialArc.ts` (0–90 clamped, 300° from −150°; no number = hidden), settling with the ring's turn exactly under the pointer. In mock mode `__flimsyMock.disconnectScale()` drops the scale (a scan takes 1.5 s to reconnect) and `__flimsyMock.setWeight(g)` drives the scale and `__flimsyMock.pressFlush()` stands in for the flush button.
- **Dial-in is per bag + profile.** Each bag remembers grind, dose, yield and temp offset for every profile used with it.
- **Bottom bar** (always visible): scale name, weight, connection (tap to tare, or to scan when disconnected); water and puck temps; a small tank glyph with the water level in mm (amber at or below the refill level, coral when the machine state is `needsWater`; the fill is a `transform` only); steam heater on/off with live steam temp. Tapping steam opens the steam modal (heater toggle, temperature, flow).
- **Preheat, flush and steam views** (`lib/activity.ts`) follow the machine's own state, so they show when the group-head or machine buttons are used. Entering `espresso` opens the shot view straight away with "Preheating…" / "Getting ready…", the live water and puck temperatures against their targets, and Stop, until preinfusion starts the graph (stopping before it ever pours closes it). `flush` and `steam` get `ActivityView` (elapsed against the rinse time or steam max run time, flow and temperatures, Stop = request idle) and close when the machine leaves the state. While Guide me is open its own rinse step covers the flush, so only steam is shown over it. All three join the shell `covered` condition.
- **Shot view** takes over while pulling and stays until "Done". While pouring, four car-style dials sit in one column left of the graph, full height under the title bar (vertical label, reading bottom to top, left of each dial; dial size is measured from the column height; under 700px wide it falls back to a row above the graph): flow in (machine, ml/s, with target), flow out (scale `weightFlow`, g/s), pressure (with target, red zone from 10 bar), and water + puck on one dial (thin coral and thick gold needles, both targets). The dial for the pump the machine is controlling (Pressure or Flow in) gets a glowing rim ring in its series colour: `PumpTracker` in `lib/pumpMode.ts` reads the nonzero snapshot target, falls back to the profile step's pump (`profileFrame`) when both or neither show, holds the last answer through gaps and needs two agreeing frames to switch; the ring is a static gradient on `Gauge`'s `.face::after` whose opacity transitions, no filter. Dials hide when the shot ends and the graph takes the full width. The graph re-renders on every machine frame and every scale frame (`ShotRecorder.onScale` moves the newest sample's weight), with no throttling or transitions. The target yield is a bold dashed line on the graph with its value in a pill. Temperatures get their own panel under pressure/flow/weight.
- **History**: shot list grouped by day (filter chips per open bag) beside the selected shot's numbers and graph. Refetches after a pull ends. Touching or dragging on the graph (`ShotChart` `scrub` prop, History only; the live shot view leaves it off so it adds no per-frame work) shows a cursor line, a dot on each series and a readout of time, pressure, flow, weight, water and puck with targets, flipping side near the edges; it stays after lift until a tap outside or another drag (`touch-action: pan-y`, so vertical scroll still works). Lookup in `lib/scrub.ts`. **Brew this again** (selected shot) opens the same `BrewPanel` over History with that shot's profile (matched by title and step shape to a lineage, newest version used), its bag if still open, else the newest open bag of the same coffee with a note, and the shot's grind, dose, yield and temperature offset (`planBrewAgain` in `lib/brewAgain.ts`). The panel puts them on the machine through the normal auto-load but writes nothing to the bag until a value is changed or a shot is started; Back returns to History. Beans' per-bag **Shots (n)** button sets `app.historyBag` and opens History filtered to that bag (read once at mount; a finished bag gets its chip too). Delete shot offers "Give back 18 g to the bag" (ticked) when the bag's ledger holds that shot.
- **Profiles tab**: every profile (newest version) with category chips, Edit and a primary Brew button. Brew shows the same `BrewPanel` over the list (local state in `Profiles.svelte`); Back (‹ Profiles) returns to the list with nothing selected.
- **Profile editor** (Profiles tab: New profile / Edit, or Edit in BrewPanel): full screen, one scrolling page under a fixed title bar (chart, then a sticky step strip, then step settings in as many columns as fit beside the profile panel; stacked under 820px). The tablet is about 960×600 CSS px: check layouts there, not just 1280×800. Planned-shape chart (pressure/flow targets with smooth ramps, exits, limiters, temperatures in their own lane, last real shot faint behind), step strip, every step setting visible, profile panel (stop at weight/volume, count-from step, tank preheat, type, author, notes, categories, checks). Undo/redo (Ctrl+Z / Ctrl+Shift+Z, held steppers coalesce), tap a number to type it, DE1-limit warnings that don't block, discard confirmation. Pure logic in `lib/profileEdit.ts`.
- **Visualizer** (Settings, History): Decaid's bundled `visualizer.reaplugin` does the uploading itself on shot events once it is enabled and signed in. Settings shows plugin on/off (`POST /plugins/{id}/enable|disable`) and whether it answers (`status`), username and password (`POST /plugins/{id}/settings`; the password comes back only as `{isSet}` and is never shown, a blank field keeps it), and the Upload shots automatically toggle (`AutoUpload`, default on). "Save and sign in" checks typed credentials with the `verifyCredentials` endpoint. History marks uploaded shots (↑V, the plugin stamps `annotations.extras.visualizerId`) and offers Upload to Visualizer (`POST /plugins/{id}/upload {shotId}`) for the rest while the plugin is on. The skin never talks to visualizer.coffee itself.
- **Bag weight counts down.** When a pull ends and Decaid has stored the shot, `app.settleShot` takes the shot's dose (`annotations.actualDoseWeight`, else `context.targetDoseWeight`) off its bag's `weightRemaining`, clamped at 0. Only shots from that pull (timestamp after it began) are considered, so a reload never re-counts old ones. A shot counts only if it poured at least 5 s or put 5 g in the cup (`lib/bagWeight.ts`). Never twice: the bag carries its own ledger, `extras.flimsydecaid.used` = the last 20 `{id, g}` (grams really taken, after the clamp), newest first; weight and ledger go out in the same batch PUT, so they can't disagree, and the bag is re-read just before so another tablet's write is seen. Deleting a shot can give `g` back (capped at the bag's size) and drops it from the ledger; shots older than the ledger simply offer no give-back.
- **Bag photos** from the tablet camera when adding a bag. After taking or choosing one (and from Edit bag → Crop photo) `PhotoCrop` shows a crop step: the picture fills the area, a free-aspect frame (starts at the centre 80%) has 48px corner handles and drags as a whole, everything outside is dimmed. Reset / Cancel / Use photo; the crop is drawn on a canvas straight to the 900px JPEG (`toJpegDataUrl(..., crop)`). Maths in `lib/crop.ts`.
- **Editing and deleting** (all destructive actions go through `ConfirmDialog`): coffees (`CoffeeDialog`: edit; Remove = archive coffee + its bags), bags (`BagDialog`: roast date, weight, left, frozen, photo, reopen, delete for good + photo key), profiles (editor → Delete profile = every version `hidden`, out of categories and Guide me), shots (History: rate 0–10 + notes via `PUT /shots/{id}` `annotations`, delete), Guide me setup (Remove).
- **Screensaver** (Settings): a photo picked from the tablet's files, shown while the machine sleeps, with a 50% white clock drifting over it, screen dimmed to a chosen brightness (slider in Settings, 0–100%, default 12, 100 = not dimmed; moving it while the screensaver or Preview is up applies at once; restored after). Off until a photo is chosen. Tap wakes the machine; if it stays asleep, the screensaver returns after a minute.

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
    scrub.ts      History graph readout: nearest / interpolated values at a time
    shot.ts       ShotRecorder (live graph) + samplesFromMeasurements (saved shots)
    history.ts    day grouping, ratio, stop-reason wording, shot stats
    screensaver.ts  clock text, fitting the photo under the store limit, dim level
    water.ts      tank level → ok / low / empty, glyph fill, refill range
    activity.ts   which flush / steam view, preparing-to-pour, preheat wording, timer text
    visualizer.ts plugin state, settings parsing (password redacted), shot upload id
    profileEdit.ts  step ops, planned curve, validation, undo history, save rules
    guide.ts      Guide me: setup, bag pick, brew plan, weigh state, step order
    gauge.ts      dial geometry (240° sweep), ticks, temperature dial range
    dialArc.ts    Guide me grinder dial: grind to arc length / ring rotation
    pumpMode.ts   shot view: pressure- or flow-controlled step (highlight ring)
    photo.ts      camera + JPEG downscale
  state/app.svelte.ts  single app state (Svelte 5 runes class) + actions
  components/  BottomBar, SteamModal, ShotView, ActivityView, ShotChart, Gauge, Screensaver, Stepper (typeable), Segmented, Modal, ConfirmDialog
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
| Screensaver brightness | KV `flimsydecaid/screensaverDim` (number 0–100) | Missing key = 12. Saved 400 ms after the last slider move |
| Water refill warning | Decaid, `POST /machine/waterLevels {refillLevel}` (mm) | Not in our KV: Decaid holds it and streams it back on `ws/v1/machine/waterLevels` |
| Visualizer account | Decaid plugin settings `visualizer.reaplugin` | Password is stored by Decaid (secure), never read back |
| Screensaver photo | KV `flimsydecaid/screensaver` (JPEG data URL, up to 1920px) | Shrunk until under 950k chars: the KV body limit is 1 MiB |
| Bag weight ledger | `BeanBatch.extras.flimsydecaid.used` = `[{id: shotId, g}]`, newest first, max 20 | No KV key: it lives on the bag so weight and ledger change in one PUT. Preserve other keys in `extras` and `flimsydecaid` |
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
- **Don't hammer the API.** Decaid doesn't debounce and drops requests that queue too long. Debounce anything sent on change (BrewPanel: 600 ms); profile edits stay drafts until Save.
- **Camera** (`doc/Skins.md` § Live Camera Access): `getUserMedia({video:true,audio:false})` works only from the *installed* skin's `http://localhost:<port>` origin with per-skin consent; never from the dev server or live-edit. Uses the **front** camera (the tablet is mounted facing you): `facingMode: 'user'`, preview mirrored, saved photo not. `AddBag` falls back to `<input type="file" accept="image/*" capture="user">`; Android's camera app may still open on whichever camera it used last.
- **Background reloads**: Decaid unloads the WebView after ~10 min in the background and reloads the skin. Keep anything important in Decaid (KV store, beans, workflow), not in memory. `sessionStorage` doesn't survive.
- **Shots**: `GET /shots` is paginated (`limit` ≤ 100, `offset`, newest first) and has no measurements; `GET /shots/{id}` has `measurements: [{machine, scale, volume}]` covering the whole espresso state, so trim to preinfusion/pouring like the live graph (`samplesFromMeasurements`). `annotations.actualYield` is often null; use the last scale weight. `stopReason` is an open set. `enjoyment` is 0–10.
- **Screen while asleep**: Decaid's wake-lock is auto-managed (screen allowed off while the machine sleeps). The screensaver holds `POST /api/v1/display/wakelock` while showing and `DELETE`s it on close, and dims via `PUT /display/brightness`, restoring the previous `requestedBrightness` (calls are queued so a quick close can't leave it dark). Request bodies are capped (1 MiB for the KV store, `bounded_request_body.dart`).
- **Water levels**: `ws/v1/machine/waterLevels` sends `{currentLevel, refillLevel}` in mm of water height (no tank height is given, so the glyph assumes a nominal 50 mm full; the number shown is always mm). `POST /api/v1/machine/waterLevels {refillLevel}` sets the warning threshold (truncated to an integer, 202). `doc/Skins.md` shows `warningThresholdPercentage` there; the REST spec and handler use `refillLevel`, so we follow those. Machine state `needsWater` means empty.
- **Plugins**: `GET /plugins` lists `{id, loaded, autoLoad, ...}`; `GET|POST /plugins/{id}/settings` (secure values redacted to `{isSet}`; POST omits = keep, null = clear, and reloads a loaded plugin); `POST /plugins/{id}/enable|disable`; `GET|POST /plugins/{id}/{endpoint}` calls a declared endpoint (Visualizer: `status`, `upload`, `verifyCredentials`, `forwardSyncStatus`).
- **Settings**: Decaid's bundled settings plugin lives at `/api/v1/plugins/settings.reaplugin/ui?backName=FlimsyDecaid`.
- **GHC machines**: the Group Head Controller owns shot start. `GET /api/v1/machine/info` → `GHC: true`; read each time the machine connects. BrewPanel then shows "Start the shot on the group head" instead of Start shot. `?mock=1&ghc=1` fakes it.
- **Decaid never decrements `weightRemaining`** (its `decrementBatchWeight` is never called), so the skin does it after each shot, tracked by the per-bag ledger (see Bag weight counts down). `GET /bean-batches/{id}` is used to read a bag fresh before that write.
- **Archived beans and bags are hidden by default**: `GET /beans` and `GET /bean-batches` need `?includeArchived=true` (dial-in carry-over from a finished bag, "Show finished bags", old shots' bag names all depend on it). Filter `archived` in the UI instead.
- **Batch PUT merges top-level fields only**: `extras` is replaced whole, hence `withDialIn` copies other keys. Missing KV keys answer 200 `null`, not 404.
- **Layers**: profile editor 25, guide 27, shot view and flush/steam views 30, modals 60/61, screensaver 100. Full-screen views with oversized decoration use `overflow: clip` (not hidden), so focus/scrollIntoView can't shift them.
- **On-screen keyboard** (`src/keyboard.ts`): while a text field has focus and the visible area shrinks, `<html>` gets `kb-open` and `--kb` = the part of the page the keyboard covers (0 when the WebView resizes instead). The bottom bar hides, modals fill all the room above it with a slim title and buttons, Enter moves to the next text field and on the last one presses the dialog's last action button (stepper tap-to-type boxes excluded: Enter just confirms the number), the profile editor folds its chart and step strip, and the focused field is scrolled into view. Any new full-screen form should honour `--kb` / `kb-open` too.
- **Glass + scrolling**: a `.glass` element must not be the scroll container (its `::before` rim scrolls away). Scroll an inner element instead, as BrewPanel and Modal do.
- **Manifest**: `public/skin-manifest.json`. Keep `id` = `flimsydecaid` forever (it's the install folder and update identity). Version is numeric dot-segments only; `npm run package` stamps it from `package.json` or the `v*` tag.

## Design

Tablet next to the machine, read at arm's length, wet hands.
- Base: deep ink-teal (`--ink`), cream text (`--paper`), over a fixed backdrop of soft colour pools (in `styles.css` on `body`) for the glass to refract. One loud element: the category tiles in riso-label colours (`--cat-1…8`), as tinted glass. Keep everything else quiet.
- **Glass (Apple-style materials), global classes in `styles.css`:** `.glass` (blurred translucent fill, rim light via `::before`, sheen, soft shadow), `.glass.thick` (sheets: modal, brew panel, graphs), `.glass.solid` (bright prominent action, dark text), `.glass.lit` / `aria-pressed|checked="true"` (selected), `.well` (recessed: steppers, inputs). A component's scoped `background`/`color` beats these, so drop them from elements that use the classes. `.glass` needs its `::before` free. Blur cost is unknown on the tablet; `--glass-blur` is the one knob to turn down.
- Font: Sen (bundled via @fontsource-variable/sen, weights 400–800, works offline; don't load it from Google Fonts). No italic, so don't use `font-style: italic` (it would be faked). Tabular figures everywhere.
- Numbers: every Stepper is tap-to-type by default (`inputmode=decimal`, the number pad), as well as −/+.
- Touch targets ≥ 48px (`--touch`), small buttons ≥ 40px, primary actions ~60px+. The whole UI is at 75% of its first sizes (first use on the tablet felt zoomed in); text tokens are a little larger than 75% so they still read at arm's length. Keep new UI on the tokens rather than fixed px.
- **Performance rules** (weak tablet GPU): full-screen overlays (guide, shot view, profile editor) are opaque, so `App.svelte` marks the shell `covered` (`visibility: hidden`, `inert`, animations off) and the guide gets `covered` while the shot view is up (it stays mounted, but skips its scene). Any new full-screen view should join that condition. Blur tokens are `--glass-blur` 12px/140% and `--glass-blur-thick` 16px/150%; buttons, list rows and glass inside glass have no backdrop-filter (rule in `styles.css`), so only sheets, bars, graphs and category tiles blur. The page backdrop is `body::before` (fixed), never `background-attachment: fixed`. No `filter`/drop-shadow on anything animated or repainted at telemetry rate. `machine` and `shot` in app state are `$state.raw`, replaced whole each frame: never mutate them in place.
- **Dials** (`Gauge.svelte`): flat frosted disc, fine rim, thin track, soft value arc, thin needles, a marker on the rim per target. Needles are separate SVGs (not `<g>`) so their rotate transition runs on the compositor; a transition on an SVG child cost about half the main thread during a shot.
- Graph colours are fixed across every graph: pressure green, flow blue, weight brown, water coral (thin), puck gold (thick). Targets dashed.
- Copy: plain, sentence case, says what happens ("Start shot", "Save steam settings", "Delete bag").

## Next up

1. Grind stepper should use the grinder's `settingSmallStep` / preset values (`/api/v1/grinders`).
3. ~~Test camera capture on the installed skin.~~ Done.
