export type AuthMode = "register" | "login";
export type GuideSection = "lore" | "how" | "journey";

export type AuthUser = {
  id: string;
  email: string;
  username: string;
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

export type RoomPlayer = {
  userId: string;
  deckId: string;
  ready: boolean;
  joinedAt: string;
};

export type RoomState = {
  roomCode: string;
  hostUserId: string;
  maxPlayers: number;
  status: "open" | "in_game";
  createdAt: string;
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
