import { z } from "zod";

const characterIds = [
  "riftforged-sentinel",
  "void-ranger",
  "ember-arcanist",
  "ironbound-beastmaster",
  "chronomancer",
  "abyss-revenant"
] as const;

export const queueJoinPayloadSchema = z.object({
  deckId: z.string().min(1)
});

export const matchActionPayloadSchema = z.object({
  matchId: z.string().min(1)
});

export const roomCreatePayloadSchema = z.object({
  deckId: z.string().min(1),
  characterId: z.enum(characterIds),
  maxPlayers: z.number().int().min(2).max(6).default(6)
});

export const roomJoinPayloadSchema = z.object({
  roomCode: z.string().min(4).max(12),
  deckId: z.string().min(1),
  characterId: z.enum(characterIds)
});

export const roomCodePayloadSchema = z.object({
  roomCode: z.string().min(4).max(12)
});

export const roomReadyPayloadSchema = z.object({
  roomCode: z.string().min(4).max(12),
  ready: z.boolean()
});

export const roomPlayCardPayloadSchema = z.object({
  roomCode: z.string().min(4).max(12),
  cardInstanceId: z.string().min(4),
  targetUserId: z.string().optional()
});

export const roomDrawCardPayloadSchema = z.object({
  roomCode: z.string().min(4).max(12)
});

export type QueueJoinPayload = z.infer<typeof queueJoinPayloadSchema>;
export type MatchActionPayload = z.infer<typeof matchActionPayloadSchema>;
export type RoomCreatePayload = z.infer<typeof roomCreatePayloadSchema>;
export type RoomJoinPayload = z.infer<typeof roomJoinPayloadSchema>;
export type RoomPlayCardPayload = z.infer<typeof roomPlayCardPayloadSchema>;
export type RoomDrawCardPayload = z.infer<typeof roomDrawCardPayloadSchema>;
