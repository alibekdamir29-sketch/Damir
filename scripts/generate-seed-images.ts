/**
 * Generates minimalist studio-style SVG product images for the demo catalogue
 * (public/seed/*.svg). Replace them with real photos via Admin → Products.
 *   npx tsx scripts/generate-seed-images.ts
 */
import { mkdirSync, writeFileSync } from "fs";
import path from "path";

const SHAPES: Record<string, string> = {
  tshirt: `<path d="M268 230 L345 190 Q400 236 455 190 L532 230 L640 340 L575 405 L530 368 L530 810 L270 810 L270 368 L225 405 L160 340 Z"/><path d="M345 190 Q400 250 455 190" fill="none" stroke="rgba(0,0,0,.18)" stroke-width="6"/>`,
  shirt: `<path d="M280 210 L355 180 L400 230 L445 180 L520 210 L600 300 L650 700 L590 715 L545 380 L540 830 L260 830 L255 380 L210 715 L150 700 L200 300 Z"/><path d="M355 180 L400 260 L445 180" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="5"/><path d="M400 260 L400 830" stroke="rgba(0,0,0,.18)" stroke-width="4"/><g fill="rgba(255,255,255,.55)"><circle cx="412" cy="320" r="6"/><circle cx="412" cy="420" r="6"/><circle cx="412" cy="520" r="6"/><circle cx="412" cy="620" r="6"/><circle cx="412" cy="720" r="6"/></g>`,
  hoodie: `<path d="M300 250 Q300 120 400 120 Q500 120 500 250 L560 270 L640 370 L670 740 L600 755 L555 420 L555 830 L245 830 L245 420 L200 755 L130 740 L160 370 L240 270 Z"/><path d="M330 250 Q330 170 400 170 Q470 170 470 250 Q400 300 330 250 Z" fill="rgba(0,0,0,.22)"/><path d="M310 640 L490 640 L470 740 L330 740 Z" fill="rgba(0,0,0,.12)"/><path d="M375 290 L370 400 M425 290 L430 400" stroke="rgba(255,255,255,.5)" stroke-width="4"/>`,
  sweatshirt: `<path d="M285 215 L350 190 Q400 225 450 190 L515 215 L600 310 L650 740 L585 755 L548 400 L545 790 L255 790 L252 400 L215 755 L150 740 L200 310 Z"/><rect x="255" y="790" width="290" height="40" rx="6" opacity=".85"/><path d="M350 190 Q400 240 450 190" fill="none" stroke="rgba(0,0,0,.2)" stroke-width="8"/>`,
  jeans: `<path d="M272 170 L528 170 L552 840 L432 840 L400 390 L368 840 L248 840 Z"/><path d="M272 215 L528 215" stroke="rgba(0,0,0,.2)" stroke-width="4"/><path d="M300 215 Q330 290 390 270 M500 215 Q470 290 410 270" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="4"/><path d="M400 215 L400 390" stroke="rgba(255,255,255,.3)" stroke-width="4"/>`,
  pants: `<path d="M282 170 L518 170 L540 850 L430 850 L400 360 L370 850 L260 850 Z"/><path d="M282 205 L518 205" stroke="rgba(0,0,0,.2)" stroke-width="4"/><path d="M335 210 L350 840 M465 210 L450 840" stroke="rgba(255,255,255,.18)" stroke-width="3"/>`,
  jacket: `<path d="M285 200 L360 175 L400 215 L440 175 L515 200 L605 300 L660 720 L595 735 L552 400 L552 800 L248 800 L248 400 L205 735 L140 720 L195 300 Z"/><path d="M360 175 L330 300 L400 360 L470 300 L440 175" fill="rgba(0,0,0,.22)"/><path d="M400 360 L400 800" stroke="rgba(255,255,255,.45)" stroke-width="5"/><rect x="290" y="560" width="70" height="8" fill="rgba(255,255,255,.35)"/><rect x="440" y="560" width="70" height="8" fill="rgba(255,255,255,.35)"/>`,
  coat: `<path d="M290 180 L362 160 L400 200 L438 160 L510 180 L600 280 L650 760 L588 772 L548 420 L575 900 L225 900 L252 420 L212 772 L150 760 L200 280 Z"/><path d="M362 160 L320 330 L400 420 L480 330 L438 160" fill="rgba(0,0,0,.2)"/><path d="M400 420 L400 900" stroke="rgba(0,0,0,.25)" stroke-width="4"/><g fill="rgba(255,255,255,.5)"><circle cx="365" cy="500" r="9"/><circle cx="435" cy="500" r="9"/><circle cx="365" cy="610" r="9"/><circle cx="435" cy="610" r="9"/></g>`,
  sport: `<path d="M285 200 L355 175 L400 205 L445 175 L515 200 L605 300 L660 730 L595 745 L552 400 L552 800 L248 800 L248 400 L205 745 L140 730 L195 300 Z"/><path d="M400 205 L400 800" stroke="rgba(255,255,255,.6)" stroke-width="5"/><path d="M195 300 L140 730 M605 300 L660 730" stroke="rgba(255,255,255,.85)" stroke-width="14"/><path d="M355 175 L400 230 L445 175" fill="none" stroke="rgba(0,0,0,.25)" stroke-width="10"/>`,
  shoes: `<path d="M150 640 Q170 520 260 500 L380 470 Q430 460 460 500 L540 560 Q600 590 680 600 Q720 610 720 660 L720 700 L150 700 Z"/><rect x="140" y="700" width="590" height="40" rx="16" fill="#f2f2f2" stroke="rgba(0,0,0,.15)" stroke-width="3"/><path d="M330 500 L380 560 M370 490 L420 550 M410 485 L455 540" stroke="rgba(255,255,255,.65)" stroke-width="6"/>`,
  accessories: `<path d="M240 400 L560 400 L590 820 L210 820 Z"/><path d="M320 400 Q320 250 400 250 Q480 250 480 400" fill="none" stroke-width="22" stroke="currentColor"/><rect x="370" y="480" width="60" height="18" rx="4" fill="rgba(255,255,255,.55)"/>`,
};

