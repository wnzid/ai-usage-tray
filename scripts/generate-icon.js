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

for (let y = 0; y < size; y += 1) {
  for (let x = 0; x < size; x += 1) {
    const square = roundedSquareCoverage(x + .5, y + .5);
    if (!square) continue;
    setPixel(x, y, almond, square);

    const dx = x + .5 - size / 2;
    const dy = y + .5 - size / 2;
    const distance = Math.hypot(dx, dy);
    const ringCoverage = Math.max(0, Math.min(1, 15.5 - Math.abs(distance - 166)));

    const heartX = dx / 105;
    const heartY = -((y + .5 - 263) / 105);
    const heartBase = heartX * heartX + heartY * heartY - 1;
    const insideHeart = heartBase ** 3 - heartX * heartX * heartY ** 3 <= 0;
    if (ringCoverage > 0 || insideHeart) setPixel(x, y, ink, Math.max(ringCoverage, insideHeart ? 1 : 0));
  }
}

fs.writeFileSync(path.join(__dirname, '..', 'assets', 'icon.png'), PNG.sync.write(png));
