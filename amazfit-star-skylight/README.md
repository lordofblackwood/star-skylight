# Amazfit Star Skylight

Zepp OS Mini Program for drawing catalog stars centered on the sky directly above the watch location.

The app mirrors the Racket flow in the parent project:

1. The Device App asks the Side Service for the current sky map.
2. The Side Service reads latitude and longitude from the app settings saved in the Zepp phone app.
3. The Side Service fetches solar noon data from `sunrise-sunset.org` and calculates the right ascension/declination.
4. The Side Service requests a VizieR Tycho-2 text table around that sky position.
5. The Side Service parses actual catalog rows, projects RA/Dec into compact watch points, caches that point set, and sends only those points over the app bridge.
6. The Device App draws those stars directly on the Band 7 screen.

The first implementation tried to transfer a generated sky image. On Amazfit Band 7, Zepp's file transfer layer can fail with `common.system.fileTransfer` code `-32502`, so this version avoids image transfer entirely. It requests a small text catalog from VizieR instead, then sends compact point records like `[x, y, size, color]` to the watch.

It does not add generated filler stars and it does not draw a synthetic fallback map. If a refresh fails after a successful draw, the app redraws the last cached catalog-derived screen. If the first catalog refresh fails before any screen is cached, the watch shows an error instead of drawing invented stars. Open the app settings in Zepp to see the saved `Last catalog error`; the side service tries both Zepp `httpRequest` and `fetch` paths before recording that error.

## Develop

Install Zeus CLI once:

```sh
npm i @zeppos/zeus-cli -g
```

Install this app's dependencies:

```sh
cd amazfit-star-skylight
npm install
```

Run the pure calculation tests:

```sh
npm test
```

Preview on the watch:

```sh
npm run preview
```

Build a production package for Amazfit Band 7:

```sh
npm run build:band7
```

The production artifact is written to `dist/*.zab`. That `.zab` is the package to upload in the Zepp developer console for the app tied to this `appId`, then submit through Zepp's review/release flow. This repo can produce the package, but publishing/installing it as a normal app must happen from the Zepp account that owns the app.

The current `app.json` uses API level `1.0` and includes Amazfit Band 7 device sources `252`, `253`, and `254`. Band 7 is listed by Zepp as Zepp OS `1.0`, screen shape `Band`, and resolution `194 x 368`.

Band 7 does not expose the newer watch-side GPS API to Mini Programs. After installing the preview, open the app settings in the Zepp phone app and tap `Use Phone Location`. If the Zepp settings WebView allows phone geolocation, it saves decimal coordinates automatically. If it is blocked, enter coordinates manually, such as `40.7128` and `-74.0060`, then tap `Refresh` on the band.

An external IP geolocation API could be added as a coarse fallback, but it is intentionally not automatic because it can be city-level inaccurate and sends location-adjacent data to a third party.
