import { Types } from "mongoose";
import type { Server, Socket } from "socket.io";
import { verifyAuthToken } from "../utils.auth.js";
import { DeckModel } from "../models/Deck.js";
import { MatchModel } from "../models/Match.js";
import { ALL_CARD_BLUEPRINTS } from "../data/starterCards.js";
import cardEffectsGenerated from "../data/cardEffects.generated.json";
import {
  matchActionPayloadSchema,
  queueJoinPayloadSchema,
  roomCodePayloadSchema,
  roomCreatePayloadSchema,
  roomDrawCardPayloadSchema,
  roomJoinPayloadSchema,
  roomPlayCardPayloadSchema,
  roomReadyPayloadSchema
} from "./realtime.validation.js";

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

type RoomPlayer = {
  userId: string;
  deckId: string;
  characterId: string;
  ready: boolean;
  health: number;
  handCount: number;
  deckCount: number;
  discardCount: number;
  mana: number;
  maxMana: number;
  hand: RoomCard[];
  deck: RoomCard[];
  discard: RoomCard[];
  board: RoomCard[];
  joinedAt: string;
};

type RoomCard = {
  instanceId: string;
  slug: string;
  name: string;
  description: string;
  faction: string;
  type: "unit" | "spell";
  rarity: "common" | "rare" | "epic" | "legendary";
  cost: number;
  attack: number;
  health: number;
};

type RoomBattleState = {
  turn: number;
  activePlayerId: string;
  playerOrder: string[];
  turnDeadlineAt: string;
  winnerId: string | null;
};

type RoomState = {
  roomCode: string;
  hostUserId: string;
  maxPlayers: number;
  status: "open" | "in_game";
  createdAt: string;
  battle: RoomBattleState | null;
  players: RoomPlayer[];
};

const TURN_DURATION_MS = 60_000;
const QUEUE_ACTION_COOLDOWN_MS = 1_500;
const MATCH_ACTION_COOLDOWN_MS = 250;
const ROOM_ACTION_COOLDOWN_MS = 350;

const queue: MatchmakingQueueEntry[] = [];
const socketToUser = new Map<string, string>();
const userToSockets = new Map<string, Set<string>>();
const activeMatches = new Map<string, ActiveMatchState>();
const activeRooms = new Map<string, RoomState>();
const lastQueueActionAtByUser = new Map<string, number>();
const lastMatchActionAtByUser = new Map<string, number>();
const lastRoomActionAtByUser = new Map<string, number>();
const disconnectCleanupTimers = new Map<string, NodeJS.Timeout>();

function isOnCooldown(store: Map<string, number>, key: string, cooldownMs: number): boolean {
  const now = Date.now();
  const lastActionAt = store.get(key) ?? 0;

  if (now - lastActionAt < cooldownMs) {
    return true;
  }

  store.set(key, now);
  return false;
}

