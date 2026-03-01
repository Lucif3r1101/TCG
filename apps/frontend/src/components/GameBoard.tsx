import { MouseEvent as ReactMouseEvent } from "react";
import { CHARACTER_CLASSES } from "../constants/game";
import { AuthUser, DeckSummary, MatchState, RoomState } from "../types/game";
import { formatTimer } from "../lib/api";

type GameBoardProps = {
  currentUser: AuthUser;
  socketConnected: boolean;
  activeMatchState: MatchState | null;
  decks: DeckSummary[];
  selectedDeckId: string;
  roomCodeInput: string;
  roomMaxPlayers: number;
  currentRoom: RoomState | null;
  meReady: boolean;
  isRoomHost: boolean;
  eventLog: string[];
  onDeckChange: (value: string) => void;
  onRoomCodeInput: (value: string) => void;
  onRoomMaxPlayersChange: (value: number) => void;
  onCreateRoom: () => void;
  onJoinRoom: () => void;
  onLeaveRoom: () => void;
  onToggleReady: () => void;
  onStartRoom: () => void;
  onQueueJoin: () => void;
  onLogout: () => void;
  onEndTurn: () => void;
  onConcede: () => void;
  onTilt: (event: ReactMouseEvent<HTMLElement>) => void;
  onTiltReset: (event: ReactMouseEvent<HTMLElement>) => void;
};

export function GameBoard({
  currentUser,
  socketConnected,
  activeMatchState,
  decks,
  selectedDeckId,
  roomCodeInput,
  roomMaxPlayers,
  currentRoom,
  meReady,
  isRoomHost,
  eventLog,
  onDeckChange,
  onRoomCodeInput,
  onRoomMaxPlayersChange,
  onCreateRoom,
  onJoinRoom,
  onLeaveRoom,
  onToggleReady,
  onStartRoom,
  onQueueJoin,
  onLogout,
  onEndTurn,
  onConcede,
  onTilt,
  onTiltReset
}: GameBoardProps) {
  return (
    <div className="grid">
      <div className="meta">
        <span>Commander</span>
        <strong>{currentUser.username}</strong>
        <span>Email</span>
        <strong>{currentUser.email}</strong>
        <span>Socket</span>
        <strong>{socketConnected ? "connected" : "disconnected"}</strong>
        <span>Match</span>
        <strong>{activeMatchState?.matchId ?? "none"}</strong>
        <span>Turn</span>
        <strong>{activeMatchState?.turn ?? "--"}</strong>
        <span>Timer</span>
        <strong>{formatTimer(activeMatchState?.turnDeadlineAt)}</strong>
      </div>

      <div className="turn-banner">
        <div className={`turn-orb ${activeMatchState ? "active" : ""}`} />
        <p>Turn {activeMatchState?.turn ?? "--"}</p>
        <span>Active Player: {activeMatchState?.activePlayerId ?? "Waiting"}</span>
      </div>

      <div className="game-split">
        <section className="grid room-panel">
          <h3 style={{ margin: 0 }}>Step 1: Create or Join Room</h3>
          <p className="muted">Private multiplayer starts from rooms. Quick queue is optional.</p>

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
            <button className="button" type="button" onClick={onLogout}>
              Logout
            </button>
          </div>

          {currentRoom ? (
            <p className="muted">
              Room <strong>{currentRoom.roomCode}</strong> | Players {currentRoom.players.length}/{currentRoom.maxPlayers}
              <br />
              {currentRoom.players.map((player) => `${player.userId}${player.ready ? " (ready)" : " (not ready)"}`).join(" | ")}
            </p>
          ) : (
            <p className="muted">No active room.</p>
          )}
        </section>

        <section className="grid table-panel">
          <h3 style={{ margin: 0 }}>Step 2: Tabletop Arena</h3>
          {currentRoom || activeMatchState ? (
            <>
              <div className="tabletop-grid">
                {Array.from({ length: currentRoom?.maxPlayers ?? 6 }, (_, index) => {
                  const player = currentRoom?.players[index];
                  const isActive = activeMatchState?.activePlayerId && player?.userId === activeMatchState.activePlayerId;
                  return (
                    <article
                      key={`seat-${index}`}
                      className={`table-seat ${player?.ready ? "ready" : ""} ${isActive ? "active-turn" : ""}`}
                      onMouseMove={onTilt}
                      onMouseLeave={onTiltReset}
                    >
                      <p>Seat {index + 1}</p>
                      <strong>{player?.userId ?? "Open Slot"}</strong>
                      <span>{player ? (player.ready ? "Ready" : "Not Ready") : "Waiting"}</span>
                    </article>
                  );
                })}
              </div>

              <div className="row">
                <button className="button" type="button" onClick={onEndTurn} disabled={!activeMatchState?.matchId}>
                  End Turn
                </button>
                <button className="button" type="button" onClick={onConcede} disabled={!activeMatchState?.matchId}>
                  Concede
                </button>
              </div>
            </>
          ) : (
            <p className="muted">Create/join a room first. Once ready, this becomes your live tabletop board.</p>
          )}
        </section>
      </div>

      <div className="class-grid">
        {CHARACTER_CLASSES.map((character) => (
          <article key={character.id} className="class-card" onMouseMove={onTilt} onMouseLeave={onTiltReset}>
            <img className="class-sprite" src={character.sprite} alt={`${character.name} card sprite`} loading="lazy" />
            <span className="chip">{character.tag}</span>
            <strong>{character.name}</strong>
            <p>{character.deckStyle}</p>
            <small>{character.ability}</small>
          </article>
        ))}
      </div>

      <div className="log">
        {eventLog.length === 0 ? <p>No realtime events yet.</p> : null}
        {eventLog.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
    </div>
  );
}
