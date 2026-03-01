import { Router } from "express";
import { Types } from "mongoose";
import { requireAuth } from "../middleware/auth.js";
import { MatchModel } from "../models/Match.js";

function toMatchResponse(match: any) {
  const turnDeadlineAt = match.state.turnDeadlineAt
    ? new Date(match.state.turnDeadlineAt).toISOString()
    : new Date(Date.now() + 45_000).toISOString();

  return {
    id: match.id,
    status: match.status,
    player1Id: String(match.player1Id),
    player2Id: String(match.player2Id),
    player1DeckId: String(match.player1DeckId),
    player2DeckId: String(match.player2DeckId),
    state: {
      turn: match.state.turn ?? 1,
      activePlayerId: match.state.activePlayerId,
      winnerId: match.state.winnerId ?? null,
      player1Health: match.state.player1Health ?? 20,
      player2Health: match.state.player2Health ?? 20,
      player1Mana: match.state.player1Mana ?? 1,
      player2Mana: match.state.player2Mana ?? 0,
      turnDeadlineAt
    },
    createdAt: match.createdAt,
    updatedAt: match.updatedAt
  };
}

export function buildMatchesRouter(jwtSecret: string): Router {
  const router = Router();
  router.use(requireAuth(jwtSecret));

  router.get("/active", async (req, res) => {
    const userId = req.authUserId;

    const match = await MatchModel.findOne({
      status: "active",
      $or: [{ player1Id: new Types.ObjectId(userId) }, { player2Id: new Types.ObjectId(userId) }]
    }).sort({ createdAt: -1 });

    if (!match) {
      res.json({ match: null });
      return;
    }

    res.json({ match: toMatchResponse(match) });
  });

  router.get("/:matchId", async (req, res) => {
    const { matchId } = req.params;
    const userId = req.authUserId;

    if (!Types.ObjectId.isValid(matchId)) {
      res.status(400).json({ message: "Invalid match id." });
      return;
    }

    const match = await MatchModel.findOne({
      _id: new Types.ObjectId(matchId),
      $or: [{ player1Id: new Types.ObjectId(userId) }, { player2Id: new Types.ObjectId(userId) }]
    });

    if (!match) {
      res.status(404).json({ message: "Match not found." });
      return;
    }

    res.json({ match: toMatchResponse(match) });
  });

  return router;
}

