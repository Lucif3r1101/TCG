import { MouseEvent as ReactMouseEvent, Suspense, SyntheticEvent, lazy, useEffect, useRef, useState } from "react";
import {
  CARD_BACK_ASSET_PATH,
  CHARACTER_CLASSES,
  DECK_BACK_ASSET_PATH,
  getAvatarAssetPath,
  getAvatarFallbackPath,
  getIconAssetPath
} from "../constants/game";
import { DeckSummary, MatchState, RoomActionEvent, RoomCard, RoomState } from "../types/game";
import { formatTimer } from "../lib/api";
import { getCardArtSources, handleCardArtError, getCrestSource, getRealmSource } from "../lib/cardArt";
import { CardDetailModal, DetailCard } from "./CardDetailModal";

// Lottie is heavy; load the victory overlay only when a match actually ends.
const VictoryOverlay = lazy(() => import("./VictoryOverlay").then((m) => ({ default: m.VictoryOverlay })));
const Battlefield3DLive = lazy(() => import("./three/Battlefield3DLive"));

// True if the browser can run WebGL — gate the 3D board so weak/old devices
// fall back to the CSS board instead of a blank canvas.
function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(window.WebGLRenderingContext && (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")));
  } catch {
    return false;
  }
}

type GameBoardProps = {
  currentUserId: string;
  socketConnected: boolean;
  activeMatchState: MatchState | null;
  decks: DeckSummary[];
  selectedDeckId: string;
  selectedCharacterId: string;
  roomCodeInput: string;
  roomMaxPlayers: number;
  hostMode: "play" | "manage";
  animationPreset: "subtle" | "balanced" | "cinematic";
  tabletopMode: boolean;
  currentRoom: RoomState | null;
  privateHand: RoomCard[];
  roomAction: RoomActionEvent | null;
  meReady: boolean;
  isInRoom: boolean;
  isRoomHost: boolean;
  onDeckChange: (value: string) => void;
  onCharacterChange: (value: string) => void;
  onRoomCodeInput: (value: string) => void;
  onRoomMaxPlayersChange: (value: number) => void;
  onHostModeChange: (value: "play" | "manage") => void;
  onAnimationPresetChange: (value: "subtle" | "balanced" | "cinematic") => void;
  onCreateRoom: () => void;
  onJoinRoom: () => void;
  onJoinAsHostPlayer: () => void;
  onLeaveRoom: () => void;
  onToggleReady: () => void;
  onStartRoom: () => void;
  onQueueJoin: () => void;
  onPractice: () => void;
  onEndTurn: () => void;
  onDrawCard: () => void;
  onPlayCard: (cardInstanceId: string, targetUserId?: string, position?: "attack" | "defense") => void;
  onSetPosition: (cardInstanceId: string, position: "attack" | "defense") => void;
  onAttackPlayer: (attackerCardInstanceId: string, targetUserId: string, targetCardInstanceId?: string) => void;
  onConcede: () => void;
  onTilt: (event: ReactMouseEvent<HTMLElement>) => void;
  onTiltReset: (event: ReactMouseEvent<HTMLElement>) => void;
};

type SeatLayout = {
  left: string;
  top: string;
  transform: string;
};

type DefeatedSignal = {
  id: string;
  playerUserId: string;
  cardName: string;
};

const TABLE_ANGLES: Record<number, number[]> = {
  2: [-90, 90],
  3: [-90, 30, 150],
  4: [-90, 0, 90, 180],
  5: [-90, -24, 34, 146, 204],
  6: [-90, -34, 22, 90, 158, 214]
};

function handleAvatarError(event: SyntheticEvent<HTMLImageElement, Event>, avatarId: string) {
  const image = event.currentTarget;

  if (image.dataset.fallbackApplied === "true") {
    return;
  }

  image.dataset.fallbackApplied = "true";
  image.src = getAvatarFallbackPath(avatarId);
}

function getSeatLayouts(seatCount: number): SeatLayout[] {
  const count = Math.max(2, seatCount);
  const centerX = 50;
  const centerY = 50;
  const radiusX = count === 2 ? 0 : count === 3 ? 34 : count === 4 ? 38 : count === 5 ? 40 : 42;
  const radiusY = count === 2 ? 39 : count === 3 ? 34 : count === 4 ? 35 : count === 5 ? 37 : 39;
  const angles = TABLE_ANGLES[count] ?? TABLE_ANGLES[6];

  return angles.map((degree) => {
    const angle = degree * (Math.PI / 180);
    const x = centerX + radiusX * Math.cos(angle);
    const y = centerY + radiusY * Math.sin(angle);
    return {
      left: `${x}%`,
      top: `${y}%`,
      transform: "translate(-50%, -50%)"
    };
  });
}

