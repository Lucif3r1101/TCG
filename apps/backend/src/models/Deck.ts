import { Schema, Types, model } from "mongoose";

const deckCardSchema = new Schema(
  {
    cardId: {
      type: Types.ObjectId,
      ref: "Card",
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      max: 3
    }
  },
  { _id: false }
);

const deckSchema = new Schema(
  {
    userId: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 40
    },
    isStarter: {
      type: Boolean,
      default: false
    },
    cards: {
      type: [deckCardSchema],
      default: []
    }
  },
  {
    timestamps: true
  }
);

export const DeckModel = model("Deck", deckSchema);
