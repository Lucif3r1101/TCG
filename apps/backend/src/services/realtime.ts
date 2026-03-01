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
  player1Health: number;
  player2Health: number;
  player1Mana: number;
  player2Mana: number;
  turnDeadlineAt: string;
};

const TURN_DURATION_MS = 45_000;

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

function buildPublicMatchState(match: ActiveMatchState) {
  return {
    matchId: match.matchId,
    turn: match.turn,
    activePlayerId: match.activePlayerId,
    winnerId: match.winnerId,
    player1Health: match.player1Health,
    player2Health: match.player2Health,
    player1Mana: match.player1Mana,
    player2Mana: match.player2Mana,
    turnDeadlineAt: match.turnDeadlineAt
  };
}

async function createMatch(io: Server, a: MatchmakingQueueEntry, b: MatchmakingQueueEntry): Promise<void> {
  const turnDeadlineAt = new Date(Date.now() + TURN_DURATION_MS).toISOString();

  const matchState: ActiveMatchState = {
    matchId: "",
    playerIds: [a.userId, b.userId],
    deckIds: [a.deckId, b.deckId],
    turn: 1,
    activePlayerId: a.userId,
    winnerId: null,
    player1Health: 20,
    player2Health: 20,
    player1Mana: 1,
    player2Mana: 0,
    turnDeadlineAt
  };

  const matchDoc = await MatchModel.create({
    player1Id: new Types.ObjectId(a.userId),
    player2Id: new Types.ObjectId(b.userId),
    player1DeckId: new Types.ObjectId(a.deckId),
    player2DeckId: new Types.ObjectId(b.deckId),
    status: "active",
    state: {
      turn: matchState.turn,
      activePlayerId: matchState.activePlayerId,
      winnerId: matchState.winnerId,
      player1Health: matchState.player1Health,
      player2Health: matchState.player2Health,
      player1Mana: matchState.player1Mana,
      player2Mana: matchState.player2Mana,
      turnDeadlineAt: matchState.turnDeadlineAt
    }
  });

  matchState.matchId = matchDoc.id;
  activeMatches.set(matchDoc.id, matchState);

  const publicState = buildPublicMatchState(matchState);

  emitToUser(io, a.userId, "match_found", {
    ...publicState,
    you: a.userId,
    opponent: b.userId
  });

  emitToUser(io, b.userId, "match_found", {
    ...publicState,
    you: b.userId,
    opponent: a.userId
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

function hydrateActiveMatchState(matchDoc: any): ActiveMatchState {
  const deadline = matchDoc.state.turnDeadlineAt
    ? new Date(matchDoc.state.turnDeadlineAt).toISOString()
    : new Date(Date.now() + TURN_DURATION_MS).toISOString();

  return {
    matchId: matchDoc.id,
    playerIds: [String(matchDoc.player1Id), String(matchDoc.player2Id)],
    deckIds: [String(matchDoc.player1DeckId), String(matchDoc.player2DeckId)],
    turn: matchDoc.state.turn ?? 1,
    activePlayerId: matchDoc.state.activePlayerId,
    winnerId: matchDoc.state.winnerId ?? null,
    player1Health: matchDoc.state.player1Health ?? 20,
    player2Health: matchDoc.state.player2Health ?? 20,
    player1Mana: matchDoc.state.player1Mana ?? 1,
    player2Mana: matchDoc.state.player2Mana ?? 0,
    turnDeadlineAt: deadline
  };
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

    socket.on("match_sync", async (payload: { matchId?: string }) => {
      const matchId = payload?.matchId;
      if (!matchId) {
        socket.emit("match_error", { message: "matchId is required." });
        return;
      }

      let match = activeMatches.get(matchId);
      if (!match) {
        const matchDoc = await MatchModel.findById(matchId);
        if (!matchDoc) {
          socket.emit("match_error", { message: "Match not found." });
          return;
        }

        match = hydrateActiveMatchState(matchDoc);
        if (match.winnerId === null) {
          activeMatches.set(matchId, match);
        }
      }

      if (!match.playerIds.includes(userId)) {
        socket.emit("match_error", { message: "Not a player in this match." });
        return;
      }

      socket.emit("match_state", buildPublicMatchState(match));
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
      match.turnDeadlineAt = new Date(Date.now() + TURN_DURATION_MS).toISOString();

      if (nextPlayer === match.playerIds[0]) {
        match.player1Mana = Math.min(match.player1Mana + 1, 10);
      } else {
        match.player2Mana = Math.min(match.player2Mana + 1, 10);
      }

      await MatchModel.findByIdAndUpdate(matchId, {
        $set: {
          "state.turn": match.turn,
          "state.activePlayerId": nextPlayer,
          "state.player1Mana": match.player1Mana,
          "state.player2Mana": match.player2Mana,
          "state.turnDeadlineAt": match.turnDeadlineAt
        }
      });

      const payloadState = buildPublicMatchState(match);
      emitToUser(io, match.playerIds[0], "match_state", payloadState);
      emitToUser(io, match.playerIds[1], "match_state", payloadState);
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

      const completion = { ...buildPublicMatchState(match), winnerId };
      emitToUser(io, match.playerIds[0], "match_completed", completion);
      emitToUser(io, match.playerIds[1], "match_completed", completion);
    });

    socket.on("disconnect", () => {
      removeFromQueueBySocket(socket.id);
      removeUserSocket(socket.id);
    });
  });
}
