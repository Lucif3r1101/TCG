import { z } from "zod";

export const queueJoinPayloadSchema = z.object({
  deckId: z.string().min(1)
});

export const matchActionPayloadSchema = z.object({
  matchId: z.string().min(1)
});

export type QueueJoinPayload = z.infer<typeof queueJoinPayloadSchema>;
export type MatchActionPayload = z.infer<typeof matchActionPayloadSchema>;
