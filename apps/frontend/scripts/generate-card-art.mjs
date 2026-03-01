import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const OUT_DIR = resolve(process.cwd(), "public/assets/cards/generated");

const FACTIONS = [
  {
    id: "riftforged-sentinel",
    name: "Riftforged Sentinel",
    palette: ["#0a1e3f", "#204f8a", "#2ee6ff", "#d8fbff"],
    motif: "hex"
  },
  {
    id: "void-ranger",
    name: "Void Ranger",
    palette: ["#0f1028", "#352b7f", "#29d3ff", "#9f8dff"],
    motif: "vector"
  },
  {
    id: "ember-arcanist",
    name: "Ember Arcanist",
    palette: ["#25120a", "#8c2b12", "#ff8e2d", "#ff5f7a"],
    motif: "rune"
  },
  {
    id: "ironbound-beastmaster",
    name: "Ironbound Beastmaster",
    palette: ["#15140f", "#5d4522", "#ab7f3e", "#8fd15f"],
    motif: "claw"
  },
  {
    id: "chronomancer",
    name: "Chronomancer",
    palette: ["#101425", "#2a4478", "#c7a64a", "#9bd3ff"],
    motif: "clock"
  },
  {
    id: "abyss-revenant",
    name: "Abyss Revenant",
    palette: ["#130f1e", "#462356", "#7a2b45", "#f06d88"],
    motif: "soul"
  }
];

const UNIT_ROLES = [
  "Vanguard",
  "Scout",
  "Bulwark",
  "Duelist",
  "Engineer",
  "Skirmisher",
  "Medic",
  "Guardian",
  "Bruiser",
  "Disruptor",
  "Captain",
  "Hazard Binder",
  "Ambusher",
  "Siegebreaker",
  "Standard Bearer",
  "Companion Keeper",
  "Enforcer",
  "Phase Infantry",
  "Aegis Warder",
  "Champion",
  "Field Marshal",
  "Trapwright",
  "Recon Sniper",
  "Construct Warden",
  "Executioner",
  "Area Denial",
  "Ritual Guard",
  "Momentum Blade",
  "Frontline Prime",
  "Signature Adept",
  "Twin Vanguard",
  "Lieutenant Prime"
];

const SPELL_ROLES = [
  "Simple Buff",
  "Arc Ping",
  "Draw Filter",
  "Resource Surge",
  "Debilitate",
  "Reposition",
  "Ward",
  "Pulse AOE",
  "Grave Utility",
  "Tempo Swing",
  "Faction Amplifier",
  "Battlefield Event",
  "Epic Summon",
  "Epic Denial",
  "Epic Volley",
  "Epic Reset",
  "Identity Ritual",
  "Finisher Setup",
  "Apex Catalyst",
  "Legendary Ultimate"
];

