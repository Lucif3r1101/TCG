export type AuthMode = "register" | "login";
export type GuideSection = "lore" | "how" | "journey";

export type AuthUser = {
  id: string;
  email: string;
  username: string;
  avatarId: string;
};

export type AuthResponse = {
  token: string;
  user: AuthUser;
};

export type DeckSummary = {
  id: string;
  name: string;
  isStarter: boolean;
};

export type MatchState = {
  matchId: string;
  turn: number;
  activePlayerId: string;
  winnerId: string | null;
  player1Health: number;
  player2Health: number;
  player1Mana: number;
  player2Mana: number;
  turnDeadlineAt: string;
};

export type ActiveMatchResponse = {
  id: string;
  status: "active" | "completed";
  state: MatchState;
};

export type MatchFoundPayload = MatchState & {
  you: string;
  opponent: string;
};

export type RoomCard = {
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

export type RoomPlayer = {
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
  board: RoomCard[];
};

export type RoomBattleState = {
  turn: number;
  activePlayerId: string;
  playerOrder: string[];
  turnDeadlineAt: string;
  winnerId: string | null;
};

export type RoomState = {
  roomCode: string;
  hostUserId: string;
  maxPlayers: number;
  status: "open" | "in_game";
  createdAt: string;
  battle: RoomBattleState | null;
  players: RoomPlayer[];
};

export type CharacterClass = {
  id: string;
  name: string;
  deckStyle: string;
  ability: string;
  tag: string;
  sprite: string;
};
