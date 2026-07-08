export const VIZIER_CATALOG_BASE_URL = "https://vizier.cds.unistra.fr/viz-bin/asu-tsv";
export const TYCHO2_CATALOG = "I/259/tyc2";
export const CATALOG_FIELD_DEGREES = 8;

const CATALOG_REQUEST_LIMIT = 160;
const MAX_CATALOG_STARS = 72;
const DEFAULT_STAR_COLOR = 0xffffff;
const BRIGHT_STAR_COLOR = 0xffffdd;
const ERROR_PREVIEW_LENGTH = 120;

function clamp(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return Math.max(min, Math.min(max, 0));
  }

  return Math.max(min, Math.min(max, number));
}

export function normalizeDegrees(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return 0;
  }

  return ((number % 360) + 360) % 360;
}

export function signedRaDeltaDegrees(rightAscension, centerRightAscension) {
  let delta = normalizeDegrees(rightAscension) - normalizeDegrees(centerRightAscension);
  if (delta > 180) {
    delta -= 360;
  }
  if (delta < -180) {
    delta += 360;
  }

  return delta;
}

function catalogQueryRadius(fieldDegrees) {
  return (fieldDegrees / 2) * Math.SQRT2;
}

export function getVizieRStarCatalogUrl(rightAscension, declination, fieldDegrees = CATALOG_FIELD_DEGREES) {
  const center = `${normalizeDegrees(rightAscension)},${clamp(Number(declination), -90, 90)}`.replace(",", " ");
  const radius = catalogQueryRadius(fieldDegrees);
  const params = [
    `-source=${encodeURIComponent(TYCHO2_CATALOG)}`,
    `-c=${encodeURIComponent(center)}`,
    `-c.r=${encodeURIComponent(radius.toFixed(3))}`,
    "-c.u=deg",
    "-out=TYC1",
    "-out=TYC2",
    "-out=TYC3",
    "-out=_RAJ2000",
    "-out=_DEJ2000",
    "-out=VTmag",
    "-sort=VTmag",
    `-out.max=${CATALOG_REQUEST_LIMIT}`
  ];

  return `${VIZIER_CATALOG_BASE_URL}?${params.join("&")}`;
}

function previewText(value) {
  return String(value || "")
    .slice(0, ERROR_PREVIEW_LENGTH)
    .replace(/\s+/g, " ");
}

function columnIndex(headers, names) {
  for (let index = 0; index < names.length; index += 1) {
    const headerIndex = headers.indexOf(names[index]);
    if (headerIndex !== -1) {
      return headerIndex;
    }
  }

  return -1;
}

function looksLikeHeader(columns) {
  return columns.indexOf("_RAJ2000") !== -1
    || columns.indexOf("RAJ2000") !== -1
    || columns.indexOf("RA_ICRS") !== -1
    || columns.indexOf("RA_ICRS_") !== -1;
}

function isSeparatorRow(columns) {
  return columns.every((column) => /^[-\s.]+$/.test(column));
}

function isUnitRow(columns) {
  return columns.some((column) => /^(deg|mag)$/i.test(column.trim()))
    && columns.every((column) => /^(\s*|deg|mag|\?)$/i.test(column.trim()));
}

