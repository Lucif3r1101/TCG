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

    return {
      slug: `${faction}-c${cardNumber}`,
      name: `${factionName} Card ${cardNumber}`,
      description:
        type === "unit"
          ? `Unit card ${cardNumber} of ${factionName}, tuned for tabletop skirmish tempo.`
          : `Spell card ${cardNumber} of ${factionName}, built for tactical swing turns.`,
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
