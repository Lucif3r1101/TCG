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
import { getCardArtSources, handleCardArtError } from "../lib/cardArt";

// Lottie is heavy; load the victory overlay only when a match actually ends.
const VictoryOverlay = lazy(() => import("./VictoryOverlay").then((m) => ({ default: m.VictoryOverlay })));

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
  onEndTurn: () => void;
  onDrawCard: () => void;
  onPlayCard: (cardInstanceId: string, targetUserId?: string) => void;
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
  const [selectedBoardCardId, setSelectedBoardCardId] = useState<string | null>(null);
  const [hoveredTargetPlayerId, setHoveredTargetPlayerId] = useState<string | null>(null);
  const [actionHistory, setActionHistory] = useState<RoomActionEvent[]>([]);
  const [defeatedSignals, setDefeatedSignals] = useState<DefeatedSignal[]>([]);
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

  const attacker = isMyTurn && selectedOwnBoardCard?.canAttack ? selectedOwnBoardCard : null;
  const strikePlayer = (targetUserId: string, health: number) => {
    if (attacker && health > 0) {
      onAttackPlayer(attacker.instanceId, targetUserId);
      setSelectedBoardCardId(null);
    }
  };
  const strikeUnit = (targetUserId: string, unitId: string) => {
    if (attacker) {
      onAttackPlayer(attacker.instanceId, targetUserId, unitId);
      setSelectedBoardCardId(null);
    }
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
      {winnerId ? (
        <Suspense fallback={null}>
          <VictoryOverlay won={iWon} winnerName={winnerName} onExit={props.onLeaveRoom} />
        </Suspense>
      ) : null}

      {showCoach ? (
        <div className="coach-overlay" role="dialog" aria-modal="true" onClick={dismissCoach}>
          <div className="coach-card" onClick={(e) => e.stopPropagation()}>
            <h3>How a duel works</h3>
            <ol className="coach-steps">
              <li><strong>Turn bar:</strong> shows whose turn it is, your ❤ health, ◆ mana, and the timer.</li>
              <li><strong>Your Hand (bottom):</strong> tap <em>Play</em> to drop a unit, or <em>Cast</em> a spell. Each card costs ◆ mana.</li>
              <li><strong>Your Field:</strong> your units sit here. Tap one (when it can act), then tap an enemy to attack.</li>
              <li><strong>Opponents (top):</strong> attack their units or them directly to lower their ❤.</li>
              <li><strong>End Turn</strong> when done — you get mana and a card next turn.</li>
              <li><strong>Win</strong> by dropping every opponent to 0 ❤.</li>
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
            <span className="bsb-stat bsb-hp">❤ {me?.health ?? "--"}</span>
            <span className="bsb-stat bsb-mana">◆ {me ? `${me.mana}/${me.maxMana}` : "--"}</span>
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
                  <button
                    key={player.userId}
                    className={`plate ${isTurn ? "plate-turn" : ""} ${targetable ? "plate-target" : ""}`}
                    type="button"
                    disabled={!targetable}
                    onClick={() => strikePlayer(player.userId, player.health)}
                    title={targetable ? `Attack ${player.username}` : player.username}
                  >
                    <img className="plate-avatar" src={getAvatarAssetPath(player.avatarId)} alt="" onError={(e) => handleAvatarError(e, player.avatarId)} />
                    <span className="plate-name">{player.username}</span>
                    <span className="plate-stats"><b className="plate-hp">❤ {player.health}</b> ◆ {player.mana}/{player.maxMana}</span>
                  </button>
                );
              })}
            </div>

            <div className="battlefield">
              <div className="bf-plane">
                <div className="bf-row bf-enemy">
                  {opponents.every((p) => p.board.length === 0) ? <span className="bf-empty">No enemy units on the field</span> : null}
                  {opponents.flatMap((player) =>
                    player.board.map((unit) => (
                      <button
                        key={unit.instanceId}
                        className={`tcg-card tcg-enemy rarity-${unit.rarity} ${attacker ? "tcg-target" : ""}`}
                        type="button"
                        disabled={!attacker}
                        onClick={() => strikeUnit(player.userId, unit.instanceId)}
                        title={`${unit.name} — ${player.username}`}
                      >
                        <img className="tcg-art" src={getCardArtSources(unit.slug).primary} alt={unit.name} loading="lazy" onError={(e) => handleCardArtError(e, unit.slug)} />
                        <span className="tcg-name">{unit.name}</span>
                        <span className="tcg-atk">{unit.attack}</span>
                        <span className="tcg-hp">{unit.health}</span>
                      </button>
                    ))
                  )}
                </div>

                <div className="bf-line"><span>RIFT</span></div>

                <div className="bf-row bf-you">
                  {(me?.board.length ?? 0) === 0 ? <span className="bf-empty">Play units from your hand to fill your field</span> : null}
                  {me?.board.map((unit) => {
                    const canAct = isMyTurn && unit.canAttack;
                    const selected = unit.instanceId === selectedBoardCardId;
                    return (
                      <button
                        key={unit.instanceId}
                        className={`tcg-card tcg-mine rarity-${unit.rarity} ${selected ? "tcg-selected" : ""} ${canAct ? "tcg-canact" : ""}`}
                        type="button"
                        onClick={() => setSelectedBoardCardId(selected ? null : canAct ? unit.instanceId : null)}
                        disabled={!canAct}
                        title={unit.name}
                      >
                        <img className="tcg-art" src={getCardArtSources(unit.slug).primary} alt={unit.name} loading="lazy" onError={(e) => handleCardArtError(e, unit.slug)} />
                        <span className="tcg-name">{unit.name}</span>
                        <span className="tcg-atk">{unit.attack}</span>
                        <span className="tcg-hp">{unit.health}</span>
                        {canAct ? <span className="tcg-ready">●</span> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="your-hand">
              <header className="field-head">
                <strong>Your Hand</strong>
                <span className="muted">{privateHand.length} card(s) · ◆ {me ? `${me.mana}/${me.maxMana}` : "--"}</span>
              </header>
              <div className="hand-row">
                {privateHand.length === 0 ? <p className="muted">No cards in hand.</p> : null}
                {privateHand.map((card) => {
                  const art = getCardArtSources(card.slug);
                  const affordable = (me?.mana ?? 0) >= card.cost;
                  const playable = isMyTurn && affordable;
                  const reason = !isMyTurn ? "Wait for your turn" : !affordable ? `Needs ${card.cost} mana` : "";
                  return (
                    <article key={card.instanceId} className={`hand-card ${!affordable ? "hand-unaffordable" : ""} ${playable ? "hand-playable" : ""}`}>
                      <div className="hand-card-media">
                        <img className="hand-card-art" src={art.primary} alt={card.name} loading="lazy" onError={(e) => handleCardArtError(e, card.slug)} />
                        <span className={`hand-cost ${affordable ? "" : "hand-cost-short"}`} title="Mana cost">{card.cost}</span>
                        {card.type === "unit" ? (
                          <span className="hand-unit-stats">⚔ {card.attack} &nbsp; ❤ {card.health}</span>
                        ) : (
                          <span className="hand-type-tag">Spell</span>
                        )}
                      </div>
                      <strong>{card.name}</strong>
                      <span className="hand-card-desc">{card.description}</span>
                      <div className="row">
                        {card.type === "unit" ? (
                          <button className="button hand-play-btn" type="button" disabled={!playable} onClick={() => onPlayCard(card.instanceId)}>Play Unit</button>
                        ) : possibleTargets.length <= 1 ? (
                          <button className="button hand-play-btn" type="button" disabled={!playable} onClick={() => onPlayCard(card.instanceId, possibleTargets[0]?.userId)}>
                            {possibleTargets[0] ? `Cast on ${possibleTargets[0].username}` : "Cast"}
                          </button>
                        ) : (
                          possibleTargets.map((target) => (
                            <button key={`${card.instanceId}-${target.userId}`} className="button hand-play-btn" type="button" disabled={!playable} onClick={() => onPlayCard(card.instanceId, target.userId)}>
                              Cast on {target.username}
                            </button>
                          ))
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