function parseNumber(value) {
  const parsed = Number(String(value || "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function buildTychoId(row, indexes) {
  const parts = [indexes.tyc1, indexes.tyc2, indexes.tyc3]
    .map((index) => (index === -1 ? "" : String(row[index] || "").trim()))
    .filter(Boolean);

  return parts.length === 3 ? `TYC ${parts[0]}-${parts[1]}-${parts[2]}` : "";
}

export function parseVizieRTsv(tsv) {
  if (typeof tsv !== "string" || !tsv.trim()) {
    throw new Error("VizieR response was empty");
  }

  const lines = tsv.replace(/\r/g, "").split("\n");
  let headers = null;
  let indexes = null;
  const stars = [];

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    if (!line.trim() || line.trim().startsWith("#")) {
      continue;
    }

    const columns = line.split("\t").map((column) => column.trim());
    if (!headers && looksLikeHeader(columns)) {
      headers = columns;
      indexes = {
        tyc1: columnIndex(headers, ["TYC1"]),
        tyc2: columnIndex(headers, ["TYC2"]),
        tyc3: columnIndex(headers, ["TYC3"]),
        ra: columnIndex(headers, ["_RAJ2000", "RAJ2000", "RA_ICRS", "RA_ICRS_"]),
        dec: columnIndex(headers, ["_DEJ2000", "DEJ2000", "DE_ICRS", "DE_ICRS_"]),
        mag: columnIndex(headers, ["VTmag", "Vmag", "mag"])
      };
      continue;
    }

    if (!headers || !indexes) {
      continue;
    }

    if (isSeparatorRow(columns) || isUnitRow(columns)) {
      continue;
    }

    const ra = parseNumber(columns[indexes.ra]);
    const dec = parseNumber(columns[indexes.dec]);
    const mag = parseNumber(columns[indexes.mag]);

    if (ra === null || dec === null) {
      continue;
    }

    stars.push({
      id: buildTychoId(columns, indexes),
      ra: normalizeDegrees(ra),
      dec: clamp(dec, -90, 90),
      mag: mag === null ? 99 : mag
    });
  }

  if (!headers || !indexes || indexes.ra === -1 || indexes.dec === -1) {
    throw new Error(`VizieR response did not include Tycho-2 coordinates: ${previewText(tsv)}`);
  }

  return stars.sort((a, b) => a.mag - b.mag);
}

function getStarSize(magnitude) {
  if (magnitude <= 5.5) {
    return 3;
  }
  if (magnitude <= 7.2) {
    return 2;
  }

  return 1;
}

function getStarColor(magnitude) {
  return magnitude <= 5.5 ? BRIGHT_STAR_COLOR : DEFAULT_STAR_COLOR;
}

export function projectCatalogStars(
  stars,
  centerRightAscension,
  centerDeclination,
  fieldDegrees = CATALOG_FIELD_DEGREES
) {
  const halfField = fieldDegrees / 2;
  const centerDec = clamp(Number(centerDeclination), -90, 90);
  const raScale = Math.max(0.08, Math.cos((centerDec * Math.PI) / 180));

  return (stars || [])
    .map((star) => {
      const dx = signedRaDeltaDegrees(star.ra, centerRightAscension) * raScale;
      const dy = star.dec - centerDec;

      return {
        id: star.id,
        dx,
        dy,
        mag: star.mag,
        x: 0.5 + dx / fieldDegrees,
        y: 0.5 - dy / fieldDegrees,
        s: getStarSize(star.mag),
        c: getStarColor(star.mag)
      };
    })
    .filter((star) => Math.abs(star.dx) <= halfField && Math.abs(star.dy) <= halfField)
    .sort((a, b) => a.mag - b.mag)
    .slice(0, MAX_CATALOG_STARS)
    .map((star) => ({
      x: Number(clamp(star.x, 0, 1).toFixed(4)),
      y: Number(clamp(star.y, 0, 1).toFixed(4)),
      s: star.s,
      c: star.c
    }));
}

export function buildCatalogStarMap(tsv, centerRightAscension, centerDeclination, fieldDegrees = CATALOG_FIELD_DEGREES) {
  const catalogStars = parseVizieRTsv(tsv);
  const stars = projectCatalogStars(catalogStars, centerRightAscension, centerDeclination, fieldDegrees);

  if (!stars.length) {
    throw new Error("VizieR catalog did not return stars inside the screen field");
  }

  return {
    stars,
    catalog: TYCHO2_CATALOG,
    fieldDegrees
  };
}

function isArrayBuffer(value) {
  return value && Object.prototype.toString.call(value) === "[object ArrayBuffer]";
}

function viewToBytes(view) {
  if (view instanceof Uint8Array) {
    return view;
  }

  return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
}

function bytesToText(bytes) {
  if (typeof TextDecoder !== "undefined") {
    return new TextDecoder("utf-8").decode(bytes);
  }

  let text = "";
  for (let index = 0; index < bytes.length; index += 1024) {
    const chunk = bytes.subarray(index, index + 1024);
    text += String.fromCharCode.apply(null, Array.from(chunk));
  }

  return text;
}

export async function responseBodyToText(response) {
  if (response && typeof response.text === "function") {
    return response.text();
  }

  const body = response && response.body !== undefined ? response.body : response;

  if (typeof body === "string") {
    return body;
  }

  if (isArrayBuffer(body)) {
    return bytesToText(new Uint8Array(body));
  }

  if (typeof Uint8Array !== "undefined" && body instanceof Uint8Array) {
    return bytesToText(body);
  }

  if (Array.isArray(body)) {
    return bytesToText(new Uint8Array(body));
  }

  if (typeof ArrayBuffer !== "undefined" && ArrayBuffer.isView && ArrayBuffer.isView(body)) {
    return bytesToText(viewToBytes(body));
  }

  if (body && typeof body === "object" && body.data !== body) {
    return responseBodyToText(body.data);
  }

  throw new Error(`VizieR response did not contain readable text (${typeof body})`);
}

export async function fetchCatalogStarMap(fetcher, centerRightAscension, centerDeclination) {
  const url = getVizieRStarCatalogUrl(centerRightAscension, centerDeclination);
  const response = await fetcher({
    url,
    method: "GET",
    headers: {
      Accept: "text/tab-separated-values,text/plain,*/*"
    },
    timeout: 45000
  });
  const text = await responseBodyToText(response);

  return buildCatalogStarMap(text, centerRightAscension, centerDeclination);
}
