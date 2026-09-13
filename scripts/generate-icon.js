const fs = require('node:fs');
const path = require('node:path');
const { PNG } = require('pngjs');

const size = 512;
const png = new PNG({ width: size, height: size, colorType: 6 });
const graphite = [17, 19, 25, 255];
const ink = [245, 247, 251, 255];

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
    setPixel(x, y, graphite, square);

    let letterSamples = 0;
    for (const offsetY of [.125, .375, .625, .875]) {
      for (const offsetX of [.125, .375, .625, .875]) {
        if (insideLetters(x + offsetX, y + offsetY)) letterSamples += 1;
      }
    }
    if (letterSamples) setPixel(x, y, ink, letterSamples / 16);
  }
}

const pngBuffer = PNG.sync.write(png);
fs.writeFileSync(path.join(__dirname, '..', 'assets', 'icon.png'), pngBuffer);

function resize(source, targetSize) {
  const output = new PNG({ width: targetSize, height: targetSize, colorType: 6 });
  for (let y = 0; y < targetSize; y += 1) {
    for (let x = 0; x < targetSize; x += 1) {
      const sourceX = Math.min(source.width - 1, Math.floor((x + .5) * source.width / targetSize));
      const sourceY = Math.min(source.height - 1, Math.floor((y + .5) * source.height / targetSize));
      const sourceIndex = (sourceY * source.width + sourceX) * 4;
      const targetIndex = (y * targetSize + x) * 4;
      source.data.copy(output.data, targetIndex, sourceIndex, sourceIndex + 4);
    }
  }
  return PNG.sync.write(output);
}

function createIco(source) {
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const images = sizes.map((targetSize) => ({ targetSize, data: resize(source, targetSize) }));
  const directorySize = 6 + images.length * 16;
  const header = Buffer.alloc(directorySize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = directorySize;
  images.forEach(({ targetSize, data }, index) => {
    const entry = 6 + index * 16;
    header.writeUInt8(targetSize === 256 ? 0 : targetSize, entry);
    header.writeUInt8(targetSize === 256 ? 0 : targetSize, entry + 1);
    header.writeUInt8(0, entry + 2);
    header.writeUInt8(0, entry + 3);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(data.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...images.map(({ data }) => data)]);
}

fs.writeFileSync(path.join(__dirname, '..', 'assets', 'icon.ico'), createIco(png));
