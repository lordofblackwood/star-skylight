# star-skylight
A racket script for finding what stars are above you right now.

The goal of star-skylight is to show you a picture of the stars and other celestial bodies above you right now.

Can run by:

```sh
racket star-skylight.rkt
```

With no arguments, the app uses the Mac's current Location Services coordinates and the current time. It does not ask for latitude or longitude.

If macOS location is disabled, permission is denied, or the device cannot produce a location, the app exits with an error instead of prompting for manual coordinates. The Location Services permission appears in System Settings as `Star Skylight Location`.

The image window includes a `Save PNG...` button.

You can save directly from the command line:

```sh
racket star-skylight.rkt --save stars-above-me.png
```

You can also pass a photo path directly:

```sh
racket star-skylight.rkt /path/to/photo.jpg
```

You can combine a photo path with saving:

```sh
racket star-skylight.rkt /path/to/photo.jpg --save stars-from-photo.png
```

When a photo path is passed, the app reads local metadata for GPS latitude, GPS longitude, and creation time. On macOS this uses `mdls`, so no Google geolocation API key is required for the photo-based path. If the photo does not expose GPS metadata, the app uses the Mac's current Location Services coordinates with the photo time if available. Photos exported from Apple Photos as derivatives often omit location metadata; exporting the unmodified original is more likely to preserve it.

## Amazfit / Zepp OS app

The watch app scaffold lives in `amazfit-star-skylight/`. It mirrors the Racket sky calculation in JavaScript so it can run through Zepp OS:

- the watch uses the latitude/longitude saved in the Zepp app settings,
- the phone-side Zepp service fetches solar noon data and VizieR Tycho-2 catalog rows,
- the side service projects real catalog stars into compact watch-displayable point records,
- the watch draws those points directly and caches the last successful screen.

From `amazfit-star-skylight/`, run:

```sh
npm install
npm test
npm run preview
```

`zeus` must be installed separately with `npm i @zeppos/zeus-cli -g`. The `app.json` includes the Amazfit Band 7 device sources (`252`, `253`, `254`) and uses API level `1.0` so Zeus can choose Band 7 when debugging. Band 7 does not expose the newer watch GPS API, so set latitude and longitude from the app settings in the Zepp phone app.

Solar noon data retrieved via https://sunrise-sunset.org/api.
