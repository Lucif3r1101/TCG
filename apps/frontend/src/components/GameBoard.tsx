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
  const lastTurnRef = useRef<number | null>(null);
  const previousBoardsRef = useRef<Record<string, RoomCard[]>>({});
  const turnKey = battle?.turn ?? activeMatchState?.turn ?? null;
  const activePlayerId = battle?.activePlayerId ?? activeMatchState?.activePlayerId;
  const seatLayouts = getSeatLayouts(currentRoom?.maxPlayers ?? 6);
  const activeSeatIndex =
    activePlayerId && currentRoom ? currentRoom.players.findIndex((player) => player.userId === activePlayerId) : -1;
  const me = currentRoom?.players.find((player) => player.userId === props.currentUserId) ?? null;
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

  return (
    <div className="grid">
      {winnerId ? (
        <Suspense fallback={null}>
          <VictoryOverlay won={iWon} winnerName={winnerName} onExit={props.onLeaveRoom} />
        </Suspense>
      ) : null}
      <section className="grid table-panel tabletop-only duel-layout">
        <h3 style={{ margin: 0 }}>Tabletop Arena</h3>
        <div className="turn-banner">
          <div className={`turn-orb ${battle || activeMatchState ? "active" : ""}`} />
          <p>Turn {battle?.turn ?? activeMatchState?.turn ?? "--"}</p>
          <span>Timer: {formatTimer(timer)}</span>
        </div>
        <div className="row">
          <strong>Room: {currentRoom?.roomCode ?? "--"}</strong>
          {currentRoom?.status === "open" ? <span className="muted">Waiting lobby: set ready and host starts</span> : null}
        </div>
        <div className="combat-hint-banner">
          <strong>How To Attack</strong>
          <span>Select one of your units on <strong>Your Field</strong>, then use the attack buttons in the selected card panel.</span>
        </div>

        <div className="duel-shell">
          <aside className="side-panel hand-panel">
            <div className="side-panel-head">
              <strong>Your Hand</strong>
              <span className="muted">{privateHand.length} cards</span>
            </div>
            <div className="panel-stat-grid">
              <div className="panel-stat">
                <span>Mana</span>
                <strong>{me ? `${me.mana}/${me.maxMana}` : "--"}</strong>
              </div>
              <div className="panel-stat">
                <span>Deck</span>
                <strong>{me?.deckCount ?? 0}</strong>
              </div>
              <div className="panel-stat">
                <span>Board</span>
                <strong>{me?.board.length ?? 0}</strong>
              </div>
            </div>
            <div className="hand-zone hand-zone-side">
              {privateHand.length === 0 ? <p className="muted">No cards in hand.</p> : null}
              {privateHand.map((card) => (
                <article key={card.instanceId} className="hand-card hand-card-compact" onMouseMove={onTilt} onMouseLeave={onTiltReset}>
                  {(() => {
                    const art = getCardArtSources(card.slug);
                    return (
                  <img
                    className="hand-card-art"
                    src={art.primary}
                    alt={card.name}
                    loading="lazy"
                    onError={(event) => handleCardArtError(event, card.slug)}
                  />
                    );
                  })()}
                  <strong>{card.name}</strong>
                  <span className="muted">
                    {card.type} | {card.rarity}
                  </span>
                  <span className="muted">Cost {card.cost}</span>
                  <div className="card-hover-detail" aria-hidden="true">
                    <strong>{card.name}</strong>
                    <span>{card.description}</span>
                    <div className="card-hover-stats">
                      <small>Cost {card.cost}</small>
                      <small>{card.type}</small>
                      <small>{card.attack}/{card.health}</small>
                    </div>
                  </div>
                  <div className="row">
                    {card.type === "unit" ? (
                      <button className="button" type="button" onClick={() => onPlayCard(card.instanceId)}>
                        <img className="button-icon" src={getIconAssetPath("icon-unit")} alt="" aria-hidden="true" />
                        Play Unit
                      </button>
                    ) : null}
                    {card.type === "spell" && possibleTargets.length <= 1 ? (
                      <button
                        className="button"
                        type="button"
                        onClick={() => onPlayCard(card.instanceId, possibleTargets[0]?.userId)}
                      >
                        <img className="button-icon" src={getIconAssetPath("icon-spell")} alt="" aria-hidden="true" />
                        {possibleTargets[0] ? `Use Spell on ${possibleTargets[0].username}` : "Use Spell"}
                      </button>
                    ) : null}
                    {card.type === "spell" && possibleTargets.length > 1
                      ? possibleTargets.map((target) => (
                          <button
                            key={`${card.instanceId}-${target.userId}`}
                            className="button"
                            type="button"
                            onClick={() => onPlayCard(card.instanceId, target.userId)}
                          >
                            <img className="button-icon" src={getIconAssetPath("icon-attack")} alt="" aria-hidden="true" />
                            Use Spell on {target.username}
                          </button>
                        ))
                      : null}
                  </div>
                </article>
              ))}
            </div>
          </aside>

          <div
            className={`tabletop-surface anim-${animationPreset} ${turnShift ? "turn-shift" : ""} ${
              roomAction ? `action-${roomAction.actionType.replace("_", "-")}` : ""
            }`}
          >
          <div className="turn-path-layer" aria-hidden="true">
            {seatPositions.map((position, index) => (
              <span key={`path-${position}`} className={`turn-path path-${position} ${activeSeatIndex === index ? "active" : ""}`} />
            ))}
            {activeSeatIndex >= 0 ? <span className={`turn-glow glow-${seatPositions[activeSeatIndex]}`} /> : null}
          </div>

          <div className="rift-board-frame">
            <div className="table-deck-stack deck-stack-top" aria-hidden="true">
              <img className="deck-back-art" src={CARD_BACK_ASSET_PATH} alt="" />
              <span>Enemy Deck</span>
            </div>
            <div className="table-deck-stack deck-stack-bottom" aria-hidden="true">
              <img className="deck-back-art" src={DECK_BACK_ASSET_PATH} alt="" />
              <span>Your Deck</span>
            </div>
            <div className="table-resource-cluster resource-cluster-top" aria-hidden="true">
              <div className="resource-chip">
                <img className="status-icon" src={getIconAssetPath("icon-room")} alt="" />
                <strong>{boardTopSummary?.deckCount ?? 0}</strong>
                <span>Deck</span>
              </div>
              <div className="resource-chip">
                <img className="status-icon" src={getIconAssetPath("icon-mana")} alt="" />
                <strong>{boardTopSummary ? `${boardTopSummary.mana}/${boardTopSummary.maxMana}` : "--"}</strong>
                <span>Mana</span>
              </div>
            </div>
            <div className="table-resource-cluster resource-cluster-bottom" aria-hidden="true">
              <div className="resource-chip">
                <img className="status-icon" src={getIconAssetPath("icon-room")} alt="" />
                <strong>{me?.deckCount ?? 0}</strong>
                <span>Deck</span>
              </div>
              <div className="resource-chip">
                <img className="status-icon" src={getIconAssetPath("icon-mana")} alt="" />
                <strong>{me ? `${me.mana}/${me.maxMana}` : "--"}</strong>
                <span>Mana</span>
              </div>
            </div>
            {roomAction ? (
              <div
                className={`table-travel-card action-${roomAction.actionType.replace("_", "-")} from-${actorSeatPosition} ${actionDestinationClass}`}
                aria-hidden="true"
              >
                {roomAction.card ? (
                  <img src={getCardArtSources(roomAction.card.slug).primary} alt="" onError={(event) => handleCardArtError(event, roomAction.card!.slug)} />
                ) : (
                  <div className="table-travel-turn-mark">End</div>
                )}
              </div>
            ) : null}
            {roomAction?.actionType === "draw" && roomAction.card ? (
              <div className={`draw-trail ${actorIsMe ? "draw-trail-self" : "draw-trail-opponent"}`} aria-hidden="true" />
            ) : null}
            {(roomAction?.actionType === "play" || roomAction?.actionType === "attack") && roomAction.card && targetSeatPosition ? (
              <div className={`target-beam beam-to-${targetSeatPosition}`} aria-hidden="true" />
            ) : null}
            {selectedOwnBoardCard && hoveredTargetSeatPosition ? (
              <div className={`target-beam preview-beam beam-to-${hoveredTargetSeatPosition}`} aria-hidden="true" />
            ) : null}
            <div className="battle-lane battle-lane-top">
              {opponents.length === 0 ? <p className="muted">Opponent field will appear here.</p> : null}
              {opponents.map((player) => (
                <section
                  key={player.userId}
                  className={`lane-player lane-player-opponent ${hoveredTargetPlayerId === player.userId ? "lane-targeted" : ""} ${roomAction?.actionType === "attack" && roomAction.targetUserId === player.userId ? "lane-under-attack" : ""}`}
                  onMouseEnter={() => setHoveredTargetPlayerId(player.userId)}
                  onMouseLeave={() => setHoveredTargetPlayerId((current) => (current === player.userId ? null : current))}
                >
                  <header className="lane-player-head">
                    <strong>{player.username}</strong>
                    <span>
                      Mana {player.mana}/{player.maxMana}
                    </span>
                  </header>
                  <div className="field-label">Enemy Field</div>
                  <div className="lane-slots" aria-hidden="true">
                    {Array.from({ length: 5 }, (_, slotIndex) => (
                      <span key={`${player.userId}-slot-${slotIndex}`} className="lane-slot" />
                    ))}
                  </div>
                  <div className="lane-card-row">
                    {defeatedSignals
                      .filter((signal) => signal.playerUserId === player.userId)
                      .map((signal) => (
                        <div key={signal.id} className="defeated-card-signal">
                          {signal.cardName} defeated
                        </div>
                      ))}
                    {player.board.length === 0 ? <span className="lane-empty">No cards in play</span> : null}
                    {player.board.slice(0, 4).map((card) => (
                      <article
                        key={`${player.userId}-${card.instanceId}`}
                        className={`board-card board-card-opponent ${selectedBoardCardId === card.instanceId ? "board-card-selected" : ""}`}
                        onClick={() => setSelectedBoardCardId((current) => (current === card.instanceId ? null : card.instanceId))}
                      >
                        <img src={getCardArtSources(card.slug).primary} alt={card.name} onError={(event) => handleCardArtError(event, card.slug)} />
                        {card.canAttack ? <small className="board-card-ready board-card-ready-opponent">Ready</small> : null}
                        <span>{card.attack}/{card.health}</span>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
            <div className="tabletop-core">
              <p className="muted">Chronicles Table</p>
              <strong>{activePlayerName ? `Active: ${activePlayerName}` : "Waiting to Start"}</strong>
              <span className="muted">{currentRoom?.status === "in_game" ? "Battle in progress" : "Lobby setup phase"}</span>
            </div>
            <div className={`table-action-card ${roomAction ? "visible" : ""} ${roomAction ? `table-action-${roomAction.actionType.replace("_", "-")}` : ""}`}>
              {roomAction?.card ? (
                <>
                  <img src={getCardArtSources(roomAction.card.slug).primary} alt={roomAction.card.name} onError={(event) => handleCardArtError(event, roomAction.card!.slug)} />
                  <div className="table-action-copy">
                    <strong>{roomAction.card.name}</strong>
                    <span>
                      {roomAction.actionType === "draw"
                        ? `${roomAction.actorUsername} drew this card`
                        : roomAction.actionType === "attack"
                          ? `${roomAction.actorUsername} attacked ${roomAction.targetCardName ?? targetPlayer?.username ?? "a target"}`
                          : `${roomAction.actorUsername} used this card`}
                    </span>
                    <p>{roomAction.actionType === "attack" ? `${roomAction.amount ?? roomAction.card.attack} damage dealt.` : roomAction.card.description}</p>
                    {roomAction.targetCardName ? <small>Target unit: {roomAction.targetCardName}</small> : targetPlayer ? <small>Targeting {targetPlayer.username}</small> : null}
                  </div>
                </>
              ) : roomAction ? (
                <div className="table-action-copy">
                  <strong>Turn End</strong>
                  <span>{roomAction.actorUsername} ended the turn</span>
                </div>
              ) : null}
            </div>
            <div className="battle-lane battle-lane-bottom">
              <section className="lane-player lane-player-self">
                <header className="lane-player-head">
                  <strong>{me?.username ?? "You"}</strong>
                  <span>
                    Mana {me ? `${me.mana}/${me.maxMana}` : "--"}
                  </span>
                </header>
                <div className="field-label">Your Field</div>
                <div className="lane-slots" aria-hidden="true">
                  {Array.from({ length: 5 }, (_, slotIndex) => (
                    <span key={`self-slot-${slotIndex}`} className="lane-slot" />
                  ))}
                </div>
                <div className="lane-card-row">
                  {defeatedSignals
                    .filter((signal) => signal.playerUserId === me?.userId)
                    .map((signal) => (
                      <div key={signal.id} className="defeated-card-signal">
                        {signal.cardName} defeated
                      </div>
                    ))}
                  {me?.board.length ? null : <span className="lane-empty">Play units and spells to build your field.</span>}
                  {me?.board.slice(0, 5).map((card) => (
                      <article
                        key={card.instanceId}
                        className={`board-card ${selectedBoardCardId === card.instanceId ? "board-card-selected" : ""}`}
                        onClick={() => setSelectedBoardCardId((current) => (current === card.instanceId ? null : card.instanceId))}
                      >
                      <img src={getCardArtSources(card.slug).primary} alt={card.name} onError={(event) => handleCardArtError(event, card.slug)} />
                      {card.canAttack ? <small className="board-card-ready">Ready</small> : null}
                      <span>{card.attack}/{card.health}</span>
                    </article>
                  ))}
                </div>
              </section>
            </div>
            <div className="table-feed">
              <span className="table-feed-label">Latest Table Action</span>
              <strong>{latestActionLabel}</strong>
              {targetPlayer ? <span className="muted">Target: {targetPlayer.username}</span> : null}
            </div>
          </div>

          {Array.from({ length: currentRoom?.maxPlayers ?? 6 }, (_, index) => {
            const player = currentRoom?.players[index];
            const playerCharacter = CHARACTER_CLASSES.find((entry) => entry.id === player?.characterId);
            const isActive = activePlayerId && player?.userId === activePlayerId;
            return (
              <article
                key={`seat-${index}`}
                className={`table-seat ${player?.ready ? "ready" : ""} ${isActive ? "active-turn" : ""}`}
                style={seatLayouts[index]}
                onMouseMove={onTilt}
                onMouseLeave={onTiltReset}
              >
                <p>Seat {index + 1}</p>
                {player ? (
                  <div className="seat-head">
                    <img
                      className="seat-avatar"
                      src={getAvatarAssetPath(player.avatarId)}
                      alt={player.username}
                      onError={(event) => handleAvatarError(event, player.avatarId)}
                    />
                    <strong>{player.username}</strong>
                  </div>
                ) : (
                  <strong>Open Slot</strong>
                )}
                {player && playerCharacter ? (
                  <div className="seat-character">
                    <img src={playerCharacter.sprite} alt={playerCharacter.name} loading="lazy" />
                    <div className="seat-character-text">
                      <strong>
                        <img className="crest-icon crest-inline" src={playerCharacter.crest} alt="" aria-hidden="true" />
                        {playerCharacter.name}
                      </strong>
                      <span>{playerCharacter.tag}</span>
                    </div>
                  </div>
                ) : (
                  <span>{player ? player.characterId : "Waiting"}</span>
                )}
                <span>Cards: {player ? player.handCount : 0} | Deck: {player ? player.deckCount : 0}</span>
                <span>
                  Mana: {player ? player.mana : 0}/{player ? player.maxMana : 0}
                </span>
              </article>
            );
          })}
          </div>

          <aside className="side-panel status-panel">
            <div className="side-panel-head">
              <strong>Battle Status</strong>
              <span className="muted">{currentRoom?.players.length ?? 0} players</span>
            </div>
            <div className="panel-stat-grid">
              <div className="panel-stat">
                <span>Turn</span>
                <strong>{battle?.turn ?? activeMatchState?.turn ?? "--"}</strong>
              </div>
              <div className="panel-stat">
                <span>Timer</span>
                <strong>{formatTimer(timer)}</strong>
              </div>
              <div className="panel-stat">
                <span>Action</span>
                <strong>{roomAction ? roomAction.actionType.replace("_", " ") : "live"}</strong>
              </div>
            </div>
            <div className="status-list">
              <article className="how-to-panel">
                <strong>How This Turn Works</strong>
                <ol className="how-to-list">
                  <li>Your draw happens automatically at the start of your turn.</li>
                  <li><strong>Play Unit</strong> puts that card onto your board.</li>
                  <li><strong>Use Spell</strong> triggers the effect immediately on the shown target.</li>
                  <li>Watch mana before using a card.</li>
                  <li>When you are done, click <strong>End Turn</strong>.</li>
                </ol>
                <small className="muted">
                  Units stay on the table. Spells resolve right away and usually do not stay in play.
                </small>
              </article>
              {(currentRoom?.players ?? []).map((player) => (
                <article key={player.userId} className={`status-card ${player.userId === activePlayerId ? "status-active" : ""}`}>
                  <div className="seat-head">
                    <img
                      className="seat-avatar"
                      src={getAvatarAssetPath(player.avatarId)}
                      alt={player.username}
                      onError={(event) => handleAvatarError(event, player.avatarId)}
                    />
                    <strong>{player.username}</strong>
                  </div>
                  <div className="status-meta">
                    <span className="status-pill">
                      <img className="status-icon" src={getIconAssetPath("icon-health")} alt="" aria-hidden="true" />
                      HP {player.health}
                    </span>
                    <span className="status-pill">
                      <img className="status-icon" src={getIconAssetPath("icon-mana")} alt="" aria-hidden="true" />
                      Mana {player.mana}/{player.maxMana}
                    </span>
                    <span className="status-pill">
                      <img className="status-icon" src={getIconAssetPath("icon-unit")} alt="" aria-hidden="true" />
                      Hand {player.handCount}
                    </span>
                    <span className="status-pill">
                      <img className="status-icon" src={getIconAssetPath("icon-room")} alt="" aria-hidden="true" />
                      Deck {player.deckCount}
                    </span>
                    <span className="status-pill">
                      <img className="status-icon" src={getIconAssetPath("icon-spell")} alt="" aria-hidden="true" />
                      Board {player.board.length}
                    </span>
                  </div>
                </article>
              ))}
            </div>
            {selectedAnyBoardCard ? (
              <article className="inspect-card">
                <strong>{selectedOwnBoardCard ? "Selected Card" : "Target Card"}</strong>
                <img
                  className="inspect-card-art"
                  src={getCardArtSources(selectedAnyBoardCard.slug).primary}
                  alt={selectedAnyBoardCard.name}
                  onError={(event) => handleCardArtError(event, selectedAnyBoardCard.slug)}
                />
                <strong>{selectedAnyBoardCard.name}</strong>
                <span>{selectedAnyBoardCard.description}</span>
                <div className="status-meta">
                  <span className="status-pill">ATK {selectedAnyBoardCard.attack}</span>
                  <span className="status-pill">HP {selectedAnyBoardCard.health}</span>
                  <span className="status-pill">Cost {selectedAnyBoardCard.cost}</span>
                  <span className="status-pill">{selectedAnyBoardCard.canAttack ? "Can Attack" : "Waiting"}</span>
                </div>
                <small className="muted">
                  {selectedOwnBoardCard
                    ? hoveredTargetPlayer
                      ? `Preview targeting ${hoveredTargetPlayer.username}`
                      : "Select an enemy lane or enemy unit to preview combat."
                    : "This is an enemy unit on the board."}
                </small>
                {battle?.activePlayerId === props.currentUserId && selectedOwnBoardCard?.canAttack ? (
                  <div className="action-stack">
                    <small className="muted action-helper">Attack controls for this unit:</small>
                    {opponents.filter((player) => player.health > 0).map((target) => (
                      <div key={`attack-group-${selectedOwnBoardCard!.instanceId}-${target.userId}`} className="attack-option-group">
                        <button
                          className="button"
                          type="button"
                          onClick={() => onAttackPlayer(selectedOwnBoardCard!.instanceId, target.userId)}
                        >
                          <img className="button-icon" src={getIconAssetPath("icon-attack")} alt="" aria-hidden="true" />
                          Attack {target.username} Directly
                        </button>
                        {target.board.slice(0, 5).map((enemyCard) => (
                          <button
                            key={`attack-${selectedOwnBoardCard!.instanceId}-${enemyCard.instanceId}`}
                            className="button button-secondary"
                            type="button"
                            onClick={() => onAttackPlayer(selectedOwnBoardCard!.instanceId, target.userId, enemyCard.instanceId)}
                          >
                            <img className="button-icon" src={getIconAssetPath("icon-attack")} alt="" aria-hidden="true" />
                            Attack {enemyCard.name}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : null}
              </article>
            ) : null}
            <article className="history-panel">
              <strong>Battle History</strong>
              <div className="history-list">
                {actionHistory.length === 0 ? <span className="muted">Recent turns and card plays will appear here.</span> : null}
                {actionHistory.map((entry, index) => (
                  <div key={`${entry.timestamp}-${index}`} className="history-item">
                    <strong>{entry.actorUsername}</strong>
                    <span>
                      {entry.actionType === "draw"
                        ? `drew ${entry.card?.name ?? "a card"}`
                        : entry.actionType === "play"
                          ? `used ${entry.card?.name ?? "a card"}`
                          : entry.actionType === "attack"
                            ? `attacked ${entry.targetCardName ?? (entry.targetUserId ? currentRoom?.players.find((player) => player.userId === entry.targetUserId)?.username ?? "a player" : "a player")} with ${entry.card?.name ?? "a unit"}`
                          : "ended the turn"}
                    </span>
                    {entry.actionType === "attack"
                      ? <small>{entry.amount ?? entry.card?.attack ?? 0} damage dealt.</small>
                      : entry.card?.description
                        ? <small>{entry.card.description}</small>
                        : null}
                  </div>
                ))}
              </div>
            </article>
          </aside>
        </div>

        <div className="row">
          {currentRoom?.status === "open" ? (
            <>
              {isInRoom ? (
                <button className="button primary" type="button" onClick={onToggleReady}>
                  <img className="button-icon" src={getIconAssetPath("icon-shield")} alt="" aria-hidden="true" />
                  {meReady ? "Unready" : "Ready"}
                </button>
              ) : (
                <button className="button primary" type="button" onClick={onJoinAsHostPlayer}>
                  <img className="button-icon" src={getIconAssetPath("icon-host")} alt="" aria-hidden="true" />
                  Join as Player
                </button>
              )}
              <button className="button" type="button" onClick={onStartRoom} disabled={!isRoomHost}>
                <img className="button-icon" src={getIconAssetPath("icon-host")} alt="" aria-hidden="true" />
                Start Room (Host)
              </button>
              <button className="button" type="button" onClick={onLeaveRoom}>
                <img className="button-icon" src={getIconAssetPath("icon-logout")} alt="" aria-hidden="true" />
                Leave Room
              </button>
            </>
          ) : (
            <>
              <button className="button primary" type="button" onClick={onEndTurn}>
                <img className="button-icon" src={getIconAssetPath("icon-timer")} alt="" aria-hidden="true" />
                End Turn
              </button>
              <span className="muted">Cards draw automatically at turn start or through card effects.</span>
            </>
          )}
          <button className="button" type="button" onClick={onConcede} disabled={!activeMatchState?.matchId}>
            <img className="button-icon" src={getIconAssetPath("icon-attack")} alt="" aria-hidden="true" />
            Concede 1v1 Match
          </button>
        </div>

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
