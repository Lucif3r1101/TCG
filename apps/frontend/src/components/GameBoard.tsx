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
            Create Room
          </button>
          <button className="button" type="button" onClick={onJoinRoom} disabled={!selectedDeckId || !roomCodeInput || !socketConnected}>
            Join Room
          </button>
          <button className="button" type="button" onClick={onLeaveRoom} disabled={!currentRoom}>
            Leave Room
          </button>
        </div>

        <div className="row">
          <button className="button" type="button" onClick={onToggleReady} disabled={!currentRoom}>
            {meReady ? "Unready" : "Ready"}
          </button>
          <button className="button" type="button" onClick={onStartRoom} disabled={!currentRoom || !isRoomHost}>
            Start Room (Host)
          </button>
          <button className="button" type="button" onClick={onQueueJoin} disabled={!socketConnected || !selectedDeckId}>
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
    onDrawCard,
    onPlayCard,
    onConcede,
    onTilt,
    onTiltReset,
    animationPreset
  } = props;
  const battle = currentRoom?.battle;
  const timer = battle?.turnDeadlineAt ?? activeMatchState?.turnDeadlineAt;
  const possibleTargets = (currentRoom?.players ?? []).filter((player) => player.health > 0);
  const seatPositions = ["top", "top-right", "bottom-right", "bottom", "bottom-left", "top-left"] as const;
  const [turnShift, setTurnShift] = useState(false);
  const lastTurnRef = useRef<number | null>(null);
  const turnKey = battle?.turn ?? activeMatchState?.turn ?? null;
  const activePlayerId = battle?.activePlayerId ?? activeMatchState?.activePlayerId;
  const activeSeatIndex =
    activePlayerId && currentRoom ? currentRoom.players.findIndex((player) => player.userId === activePlayerId) : -1;
  const me = currentRoom?.players.find((player) => player.userId === props.currentUserId) ?? null;
  const opponents = (currentRoom?.players ?? []).filter((player) => player.userId !== props.currentUserId);
  const actorPlayer = roomAction ? currentRoom?.players.find((player) => player.userId === roomAction.actorUserId) ?? null : null;
  const actorSeatIndex =
    roomAction && currentRoom ? currentRoom.players.findIndex((player) => player.userId === roomAction.actorUserId) : -1;
  const actorSeatPosition = actorSeatIndex >= 0 ? seatPositions[actorSeatIndex] ?? "top" : "top";
  const targetPlayer = roomAction?.targetUserId
    ? currentRoom?.players.find((player) => player.userId === roomAction.targetUserId) ?? null
    : null;
  const latestActionLabel = roomAction
    ? roomAction.actionType === "draw"
      ? `${roomAction.actorUsername} drew ${roomAction.card?.name ?? "a card"}`
      : roomAction.actionType === "play"
        ? `${roomAction.actorUsername} played ${roomAction.card?.name ?? "a card"}${targetPlayer ? ` on ${targetPlayer.username}` : ""}`
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
                  <div className="row">
                    <button className="button" type="button" onClick={() => onPlayCard(card.instanceId)}>
                      Play
                    </button>
                    {card.type === "spell"
                      ? possibleTargets.map((target) => (
                          <button
                            key={`${card.instanceId}-${target.userId}`}
                            className="button"
                            type="button"
                            onClick={() => onPlayCard(card.instanceId, target.userId)}
                          >
                            Cast
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
                className={`table-travel-card action-${roomAction.actionType.replace("_", "-")} from-${actorSeatPosition}`}
                aria-hidden="true"
              >
                {roomAction.card ? (
                  <img src={getCardArtSources(roomAction.card.slug).primary} alt="" onError={(event) => handleCardArtError(event, roomAction.card!.slug)} />
                ) : (
                  <div className="table-travel-turn-mark">End</div>
                )}
              </div>
            ) : null}
            <div className="battle-lane battle-lane-top">
              {opponents.length === 0 ? <p className="muted">Opponent field will appear here.</p> : null}
              {opponents.map((player) => (
                <section key={player.userId} className="lane-player lane-player-opponent">
                  <header className="lane-player-head">
                    <strong>{player.username}</strong>
                    <span>
                      Mana {player.mana}/{player.maxMana}
                    </span>
                  </header>
                  <div className="lane-card-row">
                    {player.board.length === 0 ? <span className="lane-empty">No cards in play</span> : null}
                    {player.board.slice(0, 4).map((card) => (
                      <article key={`${player.userId}-${card.instanceId}`} className="board-card board-card-opponent">
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
              <strong>{battle?.activePlayerId ? `Active: ${battle.activePlayerId.slice(0, 8)}` : "Waiting to Start"}</strong>
              <span className="muted">{currentRoom?.status === "in_game" ? "Battle in progress" : "Lobby setup phase"}</span>
            </div>
            <div className={`table-action-card ${roomAction ? "visible" : ""} ${roomAction ? `table-action-${roomAction.actionType.replace("_", "-")}` : ""}`}>
              {roomAction?.card ? (
                <>
                  <img src={getCardArtSources(roomAction.card.slug).primary} alt={roomAction.card.name} onError={(event) => handleCardArtError(event, roomAction.card!.slug)} />
                  <div className="table-action-copy">
                    <strong>{roomAction.card.name}</strong>
                    <span>{roomAction.actorUsername} {roomAction.actionType === "play" ? "played" : "drew"} this card</span>
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
                <div className="lane-card-row">
                  {me?.board.length ? null : <span className="lane-empty">Play units and spells to build your field.</span>}
                  {me?.board.slice(0, 5).map((card) => (
                    <article key={card.instanceId} className="board-card">
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
                className={`table-seat seat-${seatPositions[index] ?? "top"} ${player?.ready ? "ready" : ""} ${isActive ? "active-turn" : ""}`}
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
          </aside>
        </div>

        <div className="row">
          {currentRoom?.status === "open" ? (
            <>
              {isInRoom ? (
                <button className="button primary" type="button" onClick={onToggleReady}>
                  {meReady ? "Unready" : "Ready"}
                </button>
              ) : (
                <button className="button primary" type="button" onClick={onJoinAsHostPlayer}>
                  Join as Player
                </button>
              )}
              <button className="button" type="button" onClick={onStartRoom} disabled={!isRoomHost}>
                Start Room (Host)
              </button>
              <button className="button" type="button" onClick={onLeaveRoom}>
                Leave Room
              </button>
            </>
          ) : (
            <>
              <button className="button primary" type="button" onClick={onEndTurn}>
                End Turn
              </button>
              <button className="button" type="button" onClick={onDrawCard}>
                Draw Card
              </button>
            </>
          )}
          <button className="button" type="button" onClick={onConcede} disabled={!activeMatchState?.matchId}>
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
