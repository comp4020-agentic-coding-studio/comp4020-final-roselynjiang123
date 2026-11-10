import { defineConfig } from "astro/config";

// Written by the course stack skill, then corrected by hand: this repo is
// template-dynamic, deployed to Fly.io at the repo's root
// (https://comp4020-final-roselynjiang123.fly.dev/), not GitHub Pages under a
// subpath --- so there is no base path to serve under. build.format
// "preserve" maps each page to the same output path it had before the
// conversion --- about.html stays /about.html and notes/index.html stays
// /notes/index.html --- so hand-written relative links and asset paths keep
// working. Astro's default ("directory") would move every root page to
// /about/, and "file" would collapse notes/index.html to /notes.html; either
// way half the pages get a URL one level off from the one their relative
// links were written against. compressHTML true because the default ("jsx")
// strips the space before line-broken inline elements in hand-written prose.
export default defineConfig({
  site: "https://comp4020-final-roselynjiang123.fly.dev",
  build: { format: "preserve" },
  compressHTML: true,
});
