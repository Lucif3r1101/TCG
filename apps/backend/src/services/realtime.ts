import { Types } from "mongoose";
import type { Server, Socket } from "socket.io";
import { verifyAuthToken } from "../utils.auth";
import { DeckModel } from "../models/Deck";
import { MatchModel } from "../models/Match";

type MatchmakingQueueEntry = {
  userId: string;
  deckId: string;
  socketId: string;
  joinedAt: number;
};

type ActiveMatchState = {
  matchId: string;
  playerIds: [string, string];
  deckIds: [string, string];
  turn: number;
  activePlayerId: string;
  winnerId: string | null;
};

const queue: MatchmakingQueueEntry[] = [];
const socketToUser = new Map<string, string>();
const userToSockets = new Map<string, Set<string>>();
const activeMatches = new Map<string, ActiveMatchState>();

function addUserSocket(userId: string, socketId: string): void {
  const set = userToSockets.get(userId) ?? new Set<string>();
  set.add(socketId);
  userToSockets.set(userId, set);
  socketToUser.set(socketId, userId);
}

function removeUserSocket(socketId: string): string | null {
  const userId = socketToUser.get(socketId);
  if (!userId) {
    return null;
  }

  socketToUser.delete(socketId);
  const set = userToSockets.get(userId);
  if (!set) {
    return userId;
  }

  set.delete(socketId);
  if (set.size === 0) {
    userToSockets.delete(userId);
  }

  return userId;
}

function getUserSockets(userId: string): string[] {
  return [...(userToSockets.get(userId) ?? new Set<string>())];
}

function removeFromQueueBySocket(socketId: string): void {
  const index = queue.findIndex((entry) => entry.socketId === socketId);
  if (index >= 0) {
    queue.splice(index, 1);
  }
}

async function loadAndValidateDeck(userId: string, deckId: string): Promise<boolean> {
  if (!Types.ObjectId.isValid(deckId)) {
    return false;
  }

  const deck = await DeckModel.findOne({
    _id: new Types.ObjectId(deckId),
    userId: new Types.ObjectId(userId)
  });

  return Boolean(deck);
}

function emitToUser(io: Server, userId: string, eventName: string, payload: unknown): void {
  const sockets = getUserSockets(userId);
  for (const socketId of sockets) {
    io.to(socketId).emit(eventName, payload);
  }
}

async function createMatch(io: Server, a: MatchmakingQueueEntry, b: MatchmakingQueueEntry): Promise<void> {
  const matchDoc = await MatchModel.create({
    player1Id: new Types.ObjectId(a.userId),
    player2Id: new Types.ObjectId(b.userId),
    player1DeckId: new Types.ObjectId(a.deckId),
    player2DeckId: new Types.ObjectId(b.deckId),
    status: "active",
    state: {
      turn: 1,
      activePlayerId: a.userId,
      winnerId: null
    }
  });

  const matchState: ActiveMatchState = {
    matchId: matchDoc.id,
    playerIds: [a.userId, b.userId],
    deckIds: [a.deckId, b.deckId],
    turn: 1,
    activePlayerId: a.userId,
    winnerId: null
  };

  activeMatches.set(matchDoc.id, matchState);

  emitToUser(io, a.userId, "match_found", {
    matchId: matchState.matchId,
    you: a.userId,
    opponent: b.userId,
    turn: matchState.turn,
    activePlayerId: matchState.activePlayerId
  });

  emitToUser(io, b.userId, "match_found", {
    matchId: matchState.matchId,
    you: b.userId,
    opponent: a.userId,
    turn: matchState.turn,
    activePlayerId: matchState.activePlayerId
  });
}

async function tryMatchmake(io: Server): Promise<void> {
  while (queue.length >= 2) {
    const first = queue.shift();
    if (!first) {
      return;
    }

    const secondIndex = queue.findIndex((entry) => entry.userId !== first.userId);
    if (secondIndex < 0) {
      queue.unshift(first);
      return;
    }

    const [second] = queue.splice(secondIndex, 1);
    if (!second) {
      queue.unshift(first);
      return;
    }

    await createMatch(io, first, second);
  }
}

