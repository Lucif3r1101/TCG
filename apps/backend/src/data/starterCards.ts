export const DECK_SIZE = 20;
export const MAX_COPIES_PER_CARD = 2;

export const STARTER_CARD_BLUEPRINTS = [
  {
    slug: "ember-scout",
    name: "Ember Scout",
    description: "A fast unit that pressures early turns.",
    type: "unit",
    rarity: "common",
    cost: 1,
    attack: 1,
    health: 2
  },
  {
    slug: "iron-guardian",
    name: "Iron Guardian",
    description: "Reliable defender with solid health.",
    type: "unit",
    rarity: "common",
    cost: 2,
    attack: 2,
    health: 3
  },
  {
    slug: "grove-healer",
    name: "Grove Healer",
    description: "Restores tempo by stabilizing the board.",
    type: "unit",
    rarity: "common",
    cost: 2,
    attack: 1,
    health: 4
  },
  {
    slug: "storm-adept",
    name: "Storm Adept",
    description: "Aggressive mid-game attacker.",
    type: "unit",
    rarity: "rare",
    cost: 3,
    attack: 3,
    health: 3
  },
  {
    slug: "lava-brute",
    name: "Lava Brute",
    description: "Heavy unit for late-game pressure.",
    type: "unit",
    rarity: "rare",
    cost: 4,
    attack: 5,
    health: 4
  },
  {
    slug: "spark-bolt",
    name: "Spark Bolt",
    description: "Cheap spell to remove weak units.",
    type: "spell",
    rarity: "common",
    cost: 1,
    attack: 0,
    health: 0
  },
  {
    slug: "tidal-pulse",
    name: "Tidal Pulse",
    description: "Control spell that swings combat.",
    type: "spell",
    rarity: "common",
    cost: 2,
    attack: 0,
    health: 0
  },
  {
    slug: "nature-claim",
    name: "Nature Claim",
    description: "Utility spell for board value.",
    type: "spell",
    rarity: "common",
    cost: 2,
    attack: 0,
    health: 0
  },
  {
    slug: "arcane-burst",
    name: "Arcane Burst",
    description: "Direct damage finisher.",
    type: "spell",
    rarity: "rare",
    cost: 3,
    attack: 0,
    health: 0
  },
  {
    slug: "phoenix-call",
    name: "Phoenix Call",
    description: "High-impact late spell.",
    type: "spell",
    rarity: "epic",
    cost: 5,
    attack: 0,
    health: 0
  }
] as const;
