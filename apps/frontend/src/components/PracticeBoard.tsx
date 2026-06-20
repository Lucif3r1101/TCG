import { useEffect, useMemo, useRef, useState } from "react";
import { GameBoard } from "./GameBoard";
import { API_URL } from "../constants/game";
import { RoomCard, RoomState } from "../types/game";

type PPlayer = {
  userId: string;
  username: string;
  avatarId: string;
  characterId: string;
  health: number;
  mana: number;
  maxMana: number;
  board: RoomCard[];
  hand: RoomCard[];
  deck: RoomCard[];
  discard: RoomCard[];
};

type PState = {
  you: PPlayer;
  bot: PPlayer;
  activeId: "you" | "bot";
  turn: number;
  manualDrawUsed: boolean;
  winnerId: string | null;
};

type ApiCard = {
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

const START_HP = 20;
const HAND_SIZE = 5;
const DECK_SIZE = 16;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function toRoomCard(card: ApiCard, owner: string, n: number): RoomCard {
  return {
    instanceId: `${owner}-${card.slug}-${n}`,
    slug: card.slug,
    name: card.name,
    description: card.description,
    faction: card.faction,
    type: card.type,
    rarity: card.rarity,
    cost: card.cost,
    attack: card.attack,
    health: card.health,
    canAttack: false,
    position: "attack",
    positionChanged: false
  };
}

function makePlayer(userId: string, username: string, avatarId: string, characterId: string, pool: ApiCard[]): PPlayer {
  const deck = shuffle(pool).slice(0, DECK_SIZE).map((c, i) => toRoomCard(c, userId, i));
  const hand = deck.splice(0, HAND_SIZE);
  return { userId, username, avatarId, characterId, health: START_HP, mana: 0, maxMana: 1, board: [], hand, deck, discard: [] };
}

// Deep-ish clone so React sees new refs.
function clone(s: PState): PState {
  const cp = (p: PPlayer): PPlayer => ({
    ...p,
    board: p.board.map((c) => ({ ...c })),
    hand: p.hand.map((c) => ({ ...c })),
    deck: p.deck.map((c) => ({ ...c })),
    discard: p.discard.map((c) => ({ ...c }))
  });
  return { ...s, you: cp(s.you), bot: cp(s.bot) };
}

function checkWinner(s: PState) {
  if (s.you.health <= 0) s.winnerId = "bot";
  else if (s.bot.health <= 0) s.winnerId = "you";
}

// Yu-Gi-Oh-style resolution (mirrors the backend).
function resolveAttack(attacker: RoomCard, atkOwner: PPlayer, target: RoomCard | null, defOwner: PPlayer) {
  attacker.canAttack = false;
  if (!target) {
    if (defOwner.board.length > 0) return; // can't go face with defenders up
    defOwner.health = Math.max(0, defOwner.health - attacker.attack);
    return;
  }
  if (target.position === "attack") {
    if (attacker.attack > target.attack) {
      defOwner.health = Math.max(0, defOwner.health - (attacker.attack - target.attack));
      defOwner.board = defOwner.board.filter((c) => c.instanceId !== target.instanceId);
      defOwner.discard.push(target);
    } else if (attacker.attack < target.attack) {
      atkOwner.health = Math.max(0, atkOwner.health - (target.attack - attacker.attack));
      atkOwner.board = atkOwner.board.filter((c) => c.instanceId !== attacker.instanceId);
      atkOwner.discard.push(attacker);
    } else {
      defOwner.board = defOwner.board.filter((c) => c.instanceId !== target.instanceId);
      atkOwner.board = atkOwner.board.filter((c) => c.instanceId !== attacker.instanceId);
      defOwner.discard.push(target);
      atkOwner.discard.push(attacker);
    }
  } else {
    const def = target.health;
    if (attacker.attack > def) {
      defOwner.board = defOwner.board.filter((c) => c.instanceId !== target.instanceId);
      defOwner.discard.push(target);
    } else if (attacker.attack < def) {
      atkOwner.health = Math.max(0, atkOwner.health - (def - attacker.attack));
    }
  }
}

export function PracticeBoard({ onExit }: { onExit: () => void }) {
  const [state, setState] = useState<PState | null>(null);
  const [error, setError] = useState("");
  const botTimer = useRef<number | null>(null);

  // Build decks from the public card list.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/cards`);
        const data = (await res.json()) as { cards: ApiCard[] };
        const playable = data.cards.filter((c) => c.slug && (c.type === "unit" || c.type === "spell"));
        const units = playable.filter((c) => c.type === "unit");
        const pool = units.length >= DECK_SIZE ? units : playable;
        if (!active) return;
        const you = makePlayer("you", "You", "avatar-01", "riftforged-sentinel", pool);
        const bot = makePlayer("bot", "Practice Bot", "avatar-07", "void-ranger", pool);
        you.mana = 1;
        setState({ you, bot, activeId: "you", turn: 1, manualDrawUsed: false, winnerId: null });
      } catch {
        if (active) setError("Could not load cards for practice.");
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const mutate = (fn: (s: PState) => void) => {
    setState((prev) => {
      if (!prev || prev.winnerId) return prev;
      const next = clone(prev);
      fn(next);
      checkWinner(next);
      return next;
    });
  };

  const startTurnFor = (s: PState, who: "you" | "bot") => {
    s.activeId = who;
    s.turn += 1;
    s.manualDrawUsed = false;
    const p = s[who];
    p.maxMana = Math.min(10, p.maxMana + 1);
    p.mana = p.maxMana;
    p.board = p.board.map((c) => ({ ...c, canAttack: true, positionChanged: false }));
  };

  // Bot plays when it's its turn.
  useEffect(() => {
    if (!state || state.winnerId || state.activeId !== "bot") return;
    botTimer.current = window.setTimeout(() => {
      setState((prev) => {
        if (!prev || prev.winnerId || prev.activeId !== "bot") return prev;
        const s = clone(prev);
        const bot = s.bot;
        // draw
        const drawn = bot.deck.shift();
        if (drawn) bot.hand.push(drawn);
        // play affordable units (attack stance), cheapest first
        const affordable = bot.hand.filter((c) => c.type === "unit").sort((a, b) => a.cost - b.cost);
        for (const card of affordable) {
          if (card.cost <= bot.mana && bot.board.length < 6) {
            bot.mana -= card.cost;
            bot.hand = bot.hand.filter((c) => c.instanceId !== card.instanceId);
            bot.board.push({ ...card, position: "attack", canAttack: false });
          }
        }
        // attack with ready units
        for (const unit of bot.board) {
          if (!unit.canAttack || unit.position !== "attack") continue;
          const youTarget = s.you.board.find((c) => c.position === "attack") ?? s.you.board[0] ?? null;
          resolveAttack(unit, bot, youTarget, s.you);
          checkWinner(s);
          if (s.winnerId) break;
        }
        // end bot turn -> your turn
        if (!s.winnerId) startTurnFor(s, "you");
        return s;
      });
    }, 1100);
    return () => {
      if (botTimer.current) window.clearTimeout(botTimer.current);
    };
  }, [state?.activeId, state?.winnerId, state]);

  const room: RoomState | null = useMemo(() => {
    if (!state) return null;
    const pub = (p: PPlayer) => ({
      userId: p.userId,
      username: p.username,
      avatarId: p.avatarId,
      deckId: "practice",
      characterId: p.characterId,
      ready: true,
      health: p.health,
      handCount: p.hand.length,
      deckCount: p.deck.length,
      discardCount: p.discard.length,
      mana: p.mana,
      maxMana: p.maxMana,
      board: p.board
    });
    return {
      roomCode: "SOLO",
      hostUserId: "you",
      hostMode: "play",
      maxPlayers: 2,
      status: "in_game",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      battle: {
        turn: state.turn,
        activePlayerId: state.activeId,
        playerOrder: ["you", "bot"],
        turnDeadlineAt: new Date(Date.now() + 3_600_000).toISOString(),
        winnerId: state.winnerId,
        manualDrawUsed: state.manualDrawUsed
      },
      players: [pub(state.you), pub(state.bot)]
    };
  }, [state]);

  if (error) {
    return (
      <div className="legal-overlay" role="dialog" aria-modal="true">
        <div className="auth-modal">
          <h3>Practice unavailable</h3>
          <p className="auth-hint">{error}</p>
          <button className="button primary auth-submit" type="button" onClick={onExit}>Back</button>
        </div>
      </div>
    );
  }

  if (!state || !room) {
    return <div className="practice-loading">Shuffling decks…</div>;
  }

  const noop = () => undefined;

  return (
    <GameBoard
      currentUserId="you"
      socketConnected
      activeMatchState={null}
      decks={[]}
      selectedDeckId="practice"
      selectedCharacterId="riftforged-sentinel"
      roomCodeInput="SOLO"
      roomMaxPlayers={2}
      hostMode="play"
      animationPreset="balanced"
      tabletopMode
      currentRoom={room}
      privateHand={state.you.hand}
      roomAction={null}
      meReady
      isInRoom
      isRoomHost
      onDeckChange={noop}
      onCharacterChange={noop}
      onRoomCodeInput={noop}
      onRoomMaxPlayersChange={noop}
      onHostModeChange={noop}
      onAnimationPresetChange={noop}
      onCreateRoom={noop}
      onJoinRoom={noop}
      onJoinAsHostPlayer={noop}
      onLeaveRoom={onExit}
      onToggleReady={noop}
      onStartRoom={noop}
      onQueueJoin={noop}
      onPractice={noop}
      onEndTurn={() => {
        mutate((s) => {
          if (s.activeId === "you") startTurnFor(s, "bot");
        });
      }}
      onDrawCard={() =>
        mutate((s) => {
          if (s.activeId !== "you" || s.manualDrawUsed) return;
          const c = s.you.deck.shift();
          if (c) s.you.hand.push(c);
          s.manualDrawUsed = true;
        })
      }
      onPlayCard={(cardInstanceId, _targetUserId, position) =>
        mutate((s) => {
          if (s.activeId !== "you") return;
          const idx = s.you.hand.findIndex((c) => c.instanceId === cardInstanceId);
          if (idx < 0) return;
          const card = s.you.hand[idx];
          if (card.cost > s.you.mana) return;
          s.you.mana -= card.cost;
          s.you.hand.splice(idx, 1);
          if (card.type === "unit") {
            s.you.board.push({ ...card, position: position ?? "attack", canAttack: false, positionChanged: false });
          } else {
            // simple spell: 2 damage to the bot
            s.bot.health = Math.max(0, s.bot.health - 2);
            s.you.discard.push(card);
          }
        })
      }
      onSetPosition={(cardInstanceId, position) =>
        mutate((s) => {
          const unit = s.you.board.find((c) => c.instanceId === cardInstanceId);
          if (unit && !unit.positionChanged) {
            unit.position = position;
            unit.positionChanged = true;
          }
        })
      }
      onAttackPlayer={(attackerCardInstanceId, _targetUserId, targetCardInstanceId) => {
        mutate((s) => {
          if (s.activeId !== "you") return;
          const attacker = s.you.board.find((c) => c.instanceId === attackerCardInstanceId);
          if (!attacker || !attacker.canAttack || attacker.position !== "attack") return;
          const target = targetCardInstanceId ? s.bot.board.find((c) => c.instanceId === targetCardInstanceId) ?? null : null;
          resolveAttack(attacker, s.you, target, s.bot);
        });
      }}
      onConcede={onExit}
      onTilt={noop}
      onTiltReset={noop}
    />
  );
}
