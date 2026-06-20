import { CharacterClass } from "../types/game";

export const TOKEN_KEY = "tcg_auth_token";
export const ONBOARDING_KEY = "tcg_intro_seen_v1";
export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? API_URL;
export const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,72}$/;
export const DEFAULT_AVATAR_IDS = [
  "avatar-01",
  "avatar-02",
  "avatar-03",
  "avatar-04",
  "avatar-05",
  "avatar-06",
  "avatar-07",
  "avatar-08",
  "avatar-09",
  "avatar-10",
  "avatar-11",
  "avatar-12",
  "avatar-13",
  "avatar-14"
] as const;

export function getAvatarAssetPath(avatarId: string) {
  return `/assets/avatars/${avatarId}.png`;
}

export function getAvatarFallbackPath(avatarId: string) {
  return `/assets/avatars/${avatarId}.svg`;
}

export function getIconAssetPath(iconId: string) {
  return `/assets/icons/${iconId}.png`;
}

export const CARD_BACK_ASSET_PATH = "/assets/cards/card-back.png";
export const DECK_BACK_ASSET_PATH = "/assets/cards/deck-back.png";

export const CHARACTER_CLASSES: CharacterClass[] = [
  {
    id: "riftforged-sentinel",
    name: "Riftforged Sentinel",
    deckStyle: "Fortress control, shields, and counterplay.",
    ability: "Aegis Echo: negate first hostile spell each round.",
    tag: "Control",
    sprite: "/assets/characters/riftforged-sentinel.png",
    crest: "/assets/icons/crests/riftforged-sentinel-crest.png"
  },
  {
    id: "void-ranger",
    name: "Void Ranger",
    deckStyle: "Burst tempo deck with traps and fast turns.",
    ability: "Phase Shot: bonus damage if opponent spent mana.",
    tag: "Tempo",
    sprite: "/assets/characters/void-ranger.png",
    crest: "/assets/icons/crests/void-ranger-crest.png"
  },
  {
    id: "ember-arcanist",
    name: "Ember Arcanist",
    deckStyle: "Spell chains and scaling combos.",
    ability: "Ignition Loop: first spell each turn costs 1 less.",
    tag: "Combo",
    sprite: "/assets/characters/ember-arcanist.png",
    crest: "/assets/icons/crests/ember-arcanist-crest.png"
  },
  {
    id: "ironbound-beastmaster",
    name: "Ironbound Beastmaster",
    deckStyle: "Swarm summons and board pressure.",
    ability: "Pack Command: summoned units enter with haste.",
    tag: "Swarm",
    sprite: "/assets/characters/ironbound-beastmaster.png",
    crest: "/assets/icons/crests/ironbound-beastmaster-crest.png"
  },
  {
    id: "chronomancer",
    name: "Chronomancer",
    deckStyle: "Turn control, stuns, and timing tricks.",
    ability: "Time Fold: once per game replay your last action.",
    tag: "Utility",
    sprite: "/assets/characters/chronomancer.png",
    crest: "/assets/icons/crests/chronomancer-crest.png"
  },
  {
    id: "abyss-revenant",
    name: "Abyss Revenant",
    deckStyle: "Drain life and grave recursion.",
    ability: "Soul Tax: enemy card draws cost 1 health.",
    tag: "Drain",
    sprite: "/assets/characters/abyss-revenant.png",
    crest: "/assets/icons/crests/abyss-revenant-crest.png"
  }
];
