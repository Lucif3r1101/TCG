import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { deflateSync } from "node:zlib";

const OUT_ROOT = resolve(process.cwd(), "public/assets/cards/generated/png");
const BASE_WIDTH = 384;
const BASE_HEIGHT = 512;

const FACTIONS = [
  {
    id: "riftforged-sentinel",
    palette: [
      [8, 20, 46],
      [27, 73, 132],
      [46, 230, 255],
      [188, 246, 255]
    ],
    motif: "hex"
  },
  {
    id: "void-ranger",
    palette: [
      [13, 12, 38],
      [52, 43, 127],
      [42, 211, 255],
      [158, 141, 255]
    ],
    motif: "vector"
  },
  {
    id: "ember-arcanist",
    palette: [
      [37, 18, 10],
      [135, 41, 17],
      [255, 142, 45],
      [255, 95, 122]
    ],
    motif: "rune"
  },
  {
    id: "ironbound-beastmaster",
    palette: [
      [21, 20, 14],
      [93, 69, 34],
      [171, 127, 62],
      [143, 209, 95]
    ],
    motif: "claw"
  },
  {
    id: "chronomancer",
    palette: [
      [16, 20, 37],
      [42, 68, 120],
      [199, 166, 74],
      [155, 211, 255]
    ],
    motif: "clock"
  },
  {
    id: "abyss-revenant",
    palette: [
      [19, 15, 30],
      [70, 35, 86],
      [122, 43, 69],
      [240, 109, 136]
    ],
    motif: "soul"
  }
];

function rarityForIndex(index) {
  if (index >= 51) return "legendary";
  if (index >= 43) return "epic";
  if (index >= 29) return "rare";
  return "common";
}

function rarityAccent(rarity) {
  if (rarity === "legendary") return [255, 217, 120];
  if (rarity === "epic") return [239, 160, 255];
  if (rarity === "rare") return [120, 216, 255];
  return [138, 160, 196];
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function hashString(input) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(width, height) {
  return {
    width,
    height,
    data: new Uint8Array(width * height * 4)
  };
}

function blendPixel(canvas, x, y, rgba) {
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;
  const idx = (y * canvas.width + x) * 4;
  const srcA = rgba[3] / 255;
  const dstA = canvas.data[idx + 3] / 255;
  const outA = srcA + dstA * (1 - srcA);
  if (outA <= 0) return;

  for (let c = 0; c < 3; c += 1) {
    const src = rgba[c] / 255;
    const dst = canvas.data[idx + c] / 255;
    const out = (src * srcA + dst * dstA * (1 - srcA)) / outA;
    canvas.data[idx + c] = clamp(Math.round(out * 255), 0, 255);
  }
  canvas.data[idx + 3] = clamp(Math.round(outA * 255), 0, 255);
}

function fillLinearGradient(canvas, cTop, cBottom) {
  for (let y = 0; y < canvas.height; y += 1) {
    const t = y / (canvas.height - 1);
    const r = Math.round(cTop[0] * (1 - t) + cBottom[0] * t);
    const g = Math.round(cTop[1] * (1 - t) + cBottom[1] * t);
    const b = Math.round(cTop[2] * (1 - t) + cBottom[2] * t);
    for (let x = 0; x < canvas.width; x += 1) {
      const idx = (y * canvas.width + x) * 4;
      canvas.data[idx] = r;
      canvas.data[idx + 1] = g;
      canvas.data[idx + 2] = b;
      canvas.data[idx + 3] = 255;
    }
  }
}

function addRadialGlow(canvas, cx, cy, radius, color, intensity = 0.45) {
  const x0 = Math.max(0, Math.floor(cx - radius));
  const x1 = Math.min(canvas.width - 1, Math.ceil(cx + radius));
  const y0 = Math.max(0, Math.floor(cy - radius));
  const y1 = Math.min(canvas.height - 1, Math.ceil(cy + radius));
  const r2 = radius * radius;
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 > r2) continue;
      const falloff = 1 - d2 / r2;
      const a = Math.round(255 * intensity * falloff * falloff);
      blendPixel(canvas, x, y, [color[0], color[1], color[2], a]);
    }
  }
}

function drawLine(canvas, x0, y0, x1, y1, color, thickness = 1) {
  const dx = Math.abs(x1 - x0);
  const sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0);
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  const radius = Math.max(0, Math.floor(thickness / 2));

  while (true) {
    for (let oy = -radius; oy <= radius; oy += 1) {
      for (let ox = -radius; ox <= radius; ox += 1) {
        if (ox * ox + oy * oy <= radius * radius + 1) {
          blendPixel(canvas, x + ox, y + oy, color);
        }
      }
    }
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

function drawCircleStroke(canvas, cx, cy, radius, color, thickness = 1) {
  const rOut = radius + thickness / 2;
  const rIn = Math.max(0, radius - thickness / 2);
  const out2 = rOut * rOut;
  const in2 = rIn * rIn;
  const x0 = Math.max(0, Math.floor(cx - rOut));
  const x1 = Math.min(canvas.width - 1, Math.ceil(cx + rOut));
  const y0 = Math.max(0, Math.floor(cy - rOut));
  const y1 = Math.min(canvas.height - 1, Math.ceil(cy + rOut));
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 <= out2 && d2 >= in2) {
        blendPixel(canvas, x, y, color);
      }
    }
  }
}

