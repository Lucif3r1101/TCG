import { Router } from "express";
import { CardModel } from "../models/Card.js";

export function buildCardsRouter(): Router {
  const router = Router();

  router.get("/", async (_req, res) => {
    const cards = await CardModel.find().sort({ cost: 1, name: 1 });

    res.json({
      cards: cards.map((card) => ({
        id: card.id,
        slug: card.slug,
        name: card.name,
        description: card.description,
        faction: card.faction,
        type: card.type,
        rarity: card.rarity,
        cost: card.cost,
        attack: card.attack,
        health: card.health
      }))
    });
  });

  return router;
}

