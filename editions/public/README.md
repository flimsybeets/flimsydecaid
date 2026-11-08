# FlimsyDecent

A [Decaid](https://github.com/decentespresso/decaid) skin for the Decent DE1, for people with a lot of profiles and a routine they like to follow.

![A short tour of FlimsyDecent: pick a category and profile, dial in, start a shot and watch it live.](docs/walkthrough.gif)

[Watch the full walkthrough (MP4)](docs/walkthrough.mp4)

- **Categories → profile → bag → Start shot.** Group profiles into categories you make yourself. Each profile tile can show a little graph of its last shot or its plan.
- **Dial-in per bag.** Grind, dose, yield and temperature are remembered for every bag and profile you use together, and carried over when you open a new bag of the same coffee. "Don't track" brews a freezer dose or a one-off without touching any bag.
- **Guide me.** A step-by-step walkthrough of your own routine, from weighing beans to rinsing the group: it follows your scale and the machine (weighing to the gram, starting the shot, flushing, steaming). Start from a preset (Simple, WDT and puck screen, Milk drinks), then add, remove, reorder and reword steps, add your own (with a timer or a photo of your kit), and share a workflow by copying it as text.
- **Live shot view.** Car-style dials for flow, pressure and temperatures beside the graph; the target weight as a bold line.
- **History.** Touch the graph to read every value, rate and note shots, brew one again with the same settings, upload to Visualizer.
- **Beans.** Coffees with photos (the card takes its colour from the photo), bags that count down as you brew.
- **Looks.** Frosted glass over your own background photo, a photo screensaver with a clock, and a panel colour to taste.

Beans, bags and shots use Decaid's own APIs, so they show up in other skins and in shot history.

## Tour

All pictures are taken from the built-in demo mode (`?mock=1`), so the machine, scale, profiles and beans are simulated.

### Pick, dial in, brew

| | |
|:--|:--|
| ![Home: a tile for each category you made, plus Guide me.](docs/home.webp) | ![A category with a small graph of the last shot on each profile tile.](docs/category-profiles.webp) |
| **Home.** A tile per category, and Guide me. | **Profiles in a category.** Each tile shows its last shot or its plan. Hold one to edit it. |
| ![The brew panel: bags with coffee photos, grind, temperature, dose and yield steppers, and Start shot.](docs/brew-panel.webp) | ![The live shot view with four dials beside the pressure, flow and weight graph.](docs/shot-view.webp) |
| **Brew panel.** Pick a bag, then grind, dose, yield and temperature. Dial-in is remembered per bag and profile. | **Live shot.** Dials for flow, pressure and temperatures beside the graph, with the target weight as a dashed line. |

### History and beans

| | |
|:--|:--|
| ![History: a list of shots by day, and the selected shot with a touch readout on the graph.](docs/history.webp) | ![Beans: coffee cards with photos, colours taken from the photo, and bags that count down.](docs/beans.webp) |
| **History.** Touch or drag on the graph to read every value. Rate, add notes or brew it again. | **Beans.** Coffees with photos and bags that count down as you brew. |

### Guide me

| | |
|:--|:--|
| ![Guide me weigh step: a live scale reading with how much to add or take out.](docs/guide-weigh.webp) | ![Guide me grind step: an illustrated step with a checklist.](docs/guide-grind.webp) |
| **Weigh.** Follows your scale to the gram. | **Grind.** Illustrated steps, with lists and optional timers. |
| ![The steps editor with a preview of the selected step.](docs/guide-steps-editor.webp) | ![The Add a step picker: a grid of illustrated step types.](docs/guide-add-step.webp) |
| **Steps editor.** Reorder, reword, add photos and timers, with a preview. | **Add a step.** Pick from the library or write your own. |

### Profiles and settings

| | |
|:--|:--|
| ![The profile editor: a planned-shape chart, a step strip and every step setting.](docs/profile-editor.webp) | ![Settings over an app background photo.](docs/settings.webp) |
| **Profile editor.** Planned curve, every step setting, undo and redo. | **Settings.** Your own background photo, panel colour, screensaver, Visualizer. |

To retake the pictures and the video, run the dev server and `node scripts/capture-docs.cjs` (it needs Playwright and ffmpeg; see the comment at the top of the script).

## Install on the tablet

Decaid → Launcher → Skins → cog menu → Install skin → GitHub Release → `flimsybeets/flimsydecent`. Settings → Connection → "Check for skin updates" picks up new releases.

From your laptop over Wi-Fi:

```bash
npm install
npm run install:tablet -- 192.168.1.50   # your tablet's IP
```

Or run `npm run package` and install `release/flimsydecent-<version>.zip` with Install skin → ZIP file.

## Develop

```bash
npm install
npm run dev
```

- `http://localhost:5173/?mock=1` runs on simulated data, no machine needed.
- `http://localhost:5173/?gateway=192.168.1.50` talks to Decaid on your tablet.
- Open `http://<laptop IP>:5173/?gateway=localhost` on the tablet itself to try it with your fingers.

`npm run check` type-checks and `npm test` runs the unit tests. `npm run art:generic` regenerates the Guide me illustrations.

## Release

Bump `version` in `package.json` and merge to `main`: GitHub Actions tags it, builds the zip and publishes the release.

## License

AGPL-3.0. See [LICENSE](LICENSE).
