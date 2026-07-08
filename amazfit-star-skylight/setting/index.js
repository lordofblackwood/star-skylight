function getSetting(props, key, fallback = "") {
  return props.settingsStorage.getItem(key) || fallback;
}

function setSetting(props, key, value) {
  const normalized = value === null || value === undefined ? "" : value;
  props.settingsStorage.setItem(key, String(normalized).trim());
}

function formatCoordinate(value) {
  return Number(value).toFixed(6);
}

function setLocationStatus(props, value) {
  setSetting(props, "locationStatus", value);
}

function getCatalogStatus(props) {
  const error = getSetting(props, "lastCatalogError");
  const errorAt = getSetting(props, "lastCatalogErrorAt");

  if (!error) {
    return "Catalog status: no error recorded.";
  }

  return `Last catalog error${errorAt ? ` (${errorAt})` : ""}: ${error}`;
}

function usePhoneLocation(props) {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    setLocationStatus(props, "Phone location is unavailable in this Zepp settings view.");
    return;
  }

  setLocationStatus(props, "Requesting phone location...");
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const latitude = formatCoordinate(position.coords.latitude);
      const longitude = formatCoordinate(position.coords.longitude);
      setSetting(props, "latitude", latitude);
      setSetting(props, "longitude", longitude);
      setLocationStatus(props, `Saved phone location: ${latitude}, ${longitude}`);
    },
    (error) => {
      const message = error && error.message ? error.message : "Permission denied or location unavailable.";
      setLocationStatus(props, `Phone location failed: ${message}`);
    },
    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 600000
    }
  );
}

AppSettingsPage({
  build(props) {
    const latitude = getSetting(props, "latitude");
    const longitude = getSetting(props, "longitude");
    const locationStatus = getSetting(props, "locationStatus", "No phone location saved yet.");
    const catalogStatus = getCatalogStatus(props);

    return Section(
      {},
      [
        View(
          {
            style: {
              marginTop: "16px",
              marginBottom: "8px"
            }
          },
          [
            Text(
              {
                style: {
                  fontWeight: "bold"
                }
              },
              ["Star Skylight location"]
            )
          ]
        ),
        Text({}, ["Use phone location, or enter latitude and longitude manually."]),
        Button({
          label: "Use Phone Location",
          color: "primary",
          onClick: () => usePhoneLocation(props)
        }),
        Text({}, [locationStatus]),
        TextInput({
          label: "Latitude",
          placeholder: "40.7128",
          value: latitude,
          onChange: (value) => setSetting(props, "latitude", value)
        }),
        TextInput({
          label: "Longitude",
          placeholder: "-74.0060",
          value: longitude,
          onChange: (value) => setSetting(props, "longitude", value)
        }),
        Text({}, [catalogStatus])
      ]
    );
  }
});
