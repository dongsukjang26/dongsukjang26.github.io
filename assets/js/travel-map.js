import PhotoSwipeLightbox from "https://cdn.jsdelivr.net/npm/photoswipe@5.4.4/dist/photoswipe-lightbox.esm.min.js";
import PhotoSwipe from "https://cdn.jsdelivr.net/npm/photoswipe@5.4.4/dist/photoswipe.esm.min.js";

const TYPES = {
  ski: { label: "Ski", color: "#3b82f6" },
  tennis: { label: "Tennis", color: "#65a30d" },
  golf: { label: "Golf", color: "#0f766e" },
  trip: { label: "Trip", color: "#f97316" },
};
const OTHER_TYPE = { label: "Other", color: "#6b7280" };

const CARTO_KEY = "cb1_43gb_1_17e72b018758e12a2f568fcb";
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const TILES = CARTO_KEY
  ? {
      light: `https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${CARTO_KEY}`,
      dark: `https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png?key=${CARTO_KEY}`,
      attribution: `${OSM_ATTRIBUTION} &copy; <a href="https://carto.com/attributions">CARTO</a>`,
    }
  : { light: "https://tile.openstreetmap.org/{z}/{x}/{y}.png", dark: null, attribution: OSM_ATTRIBUTION };

const root = document.querySelector(".travel");
const imgBase = root.dataset.imgBase;
const places = JSON.parse(document.getElementById("travel-data").textContent || "[]")
  .filter((place) => {
    const ok = Number.isFinite(place.lat) && Number.isFinite(place.lng);
    if (!ok) console.warn(`travel: "${place.id}" has no lat/lng, skipped`);
    return ok;
  })
  .map((place) => ({ ...place, photos: place.photos || [] }))
  .sort((a, b) => String(b.date).localeCompare(String(a.date)));

const typeOf = (place) => TYPES[place.type] || OTHER_TYPE;
const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else if (value !== undefined && value !== null) node.setAttribute(key, value);
  }
  node.append(...children.filter((child) => child !== null && child !== undefined));
  return node;
}

function photoSrc(place, photo) {
  return photo.url || `${imgBase}${place.id}/${photo.file}`;
}

// The imagemagick plugin writes -480/-800/-1400.webp next to every local jpg/png at build time
function photoThumb(place, photo, width = 800) {
  if (photo.url) return photo.thumb || photo.url;
  return `${imgBase}${place.id}/${photo.file.replace(/\.[^.]+$/, "")}-${width}.webp`;
}

function thumbImg(place, photo, width) {
  const img = el("img", { src: photoThumb(place, photo, width), alt: photo.caption || place.name, loading: "lazy" });
  img.addEventListener("error", () => (img.src = photoSrc(place, photo)), { once: true });
  return img;
}

function formatDate(value) {
  const [year, month] = String(value || "").split("-");
  if (!month) return year || "";
  return new Date(Number(year), Number(month) - 1).toLocaleDateString("en-US", { year: "numeric", month: "short" });
}

const typeTag = (place) => el("span", { class: "travel-type", style: `--pin-color: ${typeOf(place).color}` }, typeOf(place).label);

/* Photo viewer */

const lightbox = new PhotoSwipeLightbox({ pswpModule: PhotoSwipe, bgOpacity: 0.92, showHideAnimationType: "fade" });
lightbox.on("uiRegister", () => {
  lightbox.pswp.ui.registerElement({
    name: "travel-caption",
    order: 9,
    isButton: false,
    appendTo: "root",
    onInit: (node, pswp) => {
      pswp.on("change", () => (node.textContent = pswp.currSlide.data.caption || ""));
    },
  });
});
lightbox.init();

function measure(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve({ w: 1600, h: 1200 });
    img.src = src;
  });
}

async function openGallery(place, index = 0) {
  const items = await Promise.all(
    place.photos.map(async (photo) => {
      const src = photoSrc(place, photo);
      const { w, h } = photo.w && photo.h ? photo : await measure(src);
      return {
        src,
        width: w,
        height: h,
        alt: photo.caption || place.name,
        caption: photo.caption || `${place.name}, ${formatDate(place.date)}`,
      };
    })
  );
  lightbox.loadAndOpen(index, items);
}