function drawFrame(canvas, color, inset) {
  const x0 = inset;
  const y0 = inset;
  const x1 = canvas.width - 1 - inset;
  const y1 = canvas.height - 1 - inset;
  drawLine(canvas, x0, y0, x1, y0, color, 2);
  drawLine(canvas, x1, y0, x1, y1, color, 2);
  drawLine(canvas, x1, y1, x0, y1, color, 2);
  drawLine(canvas, x0, y1, x0, y0, color, 2);
}

function drawMotif(canvas, motif, rng, colorA, colorB) {
  const w = canvas.width;
  const h = canvas.height;

  if (motif === "hex") {
    const cx = Math.floor(w * 0.5);
    const cy = Math.floor(h * 0.5);
    for (let ring = 0; ring < 4; ring += 1) {
      const r = Math.floor((Math.min(w, h) * (0.1 + ring * 0.06)));
      let prevX = 0;
      let prevY = 0;
      for (let i = 0; i <= 6; i += 1) {
        const a = (Math.PI / 3) * i - Math.PI / 2;
        const x = Math.floor(cx + Math.cos(a) * r);
        const y = Math.floor(cy + Math.sin(a) * r);
        if (i > 0) {
          drawLine(canvas, prevX, prevY, x, y, ring % 2 ? colorA : colorB, 2 + (3 - ring));
        }
        prevX = x;
        prevY = y;
      }
    }
    return;
  }

  if (motif === "vector") {
    for (let i = 0; i < 32; i += 1) {
      const x0 = Math.floor(w * (0.08 + rng() * 0.4));
      const y0 = Math.floor(h * (0.1 + rng() * 0.8));
      const x1 = Math.floor(w * (0.48 + rng() * 0.44));
      const y1 = Math.floor(h * (0.1 + rng() * 0.8));
      drawLine(canvas, x0, y0, x1, y1, i % 2 ? colorA : colorB, 1 + Math.floor(rng() * 4));
    }
    return;
  }

  if (motif === "rune") {
    const cx = Math.floor(w * 0.5);
    const cy = Math.floor(h * 0.52);
    for (let i = 0; i < 6; i += 1) {
      drawCircleStroke(canvas, cx, cy, Math.floor(26 + i * 24), i % 2 ? colorA : colorB, 2 + (i % 3));
    }
    drawLine(canvas, cx - 34, cy, cx, cy - 42, colorB, 4);
    drawLine(canvas, cx, cy - 42, cx + 34, cy, colorB, 4);
    drawLine(canvas, cx + 34, cy, cx, cy + 42, colorB, 4);
    drawLine(canvas, cx, cy + 42, cx - 34, cy, colorB, 4);
    return;
  }

  if (motif === "claw") {
    for (let i = 0; i < 7; i += 1) {
      const x0 = Math.floor(w * (0.24 + i * 0.09 + rng() * 0.02));
      const y0 = Math.floor(h * (0.2 + rng() * 0.2));
      const x1 = Math.floor(x0 + w * (0.06 + rng() * 0.06));
      const y1 = Math.floor(h * (0.7 + rng() * 0.2));
      drawLine(canvas, x0, y0, x1, y1, i % 2 ? colorA : colorB, 3 + (i % 3));
    }
    return;
  }

  if (motif === "clock") {
    const cx = Math.floor(w * 0.5);
    const cy = Math.floor(h * 0.48);
    drawCircleStroke(canvas, cx, cy, Math.floor(Math.min(w, h) * 0.2), colorA, 3);
    drawCircleStroke(canvas, cx, cy, Math.floor(Math.min(w, h) * 0.27), colorB, 2);
    for (let i = 0; i < 12; i += 1) {
      const a = (Math.PI * 2 * i) / 12;
      const x0 = Math.floor(cx + Math.cos(a) * 70);
      const y0 = Math.floor(cy + Math.sin(a) * 70);
      const x1 = Math.floor(cx + Math.cos(a) * 92);
      const y1 = Math.floor(cy + Math.sin(a) * 92);
      drawLine(canvas, x0, y0, x1, y1, colorB, 2);
    }
    drawLine(canvas, cx, cy, cx + 46, cy - 16, colorA, 4);
    drawLine(canvas, cx, cy, cx - 22, cy + 54, colorB, 3);
    return;
  }

  // soul
  for (let i = 0; i < 8; i += 1) {
    const x0 = Math.floor(w * (0.25 + i * 0.07 + rng() * 0.02));
    const y0 = Math.floor(h * (0.28 + rng() * 0.1));
    const x1 = Math.floor(w * (0.2 + i * 0.08 + rng() * 0.03));
    const y1 = Math.floor(h * (0.75 + rng() * 0.12));
    drawLine(canvas, x0, y0, x1, y1, i % 2 ? colorA : colorB, 2 + (i % 3));
  }
}

