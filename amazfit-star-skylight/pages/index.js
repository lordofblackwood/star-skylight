import "../shared/device-polyfill";

const WIDTH = 194;
const HEIGHT = 368;
const AUTO_REFRESH_DELAY_MS = 800;
const MAP_X = 10;
const MAP_Y = 104;
const MAP_SIZE = WIDTH - 20;
const STAR_COLORS = [0xffffdd, 0xffffff, 0x8fb4ff];

let statusText = null;
let metaText = null;
let actionText = null;
let skyPanel = null;
let starWidgets = [];
let inFlight = false;

function text(options) {
  return hmUI.createWidget(hmUI.widget.TEXT, {
    color: 0xffffff,
    align_h: hmUI.align.CENTER_H,
    text_style: hmUI.text_style.WRAP,
    ...options
  });
}

function setText(widget, value) {
  if (!widget) {
    return;
  }

  if (hmUI.prop.TEXT !== undefined) {
    widget.setProperty(hmUI.prop.TEXT, value);
    return;
  }

  widget.setProperty(hmUI.prop.MORE, {
    text: value
  });
}

function setStatus(stage, message) {
  setText(statusText, stage || "Working");
  setText(metaText, message || "");
}

function setAction(value) {
  setText(actionText, value);
}

function clearStarMap() {
  starWidgets.forEach((widget) => {
    if (widget && hmUI.prop.VISIBLE !== undefined) {
      widget.setProperty(hmUI.prop.VISIBLE, false);
    }
  });
  starWidgets = [];
}

function drawStarMap(stars) {
  clearStarMap();

  if (!skyPanel) {
    skyPanel = hmUI.createWidget(hmUI.widget.FILL_RECT, {
      x: MAP_X,
      y: MAP_Y,
      w: MAP_SIZE,
      h: MAP_SIZE,
      color: 0x020511
    });
  } else if (hmUI.prop.VISIBLE !== undefined) {
    skyPanel.setProperty(hmUI.prop.VISIBLE, true);
  }

  (stars || []).forEach((star) => {
    const starX = Array.isArray(star) ? star[0] / 1000 : star.x;
    const starY = Array.isArray(star) ? star[1] / 1000 : star.y;
    const starSize = Array.isArray(star) ? star[2] : star.s;
    const starColor = Array.isArray(star) ? STAR_COLORS[star[3]] : star.c;
    const size = Math.max(1, Math.min(3, Number(starSize) || 1));
    const x = Math.max(MAP_X, Math.min(MAP_X + MAP_SIZE - size, Math.round(MAP_X + starX * MAP_SIZE - size / 2)));
    const y = Math.max(MAP_Y, Math.min(MAP_Y + MAP_SIZE - size, Math.round(MAP_Y + starY * MAP_SIZE - size / 2)));

    starWidgets.push(hmUI.createWidget(hmUI.widget.FILL_RECT, {
      x,
      y,
      w: size,
      h: size,
      color: starColor || 0xffffff
    }));
  });
}

function getMessageBuilder() {
  const app = getApp();
  return app && app._options && app._options.globalData
    ? app._options.globalData.messageBuilder
    : null;
}

function normalizeResult(data) {
  if (data && data.result) {
    return data.result;
  }

  return data;
}

function handleSideCall(data) {
  const messageBuilder = getMessageBuilder();
  if (!messageBuilder || !data || !data.payload) {
    return;
  }

  const body = messageBuilder.buf2Json(data.payload);
  if (!body || body.method !== "STAR_STATUS") {
    return;
  }

  const params = body.params || {};
  setStatus(params.stage, params.message);
}

function refreshStars() {
  const messageBuilder = getMessageBuilder();
  if (!messageBuilder) {
    setStatus("Bridge unavailable", "Close and reopen the app");
    return;
  }

  if (inFlight) {
    return;
  }

  inFlight = true;
  setAction("Wait");
  setStatus("Starting", "Asking phone side service");

  messageBuilder
    .request({
      method: "GET_STARS",
      params: {}
    }, {
      timeout: 70000
    })
    .then((data) => {
      const result = normalizeResult(data);
      if (result && result.status === "map_ready") {
        const source = result.source === "cache" ? "Cached" : "Catalog";
        drawStarMap(result.stars);
        setStatus("Stars above you", `RA ${result.rightAscension} DEC ${result.declination} ${source}`);
        setAction("Refresh");
        inFlight = false;
        return;
      }

      throw new Error(result && result.message ? result.message : "Star map request failed");
    })
    .catch((error) => {
      setStatus(error && error.message ? error.message : "Refresh failed", "Fix settings or tap Retry");
      setAction("Retry");
      inFlight = false;
    });
}

function bindRefresh(widget) {
  if (!widget || typeof widget.addEventListener !== "function") {
    return;
  }

  if (hmUI.event.SELECT !== undefined) {
    widget.addEventListener(hmUI.event.SELECT, refreshStars);
  }
  if (hmUI.event.CLICK_UP !== undefined) {
    widget.addEventListener(hmUI.event.CLICK_UP, refreshStars);
  }
}

Page({
  build() {
    hmUI.createWidget(hmUI.widget.FILL_RECT, {
      x: 0,
      y: 0,
      w: WIDTH,
      h: HEIGHT,
      color: 0x05070b
    });

    statusText = text({
      x: 8,
      y: 16,
      w: WIDTH - 16,
      h: 40,
      text_size: 20,
      text: "Star Skylight"
    });

    metaText = text({
      x: 10,
      y: 58,
      w: WIDTH - 20,
      h: 58,
      text_size: 14,
      color: 0xa9c5d6,
      text: "Starting automatically"
    });

    hmUI.createWidget(hmUI.widget.FILL_RECT, {
      x: 14,
      y: 286,
      w: WIDTH - 28,
      h: 48,
      color: 0x1d8b77
    });

    actionText = text({
      x: 14,
      y: 286,
      w: WIDTH - 28,
      h: 48,
      text_size: 19,
      align_v: hmUI.align.CENTER_V,
      text_style: hmUI.text_style.NONE,
      text: "Refresh"
    });
    bindRefresh(actionText);

    const messageBuilder = getMessageBuilder();
    if (messageBuilder) {
      messageBuilder.on("call", handleSideCall);
    }

    setTimeout(refreshStars, AUTO_REFRESH_DELAY_MS);
  },
  onDestroy() {
    const messageBuilder = getMessageBuilder();
    if (messageBuilder) {
      messageBuilder.off("call", handleSideCall);
    }
  }
});
