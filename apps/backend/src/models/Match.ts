import { Schema, Types, model } from "mongoose";

const matchStateSchema = new Schema(
  {
    turn: { type: Number, required: true, default: 1 },
    activePlayerId: { type: String, required: true },
    winnerId: { type: String, default: null },
    player1Health: { type: Number, required: true, default: 20 },
    player2Health: { type: Number, required: true, default: 20 },
    player1Mana: { type: Number, required: true, default: 1 },
    player2Mana: { type: Number, required: true, default: 0 },
    turnDeadlineAt: { type: Date, required: true }
  },
  { _id: false }
);

const matchSchema = new Schema(
  {
    player1Id: { type: Types.ObjectId, ref: "User", required: true, index: true },
    player2Id: { type: Types.ObjectId, ref: "User", required: true, index: true },
    player1DeckId: { type: Types.ObjectId, ref: "Deck", required: true },
    player2DeckId: { type: Types.ObjectId, ref: "Deck", required: true },
    status: {
      type: String,
      enum: ["active", "completed"],
      required: true,
      default: "active"
    },
    state: { type: matchStateSchema, required: true }
  },
  { timestamps: true }
);

export const MatchModel = model("Match", matchSchema);
