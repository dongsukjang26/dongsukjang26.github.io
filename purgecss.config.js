module.exports = {
  content: ["_site/**/*.html", "_site/**/*.js"],
  css: ["_site/assets/css/*.css"],
  output: "_site/assets/css/",
  skippedContentGlobs: ["_site/assets/**/*.html"],
  // Classes that only exist at runtime: created by CDN libraries (Leaflet, PhotoSwipe)
  // or assembled in JS (e.g. `is-${kind}`), so they never appear literally in _site
  safelist: {
    standard: [/^is-/],
    greedy: [/^leaflet-/, /^pswp__/],
  },
};
