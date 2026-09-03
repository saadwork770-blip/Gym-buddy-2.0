/* ============================================================================
   GymBuddy 2.0 — tools/build-app-icons.js
   ----------------------------------------------------------------------------
   Builds everything iOS and Android need to treat the site as an installed
   app, from the one SVG mark in assets/img/favicon.svg:

     assets/img/icon-<n>.png          the manifest icons (any purpose)
     assets/img/icon-maskable-512.png the same mark inside a safe zone, so a
                                      launcher that crops to a circle does not
                                      crop the barbell
     assets/img/apple-touch-icon.png  180px, what iOS puts on the home screen
     assets/img/launch-<w>x<h>.png    the launch images iOS shows while the app
                                      boots — without these it is a white flash
                                      on a dark app, which is the single most
                                      obvious "this is a website" tell

   Chromium does the rendering because it is already installed for the audit
   and needs no image library. Everything is flat colour and one path set, so
   the files come out at a few kilobytes each.

       node tools/build-app-icons.js
   ============================================================================ */

const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "..", "assets", "img");
const BG = "#0e1013";
const ACCENT = "#1fd1a8";

/* The barbell from the favicon, drawn on a 64-unit grid. The favicon's own
   stroke is 5 units, which is tuned for a 32px tab icon: blown up to a 512px
   app icon the same weight closes the gaps inside the plates and the barbell
   turns into a blob. At home-screen size it wants a lighter line. */
const STROKE = 3.4;
const MARK = `
  <g fill="none" stroke="${ACCENT}" stroke-linecap="round" stroke-linejoin="round">
    <line x1="10" y1="32" x2="54" y2="32"/>
    <rect x="6" y="24" width="8" height="16" rx="2"/>
    <rect x="50" y="24" width="8" height="16" rx="2"/>
    <rect x="16" y="18" width="6" height="28" rx="2"/>
    <rect x="42" y="18" width="6" height="28" rx="2"/>
  </g>`;

/**
 * A square icon. `inset` is the fraction of the tile left empty around the
 * mark — 0 for a normal icon, more for a maskable one, whose outer ~10% on
 * every side a launcher is allowed to crop away.
 */
function iconSvg(inset, radius) {
  const scale = 1 - inset * 2;
  const shift = 64 * inset;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <rect width="64" height="64" ${radius ? `rx="${radius}"` : ""} fill="${BG}"/>
    <g transform="translate(${shift} ${shift}) scale(${scale})" stroke-width="${STROKE / scale}">${MARK}</g>
  </svg>`;
}

/** A launch image: the mark centred on the app's own background colour. */
function launchSvg(w, h) {
  const size = Math.round(Math.min(w, h) * 0.30);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">
    <rect width="${w}" height="${h}" fill="${BG}"/>
    <g transform="translate(${(w - size) / 2} ${(h - size) / 2}) scale(${size / 64})" stroke-width="${STROKE}">${MARK}</g>
  </svg>`;
}

/* Every current iPhone, portrait, in device pixels. iOS matches a launch image
   by exact pixel size — a near miss is simply not used — so the list is long
   and the files are small rather than the other way round. */
const LAUNCH = [
  [750, 1334],   // SE, 8
  [828, 1792],   // 11, XR
  [1125, 2436],  // X, XS, 11 Pro, 12 mini, 13 mini
  [1170, 2532],  // 12, 12 Pro, 13, 13 Pro, 14
  [1179, 2556],  // 14 Pro, 15, 15 Pro, 16
  [1206, 2622],  // 16 Pro
  [1242, 2688],  // XS Max, 11 Pro Max
  [1284, 2778],  // 12 Pro Max, 13 Pro Max, 14 Plus
  [1290, 2796],  // 14 Pro Max, 15 Plus, 15 Pro Max, 16 Plus
  [1320, 2868],  // 16 Pro Max
];

async function main() {
  let chromium;
  try { ({ chromium } = require("playwright")); }
  catch (e) { console.error("playwright is not installed — see tools/build-media.js"); process.exit(1); }

  const browser = await chromium.launch(
    process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await browser.newPage();
  fs.mkdirSync(OUT, { recursive: true });

  async function render(svg, w, h, file) {
    await page.setViewportSize({ width: w, height: h });
    await page.setContent(
      `<style>html,body{margin:0;background:${BG}}svg{display:block;width:${w}px;height:${h}px}</style>${svg}`);
    const buf = await page.screenshot({ omitBackground: false });
    fs.writeFileSync(path.join(OUT, file), buf);
    console.log(`${file}  ${(buf.length / 1024).toFixed(1)} KB`);
  }

  /* Android reads `icon-192`/`icon-512`; iOS reads apple-touch-icon and gives
     it its own rounded mask, so that one is drawn square. */
  await render(iconSvg(0, 0), 180, 180, "apple-touch-icon.png");
  await render(iconSvg(0, 14), 192, 192, "icon-192.png");
  await render(iconSvg(0, 14), 512, 512, "icon-512.png");
  await render(iconSvg(0.14, 0), 512, 512, "icon-maskable-512.png");

  for (const [w, h] of LAUNCH) await render(launchSvg(w, h), w, h, `launch-${w}x${h}.png`);

  await browser.close();
}

main().catch(err => { console.error(err); process.exit(1); });
