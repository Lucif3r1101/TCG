import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import "./App.css";

type AuthMode = "register" | "login" | "forgot" | "reset";

type AuthUser = {
  id: string;
  email: string;
  username: string;
};

type AuthResponse = {
  token: string;
  user: AuthUser;
};

type DeckSummary = {
  id: string;
  name: string;
  isStarter: boolean;
};

type MatchState = {
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

type ActiveMatchResponse = {
  id: string;
  status: "active" | "completed";
  state: MatchState;
};

type MatchFoundPayload = MatchState & {
  you: string;
  opponent: string;
};

type RoomPlayer = {
  userId: string;
  deckId: string;
  ready: boolean;
  joinedAt: string;
};

type RoomState = {
  roomCode: string;
  hostUserId: string;
  maxPlayers: number;
  status: "open" | "in_game";
  createdAt: string;
  players: RoomPlayer[];
};

const TOKEN_KEY = "tcg_auth_token";
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? API_URL;
const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,72}$/;

async function callApi<T>(path: string, method: string, body?: unknown, token?: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const data = (await response.json()) as T | { message?: string };

  if (!response.ok) {
    const message = (data as { message?: string }).message ?? "Request failed.";
    throw new Error(message);
  }

  return data as T;
}

function formatTimer(deadline?: string): string {
  if (!deadline) {
    return "--";
  }

  const remainingMs = new Date(deadline).getTime() - Date.now();
  const seconds = Math.max(0, Math.floor(remainingMs / 1000));
  return `${seconds}s`;
}

function validatePassword(password: string): string | null {
  if (!PASSWORD_RULE.test(password)) {
    return "Use 8+ chars with uppercase, lowercase, number, and symbol.";
  }

  return null;
}

