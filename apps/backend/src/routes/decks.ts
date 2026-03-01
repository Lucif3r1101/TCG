import { Router } from "express";
import { Types } from "mongoose";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { CardModel } from "../models/Card";
import { DeckModel } from "../models/Deck";
import { UserCardModel } from "../models/UserCard";
import { DECK_SIZE, MAX_COPIES_PER_CARD } from "../data/starterCards";
import { validateDeckSize, validateMaxCopiesPerCard } from "../domain/deckRules";

const deckCardInputSchema = z.object({
  cardId: z.string().min(1),
  quantity: z.number().int().min(1).max(MAX_COPIES_PER_CARD)
});

const createDeckSchema = z.object({
  name: z.string().min(3).max(40),
  cards: z.array(deckCardInputSchema).min(1)
});

const updateDeckSchema = z.object({
  name: z.string().min(3).max(40).optional(),
  cards: z.array(deckCardInputSchema).min(1).optional()
});

function serializeDeck(deck: any) {
  return {
    id: deck.id,
    name: deck.name,
    isStarter: deck.isStarter,
    cards: (deck.cards ?? []).map((entry: any) => ({
      cardId: String(entry.cardId),
      quantity: entry.quantity
    })),
    createdAt: deck.createdAt,
    updatedAt: deck.updatedAt
  };
}

async function validateCardsExist(cards: Array<{ cardId: string; quantity: number }>): Promise<boolean> {
  const uniqueCardIds = [...new Set(cards.map((item) => item.cardId))];

  if (uniqueCardIds.some((id) => !Types.ObjectId.isValid(id))) {
    return false;
  }

  const cardsFound = await CardModel.countDocuments({
    _id: { $in: uniqueCardIds.map((id) => new Types.ObjectId(id)) }
  });

  return cardsFound === uniqueCardIds.length;
}

async function validateUserOwnsCards(userId: string, cards: Array<{ cardId: string; quantity: number }>): Promise<boolean> {
  const owned = await UserCardModel.find({ userId: new Types.ObjectId(userId) });
  const ownedMap = new Map(owned.map((entry) => [String(entry.cardId), entry.quantity]));

  return cards.every((entry) => (ownedMap.get(entry.cardId) ?? 0) >= entry.quantity);
}

export function buildDecksRouter(jwtSecret: string): Router {
  const router = Router();

  router.use(requireAuth(jwtSecret));

  router.get("/", async (req, res) => {
    const decks = await DeckModel.find({ userId: new Types.ObjectId(req.authUserId) }).sort({ createdAt: -1 });
    res.json({ decks: decks.map(serializeDeck) });
  });

  router.get("/:deckId", async (req, res) => {
    const { deckId } = req.params;

    if (!Types.ObjectId.isValid(deckId)) {
      res.status(400).json({ message: "Invalid deck id." });
      return;
    }

    const deck = await DeckModel.findOne({
      _id: new Types.ObjectId(deckId),
      userId: new Types.ObjectId(req.authUserId)
    });

    if (!deck) {
      res.status(404).json({ message: "Deck not found." });
      return;
    }

    res.json({ deck: serializeDeck(deck) });
  });

  router.post("/", async (req, res) => {
    const parsed = createDeckSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid deck payload." });
      return;
    }

    const payload = parsed.data;

    if (!validateDeckSize(payload.cards, DECK_SIZE)) {
      res.status(400).json({ message: `Deck must contain exactly ${DECK_SIZE} cards.` });
      return;
    }

    if (!validateMaxCopiesPerCard(payload.cards, MAX_COPIES_PER_CARD)) {
      res.status(400).json({ message: `Max copies per card is ${MAX_COPIES_PER_CARD}.` });
      return;
    }

    const hasValidCards = await validateCardsExist(payload.cards);
    if (!hasValidCards) {
      res.status(400).json({ message: "Deck includes unknown cards." });
      return;
    }

    const userHasCards = await validateUserOwnsCards(req.authUserId!, payload.cards);
    if (!userHasCards) {
      res.status(400).json({ message: "You do not own enough copies for this deck." });
      return;
    }

    const deck = await DeckModel.create({
      userId: new Types.ObjectId(req.authUserId),
      name: payload.name,
      cards: payload.cards.map((entry) => ({ cardId: new Types.ObjectId(entry.cardId), quantity: entry.quantity })),
      isStarter: false
    });

    res.status(201).json({ deck: serializeDeck(deck) });
  });

  router.put("/:deckId", async (req, res) => {
    const { deckId } = req.params;

    if (!Types.ObjectId.isValid(deckId)) {
      res.status(400).json({ message: "Invalid deck id." });
      return;
    }

    const parsed = updateDeckSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid deck update payload." });
      return;
    }

    const payload = parsed.data;

    if (payload.cards) {
      if (!validateDeckSize(payload.cards, DECK_SIZE)) {
        res.status(400).json({ message: `Deck must contain exactly ${DECK_SIZE} cards.` });
        return;
      }

      if (!validateMaxCopiesPerCard(payload.cards, MAX_COPIES_PER_CARD)) {
        res.status(400).json({ message: `Max copies per card is ${MAX_COPIES_PER_CARD}.` });
        return;
      }

      const hasValidCards = await validateCardsExist(payload.cards);
      if (!hasValidCards) {
        res.status(400).json({ message: "Deck includes unknown cards." });
        return;
      }

      const userHasCards = await validateUserOwnsCards(req.authUserId!, payload.cards);
      if (!userHasCards) {
        res.status(400).json({ message: "You do not own enough copies for this deck." });
        return;
      }
    }

    const update: Record<string, unknown> = {};
    if (payload.name) {
      update.name = payload.name;
    }
    if (payload.cards) {
      update.cards = payload.cards.map((entry) => ({
        cardId: new Types.ObjectId(entry.cardId),
        quantity: entry.quantity
      }));
    }

    const updatedDeck = await DeckModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(deckId),
        userId: new Types.ObjectId(req.authUserId)
      },
      { $set: update },
      { new: true }
    );

    if (!updatedDeck) {
      res.status(404).json({ message: "Deck not found." });
      return;
    }

    res.json({ deck: serializeDeck(updatedDeck) });
  });

  return router;
}
