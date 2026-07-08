export const SOLAR_NOON_BASE_URL = "https://api.sunrise-sunset.org/json";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_MINUTE = 60 * 1000;

export function dateToYMDUTC(date) {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDaysToYMD(dateString, days) {
  const [year, month, day] = dateString.split("-").map(Number);
  return dateToYMDUTC(new Date(Date.UTC(year, month - 1, day + days)));
}

export function daysBetweenYMD(startDateString, endDateString) {
  const [startYear, startMonth, startDay] = startDateString.split("-").map(Number);
  const [endYear, endMonth, endDay] = endDateString.split("-").map(Number);
  const start = Date.UTC(startYear, startMonth - 1, startDay);
  const end = Date.UTC(endYear, endMonth - 1, endDay);
  return Math.round((end - start) / MS_PER_DAY);
}

export function getSunRightAscension(dateString) {
  const year = dateString.split("-")[0];
  const springEquinox = `${year}-03-21`;
  const daysSinceEquinox = daysBetweenYMD(springEquinox, dateString);
  return 360 * ((((daysSinceEquinox % 365) + 365) % 365) / 365);
}

export function packStarMap(stars) {
  return (stars || []).map((star) => [
    Math.round(star.x * 1000),
    Math.round(star.y * 1000),
    star.s,
    star.c === 0xffffdd ? 0 : star.c === 0xffffff ? 1 : 2
  ]);
}

export function parseSolarNoonUTC(dateString, solarNoonText) {
  const match = /^(\d{1,2}):(\d{2}):(\d{2})\s*([AP]M)$/i.exec(solarNoonText.trim());
  if (!match) {
    throw new Error(`Could not parse solar noon: ${solarNoonText}`);
  }

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3]);
  const period = match[4].toUpperCase();

  if (period === "PM" && hour !== 12) {
    hour += 12;
  }
  if (period === "AM" && hour === 12) {
    hour = 0;
  }

  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second));
}

export async function fetchSolarNoonUTC(latitude, longitude, dateString) {
  const query = [
    `lat=${encodeURIComponent(String(latitude))}`,
    `lng=${encodeURIComponent(String(longitude))}`,
    `date=${encodeURIComponent(dateString)}`
  ].join("&");
  const response = await fetch({
    url: `${SOLAR_NOON_BASE_URL}?${query}`,
    method: "GET"
  });
  const body = typeof response.body === "string" ? JSON.parse(response.body) : response.body;

  if (!body || body.status !== "OK" || !body.results || !body.results.solar_noon) {
    throw new Error(`Solar noon lookup failed for ${dateString}`);
  }

  return parseSolarNoonUTC(dateString, body.results.solar_noon);
}

export async function buildSkyViewPayload({
  latitude,
  longitude,
  observedAt = new Date().toISOString(),
  solarNoonForDate = fetchSolarNoonUTC
}) {
  const when = new Date(observedAt);
  if (Number.isNaN(when.getTime())) {
    throw new Error(`Invalid observedAt value: ${observedAt}`);
  }

  const today = dateToYMDUTC(when);
  const yesterday = addDaysToYMD(today, -1);
  const tomorrow = addDaysToYMD(today, 1);
  const todayNoon = await solarNoonForDate(latitude, longitude, today);

  const useTodayToTomorrow = todayNoon < when;
  const startDate = useTodayToTomorrow ? today : yesterday;
  const endDate = useTodayToTomorrow ? tomorrow : today;
  const startNoon = useTodayToTomorrow
    ? todayNoon
    : await solarNoonForDate(latitude, longitude, yesterday);
  const endNoon = useTodayToTomorrow
    ? await solarNoonForDate(latitude, longitude, tomorrow)
    : todayNoon;

  const solarDayMinutes = (endNoon.getTime() - startNoon.getTime()) / MS_PER_MINUTE;
  const elapsedMinutes = (when.getTime() - startNoon.getTime()) / MS_PER_MINUTE;
  const percentBetweenNoons = elapsedMinutes / solarDayMinutes;
  const raPair = [
    getSunRightAscension(startDate),
    getSunRightAscension(endDate)
  ];
  const degreesToTravel = 360 + (raPair[1] - raPair[0]);
  const rightAscension = longitude + raPair[0] + percentBetweenNoons * degreesToTravel;
  const declination = latitude;

  return {
    rightAscension,
    declination,
    observedAt: when.toISOString(),
    solarNoonWindow: {
      start: startNoon.toISOString(),
      end: endNoon.toISOString()
    },
    percentBetweenNoons
  };
}
