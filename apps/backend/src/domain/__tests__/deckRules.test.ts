import { describe, expect, it } from "vitest";
import { validateDeckSize, validateMaxCopiesPerCard } from "../deckRules.js";

describe("deckRules", () => {
  it("validates exact deck size", () => {
    const cards = [
      { cardId: "a", quantity: 10 },
      { cardId: "b", quantity: 10 }
    ];

    expect(validateDeckSize(cards, 20)).toBe(true);
    expect(validateDeckSize(cards, 19)).toBe(false);
  });

  it("rejects deck entries exceeding per-card max through duplicates", () => {
    const invalidCards = [
      { cardId: "a", quantity: 2 },
      { cardId: "a", quantity: 1 }
    ];

    const validCards = [
      { cardId: "a", quantity: 2 },
      { cardId: "b", quantity: 2 }
    ];

    expect(validateMaxCopiesPerCard(invalidCards, 2)).toBe(false);
    expect(validateMaxCopiesPerCard(validCards, 2)).toBe(true);
  });
});

