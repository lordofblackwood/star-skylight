import assert from "node:assert/strict";
import {
  buildCatalogStarMap,
  fetchCatalogStarMap,
  getVizieRStarCatalogUrl,
  normalizeDegrees,
  parseVizieRTsv,
  projectCatalogStars,
  responseBodyToText,
  signedRaDeltaDegrees
} from "../utils/catalog-stars.js";
import {
  addDaysToYMD,
  buildSkyViewPayload,
  dateToYMDUTC,
  daysBetweenYMD,
  getSunRightAscension,
  packStarMap,
  parseSolarNoonUTC
} from "../utils/skyview.js";

const sampleTychoTsv = `#RESOURCE=yCat_1259
#Name: I/259/tyc2
TYC1	TYC2	TYC3	_RAJ2000	_DEJ2000	VTmag
 	 		deg	deg	mag
----	----	-	----------	----------	-----
2798	1667	1	14.1879413900	38.4992613900	3.868
2808	2070	1	17.5780898621	42.0814806220	5.732
2808	530	1	16.7396572700	40.9073687900	6.348
2808	916	1	16.9102233400	40.1215337600	7.297
2808	1338	1	15.1186694700	39.9970479000	8.112
2808	1912	1	20.8814400000	44.9315500000	8.902
`;

assert.equal(dateToYMDUTC(new Date("2026-07-02T23:59:59.000Z")), "2026-07-02");
assert.equal(addDaysToYMD("2026-03-01", -1), "2026-02-28");
assert.equal(daysBetweenYMD("2026-03-21", "2026-03-22"), 1);
assert.equal(getSunRightAscension("2026-03-21"), 0);
assert.equal(parseSolarNoonUTC("2026-07-02", "12:03:04 PM").toISOString(), "2026-07-02T12:03:04.000Z");
assert.equal(parseSolarNoonUTC("2026-07-02", "12:03:04 AM").toISOString(), "2026-07-02T00:03:04.000Z");

const noons = {
  "2026-03-20": new Date("2026-03-20T12:00:00.000Z"),
  "2026-03-21": new Date("2026-03-21T12:00:00.000Z"),
  "2026-03-22": new Date("2026-03-22T12:00:00.000Z")
};

const payload = await buildSkyViewPayload({
  latitude: 40,
  longitude: -74,
  observedAt: "2026-03-21T18:00:00.000Z",
  solarNoonForDate: async (_latitude, _longitude, dateString) => noons[dateString]
});

assert.equal(payload.declination, 40);
assert.equal(payload.solarNoonWindow.start, "2026-03-21T12:00:00.000Z");
assert.equal(payload.solarNoonWindow.end, "2026-03-22T12:00:00.000Z");
assert.equal(payload.percentBetweenNoons, 0.25);
assert.equal(Number(payload.rightAscension.toFixed(6)), 16.246575);
assert.equal(payload.imageUrl, undefined);

assert.equal(normalizeDegrees(370), 10);
assert.equal(normalizeDegrees(-5), 355);
assert.equal(signedRaDeltaDegrees(2, 358), 4);
assert.equal(signedRaDeltaDegrees(358, 2), -4);

const catalogUrl = getVizieRStarCatalogUrl(payload.rightAscension, payload.declination);
assert.match(catalogUrl, /^https:\/\/vizier\.cds\.unistra\.fr\/viz-bin\/asu-tsv\?/);
assert.match(catalogUrl, /-source=I%2F259%2Ftyc2/);
assert.match(catalogUrl, /-c=16\.2465753424657\d*%2040/);
assert.match(catalogUrl, /-out=_RAJ2000/);
assert.match(catalogUrl, /-out=_DEJ2000/);
assert.match(catalogUrl, /-out=VTmag/);

const catalogStars = parseVizieRTsv(sampleTychoTsv);
assert.equal(catalogStars.length, 6);
assert.equal(catalogStars[0].id, "TYC 2798-1667-1");
assert.equal(catalogStars[0].mag, 3.868);
assert.equal(Number(catalogStars[0].ra.toFixed(8)), 14.18794139);

const projectedStars = projectCatalogStars(catalogStars, payload.rightAscension, payload.declination);
assert.equal(projectedStars.length, 5);
assert.ok(projectedStars.every((star) => star.x >= 0 && star.x <= 1));
assert.ok(projectedStars.every((star) => star.y >= 0 && star.y <= 1));
assert.ok(projectedStars.every((star) => star.s >= 1 && star.s <= 3));

const catalogStarMap = buildCatalogStarMap(sampleTychoTsv, payload.rightAscension, payload.declination);
assert.equal(catalogStarMap.catalog, "I/259/tyc2");
assert.equal(catalogStarMap.fieldDegrees, 8);
assert.equal(catalogStarMap.stars.length, 5);

const packedStars = packStarMap(catalogStarMap.stars);
assert.ok(packedStars.every((star) => star.length === 4));
assert.ok(packedStars.every((star) => star[0] >= 0 && star[0] <= 1000));
assert.ok(packedStars.every((star) => star[1] >= 0 && star[1] <= 1000));
assert.ok(packedStars.every((star) => star[2] >= 1 && star[2] <= 3));
assert.ok(packedStars.every((star) => star[3] >= 0 && star[3] <= 2));

const fetchedStarMap = await fetchCatalogStarMap(
  async () => ({ body: sampleTychoTsv }),
  payload.rightAscension,
  payload.declination
);
assert.equal(fetchedStarMap.stars.length, 5);

const textFromBytes = await responseBodyToText({ body: new TextEncoder().encode(sampleTychoTsv) });
assert.equal(textFromBytes, sampleTychoTsv);

assert.throws(
  () => buildCatalogStarMap("not a catalog", payload.rightAscension, payload.declination),
  /Tycho-2 coordinates/
);

console.log("skyview tests passed");