/* Map */

const mapEl = root.querySelector(".travel-map");
const map = L.map(mapEl, { worldCopyJump: true, minZoom: 2, zoomSnap: 0.25 });

let tiles = null;
let tilesUrl = null;
function syncTheme() {
  const dark = document.documentElement.getAttribute("data-theme") === "dark";
  const url = dark && TILES.dark ? TILES.dark : TILES.light;
  // Without dark tiles (OSM fallback), dark mode inverts the light ones with a CSS filter
  mapEl.classList.toggle("is-dark", dark && !TILES.dark);
  if (url === tilesUrl) return;
  if (tiles) map.removeLayer(tiles);
  tiles = L.tileLayer(url, { attribution: TILES.attribution, maxZoom: 19 }).addTo(map);
  tilesUrl = url;
}
syncTheme();
new MutationObserver(syncTheme).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

// Pinch (trackpad) and Cmd/Ctrl + scroll zoom the map; a plain scroll keeps scrolling the page
const isMac = /Mac|iPhone|iPad/.test(navigator.userAgent);
const zoomTip = el("div", { class: "travel-zoom-tip" }, isMac ? "Pinch or ⌘ + scroll to zoom" : "Ctrl + scroll to zoom");
mapEl.append(zoomTip);
let zoomTipTimer = null;
mapEl.addEventListener(
  "wheel",
  (event) => {
    if (event.ctrlKey || event.metaKey) return;
    event.stopPropagation();
    zoomTip.classList.add("is-visible");
    clearTimeout(zoomTipTimer);
    zoomTipTimer = setTimeout(() => zoomTip.classList.remove("is-visible"), 1200);
  },
  { capture: true }
);

root.querySelector(".travel-hint").textContent = L.Browser.mobile
  ? "Drag to move, pinch to zoom, tap a pin to see its photos."
  : `Drag to move, ${isMac ? "pinch or ⌘ + scroll" : "Ctrl + scroll"} or double-click to zoom, click a pin to see its photos.`;

/* Pins */

function gallery(place) {
  const photos = place.photos;
  if (!photos.length) return null;
  if (photos.length === 1) {
    return el("button", { type: "button", class: "travel-popup-cover", onclick: () => openGallery(place) }, thumbImg(place, photos[0], 800));
  }
  const layout = photos.length === 2 ? "is-two" : "is-many";
  return el(
    "div",
    { class: `travel-popup-gallery ${layout}` },
    ...photos.map((photo, index) =>
      el(
        "button",
        { type: "button", class: "travel-popup-tile", "aria-label": `Open photo ${index + 1}`, onclick: () => openGallery(place, index) },
        thumbImg(place, photo, index === 0 ? 800 : 480)
      )
    )
  );
}

function popupContent(place) {
  const count = place.photos.length;
  return el(
    "div",
    { class: "travel-popup" },
    gallery(place),
    el(
      "div",
      { class: "travel-popup-body" },
      el("div", { class: "travel-popup-title" }, place.name),
      el("div", { class: "travel-popup-meta" }, typeTag(place), [place.country, formatDate(place.date)].filter(Boolean).join(" · ")),
      place.note ? el("p", {}, place.note) : null,
      el(
        "div",
        { class: "travel-popup-actions" },
        count ? el("button", { type: "button", onclick: () => openGallery(place) }, `View ${plural(count, "photo")}`) : null,
        place.post ? el("a", { href: place.post }, "Read post →") : null
      )
    )
  );
}

const cluster = L.markerClusterGroup({
  showCoverageOnHover: false,
  maxClusterRadius: 40,
  spiderfyDistanceMultiplier: 1.6,
  iconCreateFunction: (group) =>
    L.divIcon({ className: "travel-cluster", html: `<span>${group.getChildCount()}</span>`, iconSize: [38, 38] }),
});
map.addLayer(cluster);