function addParticles(canvas, rng, colorA, colorB, count) {
  for (let i = 0; i < count; i += 1) {
    const x = Math.floor(rng() * canvas.width);
    const y = Math.floor(rng() * canvas.height);
    const r = 1 + Math.floor(rng() * 3);
    const color = i % 2 ? colorA : colorB;
    for (let oy = -r; oy <= r; oy += 1) {
      for (let ox = -r; ox <= r; ox += 1) {
        if (ox * ox + oy * oy <= r * r) {
          blendPixel(canvas, x + ox, y + oy, [color[0], color[1], color[2], 120 + Math.floor(rng() * 120)]);
        }
      }
    }
  }
}

function crcTable() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
}

const CRC_TABLE = crcTable();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function u32be(n) {
  return Buffer.from([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
}

function chunk(type, data) {
  const t = Buffer.from(type, "ascii");
  const c = Buffer.concat([t, data]);
  return Buffer.concat([u32be(data.length), t, data, u32be(crc32(c))]);
}

function encodePNG(canvas) {
  const raw = Buffer.alloc((canvas.width * 4 + 1) * canvas.height);
  for (let y = 0; y < canvas.height; y += 1) {
    const rowStart = y * (canvas.width * 4 + 1);
    raw[rowStart] = 0;
    const srcStart = y * canvas.width * 4;
    raw.set(canvas.data.subarray(srcStart, srcStart + canvas.width * 4), rowStart + 1);
  }
  const compressed = deflateSync(raw, { level: 9 });

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(canvas.width, 0);
  ihdr.writeUInt32BE(canvas.height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

function renderCard(width, height, slug, faction, rarity) {
  const canvas = makeCanvas(width, height);
  const seed = hashString(slug);
  const rng = mulberry32(seed);
  const [c0, c1, c2, c3] = faction.palette;
  const accent = rarityAccent(rarity);

  fillLinearGradient(canvas, c0, c1);
  addRadialGlow(canvas, width * (0.25 + rng() * 0.5), height * (0.2 + rng() * 0.55), Math.min(width, height) * (0.2 + rng() * 0.18), c2, 0.42);
  addRadialGlow(canvas, width * (0.18 + rng() * 0.64), height * (0.16 + rng() * 0.66), Math.min(width, height) * (0.14 + rng() * 0.1), c3, 0.38);

  drawMotif(canvas, faction.motif, rng, [...c2, 165], [...c3, 155]);
  addParticles(canvas, rng, c2, c3, Math.floor((width * height) / 5200));

  drawFrame(canvas, [...accent, 230], Math.max(4, Math.floor(width * 0.02)));
  drawFrame(canvas, [...c3, 190], Math.max(8, Math.floor(width * 0.03)));

  return canvas;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const onlyScaleArg = args.find((a) => a.startsWith("--scale="));
  if (onlyScaleArg) {
    const v = Number(onlyScaleArg.split("=")[1]);
    if (v === 2 || v === 4) {
      return [v];
    }
  }
  return [2, 4];
}

function main() {
  const scales = parseArgs();
  const manifest = [];

  for (const scale of scales) {
    const width = BASE_WIDTH * scale;
    const height = BASE_HEIGHT * scale;
    const outDir = resolve(OUT_ROOT, `${scale}x`);
    mkdirSync(outDir, { recursive: true });

    for (const faction of FACTIONS) {
      for (let i = 1; i <= 52; i += 1) {
        const cardNum = String(i).padStart(2, "0");
        const slug = `${faction.id}-c${cardNum}`;
        const rarity = rarityForIndex(i - 1);
        const type = i <= 32 ? "unit" : "spell";
        const canvas = renderCard(width, height, slug, faction, rarity);
        const png = encodePNG(canvas);
        const relFile = `${scale}x/${slug}.png`;
        writeFileSync(resolve(OUT_ROOT, relFile), png);
        manifest.push({
          slug,
          file: relFile,
          scale: `${scale}x`,
          width,
          height,
          faction: faction.id,
          rarity,
          type
        });
      }
      console.log(`Rendered ${faction.id} at ${scale}x`);
    }
  }

  writeFileSync(
    resolve(OUT_ROOT, "manifest.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), cards: manifest }, null, 2),
    "utf-8"
  );
  console.log(`Generated ${manifest.length} PNG card assets in ${OUT_ROOT}`);
}

main();
