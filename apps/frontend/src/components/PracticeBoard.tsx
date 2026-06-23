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
  spellZone: RoomCard[];
};

type PState = {
  players: PPlayer[]; // players[0] is always "you"; the rest are bots
  order: string[]; // userIds in turn order
  activeId: string;
  turn: number;
  manualDrawUsed: boolean;
  winnerId: string | null;
};

// Distinct faction/avatar/name per practice bot so the multiplayer table is varied.
const BOT_PROFILES: { characterId: string; avatarId: string; username: string }[] = [
  { characterId: "void-ranger", avatarId: "avatar-07", username: "Void Bot" },
  { characterId: "ember-arcanist", avatarId: "avatar-12", username: "Ember Bot" },
  { characterId: "ironbound-beastmaster", avatarId: "avatar-19", username: "Beast Bot" },
  { characterId: "chronomancer", avatarId: "avatar-23", username: "Chrono Bot" },
  { characterId: "abyss-revenant", avatarId: "avatar-04", username: "Abyss Bot" }
];

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
  archetype?: string;
  spellText?: string;
  spell?: SpellInfo;
};

type SpellInfo = {
  archetype?: string;
  atk?: number;
  def?: number;
  damage?: number;
  life?: number;
  heal?: number;
  draw?: number;
  mana?: number;
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
    positionChanged: false,
    archetype: card.archetype ?? card.spell?.archetype,
    spellText: card.spellText ?? card.description
  };
}

function makePlayer(userId: string, username: string, avatarId: string, characterId: string, pool: ApiCard[]): PPlayer {
  const deck = shuffle(pool).slice(0, DECK_SIZE).map((c, i) => toRoomCard(c, userId, i));
  const hand = deck.splice(0, HAND_SIZE);
  return { userId, username, avatarId, characterId, health: START_HP, mana: 0, maxMana: 1, board: [], hand, deck, discard: [], spellZone: [] };
}

// Deep-ish clone so React sees new refs.
function clone(s: PState): PState {
  const cp = (p: PPlayer): PPlayer => ({
    ...p,
    board: p.board.map((c) => ({ ...c })),
    hand: p.hand.map((c) => ({ ...c })),
    deck: p.deck.map((c) => ({ ...c })),
    discard: p.discard.map((c) => ({ ...c })),
    spellZone: p.spellZone.map((c) => ({ ...c }))
  });
  return { ...s, players: s.players.map(cp) };
}

function byId(s: PState, id: string): PPlayer | undefined {
  return s.players.find((p) => p.userId === id);
}

function checkWinner(s: PState) {
  const alive = s.players.filter((p) => p.health > 0);
  if (alive.length <= 1) {
    s.winnerId = alive[0]?.userId ?? null;
  }
}

