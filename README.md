# FlimsyDecaid

> [!IMPORTANT]
> ## This is my personal version
> FlimsyDecaid is the skin I use on my own Decent at home, so it has quirks that only make sense there: Guide me steps and illustrations drawn from my own kit (my scale, grinder, portafilter and cups), a Halloween screensaver, and whatever I'm trying out this week. It can change or break without warning.
>
> ### Want to use it yourself? Get **[FlimsyDecent](https://github.com/flimsybeets/flimsydecent)** instead.
> FlimsyDecent is the general version, made for everyone. It has every feature listed here, brand-neutral Guide me presets and illustrations, setup instructions, screenshots and a walkthrough video, and its own [releases](https://github.com/flimsybeets/flimsydecent/releases).

A [Decaid](https://github.com/decentespresso/decaid) skin for the Decent DE1, for people with a lot of profiles.

- **Categories → profile → bag → Start shot.** Profiles are grouped into categories you make yourself, each tile with a little graph of its last shot or its plan. Press and hold a profile to edit it.
- **Dial-in per bag.** Grind, dose, yield and temperature are remembered for every bag and profile you use together, and carried over to a new bag of the same coffee. "Don't track" brews a freezer dose or a one-off without touching any bag. A meter checks the beans on the scale against the dose.
- **Guide me.** Your routine step by step (the FlimsyBeets preset with its own illustrations), following the scale and machine: weighing, grinding, starting the shot, flushing, steaming. Edit, reorder, add your own steps with timers or photos, and share a workflow as text.
- **Live shot view.** Car-style dials for flow in and out, pressure and temperatures beside the graph, the pump in control lit up, and the target weight as a bold line.
- **Lands on your target weight.** The skin learns from your shots how much still drips in after the pump stops (part fixed, part following the flow) and gives every profile its own stop-early setting, put on the machine with the profile. It can tune itself after every shot.
- **History.** Touch the graph to read every value, rate and note shots, see your last shot with this profile and bag, brew one again with the same settings, upload to Visualizer.
- **Beans.** Coffees with photos (the card takes its colour from the photo) and bags that count down as you brew.
- **Profiles.** A full editor with a planned-shape chart, undo and redo. Start new ones from scratch, a Visualizer share code or a .json file, or duplicate one.
- **Bottom bar.** Scale (tap to tare or reconnect), water and puck temperatures, the water tank, and steam and hot water buttons for temperature, amount and flow.
- **Looks.** Frosted glass over your own background photo, a photo screensaver with a clock (or Halloween ghosts), and a panel colour to taste.
- **Every setting in one place.** Machine, shots and scale, sleep and wake times, tablet charging, Visualizer and Decaid itself, with tabs down the side.
- **Updates itself.** Each time the machine wakes it checks for a newer version and shows a glowing Update button when one is ready.

Beans, bags and shots use Decaid's own APIs, so they show up in other skins and in shot history.

## Install on the tablet

From a release (once one is published): Decaid → Launcher → Skins → cog menu → Install skin → GitHub Release → `flimsybeets/flimsydecaid`.

From your laptop over Wi-Fi:

```bash
npm install
npm run install:tablet -- 192.168.1.50   # your tablet's IP
```

Or run `npm run package` and install `release/flimsydecaid-<version>.zip` with Install skin → ZIP file.

## Develop

```bash
npm install
npm run dev
```

- `http://localhost:5173/?mock=1` runs on simulated data, no machine needed.
- `http://localhost:5173/?gateway=192.168.1.50` talks to Decaid on your tablet.
- Open `http://<laptop IP>:5173/?gateway=localhost` on the tablet itself to try it with your fingers.

`npm run check` type-checks and `npm test` runs the unit tests.

## Release

Bump `version` in `package.json`, then push a matching tag:

```bash
git tag v0.2.0 && git push origin v0.2.0
```

GitHub Actions builds the zip and attaches it to a release.

## License

AGPL-3.0. See [LICENSE](LICENSE).
