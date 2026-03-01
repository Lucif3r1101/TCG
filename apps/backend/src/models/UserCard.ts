import { Schema, Types, model } from "mongoose";

const userCardSchema = new Schema(
  {
    userId: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    cardId: {
      type: Types.ObjectId,
      ref: "Card",
      required: true,
      index: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

userCardSchema.index({ userId: 1, cardId: 1 }, { unique: true });

export const UserCardModel = model("UserCard", userCardSchema);