function findActiveMatchByUser(userId: string): ActiveMatchState | null {
  for (const match of activeMatches.values()) {
    if (match.playerIds.includes(userId) && match.winnerId === null) {
      return match;
    }
  }

  return null;
}

export function registerRealtime(io: Server, jwtSecret: string): void {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;

    if (!token) {
      next(new Error("Missing auth token"));
      return;
    }

    try {
      const payload = verifyAuthToken(token, jwtSecret);
      socket.data.userId = payload.userId;
      next();
    } catch {
      next(new Error("Invalid auth token"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const userId = socket.data.userId as string;
    addUserSocket(userId, socket.id);

    socket.emit("realtime_ready", { userId });

    socket.on("queue_join", async (payload: { deckId?: string }) => {
      const deckId = payload?.deckId;
      if (!deckId) {
        socket.emit("queue_error", { message: "deckId is required." });
        return;
      }

      const deckOk = await loadAndValidateDeck(userId, deckId);
      if (!deckOk) {
        socket.emit("queue_error", { message: "Deck not found for this user." });
        return;
      }

      const activeMatch = findActiveMatchByUser(userId);
      if (activeMatch) {
        socket.emit("queue_error", { message: "User already has an active match." });
        return;
      }

      removeFromQueueBySocket(socket.id);
      queue.push({
        userId,
        deckId,
        socketId: socket.id,
        joinedAt: Date.now()
      });

      socket.emit("queue_joined", { queuedAt: new Date().toISOString() });
      await tryMatchmake(io);
    });

    socket.on("queue_leave", () => {
      removeFromQueueBySocket(socket.id);
      socket.emit("queue_left", { ok: true });
    });

    socket.on("match_end_turn", async (payload: { matchId?: string }) => {
      const matchId = payload?.matchId;
      if (!matchId) {
        socket.emit("match_error", { message: "matchId is required." });
        return;
      }

      const match = activeMatches.get(matchId);
      if (!match || match.winnerId) {
        socket.emit("match_error", { message: "Active match not found." });
        return;
      }

      if (!match.playerIds.includes(userId)) {
        socket.emit("match_error", { message: "Not a player in this match." });
        return;
      }

      if (match.activePlayerId !== userId) {
        socket.emit("match_error", { message: "Not your turn." });
        return;
      }

      const nextPlayer = match.playerIds[0] === userId ? match.playerIds[1] : match.playerIds[0];
      match.turn += 1;
      match.activePlayerId = nextPlayer;

      await MatchModel.findByIdAndUpdate(matchId, {
        $set: {
          "state.turn": match.turn,
          "state.activePlayerId": nextPlayer
        }
      });

      emitToUser(io, match.playerIds[0], "match_state", {
        matchId,
        turn: match.turn,
        activePlayerId: match.activePlayerId
      });

      emitToUser(io, match.playerIds[1], "match_state", {
        matchId,
        turn: match.turn,
        activePlayerId: match.activePlayerId
      });
    });

    socket.on("match_concede", async (payload: { matchId?: string }) => {
      const matchId = payload?.matchId;
      if (!matchId) {
        socket.emit("match_error", { message: "matchId is required." });
        return;
      }

      const match = activeMatches.get(matchId);
      if (!match || match.winnerId) {
        socket.emit("match_error", { message: "Active match not found." });
        return;
      }

      if (!match.playerIds.includes(userId)) {
        socket.emit("match_error", { message: "Not a player in this match." });
        return;
      }

      const winnerId = match.playerIds[0] === userId ? match.playerIds[1] : match.playerIds[0];
      match.winnerId = winnerId;

      await MatchModel.findByIdAndUpdate(matchId, {
        $set: {
          status: "completed",
          "state.winnerId": winnerId
        }
      });

      emitToUser(io, match.playerIds[0], "match_completed", { matchId, winnerId });
      emitToUser(io, match.playerIds[1], "match_completed", { matchId, winnerId });
    });

    socket.on("disconnect", () => {
      removeFromQueueBySocket(socket.id);
      removeUserSocket(socket.id);
    });
  });
}
