# FlimsyDecaid

A [Decaid](https://github.com/decentespresso/decaid) skin for the Decent DE1, for people with a lot of profiles.

- Pick a category, then a profile, then your bag. Grind, dose, yield and temperature are remembered for every bag and profile you use together, and carried over when you open a new bag of the same coffee.
- Profiles are grouped into categories you make yourself.
- The bottom bar always shows your scale and the steam heater. Tap steam to change its temperature and flow, or switch it off.
- The shot graph shows water and puck temperature in their own panel, so you can tell them apart.
- Photograph each bag as you add it.

Beans and bags use Decaid's own beans API, so they show up in other skins and in shot history.

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
