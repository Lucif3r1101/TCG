import { describe, expect, it } from "vitest";
import { matchActionPayloadSchema, queueJoinPayloadSchema } from "../realtime.validation.js";

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
});

