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
- **Categories are for organising only.** They never affect settings.
- **Dial-in is per bag + profile.** Each bag remembers grind, dose, yield and temp offset for every profile used with it.
- **Bottom bar** (always visible): scale name, weight, connection (tap to tare, or to scan when disconnected); water and puck temps; steam heater on/off with live steam temp. Tapping steam opens the steam modal (heater toggle, temperature, flow).
- **Shot view** takes over while pulling and stays until "Done". While pouring, four car-style dials sit above the graph: flow in (machine, ml/s, with target), flow out (scale `weightFlow`, g/s), pressure (with target, red zone from 10 bar), and water + puck on one dial (thin coral and thick gold needles, both targets). Dials hide when the shot ends so the graph gets the room. Temperatures get their own panel under pressure/flow/weight.
- **History**: shot list grouped by day (filter chips per open bag) beside the selected shot's numbers and graph. Refetches after a pull ends.
- **Bag photos** from the tablet camera when adding a bag.

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
    gauge.ts      dial geometry (240° sweep), ticks, temperature dial range
    photo.ts      camera + JPEG downscale
  state/app.svelte.ts  single app state (Svelte 5 runes class) + actions
  components/  BottomBar, SteamModal, ShotView, ShotChart, Gauge, Stepper, Modal, NameDialog
  features/    home (wizard + BrewPanel), profiles, beans (+ AddBag), history, settings
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
| Shot ↔ bag link | `PUT /api/v1/workflow` `context.beanBatchId`, `coffeeName`, `coffeeRoaster`, `grinderSetting`, `targetDoseWeight`, `targetYield` | Decaid stores this on every shot |

Dial-in lookup order: this bag + profile → most recent other bag of the same bean + profile → profile defaults.

## Decaid facts that matter here

Source of truth: `assets/api/rest_v1.yml`, `assets/api/websocket_v1.yml` and `doc/Skins.md` in https://github.com/decentespresso/decaid. Clone it and grep rather than guessing payloads.

- **Profile ids are content hashes.** Editing a profile creates a new id with `parentId` → old id. Key anything long-lived by `lineageRoot()`. Show `latestPerLineage()` in lists.
- **Brew temperature lives in profile steps**, not the workflow. Apply a bag's offset with `shiftTemperature()` and send the shifted profile inline in `PUT /workflow`. Never save it as a new profile.
- **`PUT /workflow` deep-merges.** `targetYield` and every `steamSettings` field must never be `null` (400). Other context fields accept `null`, which clears them. `targetYield` 0 = stop-at-weight off.
- **Steam heater = temperature.** `steamSettings.targetTemperature` 0 = off; DE1 range 135–160 °C (Bengle 165). `duration` is max run time only. Live boiler temp is `steamTemperature` on the machine snapshot. Steam flow range in `lib/steam.ts` (0.4–2.5) is a guess; verify on the machine.
- **Temperatures**: `mixTemperature` = water entering the group ("Water", thin coral line); `groupTemperature` = group head sensor, closest to the puck ("Puck", thick gold line). Always °C. During hot water on a classic DE1, `mixTemperature` is not the outlet temperature.
- **Sockets**: `ws/v1/machine/snapshot` (~10 Hz) stays open while no machine is attached and re-binds across a machine power-cycle. `ws/v1/scale/snapshot` sends `{status}` frames on open/connection change and weight frames while connected; a status frame is not a 0 g reading. Use `ws/v1/devices` for connected/disconnected. Reconnect only on socket close. Decaid rate-limits upgrades per client (429), hence backoff with jitter.
- **The machine zeroes the inactive pump target** (targetPressure is 0 on flow steps); `ShotRecorder` drops those so dashed targets break instead of diving to 0.
- **Don't hammer the API.** Decaid doesn't debounce and drops requests that queue too long. Edits are drafts until Save/Load.
- **Camera** (`doc/Skins.md` § Live Camera Access): `getUserMedia({video:true,audio:false})` works only from the *installed* skin's `http://localhost:<port>` origin with per-skin consent; never from the dev server or live-edit. `AddBag` falls back to `<input type="file" accept="image/*" capture="environment">`.
- **Background reloads**: Decaid unloads the WebView after ~10 min in the background and reloads the skin. Keep anything important in Decaid (KV store, beans, workflow), not in memory. `sessionStorage` doesn't survive.
- **Shots**: `GET /shots` is paginated (`limit` ≤ 100, `offset`, newest first) and has no measurements; `GET /shots/{id}` has `measurements: [{machine, scale, volume}]` covering the whole espresso state, so trim to preinfusion/pouring like the live graph (`samplesFromMeasurements`). `annotations.actualYield` is often null; use the last scale weight. `stopReason` is an open set. `enjoyment` is 0–10.
- **Settings**: Decaid's bundled settings plugin lives at `/api/v1/plugins/settings.reaplugin/ui?backName=FlimsyDecaid`.
- **GHC machines**: the Group Head Controller owns shot start. The Start button isn't hidden yet; detect GHC and hide it (see how Streamline.js does it).
- **Manifest**: `public/skin-manifest.json`. Keep `id` = `flimsydecaid` forever (it's the install folder and update identity). Version is numeric dot-segments only; `npm run package` stamps it from `package.json` or the `v*` tag.

## Design

Tablet next to the machine, read at arm's length, wet hands.
- Base: deep ink-teal (`--ink`), cream text (`--paper`), over a fixed backdrop of soft colour pools (in `styles.css` on `body`) for the glass to refract. One loud element: the category tiles in riso-label colours (`--cat-1…8`), as tinted glass. Keep everything else quiet.
- **Glass (Apple-style materials), global classes in `styles.css`:** `.glass` (blurred translucent fill, rim light via `::before`, sheen, soft shadow), `.glass.thick` (sheets: modal, brew panel, graphs), `.glass.solid` (bright prominent action, dark text), `.glass.lit` / `aria-pressed|checked="true"` (selected), `.well` (recessed: steppers, inputs). A component's scoped `background`/`color` beats these, so drop them from elements that use the classes. `.glass` needs its `::before` free. Blur cost is unknown on the tablet; `--glass-blur` is the one knob to turn down.
- Font: Literata, a serif with optical sizes (bundled via @fontsource-variable, roman + italic, works offline; don't load it from Google Fonts). Tabular figures everywhere.
- Touch targets ≥ 64px (`--touch`). Primary actions 84px+.
- Graph colours are fixed across every graph: pressure green, flow blue, weight brown, water coral (thin), puck gold (thick). Targets dashed.
- Copy: plain, sentence case, says what happens ("Load", "Start shot", "Save steam settings").

## Next up

1. Hide Start on GHC machines.
2. Grind stepper should use the grinder's `settingSmallStep` / preset values (`/api/v1/grinders`).
3. Reorder and rename categories; pick tile colour and icon.
4. Decrement `weightRemaining` after each shot (or check whether Decaid already does).
5. Test camera capture on the installed skin.
6. History extras: rate a shot / add notes (`PUT /shots/{id}` `annotations`), "Brew this again" (load its profile, bag and dial-in), a "Shots" link from each bag on the Beans tab.