function renderLobby(props: GameBoardProps) {
  const {
    currentUserId,
    socketConnected,
    decks,
    selectedDeckId,
    selectedCharacterId,
    roomCodeInput,
    roomMaxPlayers,
    hostMode,
    animationPreset,
    currentRoom,
    meReady,
    isInRoom,
    isRoomHost,
    onDeckChange,
    onCharacterChange,
    onRoomCodeInput,
    onRoomMaxPlayersChange,
    onHostModeChange,
    onAnimationPresetChange,
    onCreateRoom,
    onJoinRoom,
    onJoinAsHostPlayer,
    onLeaveRoom,
    onToggleReady,
    onStartRoom,
    onQueueJoin,
    onPractice,
    onTilt,
    onTiltReset
  } = props;

  const inRoom = Boolean(currentRoom);

  return (
    <div className="lobby">
      <section className="lobby-controls">
        <header className="lobby-head">
          <h3>{inRoom ? "Room Lobby" : "Play"}</h3>
          <p className="muted">
            {inRoom ? "Pick your champion, ready up, and wait for the host to start." : "Create a room, join with a code, or jump into quick matchmaking."}
          </p>
        </header>

        <label className="label">
          Your Deck
          <select className="select" value={selectedDeckId} onChange={(e) => onDeckChange(e.target.value)}>
            <option value="">Select a deck</option>
            {decks.map((deck) => (
              <option key={deck.id} value={deck.id}>{deck.name}</option>
            ))}
          </select>
        </label>

        {!inRoom ? (
          <>
            <div className="lobby-field-row">
              <label className="label">
                Players
                <select className="select" value={roomMaxPlayers} onChange={(e) => onRoomMaxPlayersChange(Number(e.target.value))}>
                  {[2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>{n} Players</option>
                  ))}
                </select>
              </label>
              <div className="label">
                Host Mode
                <div className="host-mode-toggle" role="group" aria-label="Host mode">
                  <button className={`button ${hostMode === "play" ? "primary" : ""}`} type="button" onClick={() => onHostModeChange("play")}>
                    Host + Play
                  </button>
                  <button className={`button ${hostMode === "manage" ? "primary" : ""}`} type="button" onClick={() => onHostModeChange("manage")}>
                    Host Only
                  </button>
                </div>
              </div>
            </div>

            <div className="lobby-actions">
              <button className="button primary lobby-cta" type="button" onClick={onCreateRoom} disabled={!selectedDeckId || !socketConnected}>
                <img className="button-icon" src={getIconAssetPath("icon-host")} alt="" aria-hidden="true" />
                Create Room
              </button>
              <button className="button lobby-cta" type="button" onClick={onQueueJoin} disabled={!socketConnected || !selectedDeckId}>
                <img className="button-icon" src={getIconAssetPath("icon-room")} alt="" aria-hidden="true" />
                Quick Queue
              </button>
              <button className="button lobby-cta" type="button" onClick={onPractice}>
                <img className="button-icon" src={getIconAssetPath("icon-unit")} alt="" aria-hidden="true" />
                Practice vs Bot
              </button>
            </div>

            <div className="lobby-join">
              <input className="input" placeholder="Enter room code" value={roomCodeInput} onChange={(e) => onRoomCodeInput(e.target.value)} />
              <button className="button" type="button" onClick={onJoinRoom} disabled={!selectedDeckId || !roomCodeInput || !socketConnected}>
                Join
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="room-banner">
              <div>
                <span className="muted room-banner-label">Room Code</span>
                <strong className="room-code">{currentRoom?.roomCode}</strong>
              </div>
              <div className="room-banner-meta">
                <span className="status-pill">{currentRoom?.players.length}/{currentRoom?.maxPlayers} players</span>
                <span className="status-pill">{currentRoom?.hostMode === "manage" ? "Host Only" : "Host + Play"}</span>
              </div>
            </div>

            <div className="roster">
              {currentRoom?.players.map((player) => {
                const character = CHARACTER_CLASSES.find((c) => c.id === player.characterId);
                return (
                  <div key={player.userId} className={`roster-row ${player.ready ? "is-ready" : ""}`}>
                    <img
                      className="roster-avatar"
                      src={getAvatarAssetPath(player.avatarId)}
                      alt=""
                      onError={(e) => handleAvatarError(e, player.avatarId)}
                    />
                    <div className="roster-info">
                      <strong>{player.username}{player.userId === currentUserId ? " (you)" : ""}</strong>
                      <span className="muted">{character?.name ?? "Choosing…"}</span>
                    </div>
                    <span className={`roster-badge ${player.ready ? "ready" : ""}`}>{player.ready ? "Ready" : "Not ready"}</span>
                  </div>
                );
              })}
            </div>

            <div className="lobby-actions">
              <button className="button primary lobby-cta" type="button" onClick={onToggleReady}>
                <img className="button-icon" src={getIconAssetPath("icon-shield")} alt="" aria-hidden="true" />
                {meReady ? "Unready" : "Ready Up"}
              </button>
              {isRoomHost ? (
                <button className="button lobby-cta" type="button" onClick={onStartRoom}>
                  <img className="button-icon" src={getIconAssetPath("icon-host")} alt="" aria-hidden="true" />
                  Start Duel
                </button>
              ) : null}
            </div>
            <button className="button lobby-leave" type="button" onClick={onLeaveRoom}>
              <img className="button-icon" src={getIconAssetPath("icon-logout")} alt="" aria-hidden="true" />
              Leave Room
            </button>
          </>
        )}

        <label className="label lobby-advanced">
          Table Animation
          <select
            className="select"
            value={animationPreset}
            onChange={(e) => onAnimationPresetChange(e.target.value as "subtle" | "balanced" | "cinematic")}
          >
            <option value="subtle">Subtle</option>
            <option value="balanced">Balanced</option>
            <option value="cinematic">Cinematic</option>
          </select>
        </label>
      </section>

      <section className="lobby-characters">
        <header className="lobby-head">
          <h3>Choose your champion</h3>
          <p className="muted">Each realm plays differently. {selectedCharacterId ? "" : "Tap one to select."}</p>
        </header>
        <div className="class-grid">
          {CHARACTER_CLASSES.map((character) => {
            const takenByOther = (currentRoom?.players ?? []).some(
              (player) => player.userId !== currentUserId && player.characterId === character.id
            );
            return (
              <article
                key={character.id}
                className={`class-card ${selectedCharacterId === character.id ? "selected-character" : ""} ${takenByOther ? "character-locked" : ""}`}
                style={{
                  backgroundImage: `linear-gradient(to bottom, rgba(8,14,27,0.58), rgba(8,14,27,0.93)), url(/assets/realms/${character.id}.jpg)`
                }}
                onClick={() => {
                  if (!takenByOther) {
                    onCharacterChange(character.id);
                  }
                }}
                onMouseMove={onTilt}
                onMouseLeave={onTiltReset}
              >
                <div className="class-card-head">
                  <img className="crest-icon" src={character.crest} alt="" aria-hidden="true" />
                  <span className="chip">{character.tag}</span>
                </div>
                <img className="class-sprite" src={character.sprite} alt={`${character.name} card sprite`} loading="lazy" />
                <strong>{character.name}</strong>
                <p>{character.deckStyle}</p>
                {takenByOther ? <small className="error">Taken by another player</small> : null}
                <small>{character.ability}</small>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function TabletopBoard(props: GameBoardProps) {
  const {
    activeMatchState,
    currentRoom,
    privateHand,
    roomAction,
    meReady,
    isInRoom,
    isRoomHost,
    onToggleReady,
    onJoinAsHostPlayer,
    onStartRoom,
    onLeaveRoom,
    onEndTurn,
    onPlayCard,
    onSetPosition,
    onDrawCard,
    onAttackPlayer,
    onConcede,
    onTilt,
    onTiltReset,
    animationPreset
  } = props;
  const battle = currentRoom?.battle;
  const timer = battle?.turnDeadlineAt ?? activeMatchState?.turnDeadlineAt;
  const seatPositions = ["top", "top-right", "bottom-right", "bottom", "bottom-left", "top-left"] as const;
  const [turnShift, setTurnShift] = useState(false);
  // 3D board toggle, remembered per device. Only enabled where WebGL works.
  const [use3D, setUse3D] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("rift_board_3d") === "1" && supportsWebGL();
  });
  const toggle3D = () => {
    setUse3D((prev) => {
      const next = !prev && supportsWebGL();
      try { localStorage.setItem("rift_board_3d", next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
  };
  const [selectedBoardCardId, setSelectedBoardCardId] = useState<string | null>(null);
  const [hoveredTargetPlayerId, setHoveredTargetPlayerId] = useState<string | null>(null);
  const [actionHistory, setActionHistory] = useState<RoomActionEvent[]>([]);
  const [defeatedSignals, setDefeatedSignals] = useState<DefeatedSignal[]>([]);
  const [floatDmg, setFloatDmg] = useState<{ id: string; amount: number; mine: boolean }[]>([]);
  const prevHealthRef = useRef<Record<string, number>>({});
  const [fx, setFx] = useState<{ id: string; kind: "slash" | "shield" } | null>(null);
  const [shake, setShake] = useState(false);
  const [drawFly, setDrawFly] = useState(false);
  const [graveyardOwner, setGraveyardOwner] = useState<string | null>(null);
  const [detailCard, setDetailCard] = useState<DetailCard | null>(null);
  const [lungeId, setLungeId] = useState<string | null>(null);
  const [flipId, setFlipId] = useState<string | null>(null);
  const [turnBanner, setTurnBanner] = useState<{ text: string; mine: boolean } | null>(null);
  const [attackLine, setAttackLine] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [attackInfo, setAttackInfo] = useState<{ attacker: string; target: string } | null>(null);
  const [clash, setClash] = useState<{ slug: string; name: string; fx: "slash" | "shield"; label: string; tone: "destroy" | "reduce" | "block" } | null>(null);
  const lastActiveRef = useRef<string | null>(null);
  const [showCoach, setShowCoach] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("tcg-board-coach-v1") !== "seen";
  });

  const dismissCoach = () => {
    setShowCoach(false);
    try {
      localStorage.setItem("tcg-board-coach-v1", "seen");
    } catch {
      // ignore storage errors
    }
  };
  const lastTurnRef = useRef<number | null>(null);
  const previousBoardsRef = useRef<Record<string, RoomCard[]>>({});
  const turnKey = battle?.turn ?? activeMatchState?.turn ?? null;
  const activePlayerId = battle?.activePlayerId ?? activeMatchState?.activePlayerId;
  const seatLayouts = getSeatLayouts(currentRoom?.maxPlayers ?? 6);
  const activeSeatIndex =
    activePlayerId && currentRoom ? currentRoom.players.findIndex((player) => player.userId === activePlayerId) : -1;
  const me = currentRoom?.players.find((player) => player.userId === props.currentUserId) ?? null;
  const isMyTurn = Boolean(activePlayerId) && activePlayerId === props.currentUserId;
  const opponents = (currentRoom?.players ?? []).filter((player) => player.userId !== props.currentUserId);
  // Backdrop the battlefield with the local player's realm art (derived from
  // any of their cards' slugs), falling back to neutral arena key art.
  const realmSlug = privateHand[0]?.slug ?? me?.board[0]?.slug ?? "";
  const realmBg = getRealmSource(realmSlug) || "/assets/branding/hero-key-art.jpg";
  const possibleTargets = opponents.filter((player) => player.health > 0);
  const activePlayerName = activePlayerId
    ? currentRoom?.players.find((player) => player.userId === activePlayerId)?.username ?? "Player"
    : null;
  const actorPlayer = roomAction ? currentRoom?.players.find((player) => player.userId === roomAction.actorUserId) ?? null : null;
  const winnerId = battle?.winnerId ?? activeMatchState?.winnerId ?? null;
  const winnerName = winnerId ? currentRoom?.players.find((player) => player.userId === winnerId)?.username ?? "Your opponent" : "";
  const iWon = Boolean(winnerId) && winnerId === props.currentUserId;
  const actorSeatIndex =
    roomAction && currentRoom ? currentRoom.players.findIndex((player) => player.userId === roomAction.actorUserId) : -1;
  const actorSeatPosition = actorSeatIndex >= 0 ? seatPositions[actorSeatIndex] ?? "top" : "top";
  const actorIsMe = Boolean(roomAction?.actorUserId && roomAction.actorUserId === props.currentUserId);
  const targetPlayer = roomAction?.targetUserId
    ? currentRoom?.players.find((player) => player.userId === roomAction.targetUserId) ?? null
    : null;
  const boardTopSummary = targetPlayer ?? opponents[0] ?? null;
  const targetSeatIndex =
    targetPlayer && currentRoom ? currentRoom.players.findIndex((player) => player.userId === targetPlayer.userId) : -1;
  const targetSeatPosition = targetSeatIndex >= 0 ? seatPositions[targetSeatIndex] ?? "top" : null;
  const actionDestinationClass = roomAction
    ? roomAction.actionType === "draw"
      ? actorIsMe
        ? "to-self-hand"
        : "to-opponent-lane"
      : roomAction.actionType === "play"
        ? actorIsMe
          ? "to-self-lane"
          : "to-opponent-lane"
        : "to-center"
    : "to-center";
  const selectedOwnBoardCard = me?.board.find((card) => card.instanceId === selectedBoardCardId) ?? null;
  const selectedOpponentBoardCard =
    opponents.flatMap((player) => player.board).find((card) => card.instanceId === selectedBoardCardId) ?? null;
  const selectedAnyBoardCard = selectedOwnBoardCard ?? selectedOpponentBoardCard;
  const hoveredTargetPlayer = hoveredTargetPlayerId
    ? currentRoom?.players.find((player) => player.userId === hoveredTargetPlayerId) ?? null
    : null;
  const hoveredTargetSeatIndex =
    hoveredTargetPlayer && currentRoom ? currentRoom.players.findIndex((player) => player.userId === hoveredTargetPlayer.userId) : -1;
  const hoveredTargetSeatPosition = hoveredTargetSeatIndex >= 0 ? seatPositions[hoveredTargetSeatIndex] ?? null : null;
  const latestActionLabel = roomAction
    ? roomAction.actionType === "draw"
      ? `${roomAction.actorUsername} drew ${roomAction.card?.name ?? "a card"}`
      : roomAction.actionType === "play"
        ? `${roomAction.actorUsername} used ${roomAction.card?.name ?? "a card"}${targetPlayer ? ` on ${targetPlayer.username}` : ""}`
        : roomAction.actionType === "attack"
          ? `${roomAction.actorUsername} attacked ${roomAction.targetCardName ?? targetPlayer?.username ?? "a target"} with ${roomAction.card?.name ?? "a unit"} for ${roomAction.amount ?? roomAction.card?.attack ?? 0}`
        : `${roomAction.actorUsername} ended the turn`
    : currentRoom?.status === "in_game"
      ? "Battle live. Watch the board state update in real time."
      : "Lobby ready. Seats, decks, and characters lock in here before battle.";

  useEffect(() => {
    if (!turnKey) {
      return;
    }
    if (lastTurnRef.current === null) {
      lastTurnRef.current = turnKey;
      return;
    }
    if (lastTurnRef.current !== turnKey) {
      setTurnShift(true);
      const id = window.setTimeout(() => setTurnShift(false), 640);
      lastTurnRef.current = turnKey;
      return () => window.clearTimeout(id);
    }
    return;
  }, [turnKey]);

  useEffect(() => {
    if (!roomAction) {
      return;
    }
    setActionHistory((previous) => [roomAction, ...previous].slice(0, 6));
  }, [roomAction]);

  useEffect(() => {
    if (!currentRoom) {
      previousBoardsRef.current = {};
      setDefeatedSignals([]);
      return;
    }

    const nextBoards = Object.fromEntries(currentRoom.players.map((player) => [player.userId, player.board]));
    const removed: DefeatedSignal[] = [];

    for (const player of currentRoom.players) {
      const previousBoard = previousBoardsRef.current[player.userId] ?? [];
      const currentIds = new Set(player.board.map((card) => card.instanceId));
      for (const previousCard of previousBoard) {
        if (!currentIds.has(previousCard.instanceId)) {
          removed.push({
            id: `${player.userId}-${previousCard.instanceId}-${Date.now()}`,
            playerUserId: player.userId,
            cardName: previousCard.name
          });
        }
      }
    }

    previousBoardsRef.current = nextBoards;

    if (removed.length === 0) {
      return;
    }

    setDefeatedSignals((previous) => [...removed, ...previous].slice(0, 6));
    const timeoutId = window.setTimeout(() => {
      setDefeatedSignals((previous) => previous.filter((signal) => !removed.some((entry) => entry.id === signal.id)));
    }, 1600);

    return () => window.clearTimeout(timeoutId);
  }, [currentRoom]);

  // Big floating damage numbers whenever any player's life points drop (works for
  // your attacks AND incoming attacks).
  useEffect(() => {
    if (!currentRoom) {
      prevHealthRef.current = {};
      return;
    }
    const next: { id: string; amount: number; mine: boolean }[] = [];
    for (const player of currentRoom.players) {
      const prev = prevHealthRef.current[player.userId];
      if (prev !== undefined && player.health < prev) {
        next.push({
          id: `${player.userId}-${prev}-${player.health}`,
          amount: prev - player.health,
          mine: player.userId === props.currentUserId
        });
      }
      prevHealthRef.current[player.userId] = player.health;
    }
    if (next.length === 0) return;
    setFloatDmg((cur) => [...cur, ...next].slice(-4));
    const t = window.setTimeout(() => {
      setFloatDmg((cur) => cur.filter((d) => !next.some((n) => n.id === d.id)));
    }, 1100);
    return () => window.clearTimeout(t);
  }, [currentRoom, props.currentUserId]);

  // Turn-change banner sweep when the active player changes.
  useEffect(() => {
    if (!battle || currentRoom?.status !== "in_game" || !activePlayerId) return;
    if (lastActiveRef.current === activePlayerId) return;
    const first = lastActiveRef.current === null;
    lastActiveRef.current = activePlayerId;
    if (first) return; // don't sweep on initial mount
    const mine = activePlayerId === props.currentUserId;
    setTurnBanner({ text: mine ? "Your Turn" : `${activePlayerName ?? "Opponent"}'s Turn`, mine });
    const t = window.setTimeout(() => setTurnBanner(null), 1500);
    return () => window.clearTimeout(t);
  }, [activePlayerId, battle, currentRoom?.status, activePlayerName, props.currentUserId]);

  const attacker = isMyTurn && selectedOwnBoardCard?.canAttack && selectedOwnBoardCard.position !== "defense" ? selectedOwnBoardCard : null;
  const enemyUnits = opponents.flatMap((player) => player.board.map((unit) => ({ owner: player, unit })));
  const ZONES = 5;
  const enemyZoneCount = Math.max(ZONES, enemyUnits.length);
  const myZoneCount = Math.max(ZONES, me?.board.length ?? 0);
  // Draw a glowing beam from the attacking card to whatever it's striking, so
  // it's always clear which unit is hitting which target.
  const drawAttackLine = (attackerId: string, targetSelector: string) => {
    if (typeof document === "undefined") return;
    const a = document.querySelector(`[data-cardid="${attackerId}"]`)?.getBoundingClientRect();
    const t = document.querySelector(targetSelector)?.getBoundingClientRect();
    if (!a || !t) return;
    setAttackLine({
      x1: a.left + a.width / 2,
      y1: a.top + a.height / 2,
      x2: t.left + t.width / 2,
      y2: t.top + t.height / 2
    });
    window.setTimeout(() => setAttackLine(null), 900);
  };
  const fireFx = (id: string, kind: "slash" | "shield", targetSelector: string) => {
    if (attacker) {
      setLungeId(attacker.instanceId);
      window.setTimeout(() => setLungeId(null), 360);
      drawAttackLine(attacker.instanceId, targetSelector);
    }
    // FX lands a beat after the lunge connects
    window.setTimeout(() => setFx({ id, kind }), 240);
    window.setTimeout(() => setShake(true), 300);
    window.setTimeout(() => setShake(false), 640);
    window.setTimeout(() => setFx(null), 1050);
  };
  // Show the big center-stage clash so the result is never cropped by the
  // tilted battlefield. `fx`/`tone` drive the burst + caption.
  const showClash = (fx: "slash" | "shield", label: string, tone: "destroy" | "reduce" | "block") => {
    if (!attacker) return;
    setClash({ slug: attacker.slug, name: attacker.name, fx, label, tone });
    window.setTimeout(() => setClash(null), 1300);
  };
  const strikePlayer = (targetUserId: string, health: number) => {
    if (attacker && health > 0) {
      const target = opponents.find((p) => p.userId === targetUserId);
      setAttackInfo({ attacker: attacker.name, target: target?.username ?? "the enemy" });
      window.setTimeout(() => setAttackInfo(null), 1400);
      showClash("slash", `−${attacker.attack} LP`, "reduce");
      fireFx(`player-${targetUserId}`, "slash", `[data-plateid="${targetUserId}"]`);
      onAttackPlayer(attacker.instanceId, targetUserId);
      setSelectedBoardCardId(null);
    }
  };
  const strikeUnit = (targetUserId: string, unitId: string) => {
    if (!attacker) return;
    const targetUnit = opponents.find((p) => p.userId === targetUserId)?.board.find((c) => c.instanceId === unitId);
    // Predict the outcome client-side so the center animation matches what the
    // server will resolve (full data is available even though it's hidden in UI).
    let fx: "slash" | "shield" = "slash";
    let label = "Clash!";
    let tone: "destroy" | "reduce" | "block" = "destroy";
    if (targetUnit) {
      if (targetUnit.position === "defense") {
        const def = targetUnit.health;
        if (attacker.attack > def) { fx = "slash"; label = "💥 Destroyed!"; tone = "destroy"; }
        else if (attacker.attack < def) { fx = "shield"; label = `🛡 Repelled −${def - attacker.attack} LP`; tone = "reduce"; }
        else { fx = "shield"; label = "🛡 Blocked!"; tone = "block"; }
      } else {
        if (attacker.attack > targetUnit.attack) { fx = "slash"; label = "💥 Destroyed!"; tone = "destroy"; }
        else if (attacker.attack < targetUnit.attack) { fx = "slash"; label = `Repelled −${targetUnit.attack - attacker.attack} LP`; tone = "reduce"; }
        else { fx = "slash"; label = "💥 Both fall!"; tone = "destroy"; }
      }
    }
    setAttackInfo({ attacker: attacker.name, target: targetUnit?.name ?? "a unit" });
    window.setTimeout(() => setAttackInfo(null), 1400);
    showClash(fx, label, tone);
    fireFx(unitId, fx, `[data-cardid="${unitId}"]`);
    onAttackPlayer(attacker.instanceId, targetUserId, unitId);
    setSelectedBoardCardId(null);
  };
  const inGame = currentRoom?.status === "in_game";
  const turnHeading = !inGame ? "Waiting to start" : isMyTurn ? "Your turn" : `${activePlayerName ?? "Opponent"}'s turn`;
  const turnHint = !inGame
    ? "Ready up — the host starts the duel."
    : isMyTurn
      ? "Play cards, then tap a unit to attack. End Turn when done."
      : "Sit tight until it's your turn.";

  return (
    <div className="grid">
      {clash ? (
        <div className="clash-stage" aria-hidden="true">
          <div className={`clash-card clash-${clash.fx}`}>
            <img className="clash-art" src={getCardArtSources(clash.slug).primary} alt="" onError={(e) => handleCardArtError(e, clash.slug)} />
            <span className="clash-card-name">{clash.name}</span>
            <span className={`clash-burst burst-${clash.fx}`}>{clash.fx === "shield" ? "🛡" : "⚔"}</span>
          </div>
          <div className={`clash-label tone-${clash.tone}`}>{clash.label}</div>
        </div>
      ) : null}
      {attackLine ? (
        <svg className="attack-beam-layer" aria-hidden="true">
          <defs>
            <marker id="atk-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 Z" className="attack-beam-arrow" />
            </marker>
          </defs>
          <line
            x1={attackLine.x1}
            y1={attackLine.y1}
            x2={attackLine.x2}
            y2={attackLine.y2}
            className="attack-beam"
            markerEnd="url(#atk-arrow)"
          />
        </svg>
      ) : null}
      {winnerId ? (
        <Suspense fallback={null}>
          <VictoryOverlay won={iWon} winnerName={winnerName} onExit={props.onLeaveRoom} />
        </Suspense>
      ) : null}

      {turnBanner ? (
        <div className={`turn-sweep ${turnBanner.mine ? "turn-sweep-mine" : "turn-sweep-foe"}`} aria-hidden="true">
          <span>{turnBanner.text}</span>
        </div>
      ) : null}

      {detailCard ? <CardDetailModal card={detailCard} onClose={() => setDetailCard(null)} /> : null}

      {graveyardOwner ? (() => {
        const gravePlayer = currentRoom?.players.find((p) => p.userId === graveyardOwner) ?? null;
        const cards = gravePlayer?.discard ?? [];
        return (
          <div className="legal-overlay" role="dialog" aria-modal="true" onClick={() => setGraveyardOwner(null)}>
            <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
              <div className="auth-modal-head">
                <div>
                  <span className="auth-hero-kicker">Graveyard</span>
                  <h3>{gravePlayer?.userId === props.currentUserId ? "Your graveyard" : `${gravePlayer?.username ?? "Player"}'s graveyard`}</h3>
                </div>
                <button className="icon-close" type="button" onClick={() => setGraveyardOwner(null)} aria-label="Close">×</button>
              </div>
              <div className="grave-tabs">
                {currentRoom?.players.map((p) => (
                  <button
                    key={p.userId}
                    type="button"
                    className={`grave-tab ${p.userId === graveyardOwner ? "active" : ""}`}
                    onClick={() => setGraveyardOwner(p.userId)}
                  >
                    {p.userId === props.currentUserId ? "You" : p.username} ({p.discardCount})
                  </button>
                ))}
              </div>
              {cards.length === 0 ? (
                <p className="auth-hint">No cards here yet. Destroyed units and used spells go here.</p>
              ) : (
                <div className="grave-grid">
                  {cards.map((card, i) => (
                    <button key={`${card.instanceId}-${i}`} type="button" className={`grave-card rarity-${card.rarity}`} onClick={() => setDetailCard(card)} title={`${card.name} — tap for details`}>
                      <img src={getCardArtSources(card.slug).primary} alt={card.name} loading="lazy" onError={(e) => handleCardArtError(e, card.slug)} />
                      <span className="grave-name">{card.name}</span>
                      <span className="grave-stats">{card.type === "unit" ? `⚔ ${card.attack} · 🛡 ${card.health}` : "Spell"}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })() : null}

      {showCoach ? (
        <div className="coach-overlay" role="dialog" aria-modal="true" onClick={dismissCoach}>
          <div className="coach-card" onClick={(e) => e.stopPropagation()}>
            <h3>How a duel works</h3>
            <ol className="coach-steps">
              <li><strong>Draw:</strong> at the start of your turn, tap your <em>Deck</em> pile to draw a card.</li>
              <li><strong>Summon or Set:</strong> from your hand, <em>⚔ Summon</em> a unit (Attack position, uses ATK) or <em>🛡 Set</em> it (Defense position, uses DEF and guards you). Spells <em>Cast</em> instantly. Each costs ◆ mana.</li>
              <li><strong>Attack:</strong> tap your unit (Attack position only), then tap an enemy unit or player.</li>
              <li><strong>Combat:</strong> higher ATK wins and deals the difference as damage. Attacking a Defense unit compares your ATK vs its 🛡 DEF — no life damage unless your ATK is lower.</li>
              <li><strong>Flip:</strong> use a unit's <em>⟳</em> button to switch its stance (once per turn).</li>
              <li><strong>Win:</strong> reduce every opponent to 0 ❤. You can only attack a player directly when they have no units.</li>
            </ol>
            <button className="button primary auth-submit" type="button" onClick={dismissCoach}>Got it</button>
          </div>
        </div>
      ) : null}

      <section className="duel">
        <div className={`battle-status-bar ${!inGame ? "bsb-lobby" : isMyTurn ? "bsb-mine" : "bsb-other"}`}>
          <div className="bsb-turn">
            <span className="bsb-dot" />
            <div>
              <strong>{turnHeading}</strong>
              <span className="bsb-hint">{turnHint}</span>
            </div>
          </div>
          <div className="bsb-stats">
            <span key={`me-hp-${me?.health ?? 0}`} className="bsb-stat bsb-hp hp-pop">❤ {me?.health ?? "--"}</span>
            <span key={`me-mana-${me?.mana ?? 0}`} className="bsb-stat bsb-mana hp-pop">◆ {me ? `${me.mana}/${me.maxMana}` : "--"}</span>
            <span className="bsb-stat bsb-timer">⏱ {formatTimer(timer)}</span>
            <span className="bsb-stat">Turn {battle?.turn ?? activeMatchState?.turn ?? "--"}</span>
            <span className="bsb-stat">Room {currentRoom?.roomCode ?? "--"}</span>
            <button className="bsb-help" type="button" onClick={() => setShowCoach(true)} aria-label="How to play">?</button>
          </div>
        </div>

        {!inGame ? (
          <div className="duel-wait">
            <p className="muted">Waiting room — set ready and the host starts the duel.</p>
            <div className="roster">
              {currentRoom?.players.map((player) => {
                const character = CHARACTER_CLASSES.find((c) => c.id === player.characterId);
                return (
                  <div key={player.userId} className={`roster-row ${player.ready ? "is-ready" : ""}`}>
                    <img className="roster-avatar" src={getAvatarAssetPath(player.avatarId)} alt="" onError={(e) => handleAvatarError(e, player.avatarId)} />
                    <div className="roster-info">
                      <strong>{player.username}{player.userId === props.currentUserId ? " (you)" : ""}</strong>
                      <span className="muted">{character?.name ?? "Choosing…"}</span>
                    </div>
                    <span className={`roster-badge ${player.ready ? "ready" : ""}`}>{player.ready ? "Ready" : "Not ready"}</span>
                  </div>
                );
              })}
            </div>
            <div className="duel-controls">
              {isInRoom ? (
                <button className="button primary lobby-cta" type="button" onClick={onToggleReady}>{meReady ? "Unready" : "Ready Up"}</button>
              ) : (
                <button className="button primary lobby-cta" type="button" onClick={onJoinAsHostPlayer}>Join as Player</button>
              )}
              {isRoomHost ? <button className="button lobby-cta" type="button" onClick={onStartRoom}>Start Duel</button> : null}
              <button className="button lobby-leave" type="button" onClick={onLeaveRoom}>Leave Room</button>
            </div>
          </div>
        ) : (
          <>
            {attacker ? (
              <div className="attack-hint-bar">
                <span>Attacking with <strong>{attacker.name}</strong> — tap an enemy player or unit.</span>
                <button className="button button-secondary" type="button" onClick={() => setSelectedBoardCardId(null)}>Cancel</button>
              </div>
            ) : null}

            <div className="opp-strip">
              {opponents.length === 0 ? <span className="muted">Waiting for opponents…</span> : null}
              {opponents.map((player) => {
                const targetable = Boolean(attacker) && player.health > 0;
                const isTurn = player.userId === activePlayerId;
                return (
                  <div key={player.userId} className="plate-wrap">
                    <button
                      data-plateid={player.userId}
                      className={`plate ${isTurn ? "plate-turn" : ""} ${targetable ? "plate-target" : ""} ${fx?.id === `player-${player.userId}` ? "fx-slash" : ""}`}
                      type="button"
                      disabled={!targetable}
                      onClick={() => strikePlayer(player.userId, player.health)}
                      title={targetable ? `Attack ${player.username}` : player.username}
                    >
                      <img className="plate-avatar" src={getAvatarAssetPath(player.avatarId)} alt="" onError={(e) => handleAvatarError(e, player.avatarId)} />
                      <span className="plate-name">{player.username}</span>
                      <span className="plate-stats"><b key={`hp-${player.health}`} className="plate-hp hp-pop">❤ {player.health}</b> ◆ {player.mana}/{player.maxMana}</span>
                      {fx?.id === `player-${player.userId}` ? <span className="fx-overlay" aria-hidden="true" /> : null}
                    </button>
                    <div className="opp-hand" aria-label={`${player.username} has ${player.handCount} cards`}>
                      {Array.from({ length: Math.min(player.handCount, 8) }).map((_, h) => (
                        <img key={h} className="opp-hand-card" src={CARD_BACK_ASSET_PATH} alt="" aria-hidden="true" />
                      ))}
                      <span className="opp-hand-count">{player.handCount}</span>
                    </div>
                    <button className="grave-chip" type="button" onClick={() => setGraveyardOwner(player.userId)} title={`View ${player.username}'s graveyard`}>
                      🪦 {player.discardCount}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="board-mode-bar">
              {attacker ? <span className="board-mode-note">⚔ Attacking — tap an enemy</span> : <span />}
              <button className="board-mode-toggle" type="button" onClick={toggle3D} title="Switch board view">
                {use3D ? "🃏 2D Board" : "🧊 3D Board"}
              </button>
            </div>

            {use3D ? (
              <div className="battlefield battlefield-3d">
                <Suspense fallback={<div className="three-loading">Loading 3D board…</div>}>
                  <Battlefield3DLive
                    myUnits={me?.board ?? []}
                    enemyUnits={enemyUnits}
                    opponents={opponents}
                    selectedId={selectedBoardCardId}
                    attacking={Boolean(attacker)}
                    isMyTurn={isMyTurn}
                    onSelectMine={(id) => setSelectedBoardCardId(selectedBoardCardId === id ? null : id)}
                    onStrikeUnit={strikeUnit}
                    onStrikePlayer={strikePlayer}
                  />
                </Suspense>
              </div>
            ) : (
            <div
              className={`battlefield ${attacker ? "bf-attacking" : ""} ${shake ? "bf-shake" : ""} ${isMyTurn ? "bf-myturn" : ""}`}
              style={{ ["--realm-bg" as string]: `url(${realmBg})` }}
            >
              <div className="bf-center-fx" aria-hidden="true">
                {attackInfo ? (
                  <span className="attack-info">⚔ <strong>{attackInfo.attacker}</strong> attacks <strong>{attackInfo.target}</strong></span>
                ) : null}
                {floatDmg.map((d) => (
                  <span key={d.id} className={`float-dmg ${d.mine ? "dmg-self" : "dmg-enemy"}`}>-{d.amount}</span>
                ))}
                {defeatedSignals.map((sig) => (
                  <span key={sig.id} className="destroy-pop">💥 {sig.cardName} destroyed</span>
                ))}
              </div>
              <div className="bf-plane">
                <div className="bf-row bf-enemy">
                  <span className="bf-zone-label">Enemy Field {attacker ? "· tap a target" : ""}</span>
                  <div className="bf-zones">
                    {Array.from({ length: enemyZoneCount }).map((_, i) => {
                      const slot = enemyUnits[i];
                      if (!slot) {
                        return <div key={`ez-${i}`} className="bf-zone bf-zone-empty" aria-hidden="true" />;
                      }
                      const { owner, unit } = slot;
                      // Every enemy unit looks identical regardless of battle
                      // position — the opponent must NOT be able to tell which
                      // units are in Attack vs Defense, so they attack blind and
                      // only discover the consequence after striking.
                      const fxClass = fx?.id === unit.instanceId ? `fx-${fx.kind}` : "";
                      return (
                        <div key={unit.instanceId} className="bf-zone">
                          <button
                            data-cardid={unit.instanceId}
                            className={`tcg-card tcg-enemy rarity-${unit.rarity} stance-attack ${attacker ? "tcg-target" : ""} ${fxClass}`}
                            type="button"
                            disabled={!attacker}
                            onClick={() => strikeUnit(owner.userId, unit.instanceId)}
                            title={`${unit.name} — ${owner.username}`}
                          >
                            <img className="tcg-art" src={getCardArtSources(unit.slug).primary} alt={unit.name} loading="lazy" onError={(e) => handleCardArtError(e, unit.slug)} />
                            {getCrestSource(unit.slug) ? <img className="tcg-crest" src={getCrestSource(unit.slug)} alt="" aria-hidden="true" /> : null}
                            <span className="tcg-frame" aria-hidden="true" />
                            <span className="tcg-name">{unit.name}</span>
                            <span className="tcg-atk">{unit.attack}</span>
                            <span className="tcg-def">{unit.health}</span>
                            <span className="card-info-btn" role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); setDetailCard(unit); }}>ⓘ</span>
                            {fxClass ? <span className="fx-overlay" aria-hidden="true" /> : null}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bf-line"><span>⚔ RIFT ⚔</span></div>

                <div className="bf-row bf-you">
                  <span className="bf-zone-label">Your Field {isMyTurn ? "· tap a ⚔ ready unit" : ""}</span>
                  <div className="bf-zones">
                    {Array.from({ length: myZoneCount }).map((_, i) => {
                      const unit = me?.board[i];
                      if (!unit) {
                        return <div key={`mz-${i}`} className="bf-zone bf-zone-empty" aria-hidden="true" />;
                      }
                      const inDef = unit.position === "defense";
                      const canAct = isMyTurn && unit.canAttack && !inDef;
                      const selected = unit.instanceId === selectedBoardCardId;
                      const canFlip = isMyTurn && !unit.positionChanged;
                      const fxClass = fx?.id === unit.instanceId ? `fx-${fx.kind}` : "";
                      return (
                        <div key={unit.instanceId} className="bf-zone tcg-slot">
                          <div
                            data-cardid={unit.instanceId}
                            className={`tcg-card tcg-mine rarity-${unit.rarity} ${inDef ? "tcg-defense stance-defense" : "stance-attack"} ${selected ? "tcg-selected" : ""} ${canAct ? "tcg-canact" : ""} ${fxClass} ${unit.instanceId === lungeId ? "tcg-lunge" : ""} ${unit.instanceId === flipId ? "tcg-flip" : ""}`}
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                              if (canAct) setSelectedBoardCardId(selected ? null : unit.instanceId);
                            }}
                            title={`${unit.name} · ${inDef ? "Defense" : "Attack"}`}
                          >
                            <img className="tcg-art" src={getCardArtSources(unit.slug).primary} alt={unit.name} loading="lazy" onError={(e) => handleCardArtError(e, unit.slug)} />
                            {getCrestSource(unit.slug) ? <img className="tcg-crest" src={getCrestSource(unit.slug)} alt="" aria-hidden="true" /> : null}
                            <span className="tcg-frame" aria-hidden="true" />
                            <span className="tcg-name">{unit.name}</span>
                            <span className="tcg-atk">{unit.attack}</span>
                            <span className="tcg-def">{unit.health}</span>
                            {inDef ? <span className="tcg-pos">🛡</span> : null}
                            {canAct ? <span className="tcg-ready">●</span> : null}
                            <span className="card-info-btn" role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); setDetailCard(unit); }}>ⓘ</span>
                            {fxClass ? <span className="fx-overlay" aria-hidden="true" /> : null}
                          </div>
                          {canFlip ? (
                            <button className={`flip-btn ${inDef ? "to-attack" : "to-defend"}`} type="button" onClick={() => { setFlipId(unit.instanceId); window.setTimeout(() => setFlipId(null), 450); onSetPosition(unit.instanceId, inDef ? "attack" : "defense"); }} title="Change battle position (once per turn)">
                              ⟳ {inDef ? "To Attack" : "To Defense"}
                            </button>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
            )}

            {(() => {
              const mySpells = me?.spellZone ?? [];
              const enemySpells = opponents.flatMap((p) => (p.spellZone ?? []).map((card) => ({ owner: p, card })));
              if (mySpells.length === 0 && enemySpells.length === 0) return null;
              return (
                <div className="spell-zone">
                  <span className="bf-zone-label spell-zone-label">✦ Spell Zone</span>
                  <div className="spell-row">
                    {enemySpells.map(({ owner, card }, i) => (
                      <button key={`es-${card.instanceId}-${i}`} type="button" className="spell-card spell-enemy" title={`${card.name} — ${owner.username}`} onClick={() => setDetailCard(card)}>
                        <img src={getCardArtSources(card.slug).primary} alt={card.name} loading="lazy" onError={(e) => handleCardArtError(e, card.slug)} />
                        <span className="spell-name">{card.name}</span>
                      </button>
                    ))}
                    {mySpells.map((card, i) => (
                      <button key={`ms-${card.instanceId}-${i}`} type="button" className="spell-card spell-mine" title={card.name} onClick={() => setDetailCard(card)}>
                        <img src={getCardArtSources(card.slug).primary} alt={card.name} loading="lazy" onError={(e) => handleCardArtError(e, card.slug)} />
                        <span className="spell-name">{card.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}

            <div className="duel-piles">
              <button
                className={`pile pile-deck ${isMyTurn && !battle?.manualDrawUsed ? "pile-draw" : ""}`}
                type="button"
                disabled={!isMyTurn || Boolean(battle?.manualDrawUsed)}
                onClick={() => {
                  setDrawFly(true);
                  window.setTimeout(() => setDrawFly(false), 520);
                  onDrawCard();
                }}
                title="Draw a card"
              >
                <img className="pile-art" src={DECK_BACK_ASSET_PATH} alt="" aria-hidden="true" />
                {drawFly ? <img className="pile-flyer" src={DECK_BACK_ASSET_PATH} alt="" aria-hidden="true" /> : null}
                <span className="pile-count">{me?.deckCount ?? 0}</span>
                <span className="pile-label">{isMyTurn && !battle?.manualDrawUsed ? "Draw" : "Deck"}</span>
              </button>
              <button
                className="pile pile-discard"
                type="button"
                onClick={() => setGraveyardOwner(props.currentUserId)}
                title="View graveyard"
              >
                {me?.discard && me.discard.length > 0 ? (
                  <img className="pile-art" src={getCardArtSources(me.discard[me.discard.length - 1].slug).primary} alt="" onError={(e) => handleCardArtError(e, me.discard![me.discard!.length - 1].slug)} />
                ) : (
                  <img className="pile-art pile-empty-art" src={CARD_BACK_ASSET_PATH} alt="" aria-hidden="true" />
                )}
                <span key={`disc-${me?.discardCount ?? 0}`} className="pile-count pile-count-pop">{me?.discardCount ?? 0}</span>
                <span className="pile-label">Graveyard</span>
              </button>
            </div>

            <div className="your-hand">
              <header className="field-head">
                <strong>Your Hand</strong>
                <span className="type-legend">
                  <span className="lg lg-atk">Attack</span>
                  <span className="lg lg-def">Defense</span>
                  <span className="lg lg-spell">Spell</span>
                </span>
                <span className="muted">{privateHand.length} · ◆ {me ? `${me.mana}/${me.maxMana}` : "--"}</span>
              </header>
              <div className="hand-row">
                {privateHand.length === 0 ? <p className="muted">No cards in hand.</p> : null}
                {privateHand.map((card) => {
                  const art = getCardArtSources(card.slug);
                  const affordable = (me?.mana ?? 0) >= card.cost;
                  const playable = isMyTurn && affordable;
                  const reason = !isMyTurn ? "Wait for your turn" : !affordable ? `Needs ${card.cost} mana` : "";
                  return (
                    <article key={card.instanceId} className={`hand-card ${card.type === "spell" ? "card-spell" : "card-unit"} ${!affordable ? "hand-unaffordable" : ""} ${playable ? "hand-playable" : ""}`}>
                      <div className="hand-card-media">
                        <img className="hand-card-art" src={art.primary} alt={card.name} loading="lazy" onError={(e) => handleCardArtError(e, card.slug)} />
                        <span className={`hand-cost ${affordable ? "" : "hand-cost-short"}`} title="Mana cost">{card.cost}</span>
                        <button className="card-info-btn" type="button" onClick={() => setDetailCard(card)} title="Card details" aria-label="Card details">ⓘ</button>
                        {card.type === "unit" ? (
                          <span className="hand-unit-stats">⚔ {card.attack} &nbsp; 🛡 {card.health}</span>
                        ) : (
                          <span className="hand-type-tag">Spell</span>
                        )}
                      </div>
                      <strong>{card.name}</strong>
                      <span className="hand-card-desc">{card.description}</span>
                      <div className="row">
                        {card.type === "unit" ? (
                          <div className="play-stance">
                            <button className="button hand-play-btn" type="button" disabled={!playable} onClick={() => onPlayCard(card.instanceId, undefined, "attack")} title="Summon in Attack position (uses ATK)">⚔ Summon</button>
                            <button className="button hand-play-btn button-secondary" type="button" disabled={!playable} onClick={() => onPlayCard(card.instanceId, undefined, "defense")} title="Set in Defense position (uses DEF, guards you)">🛡 Set</button>
                          </div>
                        ) : card.targetMode === "self" ? (
                          <button className="button hand-play-btn" type="button" disabled={!playable} onClick={() => onPlayCard(card.instanceId, props.currentUserId)} title="Cast on yourself">✦ Cast on Yourself</button>
                        ) : card.targetMode === "single_opponent" ? (
                          possibleTargets.length === 0 ? (
                            <button className="button hand-play-btn" type="button" disabled>No target</button>
                          ) : (
                            possibleTargets.map((target) => (
                              <button key={`${card.instanceId}-${target.userId}`} className="button hand-play-btn" type="button" disabled={!playable} onClick={() => onPlayCard(card.instanceId, target.userId)} title={`Cast at ${target.username}`}>
                                🎯 Cast at {target.username}
                              </button>
                            ))
                          )
                        ) : (
                          // all_opponents / random_opponent — no manual target needed
                          <button className="button hand-play-btn" type="button" disabled={!playable} onClick={() => onPlayCard(card.instanceId, possibleTargets[0]?.userId)} title="Cast (hits all/every opponent)">
                            ✦ Cast {card.targetMode === "all_opponents" ? "(all enemies)" : ""}
                          </button>
                        )}
                      </div>
                      {reason ? <small className="hand-reason">{reason}</small> : null}
                    </article>
                  );
                })}
              </div>
            </div>

            <div className="duel-controls">
              <button className="button primary lobby-cta" type="button" onClick={onEndTurn} disabled={!isMyTurn}>End Turn</button>
              <button className="button" type="button" onClick={onConcede} disabled={!activeMatchState?.matchId}>Concede</button>
              <button className="button lobby-leave" type="button" onClick={onLeaveRoom}>Leave</button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

export function GameBoard(props: GameBoardProps) {
  if (props.tabletopMode) {
    return <TabletopBoard {...props} />;
  }
  return renderLobby(props);
}
