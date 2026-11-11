// Pixel sprites (U12, brief §10.2): two static 16×16 characters -- the
// facilitator (Lee) and the case's patient -- rendered as inline SVG with
// crisp edges, copied from docs/reference/ui-reference.html's own <script>
// (MAPS/BASE/shade/sprite). Patient colours come from the case's
// `patient.sprite` (CLAUDE.md); Lee always uses the fixed BASE palette.
const MAPS = {
  lee: [
    ".......hh.......","......hhhh......","....hhhhhhhh....","...hhhhhhhhhh...",
    "...hssssssssh...","...hssssssssh...","...hsessssesh...","....pssssssp....",
    "....sssmmsss....",".....ssssss.....","......ssss......","..ccccsssscccc..",
    "..cccccssccccc..",".cccwcccccclccc.",".cccwccccccllcc.",".cccccccccccccc."],
  patient: [
    "................","................","......ssss......","....ssssssss....",
    "...gssssssssg...","...gssssssssg...","...gsessssesg...","....pssssssp....",
    "....sggmmggs....",".....ssssss.....","......ssss......","..bbbbsssbbbbb..",
    "..bbBbbssbbBbb..",".bbbbbbBbbbbbbb.",".bBbbbbbbbbbBbb.",".bbbbbBbbbbbbbb."]
};
const BASE = {
  lee:     {h:"#5a3a24", s:"#f0c9a0", e:"#1f2a2e", p:"#e8a08a", m:"#a9553f", c:"#0f5257", w:"#ffffff", l:"#d99a2b"},
  patient: {g:"#c9c4bb", s:"#eac3a1", e:"#1f2a2e", p:"#e3a08c", m:"#9c5a47", b:"#a9c7dc", B:"#5d87a6"}
};
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * f), g = Math.round(((n >> 8) & 255) * f), b = Math.round((n & 255) * f);
  return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
}
function sprite(name, opts) {
  const pal = Object.assign({}, BASE[name]);
  if (name === "patient") {
    if (opts.hair) pal.g = opts.hair;
    if (opts.skin) pal.s = opts.skin;
    if (opts.gown) {
      pal.b = opts.gown;
      pal.B = shade(opts.gown, 0.62);
    }
  }
  let rects = "";
  MAPS[name].forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch !== "." && pal[ch]) rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${pal[ch]}"/>`;
    }),
  );
  const size = Math.round(16 * (opts.scale || 2));
  return `<svg class="px" viewBox="0 0 16 16" width="${size}" height="${size}" aria-hidden="true" focusable="false">${rects}</svg>`;
}

// Call after any innerHTML assignment that may have introduced new
// [data-sprite] elements -- idempotent, since it just rewrites each
// element's own children from its own data-* attributes.
export function renderSprites(container) {
  container.querySelectorAll("[data-sprite]").forEach((el) => {
    el.innerHTML = sprite(el.dataset.sprite, {
      hair: el.dataset.hair,
      skin: el.dataset.skin,
      gown: el.dataset.gown,
      scale: parseFloat(el.dataset.scale || "2"),
    });
  });
}
