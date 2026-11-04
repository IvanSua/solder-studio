/**
 * PWA Icon Generator
 * Genera todos los iconos PNG requeridos por el manifest.webmanifest
 * 
 * Uso: node scripts/generate-icons.js
 */

const { Jimp, rgbaToInt } = require('jimp');
const path = require('path');
const fs = require('fs');

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const OUTPUT_DIR = path.join(__dirname, '..', 'src', 'assets', 'icons');

// Colores de la marca
const BG = 0x111827ff;  // #111827
const INDIGO = 0x6366f1ff; // #6366f1
const VIOLET = 0x8b5cf6ff; // #8b5cf6

function lerpColor(c1, c2, t) {
  const r1 = (c1 >> 24) & 0xff, g1 = (c1 >> 16) & 0xff, b1 = (c1 >> 8) & 0xff;
  const r2 = (c2 >> 24) & 0xff, g2 = (c2 >> 16) & 0xff, b2 = (c2 >> 8) & 0xff;
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return rgbaToInt(r, g, b, 255);
}

function setPixel(image, x, y, color) {
  const w = image.width;
  const h = image.height;
  if (x >= 0 && x < w && y >= 0 && y < h) {
    image.setPixelColor(color, Math.round(x), Math.round(y));
  }
}

function drawFilledRect(image, x, y, w, h, color) {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      setPixel(image, x + dx, y + dy, color);
    }
  }
}

function drawCircle(image, cx, cy, r, color) {
  for (let py = cy - r; py <= cy + r; py++) {
    for (let px = cx - r; px <= cx + r; px++) {
      const dist = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
      if (dist <= r) {
        setPixel(image, px, py, color);
      }
    }
  }
}

async function generateIcon(size) {
  const image = new Jimp({ width: size, height: size, color: BG });

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const nx = px / size;
      const ny = py / size;

      // T-shirt shape geometry
      const inLeftSleeve = nx >= 0.08 && nx <= 0.28 && ny >= 0.32 && ny <= 0.52;
      const inRightSleeve = nx >= 0.72 && nx <= 0.92 && ny >= 0.32 && ny <= 0.52;
      const inBody = nx >= 0.28 && nx <= 0.72 && ny >= 0.32 && ny <= 0.88;
      const collarDist = Math.sqrt((nx - 0.5) ** 2 + (ny - 0.32) ** 2);
      const inCollar = collarDist < 0.1;

      let color = null;

      if ((inLeftSleeve || inRightSleeve || inBody) && !inCollar) {
        const gradT = Math.min(1, Math.max(0, (ny - 0.3) / 0.58));
        color = lerpColor(INDIGO, VIOLET, gradT);
      }

      if (color !== null) {
        image.setPixelColor(color, px, py);
      }
    }
  }

  // Side accent bars
  for (let i = 0; i < 4; i++) {
    setPixel(image, i, Math.floor(size * 0.35), INDIGO);
    setPixel(image, i, Math.floor(size * 0.65), INDIGO);
    setPixel(image, size - 1 - i, Math.floor(size * 0.35), INDIGO);
    setPixel(image, size - 1 - i, Math.floor(size * 0.65), INDIGO);
  }

  return image;
}

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log('🎨 Generando iconos PWA...\n');

  for (const size of SIZES) {
    process.stdout.write(`  Generando ${size}x${size}... `);
    const icon = await generateIcon(size);
    const filename = `icon-${size}x${size}.png`;
    await icon.write(path.join(OUTPUT_DIR, filename));
    console.log('✅');
  }

  console.log(`\n✅ Iconos generados en src/assets/icons/`);
  console.log(`   ${SIZES.join('px, ')}px`);
  console.log('\n📝 Reemplazá estos iconos genéricos con diseños reales después.');
}

main().catch(console.error);
