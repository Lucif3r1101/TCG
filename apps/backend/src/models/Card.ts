import { Schema, model } from "mongoose";

export const cardRarities = ["common", "rare", "epic", "legendary"] as const;
export const cardTypes = ["unit", "spell"] as const;
export const cardFactions = [
  "riftforged-sentinel",
  "void-ranger",
  "ember-arcanist",
  "ironbound-beastmaster",
  "chronomancer",
  "abyss-revenant"
] as const;

const cardSchema = new Schema(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      default: ""
    },
    faction: {
      type: String,
      enum: cardFactions,
      required: true
    },
    type: {
      type: String,
      enum: cardTypes,
      required: true
    },
    rarity: {
      type: String,
      enum: cardRarities,
      required: true
    },
    cost: {
      type: Number,
      required: true,
      min: 0
    },
    attack: {
      type: Number,
      min: 0,
      default: 0
    },
    health: {
      type: Number,
      min: 0,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

export const CardModel = model("Card", cardSchema);
