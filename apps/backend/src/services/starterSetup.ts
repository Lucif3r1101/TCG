import { Types } from "mongoose";
import { STARTER_CARD_BLUEPRINTS } from "../data/starterCards.js";
import { CardModel } from "../models/Card.js";
import { DeckModel } from "../models/Deck.js";
import { UserCardModel } from "../models/UserCard.js";

const STARTER_DECK_NAME = "Starter Deck";

export async function seedBaseCards(): Promise<void> {
  const operations = STARTER_CARD_BLUEPRINTS.map((card) => ({
    updateOne: {
      filter: { slug: card.slug },
      update: { $setOnInsert: card },
      upsert: true
    }
  }));

  if (operations.length > 0) {
    await CardModel.bulkWrite(operations);
  }
}

export async function grantStarterSetForUser(userId: string): Promise<void> {
  await seedBaseCards();

  const cards = await CardModel.find({ slug: { $in: STARTER_CARD_BLUEPRINTS.map((card) => card.slug) } });
  const cardBySlug = new Map(cards.map((card) => [card.slug, card]));

  const userObjectId = new Types.ObjectId(userId);

  for (const blueprint of STARTER_CARD_BLUEPRINTS) {
    const card = cardBySlug.get(blueprint.slug);
    if (!card) {
      continue;
    }

    await UserCardModel.findOneAndUpdate(
      {
        userId: userObjectId,
        cardId: card._id
      },
      {
        $setOnInsert: {
          userId: userObjectId,
          cardId: card._id,
          quantity: 2
        }
      },
      { upsert: true, new: true }
    );
  }

  const existingStarterDeck = await DeckModel.findOne({ userId: userObjectId, isStarter: true });
  if (existingStarterDeck) {
    return;
  }

  const starterDeckCards = STARTER_CARD_BLUEPRINTS.map((blueprint) => {
    const card = cardBySlug.get(blueprint.slug);
    if (!card) {
      return null;
    }

    return {
      cardId: card._id,
      quantity: 2
    };
  }).filter((item) => item !== null);

  if (starterDeckCards.length === 0) {
    return;
  }

  await DeckModel.create({
    userId: userObjectId,
    name: STARTER_DECK_NAME,
    isStarter: true,
    cards: starterDeckCards
  });
}

