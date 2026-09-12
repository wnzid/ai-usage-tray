const fs = require('node:fs');
const path = require('node:path');
const { PNG } = require('pngjs');

const size = 512;
const png = new PNG({ width: size, height: size, colorType: 6 });
const almond = [238, 211, 186, 255];
const ink = [33, 25, 21, 255];

function setPixel(x, y, color, coverage = 1) {
  const index = (y * size + x) * 4;
  png.data[index] = color[0];
  png.data[index + 1] = color[1];
  png.data[index + 2] = color[2];
  png.data[index + 3] = Math.round(color[3] * coverage);
}

function roundedSquareCoverage(x, y) {
  const left = 22;
  const right = size - 22;
  const radius = 112;
  const nearestX = Math.max(left + radius, Math.min(x, right - radius));
  const nearestY = Math.max(left + radius, Math.min(y, right - radius));
  const distance = Math.hypot(x - nearestX, y - nearestY);
  return Math.max(0, Math.min(1, radius + .5 - distance));
}

function distanceToSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / (abx * abx + aby * aby)));
  return Math.hypot(px - (ax + abx * t), py - (ay + aby * t));
}

function insideLetters(x, y) {
  const a = (
    distanceToSegment(x, y, 72, 365, 132, 160) <= 18
    || distanceToSegment(x, y, 132, 160, 192, 365) <= 18
    || (x >= 96 && x <= 168 && y >= 287 && y <= 317)
  ) && y >= 142 && y <= 383;
  const i = x >= 224 && x <= 266 && y >= 160 && y <= 365;
  const uBars = ((x >= 298 && x <= 338) || (x >= 400 && x <= 440)) && y >= 160 && y <= 305;
  const radius = Math.hypot(x - 369, y - 304);
  const uCurve = y >= 304 && radius >= 31 && radius <= 72;
  return a || i || uBars || uCurve;
}

for (let y = 0; y < size; y += 1) {
  for (let x = 0; x < size; x += 1) {
    const square = roundedSquareCoverage(x + .5, y + .5);
    if (!square) continue;
    setPixel(x, y, almond, square);

    let letterSamples = 0;
    for (const offsetY of [.125, .375, .625, .875]) {
      for (const offsetX of [.125, .375, .625, .875]) {
        if (insideLetters(x + offsetX, y + offsetY)) letterSamples += 1;
      }
    }
    if (letterSamples) setPixel(x, y, ink, letterSamples / 16);
  }
}

fs.writeFileSync(path.join(__dirname, '..', 'assets', 'icon.png'), PNG.sync.write(png));