function rarityForIndex(index) {
  if (index >= 51) return "legendary";
  if (index >= 43) return "epic";
  if (index >= 29) return "rare";
  return "common";
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

function hashString(input) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function rarityStroke(rarity) {
  if (rarity === "legendary") return "#ffd978";
  if (rarity === "epic") return "#f0a0ff";
  if (rarity === "rare") return "#78d8ff";
  return "#8aa0c4";
}

function factionGlyph(motif, w, h, rng, colorA, colorB) {
  if (motif === "hex") {
    const cx = w * 0.5;
    const cy = h * 0.5;
    const size = Math.min(w, h) * 0.24;
    const points = Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 3) * i - Math.PI / 2;
      return `${(cx + Math.cos(a) * size).toFixed(2)},${(cy + Math.sin(a) * size).toFixed(2)}`;
    }).join(" ");
    return `<polygon points="${points}" fill="none" stroke="${colorA}" stroke-width="10" opacity="0.7"/>
<polygon points="${points}" fill="none" stroke="${colorB}" stroke-width="3" opacity="0.95" transform="scale(0.78) translate(${cx * 0.28},${cy * 0.28})"/>`;
  }

  if (motif === "vector") {
    let lines = "";
    for (let i = 0; i < 7; i += 1) {
      const x1 = (w * (0.1 + rng() * 0.4)).toFixed(2);
      const y1 = (h * (0.2 + rng() * 0.6)).toFixed(2);
      const x2 = (w * (0.55 + rng() * 0.35)).toFixed(2);
      const y2 = (h * (0.15 + rng() * 0.7)).toFixed(2);
      lines += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${i % 2 ? colorA : colorB}" stroke-width="${2 + Math.floor(rng() * 4)}" opacity="0.72"/>`;
    }
    return lines;
  }

  if (motif === "rune") {
    const cx = w * 0.5;
    const cy = h * 0.54;
    let rings = "";
    for (let i = 0; i < 4; i += 1) {
      const r = 70 + i * 38;
      rings += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${i % 2 ? colorA : colorB}" stroke-width="${i === 0 ? 7 : 3}" opacity="${clamp(0.75 - i * 0.12, 0.3, 1)}"/>`;
    }
    return `${rings}<path d="M${cx - 40},${cy} L${cx},${cy - 56} L${cx + 40},${cy} L${cx},${cy + 56} Z" fill="none" stroke="${colorB}" stroke-width="6" opacity="0.9"/>`;
  }

  if (motif === "claw") {
    let claw = "";
    for (let i = 0; i < 4; i += 1) {
      const x = 180 + i * 85 + rng() * 12;
      const y = 210 + rng() * 120;
      const c1x = x + 40 + rng() * 40;
      const c1y = y + 90 + rng() * 140;
      const c2x = x + 20 + rng() * 60;
      const c2y = y + 230 + rng() * 160;
      const ex = x - 25 + rng() * 24;
      const ey = y + 380 + rng() * 130;
      claw += `<path d="M${x.toFixed(2)},${y.toFixed(2)} C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${ex.toFixed(2)},${ey.toFixed(2)}" stroke="${i % 2 ? colorA : colorB}" stroke-width="${10 - i}" fill="none" opacity="0.7"/>`;
    }
    return claw;
  }

  if (motif === "clock") {
    const cx = w * 0.5;
    const cy = h * 0.5;
    let ticks = "";
    for (let i = 0; i < 12; i += 1) {
      const a = (Math.PI * 2 * i) / 12;
      const x1 = cx + Math.cos(a) * 140;
      const y1 = cy + Math.sin(a) * 140;
      const x2 = cx + Math.cos(a) * 176;
      const y2 = cy + Math.sin(a) * 176;
      ticks += `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${colorB}" stroke-width="4" opacity="0.7"/>`;
    }
    return `<circle cx="${cx}" cy="${cy}" r="184" fill="none" stroke="${colorA}" stroke-width="8" opacity="0.72"/>
<circle cx="${cx}" cy="${cy}" r="132" fill="none" stroke="${colorB}" stroke-width="4" opacity="0.76"/>
${ticks}
<line x1="${cx}" y1="${cy}" x2="${(cx + 82).toFixed(2)}" y2="${(cy - 26).toFixed(2)}" stroke="${colorA}" stroke-width="8" opacity="0.9"/>
<line x1="${cx}" y1="${cy}" x2="${(cx - 42).toFixed(2)}" y2="${(cy + 92).toFixed(2)}" stroke="${colorB}" stroke-width="6" opacity="0.9"/>`;
  }

  // soul motif
  let wisps = "";
  for (let i = 0; i < 6; i += 1) {
    const x = 220 + i * 65 + rng() * 14;
    const y = 240 + rng() * 80;
    const c1x = x + 60 + rng() * 30;
    const c1y = y - 60 - rng() * 60;
    const c2x = x - 50 - rng() * 40;
    const c2y = y + 150 + rng() * 90;
    const ex = x + 10 + rng() * 20;
    const ey = y + 290 + rng() * 110;
    wisps += `<path d="M${x.toFixed(2)},${y.toFixed(2)} C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${ex.toFixed(2)},${ey.toFixed(2)}" stroke="${i % 2 ? colorA : colorB}" stroke-width="${7 - i * 0.7}" fill="none" opacity="0.72"/>`;
  }
  return wisps;
}

function particleLayer(w, h, rng, colorA, colorB) {
  let particles = "";
  for (let i = 0; i < 28; i += 1) {
    const cx = (rng() * w).toFixed(2);
    const cy = (rng() * h).toFixed(2);
    const r = (1.2 + rng() * 3.8).toFixed(2);
    const color = i % 2 ? colorA : colorB;
    const op = (0.24 + rng() * 0.5).toFixed(2);
    particles += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" opacity="${op}"/>`;
  }
  return particles;
}

