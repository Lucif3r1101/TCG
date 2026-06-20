import type { SyntheticEvent } from "react";

export const FACTIONS = [
  "riftforged-sentinel",
  "void-ranger",
  "ironbound-beastmaster",
  "abyss-revenant",
  "ember-arcanist",
  "chronomancer"
];

// The slug always encodes the faction (e.g. "abyss-revenant-c01"); use it as a
// fallback when a card record has no explicit `faction` field.
export function factionFromSlug(slug: string): string {
  return FACTIONS.find((f) => slug.startsWith(`${f}-`)) ?? "";
}

// Faction crest emblem for a card slug (used as a watermark on the card frame).
export function getCrestSource(slug: string): string {
  const faction = factionFromSlug(slug);
  return faction ? `/assets/icons/crests/${faction}-crest.png` : "";
}

// Faction realm backdrop image for a card slug (used behind the battlefield).
export function getRealmSource(slug: string): string {
  const faction = factionFromSlug(slug);
  return faction ? `/assets/realms/${faction}.jpg` : "";
}

// Resolve the art source chain for a card slug: a custom hand-picked image when
// available, then the generated PNG, then the generated SVG as a last resort.
export function getCardArtSources(slug: string) {
  const faction = FACTIONS.find((f) => slug.startsWith(`${f}-`));
  if (faction) {
    return {
      primary: `/assets/cards/custom/${faction}/${slug}.png`,
      fallback: `/assets/cards/generated/png/2x/${slug}.png`,
      finalFallback: `/assets/cards/generated/${slug}.svg`
    };
  }

  return {
    primary: `/assets/cards/generated/png/2x/${slug}.png`,
    fallback: `/assets/cards/generated/${slug}.svg`,
    finalFallback: `/assets/cards/generated/${slug}.svg`
  };
}

// <img onError> handler that walks primary → fallback → finalFallback once each.
export function handleCardArtError(event: SyntheticEvent<HTMLImageElement, Event>, slug: string) {
  const image = event.currentTarget;
  const { fallback, finalFallback } = getCardArtSources(slug);

  if (image.dataset.fallbackStage === "final") {
    return;
  }

  if (image.src.endsWith(fallback) || image.dataset.fallbackStage === "fallback") {
    image.dataset.fallbackStage = "final";
    image.src = finalFallback;
    return;
  }

  image.dataset.fallbackStage = "fallback";
  image.src = fallback;
}
