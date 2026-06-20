export type AuthMode = "register" | "login";
export type GuideSection = "lore" | "how" | "journey" | "about";

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
  canAttack: boolean;
  position?: "attack" | "defense";
  positionChanged?: boolean;
  targetMode?: string;
};

export type RoomPlayer = {
  userId: string;
  username: string;
  avatarId: string;
  deckId: string;
  characterId: string;
  ready: boolean;
  health: number;
  handCount: number;
  deckCount: number;
  discardCount: number;
  discard?: RoomCard[];
  mana: number;
  maxMana: number;
  board: RoomCard[];
  spellZone?: RoomCard[];
};

export type RoomBattleState = {
  turn: number;
  activePlayerId: string;
  playerOrder: string[];
  turnDeadlineAt: string;
  winnerId: string | null;
  manualDrawUsed?: boolean;
};

export type RoomState = {
  roomCode: string;
  hostUserId: string;
  hostMode: "play" | "manage";
  maxPlayers: number;
  status: "open" | "in_game";
  createdAt: string;
  expiresAt: string;
  battle: RoomBattleState | null;
  players: RoomPlayer[];
};

export type RoomActionEvent = {
  roomCode: string;
  actionType: "draw" | "play" | "attack" | "end_turn";
  actorUserId: string;
  actorUsername: string;
  targetUserId?: string;
  targetCardName?: string;
  amount?: number;
  card?: {
    slug: string;
    name: string;
    description: string;
    type: "unit" | "spell";
    rarity: "common" | "rare" | "epic" | "legendary";
    cost: number;
    attack: number;
    health: number;
    canAttack: boolean;
  };
  turn: number;
  timestamp: string;
};

export type CharacterClass = {
  id: string;
  name: string;
  deckStyle: string;
  ability: string;
  tag: string;
  sprite: string;
  crest: string;
};