export const SEED_COLORS: Record<string, string> = {
  black: "#111111",
  white: "#FAFAFA",
  graphite: "#3A3A3A",
  grey: "#9A9A9A",
  sand: "#CBB89A",
  navy: "#1F2A44",
  olive: "#5B5E3C",
  brown: "#5A3E2B",
  indigo: "#2E3A5C",
  cream: "#EFE6D6",
};

function svg(shape: string, hex: string, label: string) {
  const light = ["#FAFAFA", "#EFE6D6"].includes(hex);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000" width="800" height="1000">
<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F5F5F5"/><stop offset="1" stop-color="#E6E6E6"/></linearGradient>
<radialGradient id="sh" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="rgba(0,0,0,.18)"/><stop offset="1" stop-color="rgba(0,0,0,0)"/></radialGradient></defs>
<rect width="800" height="1000" fill="url(#bg)"/>
<ellipse cx="400" cy="900" rx="260" ry="26" fill="url(#sh)"/>
<g fill="${hex}" color="${hex}" stroke="${light ? "rgba(0,0,0,.12)" : "none"}" stroke-width="3">${shape}</g>
<text x="400" y="960" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="18" letter-spacing="8" fill="#9a9a9a">DAMIR · ${label}</text>
</svg>`;
}

if (process.argv[1] && process.argv[1].includes("generate-seed-images")) {
  const out = path.join(process.cwd(), "public", "seed");
  mkdirSync(out, { recursive: true });
  let n = 0;
  for (const [shape, body] of Object.entries(SHAPES)) {
    for (const [color, hex] of Object.entries(SEED_COLORS)) {
      writeFileSync(path.join(out, `${shape}-${color}.svg`), svg(body, hex, shape.toUpperCase()));
      n++;
    }
  }
  console.log(`Generated ${n} images in ${out}`);
}