function renderCardSVG({ slug, faction, cardNumber, type, rarity }) {
  const w = 768;
  const h = 1024;
  const seed = hashString(slug);
  const rng = mulberry32(seed);

  const [dark, mid, accentA, accentB] = faction.palette;
  const role = type === "unit" ? UNIT_ROLES[cardNumber - 1] : SPELL_ROLES[cardNumber - 33];
  const rarityColor = rarityStroke(rarity);

  const glowX = (0.15 + rng() * 0.7) * w;
  const glowY = (0.12 + rng() * 0.64) * h;
  const blobRadius = 180 + rng() * 120;

  const motif = factionGlyph(faction.motif, w, h, rng, accentA, accentB);
  const particles = particleLayer(w, h, rng, accentA, accentB);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg-${slug}" x1="60" y1="40" x2="${w - 40}" y2="${h - 20}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${dark}"/>
      <stop offset="0.55" stop-color="${mid}"/>
      <stop offset="1" stop-color="${dark}"/>
    </linearGradient>
    <radialGradient id="glow-${slug}" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(${glowX.toFixed(2)} ${glowY.toFixed(2)}) rotate(90) scale(${blobRadius.toFixed(2)} ${blobRadius.toFixed(2)})">
      <stop stop-color="${accentA}" stop-opacity="0.45"/>
      <stop offset="1" stop-color="${accentA}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="edge-${slug}" x1="0" y1="0" x2="${w}" y2="${h}" gradientUnits="userSpaceOnUse">
      <stop stop-color="${accentA}" stop-opacity="0.85"/>
      <stop offset="1" stop-color="${accentB}" stop-opacity="0.85"/>
    </linearGradient>
  </defs>

  <rect x="0" y="0" width="${w}" height="${h}" rx="32" fill="#060910"/>
  <rect x="16" y="16" width="${w - 32}" height="${h - 32}" rx="24" fill="url(#bg-${slug})"/>
  <rect x="16" y="16" width="${w - 32}" height="${h - 32}" rx="24" fill="url(#glow-${slug})"/>

  <g opacity="0.88">
    ${motif}
  </g>

  <g opacity="0.8">
    ${particles}
  </g>

  <rect x="16" y="16" width="${w - 32}" height="${h - 32}" rx="24" stroke="url(#edge-${slug})" stroke-width="2.5" opacity="0.85"/>
  <rect x="22" y="22" width="${w - 44}" height="${h - 44}" rx="20" stroke="${rarityColor}" stroke-width="2" opacity="0.74"/>

  <rect x="34" y="34" width="${w - 68}" height="72" rx="14" fill="#070b14" fill-opacity="0.72" stroke="${rarityColor}" stroke-opacity="0.55"/>
  <text x="54" y="80" fill="#EAF4FF" font-family="Exo 2, Segoe UI, sans-serif" font-size="32" font-weight="700">${faction.name}</text>

  <rect x="34" y="${h - 152}" width="${w - 68}" height="92" rx="14" fill="#070b14" fill-opacity="0.74" stroke="${rarityColor}" stroke-opacity="0.6"/>
  <text x="54" y="${h - 100}" fill="#D9E7FF" font-family="Exo 2, Segoe UI, sans-serif" font-size="30" font-weight="600">${role}</text>

  <rect x="${w - 170}" y="36" width="118" height="42" rx="10" fill="${rarityColor}" fill-opacity="0.2" stroke="${rarityColor}" stroke-opacity="0.8"/>
  <text x="${w - 156}" y="65" fill="${rarityColor}" font-family="Exo 2, Segoe UI, sans-serif" font-size="20" font-weight="700">${rarity.toUpperCase()}</text>

  <circle cx="${w - 60}" cy="${h - 70}" r="26" fill="#080d18" stroke="${rarityColor}" stroke-opacity="0.8"/>
  <text x="${w - 72}" y="${h - 62}" fill="#E7F2FF" font-family="Exo 2, Segoe UI, sans-serif" font-size="24" font-weight="700">${String(cardNumber).padStart(2, "0")}</text>
</svg>`;
}

function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const manifest = [];

  for (const faction of FACTIONS) {
    for (let i = 1; i <= 52; i += 1) {
      const cardNumber = String(i).padStart(2, "0");
      const slug = `${faction.id}-c${cardNumber}`;
      const type = i <= 32 ? "unit" : "spell";
      const rarity = rarityForIndex(i - 1);

      const svg = renderCardSVG({
        slug,
        faction,
        cardNumber: i,
        type,
        rarity
      });

      writeFileSync(resolve(OUT_DIR, `${slug}.svg`), svg, "utf-8");
      manifest.push({
        slug,
        file: `generated/${slug}.svg`,
        faction: faction.id,
        type,
        rarity
      });
    }
  }

  writeFileSync(resolve(OUT_DIR, "manifest.json"), JSON.stringify({ generatedAt: new Date().toISOString(), cards: manifest }, null, 2));
  console.log(`Generated ${manifest.length} card artworks in ${OUT_DIR}`);
}

main();
