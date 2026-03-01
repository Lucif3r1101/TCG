import { describe, expect, it } from "vitest";
import {
  matchActionPayloadSchema,
  queueJoinPayloadSchema,
  roomCodePayloadSchema,
  roomCreatePayloadSchema,
  roomJoinPayloadSchema,
  roomReadyPayloadSchema
} from "../realtime.validation.js";

describe("realtime payload schemas", () => {
  it("accepts valid queue join payload", () => {
    const parsed = queueJoinPayloadSchema.safeParse({ deckId: "abc123" });
    expect(parsed.success).toBe(true);
  });

  it("rejects invalid queue join payload", () => {
    const parsed = queueJoinPayloadSchema.safeParse({});
    expect(parsed.success).toBe(false);
  });

  it("rejects invalid match action payload", () => {
    const parsed = matchActionPayloadSchema.safeParse({ matchId: "" });
    expect(parsed.success).toBe(false);
  });

  it("accepts valid room payloads", () => {
    expect(roomCreatePayloadSchema.safeParse({ deckId: "d1", maxPlayers: 4 }).success).toBe(true);
    expect(roomJoinPayloadSchema.safeParse({ roomCode: "ABCD12", deckId: "d1" }).success).toBe(true);
    expect(roomCodePayloadSchema.safeParse({ roomCode: "ROOM1" }).success).toBe(true);
    expect(roomReadyPayloadSchema.safeParse({ roomCode: "ROOM1", ready: true }).success).toBe(true);
  });
});