export function App() {
  const [mode, setMode] = useState<AuthMode>("register");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetTokenInput, setResetTokenInput] = useState("");
  const [token, setToken] = useState<string>(() => localStorage.getItem(TOKEN_KEY) ?? "");
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [decks, setDecks] = useState<DeckSummary[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [socketConnected, setSocketConnected] = useState(false);
  const [activeMatchState, setActiveMatchState] = useState<MatchState | null>(null);
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [roomMaxPlayers, setRoomMaxPlayers] = useState(4);
  const [currentRoom, setCurrentRoom] = useState<RoomState | null>(null);
  const [eventLog, setEventLog] = useState<string[]>([]);

  const socketRef = useRef<Socket | null>(null);
  const currentUserId = currentUser?.id ?? "";
  const meInRoom = currentRoom?.players.find((player) => player.userId === currentUserId) ?? null;

  const canSubmit = useMemo(() => {
    if (!email) {
      return false;
    }

    if (mode === "login") {
      return password.length > 0;
    }

    if (mode === "forgot") {
      return true;
    }

    if (!password || !confirmPassword) {
      return false;
    }

    if (mode === "reset" && !resetTokenInput) {
      return false;
    }

    if (mode === "register" && !username) {
      return false;
    }

    return true;
  }, [mode, email, password, confirmPassword, username, resetTokenInput]);

  function appendLog(message: string): void {
    setEventLog((prev) => [`${new Date().toLocaleTimeString()} ${message}`, ...prev].slice(0, 30));
  }

  function clearMessages(): void {
    setErrorMessage("");
    setSuccessMessage("");
  }

  async function loadDecks(authToken: string): Promise<void> {
    const response = await callApi<{ decks: DeckSummary[] }>("/decks", "GET", undefined, authToken);
    setDecks(response.decks);
    if (response.decks.length > 0 && !selectedDeckId) {
      setSelectedDeckId(response.decks[0].id);
    }
  }

  async function loadActiveMatch(authToken: string): Promise<void> {
    const response = await callApi<{ match: ActiveMatchResponse | null }>("/matches/active", "GET", undefined, authToken);
    if (!response.match || response.match.status !== "active") {
      setActiveMatchState(null);
      return;
    }

    setActiveMatchState(response.match.state);
  }

  useEffect(() => {
    if (!token) {
      setCurrentUser(null);
      setDecks([]);
      setSelectedDeckId("");
      setActiveMatchState(null);
      setCurrentRoom(null);
      return;
    }

    void (async () => {
      try {
        const me = await callApi<{ user: AuthUser }>("/auth/me", "GET", undefined, token);
        setCurrentUser(me.user);
        await loadDecks(token);
        await loadActiveMatch(token);
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        setToken("");
        setCurrentUser(null);
      }
    })();
  }, [token]);

  useEffect(() => {
    if (!token || !currentUser) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }

      setSocketConnected(false);
      return;
    }

    const socket = io(SOCKET_URL, {
      transports: ["websocket"],
      auth: { token }
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setSocketConnected(true);
      appendLog("socket connected");
    });

    socket.on("disconnect", () => {
      setSocketConnected(false);
      appendLog("socket disconnected");
    });

    socket.on("realtime_ready", () => appendLog("realtime ready"));
    socket.on("queue_joined", () => appendLog("joined queue"));
    socket.on("queue_left", () => appendLog("left queue"));
    socket.on("queue_error", (payload: { message: string }) => appendLog(`queue error: ${payload.message}`));
    socket.on("room_error", (payload: { message: string }) => appendLog(`room error: ${payload.message}`));
    socket.on("match_error", (payload: { message: string }) => appendLog(`match error: ${payload.message}`));

    socket.on("match_found", (payload: MatchFoundPayload) => {
      setActiveMatchState(payload);
      appendLog(`match found: ${payload.matchId}`);
    });

    socket.on("match_state", (payload: MatchState) => {
      setActiveMatchState(payload);
      appendLog(`turn ${payload.turn}, active ${payload.activePlayerId}`);
    });

    socket.on("match_completed", (payload: MatchState) => {
      setActiveMatchState(payload);
      appendLog(`match completed, winner ${payload.winnerId}`);
    });

    socket.on("room_created", (payload: { roomCode: string }) => {
      setRoomCodeInput(payload.roomCode);
      appendLog(`room created: ${payload.roomCode}`);
    });

    socket.on("room_state", (payload: { room: RoomState }) => {
      setCurrentRoom(payload.room);
      setRoomCodeInput(payload.room.roomCode);
      appendLog(`room state: ${payload.room.roomCode} (${payload.room.players.length}/${payload.room.maxPlayers})`);
    });

    socket.on("room_left", (payload: { roomCode: string }) => {
      if (currentRoom?.roomCode === payload.roomCode) {
        setCurrentRoom(null);
      }
      appendLog(`room left: ${payload.roomCode}`);
    });

    socket.on("room_started", (payload: { roomCode: string; playerCount: number }) => {
      appendLog(`room started: ${payload.roomCode} (${payload.playerCount} players)`);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setSocketConnected(false);
    };
  }, [token, currentUserId, currentRoom?.roomCode]);

  useEffect(() => {
    if (!activeMatchState?.matchId || !socketConnected) {
      return;
    }

    socketRef.current?.emit("match_sync", { matchId: activeMatchState.matchId });
  }, [activeMatchState?.matchId, socketConnected]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }

    clearMessages();

    if (mode === "register" || mode === "reset") {
      const validationError = validatePassword(password);
      if (validationError) {
        setErrorMessage(validationError);
        return;
      }

      if (password !== confirmPassword) {
        setErrorMessage("Password and confirm password do not match.");
        return;
      }
    }

    setIsLoading(true);

    try {
      if (mode === "register") {
        const response = await callApi<AuthResponse>("/auth/register", "POST", { email, username, password });
        localStorage.setItem(TOKEN_KEY, response.token);
        setToken(response.token);
        setCurrentUser(response.user);
        appendLog("register success");
      } else if (mode === "login") {
        const response = await callApi<AuthResponse>("/auth/login", "POST", { email, password });
        localStorage.setItem(TOKEN_KEY, response.token);
        setToken(response.token);
        setCurrentUser(response.user);
        appendLog("login success");
      } else if (mode === "forgot") {
        const response = await callApi<{ message: string; resetToken?: string }>("/auth/forgot-password", "POST", { email });
        setSuccessMessage(response.message);
        if (response.resetToken) {
          setResetTokenInput(response.resetToken);
          setMode("reset");
          setSuccessMessage("Dev token generated. Paste/use it to reset password.");
        }
      } else {
        const response = await callApi<{ message: string }>("/auth/reset-password", "POST", {
          token: resetTokenInput,
          password
        });
        setSuccessMessage(response.message);
        setMode("login");
        setPassword("");
        setConfirmPassword("");
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleLogout() {
    socketRef.current?.disconnect();
    socketRef.current = null;
    localStorage.removeItem(TOKEN_KEY);
    setToken("");
    setCurrentUser(null);
    setActiveMatchState(null);
    setCurrentRoom(null);
    setEventLog([]);
    clearMessages();
  }

  function handleQueueJoin() {
    if (!socketRef.current || !selectedDeckId) {
      return;
    }

    socketRef.current.emit("queue_join", { deckId: selectedDeckId });
  }

  function handleCreateRoom() {
    if (!socketRef.current || !selectedDeckId) {
      return;
    }
    socketRef.current.emit("room_create", { deckId: selectedDeckId, maxPlayers: roomMaxPlayers });
  }

  function handleJoinRoom() {
    if (!socketRef.current || !selectedDeckId || !roomCodeInput) {
      return;
    }
    socketRef.current.emit("room_join", { roomCode: roomCodeInput, deckId: selectedDeckId });
  }

  function handleLeaveRoom() {
    if (!socketRef.current || !currentRoom?.roomCode) {
      return;
    }
    socketRef.current.emit("room_leave", { roomCode: currentRoom.roomCode });
  }

  function handleToggleReady() {
    if (!socketRef.current || !currentRoom?.roomCode || !meInRoom) {
      return;
    }
    socketRef.current.emit("room_ready", { roomCode: currentRoom.roomCode, ready: !meInRoom.ready });
  }

  function handleStartRoom() {
    if (!socketRef.current || !currentRoom?.roomCode) {
      return;
    }
    socketRef.current.emit("room_start", { roomCode: currentRoom.roomCode });
  }

  return (
    <div className="page">
      <section className="hero">
        <div className="hero-content">
          <h1>Chronicles of the Rift</h1>
          <p>
            Build your deck, forge alliances, and survive tactical battles across fractured realms. Now with room-based
            multiplayer lobbies for 2-6 players.
          </p>
        </div>
      </section>

      <section className="panel">
        <div className="card">
          {!currentUser ? (
            <>
              <div className="tabs">
                <button
                  className={`tab ${mode === "register" ? "active" : ""}`}
                  type="button"
                  onClick={() => {
                    clearMessages();
                    setMode("register");
                  }}
                >
                  Register
                </button>
                <button
                  className={`tab ${mode === "login" ? "active" : ""}`}
                  type="button"
                  onClick={() => {
                    clearMessages();
                    setMode("login");
                  }}
                >
                  Login
                </button>
                <button
                  className={`tab ${mode === "forgot" ? "active" : ""}`}
                  type="button"
                  onClick={() => {
                    clearMessages();
                    setMode("forgot");
                  }}
                >
                  Forgot
                </button>
                <button
                  className={`tab ${mode === "reset" ? "active" : ""}`}
                  type="button"
                  onClick={() => {
                    clearMessages();
                    setMode("reset");
                  }}
                >
                  Reset
                </button>
              </div>

              <form className="form" onSubmit={handleSubmit}>
                <label className="label">
                  Email
                  <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </label>

                {mode === "register" ? (
                  <label className="label">
                    Username
                    <input className="input" type="text" value={username} onChange={(e) => setUsername(e.target.value)} required />
                  </label>
                ) : null}

                {mode === "reset" ? (
                  <label className="label">
                    Reset Token
                    <input className="input" type="text" value={resetTokenInput} onChange={(e) => setResetTokenInput(e.target.value)} required />
                  </label>
                ) : null}

                {mode !== "forgot" ? (
                  <label className="label">
                    Password
                    <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                  </label>
                ) : null}

                {mode === "register" || mode === "reset" ? (
                  <label className="label">
                    Confirm Password
                    <input className="input" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
                  </label>
                ) : null}

                {mode === "register" || mode === "reset" ? (
                  <p className="muted">Password must include uppercase, lowercase, number, and symbol.</p>
                ) : null}

                {errorMessage ? <p className="error">{errorMessage}</p> : null}
                {successMessage ? <p className="good">{successMessage}</p> : null}

                <button className="button primary" type="submit" disabled={isLoading || !canSubmit}>
                  {isLoading
                    ? "Working..."
                    : mode === "forgot"
                    ? "Send Reset"
                    : mode === "reset"
                    ? "Reset Password"
                    : mode === "register"
                    ? "Create Account"
                    : "Sign In"}
                </button>
              </form>
            </>
          ) : (
            <div className="grid">
              <div className="meta">
                <span>Username</span>
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

              <label className="label">
                Deck
                <select className="select" value={selectedDeckId} onChange={(e) => setSelectedDeckId(e.target.value)}>
                  <option value="">Select a deck</option>
                  {decks.map((deck) => (
                    <option key={deck.id} value={deck.id}>
                      {deck.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="row">
                <button className="button primary" type="button" onClick={handleQueueJoin} disabled={!socketConnected || !selectedDeckId}>
                  Join Queue
                </button>
                <button className="button" type="button" onClick={() => socketRef.current?.emit("queue_leave")}>
                  Leave Queue
                </button>
                <button className="button" type="button" onClick={() => socketRef.current?.emit("match_end_turn", { matchId: activeMatchState?.matchId })}>
                  End Turn
                </button>
                <button className="button" type="button" onClick={() => socketRef.current?.emit("match_concede", { matchId: activeMatchState?.matchId })}>
                  Concede
                </button>
                <button className="button" type="button" onClick={handleLogout}>
                  Logout
                </button>
              </div>

              <div className="grid">
                <h3 style={{ margin: 0 }}>Rooms (2-6 players)</h3>
                <div className="row">
                  <input
                    className="input"
                    placeholder="Room Code"
                    value={roomCodeInput}
                    onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                  />
                  <select className="select" value={roomMaxPlayers} onChange={(e) => setRoomMaxPlayers(Number(e.target.value))}>
                    <option value={2}>2 Players</option>
                    <option value={3}>3 Players</option>
                    <option value={4}>4 Players</option>
                    <option value={5}>5 Players</option>
                    <option value={6}>6 Players</option>
                  </select>
                </div>
                <div className="row">
                  <button className="button primary" type="button" onClick={handleCreateRoom} disabled={!selectedDeckId || !socketConnected}>
                    Create Room
                  </button>
                  <button className="button" type="button" onClick={handleJoinRoom} disabled={!selectedDeckId || !roomCodeInput || !socketConnected}>
                    Join Room
                  </button>
                  <button className="button" type="button" onClick={handleLeaveRoom} disabled={!currentRoom}>
                    Leave Room
                  </button>
                  <button className="button" type="button" onClick={handleToggleReady} disabled={!currentRoom || !meInRoom}>
                    {meInRoom?.ready ? "Unready" : "Ready"}
                  </button>
                  <button
                    className="button"
                    type="button"
                    onClick={handleStartRoom}
                    disabled={!currentRoom || currentRoom.hostUserId !== currentUserId}
                  >
                    Start Room
                  </button>
                </div>
                {currentRoom ? (
                  <p className="muted">
                    Room <strong>{currentRoom.roomCode}</strong> | Host {currentRoom.hostUserId} | Players {currentRoom.players.length}/
                    {currentRoom.maxPlayers}
                    <br />
                    {currentRoom.players.map((player) => `${player.userId}${player.ready ? " (ready)" : " (not ready)"}`).join(" | ")}
                  </p>
                ) : (
                  <p className="muted">No active room.</p>
                )}
              </div>

              <div className="log">
                {eventLog.length === 0 ? <p>No realtime events yet.</p> : null}
                {eventLog.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
