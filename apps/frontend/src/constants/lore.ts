// Single source of truth for Chronicles of the RIFT worldbuilding, used by the
// landing page and the in-app guide so the lore never drifts between them.

export const LORE_TAGLINE = "Six shattered realms. One collapsing timeline. Only one can hold the Rift.";

export const LORE_INTRO: string[] = [
  "In the year 2189, the Ascendant Concord tried to harness the energy between worlds. Their engine tore a wound in reality instead — the Rift — and the timeline shattered into six unstable realms, each spinning on its own broken rules.",
  "From that fracture rose the Riftwalkers: champions who can step between collapsing worlds and bend their laws to their will. They duel for Rift Cores — shards of raw possibility that can rewrite what happened, what is, and what will be.",
  "Every match is one such duel. Win, and your timeline holds. Lose, and your world is unwritten from history. The Rift remembers only its victors."
];

export const LORE_PILLARS: { title: string; text: string }[] = [
  { title: "The Wound", text: "The Rift never stopped spreading. Each realm is a fragment fighting to survive its own unraveling." },
  { title: "The Riftwalkers", text: "You are one of them — a commander who channels a realm's identity into a deck of living units and spells." },
  { title: "The Stakes", text: "Rift Cores rewrite reality. Claim them in the duel and your timeline endures; fail and it is erased." }
];

export type Faction = {
  id: string;
  emoji: string;
  name: string;
  realm: string;
  blurb: string; // short, gameplay-flavored (used on cards/landing)
  lore: string; // worldbuilding flavor (used in the codex/guide)
};

export const FACTIONS: Faction[] = [
  {
    id: "riftforged-sentinel",
    emoji: "🛡️",
    name: "Riftforged Sentinel",
    realm: "The Bastion Citadels",
    blurb: "Control the board with hard-light shields and fortress tech.",
    lore: "Order's last stand. The Sentinels weld broken physics into walls of light, refusing to let their realm fall a single inch further into the Rift."
  },
  {
    id: "void-ranger",
    emoji: "🏹",
    name: "Void Ranger",
    realm: "The Void Corridors",
    blurb: "Pressure with tempo, phase strikes, and dimensional trails.",
    lore: "Hunters of the dark between worlds. Rangers phase through the gaps in reality, striking from angles that should not exist."
  },
  {
    id: "ember-arcanist",
    emoji: "🔥",
    name: "Ember Arcanist",
    realm: "The Ember Sanctums",
    blurb: "Chain explosive runic combos and burn through defenses.",
    lore: "Keepers of the first fire. Their realm burns hotter as the Rift feeds it, and they weaponize that hunger in chains of runic flame."
  },
  {
    id: "ironbound-beastmaster",
    emoji: "🐺",
    name: "Ironbound Beastmaster",
    realm: "The Iron Wilds",
    blurb: "Swarm the field with engineered beasts and primal power.",
    lore: "Where steel grew teeth. Beastmasters bind feral Rift-mutated creatures in iron, marching swarms across the ruins of their wilds."
  },
  {
    id: "chronomancer",
    emoji: "⏳",
    name: "Chronomancer",
    realm: "The Broken Timelines",
    blurb: "Bend turn order and freeze foes with temporal magic.",
    lore: "Survivors who live out of sequence. Chronomancers steal moments from the future and spend them now, turning time itself into a blade."
  },
  {
    id: "abyss-revenant",
    emoji: "💀",
    name: "Abyss Revenant",
    realm: "The Abyss Trenches",
    blurb: "Drain value from every exchange and outlast your rivals.",
    lore: "What the Rift could not kill. Revenants returned from the deepest trench wrong and undying, draining life from every exchange to feed their endless return."
  }
];
