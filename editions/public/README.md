# FlimsyDecent

A [Decaid](https://github.com/decentespresso/decaid) skin for the Decent DE1, for people with a lot of profiles and a routine they like to follow.

- **Categories → profile → bag → Start shot.** Group profiles into categories you make yourself. Each profile tile can show a little graph of its last shot or its plan.
- **Dial-in per bag.** Grind, dose, yield and temperature are remembered for every bag and profile you use together, and carried over when you open a new bag of the same coffee. "Don't track" brews a freezer dose or a one-off without touching any bag.
- **Guide me.** A step-by-step walkthrough of your own routine, from weighing beans to rinsing the group: it follows your scale and the machine (weighing to the gram, starting the shot, flushing, steaming). Start from a preset (Simple, WDT and puck screen, Milk drinks), then add, remove, reorder and reword steps, add your own (with a timer or a photo of your kit), and share a workflow by copying it as text.
- **Live shot view.** Car-style dials for flow, pressure and temperatures beside the graph; the target weight as a bold line.
- **History.** Touch the graph to read every value, rate and note shots, brew one again with the same settings, upload to Visualizer.
- **Beans.** Coffees with photos (the card takes its colour from the photo), bags that count down as you brew.
- **Looks.** Frosted glass over your own background photo, a photo screensaver with a clock, and a panel colour to taste.

Beans, bags and shots use Decaid's own APIs, so they show up in other skins and in shot history.

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