const markers = new Map();
for (const place of places) {
  const icon = L.divIcon({
    className: "travel-pin",
    html: `<span style="--pin-color: ${typeOf(place).color}"></span>`,
    iconSize: [24, 24],
    iconAnchor: [12, 29],
    popupAnchor: [0, -26],
  });
  const marker = L.marker([place.lat, place.lng], { icon, title: place.name, alt: place.name }).bindPopup(() => popupContent(place), {
    className: "travel-leaflet-popup",
    minWidth: 300,
    maxWidth: 300,
  });
  markers.set(place.id, marker);
}
cluster.addLayers([...markers.values()]);

function fitTo(list) {
  if (list.length > 1) {
    map.fitBounds(L.latLngBounds(list.map((place) => [place.lat, place.lng])), { padding: [48, 48], maxZoom: 6 });
  } else if (list.length === 1) {
    map.setView([list[0].lat, list[0].lng], 5);
  } else {
    map.setView([25, 10], 2);
  }
}
fitTo(places);

function focusPlace(place) {
  const marker = markers.get(place.id);
  mapEl.scrollIntoView({ behavior: "smooth", block: "center" });
  map.closePopup();
  map.once("moveend", () => cluster.zoomToShowLayer(marker, () => marker.openPopup()));
  map.flyTo(marker.getLatLng(), Math.max(map.getZoom(), 8), { duration: 1.2 });
}

/* Stats, filters and timeline */

const countries = new Set(places.map((place) => place.country).filter(Boolean)).size;
const photoCount = places.reduce((sum, place) => sum + place.photos.length, 0);
root.querySelector(".travel-stats").textContent = [
  plural(places.length, "place"),
  plural(countries, "country", "countries"),
  plural(photoCount, "photo"),
].join(" · ");

const cards = new Map();
const timeline = root.querySelector(".travel-timeline");
let currentYear = null;
let grid = null;
for (const place of places) {
  const year = String(place.date).slice(0, 4);
  if (year !== currentYear) {
    currentYear = year;
    grid = el("div", { class: "travel-cards" });
    timeline.append(el("h2", { class: "travel-year" }, year), grid);
  }
  const card = el(
    "button",
    { type: "button", class: "travel-card", onclick: () => focusPlace(place) },
    place.photos.length ? thumbImg(place, place.photos[0], 800) : el("span", { class: "travel-card-placeholder" }, el("i", { class: "fa-regular fa-image" })),
    el(
      "span",
      { class: "travel-card-body" },
      el("span", { class: "travel-card-title" }, place.name),
      el(
        "span",
        { class: "travel-card-meta" },
        typeTag(place),
        [place.country, formatDate(place.date), place.photos.length ? plural(place.photos.length, "photo") : null].filter(Boolean).join(" · ")
      )
    )
  );
  cards.set(place.id, card);
  grid.append(card);
}

const typeOrder = Object.keys(TYPES);
const rank = (key) => (typeOrder.includes(key) ? typeOrder.indexOf(key) : typeOrder.length);
const presentTypes = [...new Set(places.map((place) => place.type))].sort((a, b) => rank(a) - rank(b));
const filters = root.querySelector(".travel-filters");
if (presentTypes.length > 1) {
  let chips = [];
  const select = (active) => {
    for (const chip of chips) chip.setAttribute("aria-pressed", String((chip.dataset.type || null) === active));
    const shown = places.filter((place) => active === null || place.type === active);
    map.closePopup();
    cluster.clearLayers();
    cluster.addLayers(shown.map((place) => markers.get(place.id)));
    for (const place of places) cards.get(place.id).hidden = !shown.includes(place);
    fitTo(shown);
    for (const section of timeline.querySelectorAll(".travel-cards")) {
      const empty = [...section.children].every((card) => card.hidden);
      section.hidden = empty;
      section.previousElementSibling.hidden = empty;
    }
  };
  chips = [null, ...presentTypes].map((key) => {
    const type = key ? TYPES[key] || OTHER_TYPE : null;
    const count = key ? places.filter((place) => place.type === key).length : places.length;
    const chip = el(
      "button",
      { type: "button", class: "travel-chip", "aria-pressed": String(key === null), onclick: () => select(key) },
      type ? el("span", { class: "travel-type", style: `--pin-color: ${type.color}` }, `${type.label} ${count}`) : `All ${count}`
    );
    chip.dataset.type = key || "";
    return chip;
  });
  filters.append(...chips);
}
