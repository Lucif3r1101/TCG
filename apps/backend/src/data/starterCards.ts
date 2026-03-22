export const DECK_SIZE = 20;
export const MAX_COPIES_PER_CARD = 2;

export const CARD_FACTIONS = [
  "riftforged-sentinel",
  "void-ranger",
  "ember-arcanist",
  "ironbound-beastmaster",
  "chronomancer",
  "abyss-revenant"
] as const;

type CardFaction = (typeof CARD_FACTIONS)[number];

type CardBlueprint = {
  slug: string;
  name: string;
  description: string;
  faction: CardFaction;
  type: "unit" | "spell";
  rarity: "common" | "rare" | "epic" | "legendary";
  cost: number;
  attack: number;
  health: number;
};

const FACTION_NAMES: Record<CardFaction, string> = {
  "riftforged-sentinel": "Riftforged Sentinel",
  "void-ranger": "Void Ranger",
  "ember-arcanist": "Ember Arcanist",
  "ironbound-beastmaster": "Ironbound Beastmaster",
  chronomancer: "Chronomancer",
  "abyss-revenant": "Abyss Revenant"
};

const FACTION_PREFIXES: Record<CardFaction, string> = {
  "riftforged-sentinel": "Aegis",
  "void-ranger": "Phase",
  "ember-arcanist": "Ember",
  "ironbound-beastmaster": "Pack",
  chronomancer: "Chrono",
  "abyss-revenant": "Soul"
};

const UNIT_TITLES = [
  "Vanguard",
  "Scout",
  "Shieldbearer",
  "Duelist",
  "Engineer",
  "Skirmisher",
  "Medic",
  "Elite Guard",
  "Bruiser",
  "Disruptor",
  "Captain",
  "Hazard Smith",
  "Ambusher",
  "Siegebreaker",
  "Bannerlord",
  "Companion",
  "Enforcer",
  "Phasewalker",
  "Sentinel",
  "Champion",
  "Commander",
  "Trapmaster",
  "Sniper",
  "Construct",
  "Executioner",
  "Warden",
  "Bodyguard",
  "Finisher",
  "Frontliner",
  "Specialist",
  "Twinblade",
  "Lieutenant"
] as const;

const SPELL_TITLES = [
  "Surge",
  "Bolt",
  "Insight",
  "Reserve",
  "Hex",
  "Shift",
  "Ward",
  "Pulse",
  "Recall",
  "Swing",
  "Doctrine",
  "Cataclysm",
  "Avatar",
  "Counterseal",
  "Storm",
  "Reset",
  "Ritual",
  "Formation",
  "Catalyst",
  "Finale"
] as const;

function makeCardName(faction: CardFaction, idx: number, type: CardBlueprint["type"]): string {
  const prefix = FACTION_PREFIXES[faction];
  const title = type === "unit" ? UNIT_TITLES[idx - 1] : SPELL_TITLES[idx - 33];
  return `${prefix} ${title}`;
}

function makeCardDescription(factionName: string, name: string, type: CardBlueprint["type"], rarity: CardBlueprint["rarity"]): string {
  const roleLine =
    type === "unit"
      ? `${name} is a frontline ${factionName} unit built for board pressure and tactical trades.`
      : `${name} is a ${factionName} spell built for tempo swings and battlefield control.`;

  const rarityLine =
    rarity === "legendary"
      ? "This is a legendary signature card with a high-impact effect."
      : rarity === "epic"
        ? "This is an epic card with a dramatic swing effect."
        : rarity === "rare"
          ? "This is a rare card with a sharper tactical payoff."
          : "This is a core card used to build stable turn patterns.";

  return `${roleLine} ${rarityLine}`;
}

function rarityForIndex(index: number): CardBlueprint["rarity"] {
  if (index >= 51) {
    return "legendary";
  }
  if (index >= 43) {
    return "epic";
  }
  if (index >= 29) {
    return "rare";
  }
  return "common";
}

function makeFactionCards(faction: CardFaction): CardBlueprint[] {
  const factionName = FACTION_NAMES[faction];

  return Array.from({ length: 52 }, (_, i) => {
    const idx = i + 1;
    const type: CardBlueprint["type"] = idx <= 32 ? "unit" : "spell";
    const rarity = rarityForIndex(i);
    const cost = Math.min(7, Math.max(1, Math.floor(idx / 8) + 1));
    const attack = type === "unit" ? Math.max(1, cost + (idx % 3) - 1) : 0;
    const health = type === "unit" ? Math.max(1, cost + ((idx + 1) % 4) - 1) : 0;
    const cardNumber = String(idx).padStart(2, "0");
    const name = makeCardName(faction, idx, type);

    return {
      slug: `${faction}-c${cardNumber}`,
      name,
      description: makeCardDescription(factionName, name, type, rarity),
      faction,
      type,
      rarity,
      cost,
      attack,
      health
    };
  });
}

export const ALL_CARD_BLUEPRINTS: CardBlueprint[] = CARD_FACTIONS.flatMap((faction) => makeFactionCards(faction));

const starterPickSlugs = [
  "riftforged-sentinel-c01",
  "riftforged-sentinel-c02",
  "void-ranger-c01",
  "void-ranger-c02",
  "ember-arcanist-c01",
  "ember-arcanist-c02",
  "ironbound-beastmaster-c01",
  "chronomancer-c01",
  "abyss-revenant-c01",
  "abyss-revenant-c02"
] as const;

export const STARTER_CARD_BLUEPRINTS: CardBlueprint[] = ALL_CARD_BLUEPRINTS.filter((card) =>
  starterPickSlugs.includes(card.slug as (typeof starterPickSlugs)[number])
);
