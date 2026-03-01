export type DeckCardInput = {
  cardId: string;
  quantity: number;
};

export function validateDeckSize(cards: DeckCardInput[], targetSize: number): boolean {
  const count = cards.reduce((sum, item) => sum + item.quantity, 0);
  return count === targetSize;
}

export function validateMaxCopiesPerCard(cards: DeckCardInput[], maxCopies: number): boolean {
  const copyCountByCard = new Map<string, number>();

  for (const card of cards) {
    const nextCount = (copyCountByCard.get(card.cardId) ?? 0) + card.quantity;
    if (nextCount > maxCopies) {
      return false;
    }

    copyCountByCard.set(card.cardId, nextCount);
  }

  return true;
}
