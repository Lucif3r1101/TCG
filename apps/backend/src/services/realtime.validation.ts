import { z } from "zod";

export const queueJoinPayloadSchema = z.object({
  deckId: z.string().min(1)
});

export const matchActionPayloadSchema = z.object({
  matchId: z.string().min(1)
});

export const roomCreatePayloadSchema = z.object({
  deckId: z.string().min(1),
  maxPlayers: z.number().int().min(2).max(6).default(6)
});

export const roomJoinPayloadSchema = z.object({
  roomCode: z.string().min(4).max(12),
  deckId: z.string().min(1)
});

export const roomCodePayloadSchema = z.object({
  roomCode: z.string().min(4).max(12)
});

export const roomReadyPayloadSchema = z.object({
  roomCode: z.string().min(4).max(12),
  ready: z.boolean()
});

export type QueueJoinPayload = z.infer<typeof queueJoinPayloadSchema>;
export type MatchActionPayload = z.infer<typeof matchActionPayloadSchema>;
export type RoomCreatePayload = z.infer<typeof roomCreatePayloadSchema>;
export type RoomJoinPayload = z.infer<typeof roomJoinPayloadSchema>;
