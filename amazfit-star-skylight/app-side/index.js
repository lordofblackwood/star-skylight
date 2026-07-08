import { BaseSideService, settingsLib } from "@zeppos/zml/base-side";
import { fetchCatalogStarMap, normalizeDegrees } from "../utils/catalog-stars.js";
import { buildSkyViewPayload, packStarMap } from "../utils/skyview.js";

const LOCATION_ERROR = "Set latitude and longitude in app settings.";
const STAR_MAP_CACHE_KEY = "lastCatalogStarMap";
const LEGACY_STAR_MAP_CACHE_KEY = "lastNasaStarMap";
const CATALOG_ERROR_KEY = "lastCatalogError";
const CATALOG_ERROR_AT_KEY = "lastCatalogErrorAt";
const MAX_ERROR_LENGTH = 220;
const DEBUG_LOGS = false;

function log(message, extra) {
  if (!DEBUG_LOGS) {
    return;
  }

  if (extra === undefined) {
    console.log(`star_skylight_side ${message}`);
    return;
  }

  console.log(`star_skylight_side ${message}`, extra);
}

function logError(message) {
  console.log(`star_skylight error: ${message}`);
}

function notifyStatus(service, stage, message) {
  if (!service || typeof service.call !== "function") {
    return;
  }

  try {
    service.call({
      method: "STAR_STATUS",
      params: {
        stage,
        message
      }
    });
  } catch (error) {
    log("status notify failed", error && error.message ? error.message : error);
  }
}

function parseCoordinate(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function withStoredLocation(params) {
  const latitudeValue = params && params.latitude !== undefined
    ? params.latitude
    : settingsLib.getItem("latitude");
  const longitudeValue = params && params.longitude !== undefined
    ? params.longitude
    : settingsLib.getItem("longitude");
  const latitude = parseCoordinate(latitudeValue);
  const longitude = parseCoordinate(longitudeValue);

  if (latitude === null || longitude === null) {
    log("missing coordinates", JSON.stringify(settingsLib.getAll()));
    throw new Error(LOCATION_ERROR);
  }

  return Object.assign({}, params, {
    latitude,
    longitude
  });
}

function shorten(value, maxLength = MAX_ERROR_LENGTH) {
  const text = String(value || "");
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

function saveCatalogError(message) {
  try {
    settingsLib.setItem(CATALOG_ERROR_KEY, shorten(message));
    settingsLib.setItem(CATALOG_ERROR_AT_KEY, new Date().toISOString());
  } catch (error) {
    log("error save failed", error && error.message ? error.message : error);
  }
}

function clearCatalogError() {
  try {
    settingsLib.removeItem(CATALOG_ERROR_KEY);
    settingsLib.removeItem(CATALOG_ERROR_AT_KEY);
  } catch (error) {
    log("error clear failed", error && error.message ? error.message : error);
  }
}

function withTextHints(request) {
  return Object.assign({}, request, {
    responseType: "text",
    dataType: "text"
  });
}

function getCatalogFetchers(service) {
  const fetchers = [];

  if (service && typeof service.httpRequest === "function") {
    fetchers.push({
      name: "httpRequest",
      fetcher: (request) => service.httpRequest(withTextHints(request))
    });
  }

  if (service && typeof service.fetch === "function") {
    fetchers.push({
      name: "service.fetch",
      fetcher: (request) => service.fetch(withTextHints(request))
    });
  }

  if (typeof fetch === "function") {
    fetchers.push({
      name: "global.fetch",
      fetcher: (request) => fetch(withTextHints(request))
    });
  }

  return fetchers;
}

async function fetchCatalogStarMapFromService(service, rightAscension, declination) {
  const attempts = [];
  const fetchers = getCatalogFetchers(service);

  if (!fetchers.length) {
    throw new Error("No Zepp network fetch API is available");
  }

  for (let index = 0; index < fetchers.length; index += 1) {
    const item = fetchers[index];
    try {
      return await fetchCatalogStarMap(item.fetcher, rightAscension, declination);
    } catch (error) {
      const message = error && error.message ? error.message : error;
      attempts.push(`${item.name}: ${shorten(message, 90)}`);
    }
  }

  throw new Error(attempts.join(" | "));
}

function buildResult(payload, source, packedStars) {
  return {
    rightAscension: normalizeDegrees(payload.rightAscension).toFixed(1),
    declination: payload.declination.toFixed(1),
    observedAt: payload.observedAt,
    status: "map_ready",
    source,
    stars: packedStars
  };
}

function isPackedStar(star) {
  return Array.isArray(star)
    && star.length === 4
    && star.every((value) => Number.isFinite(Number(value)));
}

function saveCachedStarMap(result) {
  try {
    settingsLib.setItem(STAR_MAP_CACHE_KEY, JSON.stringify(result));
  } catch (error) {
    log("cache save failed", error && error.message ? error.message : error);
  }
}

function readCachedStarMap() {
  const cacheKeys = [STAR_MAP_CACHE_KEY, LEGACY_STAR_MAP_CACHE_KEY];

  for (let index = 0; index < cacheKeys.length; index += 1) {
    const raw = settingsLib.getItem(cacheKeys[index]);
    if (!raw) {
      continue;
    }

    try {
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (!parsed || parsed.status !== "map_ready" || !Array.isArray(parsed.stars)) {
        continue;
      }

      if (!parsed.stars.every(isPackedStar)) {
        continue;
      }

      return Object.assign({}, parsed, {
        source: "cache"
      });
    } catch (error) {
      log("cache read failed", error && error.message ? error.message : error);
    }
  }

  return null;
}

async function prepareStarsImage(service, params) {
  notifyStatus(service, "1/3 Position", "Reading coordinates");
  log("prepare start");
  const payload = await buildSkyViewPayload(withStoredLocation(params));
  notifyStatus(service, "1/3 Position", `RA ${payload.rightAscension.toFixed(1)} DEC ${payload.declination.toFixed(1)}`);
  log("sky payload");

  try {
    notifyStatus(service, "2/3 Catalog", "Querying Tycho-2");
    const starMap = await fetchCatalogStarMapFromService(service, payload.rightAscension, payload.declination);
    notifyStatus(service, "3/3 Map", `${starMap.stars.length} catalog stars`);
    const result = buildResult(payload, "catalog", packStarMap(starMap.stars));
    saveCachedStarMap(result);
    clearCatalogError();
    return result;
  } catch (error) {
    const message = error && error.message ? error.message : "Catalog lookup failed";
    saveCatalogError(message);
    const cached = readCachedStarMap();
    if (cached) {
      notifyStatus(service, "Cached screen", "Catalog failed; showing last successful map");
      log("catalog cache", message);
      return cached;
    }

    throw new Error("Catalog failed; no cached screen. Open app settings for details.");
  }
}

AppSideService(
  BaseSideService({
    onInit() {
      log("initialized");
    },
    onRequest(req, res) {
      log("request");
      if (req.method !== "GET_STARS") {
        res(null, {
          status: "ignored"
        });
        return;
      }

      prepareStarsImage(this, req.params || {})
        .then((result) => {
          res(null, result);
        })
        .catch((error) => {
          const message = error && error.message ? error.message : "Unable to prepare star image";
          notifyStatus(this, "Error", message);
          logError(message);
          res(null, {
            status: "error",
            message
          });
        });
    },
    onRun() {
      log("run");
    },
    onDestroy() {
      log("destroy");
    }
  })
);