// Next living player after `id` in turn order (cyclic).
function nextAliveAfter(s: PState, id: string): string {
  const start = s.order.indexOf(id);
  for (let step = 1; step <= s.order.length; step += 1) {
    const cand = s.order[(start + step) % s.order.length];
    if ((byId(s, cand)?.health ?? 0) > 0) return cand;
  }
  return id;
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
  const [playerCount, setPlayerCount] = useState(2);
  const botTimer = useRef<number | null>(null);
  const spellBySlug = useRef<Record<string, SpellInfo>>({});
  const poolRef = useRef<ApiCard[]>([]);

  // Build a fresh game with `count` total players (you + bots).
  const buildGame = (count: number) => {
    const pool = poolRef.current;
    if (pool.length === 0) return;
    const you = makePlayer("you", "You", "avatar-01", "riftforged-sentinel", pool);
    you.mana = 1;
    const bots = BOT_PROFILES.slice(0, count - 1).map((b, i) =>
      makePlayer(`bot${i + 1}`, b.username, b.avatarId, b.characterId, pool)
    );
    const players = [you, ...bots];
    setState({
      players,
      order: players.map((p) => p.userId),
      activeId: "you",
      turn: 1,
      manualDrawUsed: false,
      winnerId: null
    });
  };

  // Load the card pool once, then start a 2-player game.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/cards`);
        const data = (await res.json()) as { cards: ApiCard[] };
        spellBySlug.current = Object.fromEntries(
          data.cards.filter((c) => c.spell?.archetype).map((c) => [c.slug, c.spell as SpellInfo])
        );
        const playable = data.cards.filter((c) => c.slug && (c.type === "unit" || c.type === "spell"));
        const spells = playable.filter((c) => c.type === "spell");
        const units = playable.filter((c) => c.type === "unit");
        if (!active) return;
        // Mix in spells so they can be drawn and tested (units + every spell, repeated a bit).
        poolRef.current = playable.length ? [...units, ...spells, ...spells, ...spells] : playable;
        buildGame(2);
      } catch {
        if (active) setError("Could not load cards for practice.");
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setCount = (n: number) => {
    setPlayerCount(n);
    buildGame(n);
  };

  const mutate = (fn: (s: PState) => void) => {
    setState((prev) => {
      if (!prev || prev.winnerId) return prev;
      const next = clone(prev);
      fn(next);
      checkWinner(next);
      return next;
    });
  };

  const startTurnFor = (s: PState, who: string) => {
    s.activeId = who;
    s.turn += 1;
    s.manualDrawUsed = false;
    const p = byId(s, who);
    if (!p) return;
    p.maxMana = Math.min(10, p.maxMana + 1);
    p.mana = p.maxMana;
    p.board = p.board.map((c) => ({ ...c, canAttack: true, positionChanged: false }));
  };

  // Each bot plays automatically on its turn, then passes to the next player.
  useEffect(() => {
    if (!state || state.winnerId || state.activeId === "you") return;
    botTimer.current = window.setTimeout(() => {
      setState((prev) => {
        if (!prev || prev.winnerId || prev.activeId === "you") return prev;
        const s = clone(prev);
        const bot = byId(s, s.activeId);
        if (!bot) return prev;
        const drawn = bot.deck.shift();
        if (drawn) bot.hand.push(drawn);
        // play affordable units cheapest-first
        const affordable = bot.hand.filter((c) => c.type === "unit").sort((a, b) => a.cost - b.cost);
        for (const card of affordable) {
          if (card.cost <= bot.mana && bot.board.length < 6) {
            bot.mana -= card.cost;
            bot.hand = bot.hand.filter((c) => c.instanceId !== card.instanceId);
            bot.board.push({ ...card, position: "attack", canAttack: false });
          }
        }
        // Free-for-all: each attack hits a RANDOM living opponent (could be you
        // OR another bot), so it never feels like everyone ganging up on you.
        const pick = <T,>(arr: T[]): T | null => (arr.length ? arr[Math.floor(Math.random() * arr.length)] : null);
        for (const unit of bot.board) {
          if (!unit.canAttack || unit.position !== "attack") continue;
          const foes = s.players.filter((p) => p.userId !== bot.userId && p.health > 0);
          if (foes.length === 0) break;
          // Prefer foes that have units (real combat); otherwise a free hit to the face.
          const defenders = foes.filter((f) => f.board.length > 0);
          const foe = pick(defenders.length ? defenders : foes);
          if (!foe) break;
          const target = foe.board.find((c) => c.position === "attack") ?? foe.board[0] ?? null;
          resolveAttack(unit, bot, target, foe);
          checkWinner(s);
          if (s.winnerId) break;
        }
        if (!s.winnerId) startTurnFor(s, nextAliveAfter(s, s.activeId));
        return s;
      });
    }, 1000);
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
      discard: p.discard,
      mana: p.mana,
      maxMana: p.maxMana,
      board: p.board,
      spellZone: p.spellZone
    });
    return {
      roomCode: "SOLO",
      hostUserId: "you",
      hostMode: "play",
      maxPlayers: state.players.length,
      status: "in_game",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      battle: {
        turn: state.turn,
        activePlayerId: state.activeId,
        playerOrder: state.order,
        turnDeadlineAt: new Date(Date.now() + 3_600_000).toISOString(),
        winnerId: state.winnerId,
        manualDrawUsed: state.manualDrawUsed
      },
      players: state.players.map(pub)
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
    <>
      <div className="practice-players" role="group" aria-label="Practice player count">
        <span className="practice-players-label">Players</span>
        {[2, 3, 4, 5, 6].map((n) => (
          <button
            key={n}
            type="button"
            className={`practice-players-btn ${playerCount === n ? "active" : ""}`}
            onClick={() => setCount(n)}
            title={`Practice with ${n} players`}
          >
            {n}
          </button>
        ))}
      </div>
    <GameBoard
      currentUserId="you"
      socketConnected
      activeMatchState={null}
      decks={[]}
      selectedDeckId="practice"
      selectedCharacterId="riftforged-sentinel"
      roomCodeInput="SOLO"
      roomMaxPlayers={state.players.length}
      hostMode="play"
      animationPreset="balanced"
      tabletopMode
      currentRoom={room}
      privateHand={state.players[0].hand}
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
          if (s.activeId === "you") startTurnFor(s, nextAliveAfter(s, "you"));
        });
      }}
      onDrawCard={() =>
        mutate((s) => {
          if (s.activeId !== "you" || s.manualDrawUsed) return;
          const me = s.players[0];
          const c = me.deck.shift();
          if (c) me.hand.push(c);
          s.manualDrawUsed = true;
        })
      }
      onPlayCard={(cardInstanceId, _targetUserId, position) =>
        mutate((s) => {
          if (s.activeId !== "you") return;
          const me = s.players[0];
          const idx = me.hand.findIndex((c) => c.instanceId === cardInstanceId);
          if (idx < 0) return;
          const card = me.hand[idx];
          if (card.cost > me.mana) return;
          me.mana -= card.cost;
          me.hand.splice(idx, 1);
          if (card.type === "unit") {
            me.board.push({ ...card, position: position ?? "attack", canAttack: false, positionChanged: false });
          } else {
            // Spell: resolve its archetype (mirrors the backend), auto-targeting.
            const spell = spellBySlug.current[card.slug];
            const enemies = s.players.filter((p) => p.userId !== "you" && p.health > 0);
            const strongestOwn = me.board.length ? me.board.reduce((b, u) => (u.attack > b.attack ? u : b)) : null;
            // Strongest enemy unit across every opponent.
            let topOwner: PPlayer | null = null;
            let topUnit: RoomCard | null = null;
            for (const e of enemies) for (const u of e.board) if (!topUnit || u.attack > topUnit.attack) { topUnit = u; topOwner = e; }
            const destroy = (owner: PPlayer, u: RoomCard) => {
              owner.board = owner.board.filter((c) => c.instanceId !== u.instanceId);
              owner.discard.push(u);
            };
            switch (spell?.archetype) {
              case "empower":
                if (strongestOwn) { strongestOwn.attack += spell.atk ?? 0; strongestOwn.health += spell.def ?? 0; }
                break;
              case "rally":
                me.board.forEach((u) => { u.attack += spell.atk ?? 0; u.health += spell.def ?? 0; });
                break;
              case "strike":
                if (topUnit && topOwner) { topUnit.health -= spell.damage ?? 0; if (topUnit.health <= 0) destroy(topOwner, topUnit); }
                break;
              case "volley":
                enemies.forEach((e) => [...e.board].forEach((u) => { u.health -= spell?.damage ?? 0; if (u.health <= 0) destroy(e, u); }));
                break;
              case "tradeoff":
                if (strongestOwn) { strongestOwn.attack += spell.atk ?? 0; strongestOwn.health += spell.def ?? 0; }
                me.health = Math.max(0, me.health - (spell.life ?? 0));
                break;
              default:
                if (spell?.heal) me.health = Math.min(START_HP, me.health + spell.heal);
                if (spell?.mana) me.mana = Math.min(10, me.mana + spell.mana);
                break;
            }
            me.discard.push(card);
          }
        })
      }
      onSetPosition={(cardInstanceId, position) =>
        mutate((s) => {
          const unit = s.players[0].board.find((c) => c.instanceId === cardInstanceId);
          if (unit && !unit.positionChanged) {
            unit.position = position;
            unit.positionChanged = true;
          }
        })
      }
      onAttackPlayer={(attackerCardInstanceId, targetUserId, targetCardInstanceId) => {
        mutate((s) => {
          if (s.activeId !== "you") return;
          const me = s.players[0];
          const attacker = me.board.find((c) => c.instanceId === attackerCardInstanceId);
          if (!attacker || !attacker.canAttack || attacker.position !== "attack") return;
          const defOwner = byId(s, targetUserId);
          if (!defOwner) return;
          const target = targetCardInstanceId ? defOwner.board.find((c) => c.instanceId === targetCardInstanceId) ?? null : null;
          resolveAttack(attacker, me, target, defOwner);
        });
      }}
      onConcede={onExit}
      onTilt={noop}
      onTiltReset={noop}
    />
    </>
  );
}