function addUserSocket(userId: string, socketId: string): void {
  const cleanupTimer = disconnectCleanupTimers.get(userId);
  if (cleanupTimer) {
    clearTimeout(cleanupTimer);
    disconnectCleanupTimers.delete(userId);
  }

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

function normalizeRoomCode(value: string): string {
  return value.trim().toUpperCase();
}

function makeRoomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

function generateUniqueRoomCode(): string {
  for (let i = 0; i < 15; i += 1) {
    const code = makeRoomCode();
    if (!activeRooms.has(code)) {
      return code;
    }
  }

  throw new Error("Unable to allocate room code");
}

function findRoomByUserId(userId: string): RoomState | null {
  for (const room of activeRooms.values()) {
    if (room.players.some((player) => player.userId === userId)) {
      return room;
    }
  }
  return null;
}

function toRoomPublicState(room: RoomState) {
  return {
    roomCode: room.roomCode,
    hostUserId: room.hostUserId,
    maxPlayers: room.maxPlayers,
    status: room.status,
    createdAt: room.createdAt,
    battle: room.battle,
    players: room.players.map((player) => ({
      userId: player.userId,
      deckId: player.deckId,
      characterId: player.characterId,
      ready: player.ready,
      health: player.health,
      handCount: player.handCount,
      deckCount: player.deckCount,
      discardCount: player.discardCount,
      mana: player.mana,
      maxMana: player.maxMana,
      board: player.board
    }))
  };
}

function toRoomPrivateState(room: RoomState, userId: string) {
  const player = room.players.find((entry) => entry.userId === userId);
  return {
    roomCode: room.roomCode,
    hand: player?.hand ?? [],
    deckCount: player?.deckCount ?? 0,
    discardCount: player?.discardCount ?? 0,
    board: player?.board ?? []
  };
}

function makeCardInstanceId(slug: string, index: number): string {
  return `${slug}-${index}-${Math.random().toString(36).slice(2, 8)}`;
}

function shuffleCards<T>(input: T[]): T[] {
  const items = [...input];
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function buildFactionDeck(factionId: string): RoomCard[] {
  const cards = ALL_CARD_BLUEPRINTS.filter((card) => card.faction === factionId).map((card, index) => ({
    instanceId: makeCardInstanceId(card.slug, index + 1),
    slug: card.slug,
    name: card.name,
    description: card.description,
    faction: card.faction,
    type: card.type,
    rarity: card.rarity,
    cost: card.cost,
    attack: card.attack,
    health: card.health
  }));

  return shuffleCards(cards);
}

function drawCardsForPlayer(player: RoomPlayer, count: number): void {
  for (let i = 0; i < count; i += 1) {
    const next = player.deck.shift();
    if (!next) {
      break;
    }
    player.hand.push(next);
  }

  player.handCount = player.hand.length;
  player.deckCount = player.deck.length;
  player.discardCount = player.discard.length;
}

function findRoomByCodeForActivePlayer(roomCode: string): RoomState | null {
  const room = activeRooms.get(roomCode);
  if (!room || room.status !== "in_game" || !room.battle) {
    return null;
  }
  return room;
}

function advanceRoomTurn(room: RoomState): void {
  if (!room.battle || room.battle.playerOrder.length === 0) {
    return;
  }

  const currentIndex = room.battle.playerOrder.findIndex((id) => id === room.battle!.activePlayerId);
  const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % room.battle.playerOrder.length;
  const nextPlayerId = room.battle.playerOrder[nextIndex];
  const nextPlayer = room.players.find((player) => player.userId === nextPlayerId);

  room.battle.turn += 1;
  room.battle.activePlayerId = nextPlayerId;
  room.battle.turnDeadlineAt = new Date(Date.now() + TURN_DURATION_MS).toISOString();

  if (nextPlayer) {
    nextPlayer.maxMana = Math.min(nextPlayer.maxMana + 1, 10);
    nextPlayer.mana = nextPlayer.maxMana;
    drawCardsForPlayer(nextPlayer, 1);
  }
}

function setRoomWinnerIfResolved(room: RoomState): void {
  if (!room.battle) {
    return;
  }

  const alive = room.players.filter((player) => player.health > 0);
  if (alive.length === 1) {
    room.battle.winnerId = alive[0].userId;
    room.status = "open";
  }
}

type TargetMode = "self" | "single_opponent" | "all_opponents" | "random_opponent";

type EffectOp =
  | { kind: "damage"; amount: number }
  | { kind: "heal"; amount: number }
  | { kind: "draw"; amount: number }
  | { kind: "gain_mana"; amount: number }
  | { kind: "reduce_opponent_mana"; amount: number }
  | { kind: "modify_hand_cost"; amount: number };

type CardEffectScript = {
  slug: string;
  targetMode: TargetMode;
  operations: EffectOp[];
  unitBoardAttackBonus: number;
  unitBoardHealthBonus: number;
};

const CARD_EFFECTS_BY_SLUG = new Map<string, CardEffectScript>(
  Object.entries(cardEffectsGenerated as Record<string, CardEffectScript>)
);

function selectTargets(room: RoomState, caster: RoomPlayer, targetMode: TargetMode, explicitTargetUserId?: string): RoomPlayer[] {
  const opponents = room.players.filter((player) => player.userId !== caster.userId && player.health > 0);
  if (targetMode === "self") {
    return [caster];
  }
  if (targetMode === "single_opponent") {
    const explicit = explicitTargetUserId ? opponents.find((player) => player.userId === explicitTargetUserId) : null;
    return explicit ? [explicit] : opponents.slice(0, 1);
  }
  if (targetMode === "all_opponents") {
    return opponents;
  }
  if (opponents.length === 0) {
    return [];
  }
  const randomIndex = Math.floor(Math.random() * opponents.length);
  return [opponents[randomIndex]];
}

function executeCardEffect(room: RoomState, caster: RoomPlayer, card: RoomCard, targetUserId?: string): void {
  const script = CARD_EFFECTS_BY_SLUG.get(card.slug);
  if (!script) {
    return;
  }

  const targets = selectTargets(room, caster, script.targetMode, targetUserId);

  if (card.type === "unit") {
    const unitCard: RoomCard = {
      ...card,
      attack: card.attack + script.unitBoardAttackBonus,
      health: card.health + script.unitBoardHealthBonus
    };
    caster.board.push(unitCard);
  }

  for (const op of script.operations) {
    if (op.kind === "damage") {
      for (const target of targets) {
        target.health = Math.max(0, target.health - op.amount);
      }
      continue;
    }

    if (op.kind === "heal") {
      caster.health = Math.min(30, caster.health + op.amount);
      continue;
    }

    if (op.kind === "draw") {
      drawCardsForPlayer(caster, op.amount);
      continue;
    }

    if (op.kind === "gain_mana") {
      caster.mana = Math.min(10, caster.mana + op.amount);
      caster.maxMana = Math.min(10, Math.max(caster.maxMana, caster.mana));
      continue;
    }

    if (op.kind === "reduce_opponent_mana") {
      for (const target of targets) {
        target.mana = Math.max(0, target.mana - op.amount);
      }
      continue;
    }

    // modify_hand_cost
    for (const target of targets) {
      target.hand = target.hand.map((entry) => ({
        ...entry,
        cost: Math.max(0, Math.min(10, entry.cost + op.amount))
      }));
    }
  }
}

function emitRoomState(io: Server, room: RoomState): void {
  const payload = { room: toRoomPublicState(room) };
  for (const player of room.players) {
    emitToUser(io, player.userId, "room_state", payload);
    emitToUser(io, player.userId, "room_private_state", toRoomPrivateState(room, player.userId));
  }
}

function removeUserFromAllRooms(io: Server, userId: string): void {
  for (const [code, room] of activeRooms.entries()) {
    if (!room.players.some((player) => player.userId === userId)) {
      continue;
    }

    room.players = room.players.filter((player) => player.userId !== userId);
    if (room.battle) {
      room.battle.playerOrder = room.battle.playerOrder.filter((id) => id !== userId);
      if (room.battle.activePlayerId === userId && room.battle.playerOrder.length > 0) {
        room.battle.activePlayerId = room.battle.playerOrder[0];
        room.battle.turnDeadlineAt = new Date(Date.now() + TURN_DURATION_MS).toISOString();
      }
    }

    if (room.hostUserId === userId && room.players.length > 0) {
      room.hostUserId = room.players[0].userId;
    }

    if (room.players.length === 0 || (room.status === "in_game" && room.players.length < 2)) {
      activeRooms.delete(code);
      continue;
    }

    emitRoomState(io, room);
  }
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

function advanceMatchTurn(match: ActiveMatchState): void {
  const nextPlayer = match.playerIds[0] === match.activePlayerId ? match.playerIds[1] : match.playerIds[0];
  match.turn += 1;
  match.activePlayerId = nextPlayer;
  match.turnDeadlineAt = new Date(Date.now() + TURN_DURATION_MS).toISOString();

  if (nextPlayer === match.playerIds[0]) {
    match.player1Mana = Math.min(match.player1Mana + 1, 10);
  } else {
    match.player2Mana = Math.min(match.player2Mana + 1, 10);
  }
}

export function registerRealtime(io: Server, jwtSecret: string): void {
  setInterval(async () => {
    const now = Date.now();

    for (const room of activeRooms.values()) {
      if (!room.battle || room.status !== "in_game") {
        continue;
      }

      if (new Date(room.battle.turnDeadlineAt).getTime() <= now) {
        advanceRoomTurn(room);
        setRoomWinnerIfResolved(room);
        emitRoomState(io, room);
      }
    }

    for (const match of activeMatches.values()) {
      if (match.winnerId) {
        continue;
      }

      if (new Date(match.turnDeadlineAt).getTime() <= now) {
        advanceMatchTurn(match);
        await MatchModel.findByIdAndUpdate(match.matchId, {
          $set: {
            "state.turn": match.turn,
            "state.activePlayerId": match.activePlayerId,
            "state.player1Mana": match.player1Mana,
            "state.player2Mana": match.player2Mana,
            "state.turnDeadlineAt": match.turnDeadlineAt
          }
        });

        const payloadState = buildPublicMatchState(match);
        emitToUser(io, match.playerIds[0], "match_state", payloadState);
        emitToUser(io, match.playerIds[1], "match_state", payloadState);
      }
    }
  }, 1000);

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

    socket.on("room_create", async (payload: unknown) => {
      if (isOnCooldown(lastRoomActionAtByUser, userId, ROOM_ACTION_COOLDOWN_MS)) {
        socket.emit("room_error", { message: "Too many room actions. Slow down." });
        return;
      }

      const parsed = roomCreatePayloadSchema.safeParse(payload);
      if (!parsed.success) {
        socket.emit("room_error", { message: "Invalid room create payload." });
        return;
      }

      const { deckId, characterId, maxPlayers } = parsed.data;

      const deckOk = await loadAndValidateDeck(userId, deckId);
      if (!deckOk) {
        socket.emit("room_error", { message: "Deck not found for this user." });
        return;
      }

      removeUserFromAllRooms(io, userId);

      const roomCode = generateUniqueRoomCode();
      const room: RoomState = {
        roomCode,
        hostUserId: userId,
        maxPlayers,
        status: "open",
        createdAt: new Date().toISOString(),
        battle: null,
        players: [
          {
            userId,
            deckId,
            characterId,
            ready: true,
            health: 20,
            handCount: 0,
            deckCount: 0,
            discardCount: 0,
            mana: 0,
            maxMana: 0,
            hand: [],
            deck: [],
            discard: [],
            board: [],
            joinedAt: new Date().toISOString()
          }
        ]
      };

      activeRooms.set(roomCode, room);
      emitRoomState(io, room);
      socket.emit("room_created", { roomCode });
    });

    socket.on("room_join", async (payload: unknown) => {
      if (isOnCooldown(lastRoomActionAtByUser, userId, ROOM_ACTION_COOLDOWN_MS)) {
        socket.emit("room_error", { message: "Too many room actions. Slow down." });
        return;
      }

      const parsed = roomJoinPayloadSchema.safeParse(payload);
      if (!parsed.success) {
        socket.emit("room_error", { message: "Invalid room join payload." });
        return;
      }

      const roomCode = normalizeRoomCode(parsed.data.roomCode);
      const { deckId, characterId } = parsed.data;
      const room = activeRooms.get(roomCode);

      if (!room) {
        socket.emit("room_error", { message: "Room not found." });
        return;
      }

      if (room.status !== "open") {
        socket.emit("room_error", { message: "Room is already in game." });
        return;
      }

      const deckOk = await loadAndValidateDeck(userId, deckId);
      if (!deckOk) {
        socket.emit("room_error", { message: "Deck not found for this user." });
        return;
      }

      const existing = room.players.find((player) => player.userId === userId);
      if (existing) {
        existing.deckId = deckId;
        existing.characterId = characterId;
        existing.ready = true;
        emitRoomState(io, room);
        return;
      }

      if (room.players.length >= room.maxPlayers) {
        socket.emit("room_error", { message: "Room is full." });
        return;
      }

      removeUserFromAllRooms(io, userId);

      room.players.push({
        userId,
        deckId,
        characterId,
        ready: false,
        health: 20,
        handCount: 0,
        deckCount: 0,
        discardCount: 0,
        mana: 0,
        maxMana: 0,
        hand: [],
        deck: [],
        discard: [],
        board: [],
        joinedAt: new Date().toISOString()
      });

      emitRoomState(io, room);
    });

    socket.on("room_leave", (payload: unknown) => {
      if (isOnCooldown(lastRoomActionAtByUser, userId, ROOM_ACTION_COOLDOWN_MS)) {
        socket.emit("room_error", { message: "Too many room actions. Slow down." });
        return;
      }

      const parsed = roomCodePayloadSchema.safeParse(payload);
      if (!parsed.success) {
        socket.emit("room_error", { message: "Invalid room leave payload." });
        return;
      }

      const roomCode = normalizeRoomCode(parsed.data.roomCode);
      const room = activeRooms.get(roomCode);
      if (!room) {
        socket.emit("room_error", { message: "Room not found." });
        return;
      }

      room.players = room.players.filter((player) => player.userId !== userId);
      if (room.battle) {
        room.battle.playerOrder = room.battle.playerOrder.filter((id) => id !== userId);
        if (room.battle.activePlayerId === userId && room.battle.playerOrder.length > 0) {
          room.battle.activePlayerId = room.battle.playerOrder[0];
          room.battle.turnDeadlineAt = new Date(Date.now() + TURN_DURATION_MS).toISOString();
        }
      }

      if (room.hostUserId === userId && room.players.length > 0) {
        room.hostUserId = room.players[0].userId;
      }

      if (room.players.length === 0 || (room.status === "in_game" && room.players.length < 2)) {
        activeRooms.delete(roomCode);
        socket.emit("room_left", { roomCode });
        return;
      }

      emitRoomState(io, room);
      socket.emit("room_left", { roomCode });
    });

    socket.on("room_ready", (payload: unknown) => {
      if (isOnCooldown(lastRoomActionAtByUser, userId, ROOM_ACTION_COOLDOWN_MS)) {
        socket.emit("room_error", { message: "Too many room actions. Slow down." });
        return;
      }

      const parsed = roomReadyPayloadSchema.safeParse(payload);
      if (!parsed.success) {
        socket.emit("room_error", { message: "Invalid room ready payload." });
        return;
      }

      const roomCode = normalizeRoomCode(parsed.data.roomCode);
      const room = activeRooms.get(roomCode);
      if (!room) {
        socket.emit("room_error", { message: "Room not found." });
        return;
      }

      const player = room.players.find((entry) => entry.userId === userId);
      if (!player) {
        socket.emit("room_error", { message: "User is not in this room." });
        return;
      }

      player.ready = parsed.data.ready;
      emitRoomState(io, room);
    });

    socket.on("room_start", (payload: unknown) => {
      if (isOnCooldown(lastRoomActionAtByUser, userId, ROOM_ACTION_COOLDOWN_MS)) {
        socket.emit("room_error", { message: "Too many room actions. Slow down." });
        return;
      }

      const parsed = roomCodePayloadSchema.safeParse(payload);
      if (!parsed.success) {
        socket.emit("room_error", { message: "Invalid room start payload." });
        return;
      }

      const roomCode = normalizeRoomCode(parsed.data.roomCode);
      const room = activeRooms.get(roomCode);
      if (!room) {
        socket.emit("room_error", { message: "Room not found." });
        return;
      }

      if (room.hostUserId !== userId) {
        socket.emit("room_error", { message: "Only host can start the room." });
        return;
      }

      if (room.players.length < 2) {
        socket.emit("room_error", { message: "At least 2 players are required." });
        return;
      }

      if (!room.players.every((player) => player.ready)) {
        socket.emit("room_error", { message: "All players must be ready." });
        return;
      }

      room.status = "in_game";
      const order = [...room.players].sort(() => Math.random() - 0.5).map((player) => player.userId);
      const activePlayerId = order[0];
      const turnDeadlineAt = new Date(Date.now() + TURN_DURATION_MS).toISOString();
      room.battle = {
        turn: 1,
        activePlayerId,
        playerOrder: order,
        turnDeadlineAt,
        winnerId: null
      };

      room.players = room.players.map((player) => {
        const isActive = player.userId === activePlayerId;
        const deck = buildFactionDeck(player.characterId);
        const nextPlayer: RoomPlayer = {
          ...player,
          health: 20,
          hand: [],
          deck,
          discard: [],
          board: [],
          handCount: 0,
          deckCount: deck.length,
          discardCount: 0,
          maxMana: 1,
          mana: isActive ? 1 : 0
        };
        drawCardsForPlayer(nextPlayer, 5);
        return {
          ...nextPlayer
        };
      });

      for (const player of room.players) {
        emitToUser(io, player.userId, "room_started", {
          roomCode,
          playerOrder: order,
          activePlayerId,
          turn: 1,
          turnDeadlineAt,
          playerCount: room.players.length
        });
      }

      emitRoomState(io, room);
    });

    socket.on("room_end_turn", (payload: unknown) => {
      if (isOnCooldown(lastRoomActionAtByUser, userId, ROOM_ACTION_COOLDOWN_MS)) {
        socket.emit("room_error", { message: "Too many room actions. Slow down." });
        return;
      }

      const parsed = roomCodePayloadSchema.safeParse(payload);
      if (!parsed.success) {
        socket.emit("room_error", { message: "Invalid room end turn payload." });
        return;
      }

      const roomCode = normalizeRoomCode(parsed.data.roomCode);
      const room = findRoomByCodeForActivePlayer(roomCode);
      if (!room || !room.battle) {
        socket.emit("room_error", { message: "Active room game not found." });
        return;
      }

      if (room.battle.activePlayerId !== userId) {
        socket.emit("room_error", { message: "Not your turn." });
        return;
      }

      advanceRoomTurn(room);
      setRoomWinnerIfResolved(room);
      emitRoomState(io, room);
    });

    socket.on("room_draw_card", (payload: unknown) => {
      if (isOnCooldown(lastRoomActionAtByUser, userId, ROOM_ACTION_COOLDOWN_MS)) {
        socket.emit("room_error", { message: "Too many room actions. Slow down." });
        return;
      }

      const parsed = roomDrawCardPayloadSchema.safeParse(payload);
      if (!parsed.success) {
        socket.emit("room_error", { message: "Invalid draw payload." });
        return;
      }

      const roomCode = normalizeRoomCode(parsed.data.roomCode);
      const room = findRoomByCodeForActivePlayer(roomCode);
      if (!room || !room.battle) {
        socket.emit("room_error", { message: "Active room game not found." });
        return;
      }

      if (room.battle.activePlayerId !== userId) {
        socket.emit("room_error", { message: "Not your turn." });
        return;
      }

      const player = room.players.find((entry) => entry.userId === userId);
      if (!player) {
        socket.emit("room_error", { message: "Player not found in room." });
        return;
      }

      if (player.deck.length === 0) {
        socket.emit("room_error", { message: "No cards left to draw." });
        return;
      }

      drawCardsForPlayer(player, 1);
      emitRoomState(io, room);
    });

    socket.on("room_play_card", (payload: unknown) => {
      if (isOnCooldown(lastRoomActionAtByUser, userId, ROOM_ACTION_COOLDOWN_MS)) {
        socket.emit("room_error", { message: "Too many room actions. Slow down." });
        return;
      }

      const parsed = roomPlayCardPayloadSchema.safeParse(payload);
      if (!parsed.success) {
        socket.emit("room_error", { message: "Invalid play payload." });
        return;
      }

      const roomCode = normalizeRoomCode(parsed.data.roomCode);
      const room = findRoomByCodeForActivePlayer(roomCode);
      if (!room || !room.battle) {
        socket.emit("room_error", { message: "Active room game not found." });
        return;
      }

      if (room.battle.activePlayerId !== userId) {
        socket.emit("room_error", { message: "Not your turn." });
        return;
      }

      const player = room.players.find((entry) => entry.userId === userId);
      if (!player) {
        socket.emit("room_error", { message: "Player not found in room." });
        return;
      }

      const cardIndex = player.hand.findIndex((card) => card.instanceId === parsed.data.cardInstanceId);
      if (cardIndex < 0) {
        socket.emit("room_error", { message: "Card not found in hand." });
        return;
      }

      const card = player.hand[cardIndex];
      if (card.cost > player.mana) {
        socket.emit("room_error", { message: "Not enough mana." });
        return;
      }

      player.mana -= card.cost;
      player.hand.splice(cardIndex, 1);

      executeCardEffect(room, player, card, parsed.data.targetUserId);
      if (card.type === "spell") {
        player.discard.push(card);
      }
      player.handCount = player.hand.length;
      player.deckCount = player.deck.length;
      player.discardCount = player.discard.length;

      setRoomWinnerIfResolved(room);
      emitRoomState(io, room);
    });

    socket.on("queue_join", async (payload: { deckId?: string }) => {
      if (isOnCooldown(lastQueueActionAtByUser, userId, QUEUE_ACTION_COOLDOWN_MS)) {
        socket.emit("queue_error", { message: "Too many queue actions. Slow down." });
        return;
      }

      const parsed = queueJoinPayloadSchema.safeParse(payload);
      if (!parsed.success) {
        socket.emit("queue_error", { message: "Invalid queue payload." });
        return;
      }
      const deckId = parsed.data.deckId;

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
      if (isOnCooldown(lastQueueActionAtByUser, userId, QUEUE_ACTION_COOLDOWN_MS)) {
        socket.emit("queue_error", { message: "Too many queue actions. Slow down." });
        return;
      }

      removeFromQueueBySocket(socket.id);
      socket.emit("queue_left", { ok: true });
    });

    socket.on("match_sync", async (payload: { matchId?: string }) => {
      const parsed = matchActionPayloadSchema.safeParse(payload);
      if (!parsed.success) {
        socket.emit("match_error", { message: "Invalid match payload." });
        return;
      }
      const matchId = parsed.data.matchId;

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
      if (isOnCooldown(lastMatchActionAtByUser, userId, MATCH_ACTION_COOLDOWN_MS)) {
        socket.emit("match_error", { message: "Too many match actions. Slow down." });
        return;
      }

      const parsed = matchActionPayloadSchema.safeParse(payload);
      if (!parsed.success) {
        socket.emit("match_error", { message: "Invalid match payload." });
        return;
      }
      const matchId = parsed.data.matchId;

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

      advanceMatchTurn(match);

      await MatchModel.findByIdAndUpdate(matchId, {
        $set: {
          "state.turn": match.turn,
          "state.activePlayerId": match.activePlayerId,
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
      if (isOnCooldown(lastMatchActionAtByUser, userId, MATCH_ACTION_COOLDOWN_MS)) {
        socket.emit("match_error", { message: "Too many match actions. Slow down." });
        return;
      }

      const parsed = matchActionPayloadSchema.safeParse(payload);
      if (!parsed.success) {
        socket.emit("match_error", { message: "Invalid match payload." });
        return;
      }
      const matchId = parsed.data.matchId;

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
      if (getUserSockets(userId).length === 0) {
        const timer = setTimeout(() => {
          if (getUserSockets(userId).length === 0) {
            removeUserFromAllRooms(io, userId);
            lastQueueActionAtByUser.delete(userId);
            lastMatchActionAtByUser.delete(userId);
            lastRoomActionAtByUser.delete(userId);
          }
          disconnectCleanupTimers.delete(userId);
        }, 12_000);
        disconnectCleanupTimers.set(userId, timer);
      }
    });
  });
}
