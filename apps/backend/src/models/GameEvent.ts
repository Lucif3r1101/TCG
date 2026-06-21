import { Schema, model } from "mongoose";

// Lightweight analytics log: one document per meaningful gameplay moment.
// This is the source of truth for the activation funnel (lobby -> duel ->
// finish), retention (distinct userIds over time), and faction balance.
export const gameEventTypes = ["lobby_created", "duel_started", "duel_finished"] as const;

const gameEventSchema = new Schema(
  {
    type: {
      type: String,
      enum: gameEventTypes,
      required: true,
      index: true
    },
    roomCode: { type: String, default: null },
    userId: { type: String, default: null, index: true },
    playerCount: { type: Number, default: null },
    factions: { type: [String], default: [] },
    winnerId: { type: String, default: null },
    winnerFaction: { type: String, default: null },
    turnCount: { type: Number, default: null },
    durationMs: { type: Number, default: null }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Common query: events of a type ordered by time (for funnel + retention).
gameEventSchema.index({ type: 1, createdAt: -1 });

export const GameEventModel = model("GameEvent", gameEventSchema);
