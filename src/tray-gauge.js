const fs = require('node:fs');
const path = require('node:path');
const { PNG } = require('pngjs');

let mask;

const DIGITS = {
  0: ['111', '101', '101', '101', '111'],
  1: ['010', '110', '010', '010', '111'],
  2: ['111', '001', '111', '100', '111'],
  3: ['111', '001', '111', '001', '111'],
  4: ['101', '101', '111', '001', '001'],
  5: ['111', '100', '111', '001', '111'],
  6: ['111', '100', '111', '101', '111'],
  7: ['111', '001', '010', '010', '010'],
  8: ['111', '101', '111', '101', '111'],
  9: ['111', '101', '111', '001', '111'],
};

function rgba(hex, alpha = 255) {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255, alpha];
}

function blendPixel(png, x, y, color, coverage = 1) {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height || coverage <= 0) return;
  const index = (Math.floor(y) * png.width + Math.floor(x)) * 4;
  const sourceAlpha = (color[3] / 255) * Math.min(1, coverage);
  const targetAlpha = png.data[index + 3] / 255;
  const outputAlpha = sourceAlpha + targetAlpha * (1 - sourceAlpha);
  if (!outputAlpha) return;
  for (let channel = 0; channel < 3; channel += 1) {
    png.data[index + channel] = Math.round(
      (color[channel] * sourceAlpha + png.data[index + channel] * targetAlpha * (1 - sourceAlpha)) / outputAlpha,
    );
  }
  png.data[index + 3] = Math.round(outputAlpha * 255);
}

function getMask(app) {
  if (!mask) {
    mask = PNG.sync.read(fs.readFileSync(path.join(app.getAppPath(), 'assets', 'provider-mark.png')));
  }
  return mask;
}

function drawRing(png, remaining, foreground, track) {
  const center = png.width / 2;
  const radius = png.width * 0.40625;
  const thickness = Math.max(2, png.width * 0.09375);
  const inner = radius - thickness / 2;
  const outer = radius + thickness / 2;
  const progress = Math.max(0, Math.min(1, remaining / 100));
  const smoothing = Math.max(0.7, png.width / 512);

  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const dx = x + 0.5 - center;
      const dy = y + 0.5 - center;
      const distance = Math.hypot(dx, dy);
      const edge = Math.min(distance - inner, outer - distance);
      const coverage = Math.max(0, Math.min(1, edge / smoothing + 0.5));
      if (!coverage) continue;
      const angle = (Math.atan2(dy, dx) + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2);
      const fraction = angle / (Math.PI * 2);
      blendPixel(png, x, y, progress > 0 && fraction <= progress ? foreground : track, coverage);
    }
  }
}

function drawLogo(png, app, foreground) {
  const source = getMask(app);
  const boxWidth = png.width * 0.44;
  const boxHeight = png.height * 0.47;
  const startX = (png.width - boxWidth) / 2;
  const startY = (png.height - boxHeight) / 2;

  for (let y = Math.floor(startY); y < Math.ceil(startY + boxHeight); y += 1) {
    for (let x = Math.floor(startX); x < Math.ceil(startX + boxWidth); x += 1) {
      const sourceX = Math.max(0, Math.min(source.width - 1, Math.floor(((x - startX) / boxWidth) * source.width)));
      const sourceY = Math.max(0, Math.min(source.height - 1, Math.floor(((y - startY) / boxHeight) * source.height)));
      const sourceIndex = (sourceY * source.width + sourceX) * 4;
      const alpha = Math.max(source.data[sourceIndex], source.data[sourceIndex + 1], source.data[sourceIndex + 2]) / 255;
      blendPixel(png, x, y, foreground, alpha);
    }
  }
}

function drawPercentage(png, remaining, foreground) {
  const text = String(Math.round(remaining));
  const scale = Math.max(1, Math.floor(png.width / (text.length === 3 ? 18 : 14)));
  const glyphWidth = 3 * scale;
  const gap = scale;
  const width = text.length * glyphWidth + (text.length - 1) * gap;
  const height = 5 * scale;
  const startX = Math.floor((png.width - width) / 2);
  const startY = Math.floor((png.height - height) / 2);

  for (let character = 0; character < text.length; character += 1) {
    const rows = DIGITS[text[character]];
    rows.forEach((row, rowIndex) => {
      [...row].forEach((pixel, columnIndex) => {
        if (pixel !== '1') return;
        for (let dy = 0; dy < scale; dy += 1) {
          for (let dx = 0; dx < scale; dx += 1) {
            blendPixel(
              png,
              startX + character * (glyphWidth + gap) + columnIndex * scale + dx,
              startY + rowIndex * scale + dy,
              foreground,
            );
          }
        }
      });
    });
  }
}

function createGaugeBuffer({ app, remaining = 0, center = 'logo', color, critical = false, dark = true, connected = true, size = 32 }) {
  const png = new PNG({ width: size, height: size, colorType: 6 });
  const chosen = typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color) ? color : (dark ? '#ffffff' : '#111111');
  const foreground = rgba(connected ? (critical ? '#FF626C' : chosen) : (dark ? '#737373' : '#8a8a8a'));
  const track = rgba(dark ? '#ffffff' : '#111111', 48);
  const value = Math.max(0, Math.min(100, Number(remaining) || 0));
  drawRing(png, value, foreground, track);
  if (center === 'percentage') drawPercentage(png, value, foreground);
  else drawLogo(png, app, foreground);
  return PNG.sync.write(png);
}

function createGaugeImage(electron, options) {
  return electron.nativeImage.createFromBuffer(createGaugeBuffer(options), { scaleFactor: 1 });
}

module.exports = { createGaugeBuffer, createGaugeImage };
