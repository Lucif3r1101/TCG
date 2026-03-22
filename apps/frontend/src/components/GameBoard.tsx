import { MouseEvent as ReactMouseEvent, SyntheticEvent, useEffect, useRef, useState } from "react";
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
  onConcede: () => void;
  onTilt: (event: ReactMouseEvent<HTMLElement>) => void;
  onTiltReset: (event: ReactMouseEvent<HTMLElement>) => void;
};

type SeatLayout = {
  left: string;
  top: string;
  transform: string;
};

const TABLE_ANGLES: Record<number, number[]> = {
  2: [-90, 90],
  3: [-90, 30, 150],
  4: [-90, 0, 90, 180],
  5: [-90, -24, 34, 146, 204],
  6: [-90, -34, 22, 90, 158, 214]
};

function getCardArtSources(slug: string) {
  if (slug.startsWith("riftforged-sentinel-")) {
    return {
      primary: `/assets/cards/custom/riftforged-sentinel/${slug}.png`,
      fallback: `/assets/cards/generated/png/2x/${slug}.png`,
      finalFallback: `/assets/cards/generated/${slug}.svg`
    };
  }

  if (slug.startsWith("void-ranger-")) {
    return {
      primary: `/assets/cards/custom/void-ranger/${slug}.png`,
      fallback: `/assets/cards/generated/png/2x/${slug}.png`,
      finalFallback: `/assets/cards/generated/${slug}.svg`
    };
  }

  if (slug.startsWith("ironbound-beastmaster-")) {
    return {
      primary: `/assets/cards/custom/ironbound-beastmaster/${slug}.png`,
      fallback: `/assets/cards/generated/png/2x/${slug}.png`,
      finalFallback: `/assets/cards/generated/${slug}.svg`
    };
  }

  if (slug.startsWith("abyss-revenant-")) {
    return {
      primary: `/assets/cards/custom/abyss-revenant/${slug}.png`,
      fallback: `/assets/cards/generated/png/2x/${slug}.png`,
      finalFallback: `/assets/cards/generated/${slug}.svg`
    };
  }

  if (slug.startsWith("ember-arcanist-")) {
    return {
      primary: `/assets/cards/custom/ember-arcanist/${slug}.png`,
      fallback: `/assets/cards/generated/png/2x/${slug}.png`,
      finalFallback: `/assets/cards/generated/${slug}.svg`
    };
  }

  if (slug.startsWith("chronomancer-")) {
    return {
      primary: `/assets/cards/custom/chronomancer/${slug}.png`,
      fallback: `/assets/cards/generated/png/2x/${slug}.png`,
      finalFallback: `/assets/cards/generated/${slug}.svg`
    };
  }

  return {
    primary: `/assets/cards/generated/png/2x/${slug}.png`,
    fallback: `/assets/cards/generated/${slug}.svg`,
    finalFallback: `/assets/cards/generated/${slug}.svg`
  };
}

