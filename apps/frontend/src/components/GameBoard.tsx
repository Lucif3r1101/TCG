import { MouseEvent as ReactMouseEvent, useEffect, useRef, useState } from "react";
import { CHARACTER_CLASSES } from "../constants/game";
import { DeckSummary, MatchState, RoomCard, RoomState } from "../types/game";
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
  meReady: boolean;
  isRoomHost: boolean;
  eventLog: string[];
  onDeckChange: (value: string) => void;
  onCharacterChange: (value: string) => void;
  onRoomCodeInput: (value: string) => void;
  onRoomMaxPlayersChange: (value: number) => void;
  onHostModeChange: (value: "play" | "manage") => void;
  onAnimationPresetChange: (value: "subtle" | "balanced" | "cinematic") => void;
  onCreateRoom: () => void;
  onJoinRoom: () => void;
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
    isRoomHost,
    eventLog,
    onDeckChange,
    onCharacterChange,
    onRoomCodeInput,
    onRoomMaxPlayersChange,
    onHostModeChange,
    onAnimationPresetChange,
    onCreateRoom,
    onJoinRoom,
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
              <img className="class-sprite" src={character.sprite} alt={`${character.name} card sprite`} loading="lazy" />
              <span className="chip">{character.tag}</span>
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

      <div className="log">
        {eventLog.length === 0 ? <p>No realtime events yet.</p> : null}
        {eventLog.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
    </div>
  );
}

function TabletopBoard(props: GameBoardProps) {
  const {
    activeMatchState,
    currentRoom,
    privateHand,
    meReady,
    isRoomHost,
    onToggleReady,
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
      <section className="grid table-panel tabletop-only">
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

        <div className={`tabletop-surface anim-${animationPreset} ${turnShift ? "turn-shift" : ""}`}>
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
            <div className="tabletop-core">
              <p className="muted">Chronicles Table</p>
              <strong>{battle?.activePlayerId ? `Active: ${battle.activePlayerId.slice(0, 8)}` : "Waiting to Start"}</strong>
              <span className="muted">{currentRoom?.status === "in_game" ? "Battle in progress" : "Lobby setup phase"}</span>
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
                    <img className="seat-avatar" src={`/assets/avatars/${player.avatarId}.svg`} alt={player.username} />
                    <strong>{player.username}</strong>
                  </div>
                ) : (
                  <strong>Open Slot</strong>
                )}
                {player && playerCharacter ? (
                  <div className="seat-character">
                    <img src={playerCharacter.sprite} alt={playerCharacter.name} loading="lazy" />
                    <div className="seat-character-text">
                      <strong>{playerCharacter.name}</strong>
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

        <div className="row">
          {currentRoom?.status === "open" ? (
            <>
              <button className="button primary" type="button" onClick={onToggleReady}>
                {meReady ? "Unready" : "Ready"}
              </button>
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

        <section className="grid">
          <h4 style={{ margin: 0 }}>Your Hand</h4>
          <div className="hand-zone">
            {privateHand.length === 0 ? <p className="muted">No cards in hand.</p> : null}
            {privateHand.map((card) => (
              <article key={card.instanceId} className="hand-card" onMouseMove={onTilt} onMouseLeave={onTiltReset}>
                <img
                  className="hand-card-art"
                  src={`/assets/cards/generated/png/2x/${card.slug}.png`}
                  alt={card.name}
                  loading="lazy"
                  onError={(event) => {
                    event.currentTarget.src = `/assets/cards/generated/${card.slug}.svg`;
                  }}
                />
                <strong>{card.name}</strong>
                <span className="muted">
                  {card.type} | {card.rarity}
                </span>
                <span className="muted">Cost {card.cost}</span>
                <p className="muted">{card.description}</p>
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
                          Cast on {target.userId.slice(0, 6)}
                        </button>
                      ))
                    : null}
                </div>
              </article>
            ))}
          </div>
        </section>
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