function handleCardArtError(event: SyntheticEvent<HTMLImageElement, Event>, slug: string) {
  const image = event.currentTarget;
  const { fallback, finalFallback } = getCardArtSources(slug);

  if (image.dataset.fallbackStage === "final") {
    return;
  }

  if (image.src.endsWith(fallback) || image.dataset.fallbackStage === "fallback") {
    image.dataset.fallbackStage = "final";
    image.src = finalFallback;
    return;
  }

  image.dataset.fallbackStage = "fallback";
  image.src = fallback;
}

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

  return (
    <div className="grid">
      <section className="grid room-panel">
        <h3 style={{ margin: 0 }}>Room Lobby</h3>
        <p className="muted">Create a room or join with room code, then choose players and ready up.</p>

        <label className="label">
          Deck
          <select className="select" value={selectedDeckId} onChange={(e) => onDeckChange(e.target.value)}>
            <option value="">Select a deck</option>
            {decks.map((deck) => (
              <option key={deck.id} value={deck.id}>
                {deck.name}
              </option>
            ))}
          </select>
        </label>

        <div className="row">
          <input className="input" placeholder="Room Code" value={roomCodeInput} onChange={(e) => onRoomCodeInput(e.target.value)} />
          <select className="select room-size" value={roomMaxPlayers} onChange={(e) => onRoomMaxPlayersChange(Number(e.target.value))}>
            <option value={2}>2 Players</option>
            <option value={3}>3 Players</option>
            <option value={4}>4 Players</option>
            <option value={5}>5 Players</option>
            <option value={6}>6 Players</option>
          </select>
        </div>
        <div className="host-mode-toggle" role="group" aria-label="Host mode">
          <button
            className={`button ${hostMode === "play" ? "primary" : ""}`}
            type="button"
            onClick={() => onHostModeChange("play")}
          >
            Host + Play
          </button>
          <button
            className={`button ${hostMode === "manage" ? "primary" : ""}`}
            type="button"
            onClick={() => onHostModeChange("manage")}
          >
            Host Only
          </button>
        </div>
        <label className="label">
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

        <div className="row">
          <button className="button primary" type="button" onClick={onCreateRoom} disabled={!selectedDeckId || !socketConnected}>
            <img className="button-icon" src={getIconAssetPath("icon-host")} alt="" aria-hidden="true" />
            Create Room
          </button>
          <button className="button" type="button" onClick={onJoinRoom} disabled={!selectedDeckId || !roomCodeInput || !socketConnected}>
            <img className="button-icon" src={getIconAssetPath("icon-room")} alt="" aria-hidden="true" />
            Join Room
          </button>
          <button className="button" type="button" onClick={onLeaveRoom} disabled={!currentRoom}>
            <img className="button-icon" src={getIconAssetPath("icon-logout")} alt="" aria-hidden="true" />
            Leave Room
          </button>
        </div>

        <div className="row">
          <button className="button" type="button" onClick={onToggleReady} disabled={!currentRoom}>
            <img className="button-icon" src={getIconAssetPath("icon-shield")} alt="" aria-hidden="true" />
            {meReady ? "Unready" : "Ready"}
          </button>
          <button className="button" type="button" onClick={onStartRoom} disabled={!currentRoom || !isRoomHost}>
            <img className="button-icon" src={getIconAssetPath("icon-host")} alt="" aria-hidden="true" />
            Start Room (Host)
          </button>
          <button className="button" type="button" onClick={onQueueJoin} disabled={!socketConnected || !selectedDeckId}>
            <img className="button-icon" src={getIconAssetPath("icon-room")} alt="" aria-hidden="true" />
            Quick Queue
          </button>
        </div>

        {currentRoom ? (
          <p className="muted">
            Room <strong>{currentRoom.roomCode}</strong> | Players {currentRoom.players.length}/{currentRoom.maxPlayers}
            <br />
            Host mode: <strong>{currentRoom.hostMode === "manage" ? "Host Only" : "Host + Play"}</strong>
            <br />
            {currentRoom.players
              .map(
                (player) =>
                  `${player.userId} [${player.characterId}]${player.ready ? " (ready)" : " (not ready)"}`
              )
              .join(" | ")}
          </p>
        ) : (
          <p className="muted">No active room.</p>
        )}
      </section>

      <section className="grid">
        <h3 style={{ margin: 0 }}>Choose Character (1 of 6)</h3>
        <div className="class-grid">
          {CHARACTER_CLASSES.map((character) => (
            (() => {
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
            })()
          ))}
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
  const lastTurnRef = useRef<number | null>(null);
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
  const actorSeatIndex =
    roomAction && currentRoom ? currentRoom.players.findIndex((player) => player.userId === roomAction.actorUserId) : -1;
  const actorSeatPosition = actorSeatIndex >= 0 ? seatPositions[actorSeatIndex] ?? "top" : "top";
  const actorIsMe = Boolean(roomAction?.actorUserId && roomAction.actorUserId === props.currentUserId);
  const targetPlayer = roomAction?.targetUserId
    ? currentRoom?.players.find((player) => player.userId === roomAction.targetUserId) ?? null
    : null;
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

  return (
    <div className="grid">
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

          <div className="zone-strip zone-top" aria-hidden="true">
            <span className="zone-cell">Deck</span>
            <span className="zone-cell">Power Pool</span>
            <span className="zone-cell">Buff/Spell</span>
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
            {roomAction?.actionType === "play" && roomAction.card && targetSeatPosition ? (
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
                  className={`lane-player lane-player-opponent ${hoveredTargetPlayerId === player.userId ? "lane-targeted" : ""}`}
                  onMouseEnter={() => setHoveredTargetPlayerId(player.userId)}
                  onMouseLeave={() => setHoveredTargetPlayerId((current) => (current === player.userId ? null : current))}
                >
                  <header className="lane-player-head">
                    <strong>{player.username}</strong>
                    <span>
                      Mana {player.mana}/{player.maxMana}
                    </span>
                  </header>
                  <div className="lane-slots" aria-hidden="true">
                    {Array.from({ length: 5 }, (_, slotIndex) => (
                      <span key={`${player.userId}-slot-${slotIndex}`} className="lane-slot" />
                    ))}
                  </div>
                  <div className="lane-card-row">
                    {player.board.length === 0 ? <span className="lane-empty">No cards in play</span> : null}
                    {player.board.slice(0, 4).map((card) => (
                      <article
                        key={`${player.userId}-${card.instanceId}`}
                        className={`board-card board-card-opponent ${selectedBoardCardId === card.instanceId ? "board-card-selected" : ""}`}
                        onClick={() => setSelectedBoardCardId((current) => (current === card.instanceId ? null : card.instanceId))}
                      >
                        <img src={getCardArtSources(card.slug).primary} alt={card.name} onError={(event) => handleCardArtError(event, card.slug)} />
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
                    <span>{roomAction.actorUsername} {roomAction.actionType === "play" ? "used" : "drew"} this card</span>
                    <p>{roomAction.card.description}</p>
                    {targetPlayer ? <small>Targeting {targetPlayer.username}</small> : null}
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
                <div className="lane-slots" aria-hidden="true">
                  {Array.from({ length: 5 }, (_, slotIndex) => (
                    <span key={`self-slot-${slotIndex}`} className="lane-slot" />
                  ))}
                </div>
                <div className="lane-card-row">
                  {me?.board.length ? null : <span className="lane-empty">Play units and spells to build your field.</span>}
                  {me?.board.slice(0, 5).map((card) => (
                    <article
                      key={card.instanceId}
                      className={`board-card ${selectedBoardCardId === card.instanceId ? "board-card-selected" : ""}`}
                      onClick={() => setSelectedBoardCardId((current) => (current === card.instanceId ? null : card.instanceId))}
                    >
                      <img src={getCardArtSources(card.slug).primary} alt={card.name} onError={(event) => handleCardArtError(event, card.slug)} />
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

          <div className="zone-strip zone-bottom" aria-hidden="true">
            <span className="zone-cell">Deck</span>
            <span className="zone-cell">Power Pool</span>
            <span className="zone-cell">Buff/Spell</span>
          </div>

          <span className="table-banner banner-left-top" aria-hidden="true" />
          <span className="table-banner banner-left-mid" aria-hidden="true" />
          <span className="table-banner banner-left-bottom" aria-hidden="true" />
          <span className="table-banner banner-right-top" aria-hidden="true" />
          <span className="table-banner banner-right-mid" aria-hidden="true" />
          <span className="table-banner banner-right-bottom" aria-hidden="true" />

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
            {selectedOwnBoardCard ? (
              <article className="inspect-card">
                <strong>Selected Card</strong>
                <img
                  className="inspect-card-art"
                  src={getCardArtSources(selectedOwnBoardCard.slug).primary}
                  alt={selectedOwnBoardCard.name}
                  onError={(event) => handleCardArtError(event, selectedOwnBoardCard.slug)}
                />
                <strong>{selectedOwnBoardCard.name}</strong>
                <span>{selectedOwnBoardCard.description}</span>
                <div className="status-meta">
                  <span className="status-pill">ATK {selectedOwnBoardCard.attack}</span>
                  <span className="status-pill">HP {selectedOwnBoardCard.health}</span>
                  <span className="status-pill">Cost {selectedOwnBoardCard.cost}</span>
                </div>
                <small className="muted">
                  {hoveredTargetPlayer ? `Preview targeting ${hoveredTargetPlayer.username}` : "Select an enemy lane to preview direction."}
                </small>
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
                          : "ended the turn"}
                    </span>
                    {entry.card?.description ? <small>{entry.card.description}</small> : null}
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
