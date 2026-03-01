import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

type AuthMode = "register" | "login";

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
  player1Id: string;
  player2Id: string;
  player1DeckId: string;
  player2DeckId: string;
  state: {
    turn: number;
    activePlayerId: string;
    winnerId: string | null;
    player1Health: number;
    player2Health: number;
    player1Mana: number;
    player2Mana: number;
    turnDeadlineAt: string;
  };
};

type MatchFoundPayload = MatchState & {
  you: string;
  opponent: string;
};

const TOKEN_KEY = "tcg_auth_token";
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? API_URL;

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

export function App() {
  const [mode, setMode] = useState<AuthMode>("register");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState<string>(() => localStorage.getItem(TOKEN_KEY) ?? "");
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [decks, setDecks] = useState<DeckSummary[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [socketConnected, setSocketConnected] = useState(false);
  const [activeMatchState, setActiveMatchState] = useState<MatchState | null>(null);
  const [eventLog, setEventLog] = useState<string[]>([]);

  const socketRef = useRef<Socket | null>(null);
  const currentUserId = currentUser?.id ?? "";

  const canSubmit = useMemo(() => {
    if (!email || !password) {
      return false;
    }

    if (mode === "register" && !username) {
      return false;
    }

    return true;
  }, [email, password, username, mode]);

  function appendLog(message: string): void {
    setEventLog((prev) => [`${new Date().toLocaleTimeString()} ${message}`, ...prev].slice(0, 24));
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

    setActiveMatchState({
      matchId: response.match.id,
      turn: response.match.state.turn,
      activePlayerId: response.match.state.activePlayerId,
      winnerId: response.match.state.winnerId,
      player1Health: response.match.state.player1Health,
      player2Health: response.match.state.player2Health,
      player1Mana: response.match.state.player1Mana,
      player2Mana: response.match.state.player2Mana,
      turnDeadlineAt: response.match.state.turnDeadlineAt
    });
  }

  useEffect(() => {
    if (!token) {
      setCurrentUser(null);
      setDecks([]);
      setSelectedDeckId("");
      setActiveMatchState(null);
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

    socket.on("realtime_ready", () => {
      appendLog("realtime ready");
    });

    socket.on("queue_joined", () => {
      appendLog("joined queue");
    });

    socket.on("queue_left", () => {
      appendLog("left queue");
    });

    socket.on("queue_error", (payload: { message: string }) => {
      appendLog(`queue error: ${payload.message}`);
    });

    socket.on("match_error", (payload: { message: string }) => {
      appendLog(`match error: ${payload.message}`);
    });

    socket.on("match_found", (payload: MatchFoundPayload) => {
      setActiveMatchState({
        matchId: payload.matchId,
        turn: payload.turn,
        activePlayerId: payload.activePlayerId,
        winnerId: payload.winnerId,
        player1Health: payload.player1Health,
        player2Health: payload.player2Health,
        player1Mana: payload.player1Mana,
        player2Mana: payload.player2Mana,
        turnDeadlineAt: payload.turnDeadlineAt
      });
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

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setSocketConnected(false);
    };
  }, [token, currentUserId]);

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

    setErrorMessage("");
    setIsLoading(true);

    try {
      const endpoint = mode === "register" ? "/auth/register" : "/auth/login";
      const payload = mode === "register" ? { email, username, password } : { email, password };
      const response = await callApi<AuthResponse>(endpoint, "POST", payload);

      localStorage.setItem(TOKEN_KEY, response.token);
      setToken(response.token);
      setCurrentUser(response.user);
      setPassword("");
      appendLog(`${mode} success`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleLogout() {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    localStorage.removeItem(TOKEN_KEY);
    setToken("");
    setCurrentUser(null);
    setActiveMatchState(null);
    setEventLog([]);
  }

  function handleQueueJoin() {
    if (!socketRef.current || !selectedDeckId) {
      return;
    }

    socketRef.current.emit("queue_join", { deckId: selectedDeckId });
  }

  function handleQueueLeave() {
    socketRef.current?.emit("queue_leave");
  }

  function handleEndTurn() {
    if (!activeMatchState?.matchId) {
      return;
    }

    socketRef.current?.emit("match_end_turn", { matchId: activeMatchState.matchId });
  }

  function handleConcede() {
    if (!activeMatchState?.matchId) {
      return;
    }

    socketRef.current?.emit("match_concede", { matchId: activeMatchState.matchId });
  }

  return (
    <main style={{ fontFamily: "system-ui", padding: "2rem", maxWidth: "820px", margin: "0 auto" }}>
      <h1>TCG Day 5 Match Console</h1>
      <p>Auth + queue + live match state + refresh rejoin.</p>

      {currentUser ? (
        <section style={{ display: "grid", gap: "1rem" }}>
          <div>
            <h2>Session</h2>
            <p>
              <strong>Username:</strong> {currentUser.username}
            </p>
            <p>
              <strong>Email:</strong> {currentUser.email}
            </p>
            <p>
              <strong>Socket:</strong> {socketConnected ? "connected" : "disconnected"}
            </p>
            <button type="button" onClick={handleLogout}>
              Logout
            </button>
          </div>

          <div>
            <h2>Queue</h2>
            <label>
              Deck
              <select
                value={selectedDeckId}
                onChange={(event) => setSelectedDeckId(event.target.value)}
                style={{ marginLeft: "0.5rem" }}
              >
                <option value="">Select a deck</option>
                {decks.map((deck) => (
                  <option key={deck.id} value={deck.id}>
                    {deck.name}
                  </option>
                ))}
              </select>
            </label>
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.75rem" }}>
              <button type="button" onClick={handleQueueJoin} disabled={!selectedDeckId || !socketConnected}>
                Join Queue
              </button>
              <button type="button" onClick={handleQueueLeave} disabled={!socketConnected}>
                Leave Queue
              </button>
            </div>
          </div>

          <div>
            <h2>Match</h2>
            <p>
              <strong>Active Match ID:</strong> {activeMatchState?.matchId || "none"}
            </p>
            <p>
              <strong>Turn:</strong> {activeMatchState?.turn ?? "--"}
            </p>
            <p>
              <strong>Active Player:</strong> {activeMatchState?.activePlayerId ?? "--"}
            </p>
            <p>
              <strong>Winner:</strong> {activeMatchState?.winnerId ?? "pending"}
            </p>
            <p>
              <strong>P1 HP/Mana:</strong> {activeMatchState?.player1Health ?? "--"} / {activeMatchState?.player1Mana ?? "--"}
            </p>
            <p>
              <strong>P2 HP/Mana:</strong> {activeMatchState?.player2Health ?? "--"} / {activeMatchState?.player2Mana ?? "--"}
            </p>
            <p>
              <strong>Turn Timer:</strong> {formatTimer(activeMatchState?.turnDeadlineAt)}
            </p>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button type="button" onClick={handleEndTurn} disabled={!activeMatchState?.matchId || !socketConnected}>
                End Turn
              </button>
              <button type="button" onClick={handleConcede} disabled={!activeMatchState?.matchId || !socketConnected}>
                Concede
              </button>
            </div>
          </div>

          <div>
            <h2>Event Log</h2>
            <div style={{ border: "1px solid #ddd", padding: "0.75rem", borderRadius: "8px", minHeight: "160px" }}>
              {eventLog.length === 0 ? <p>No realtime events yet.</p> : null}
              {eventLog.map((line) => (
                <p key={line} style={{ margin: "0.25rem 0", fontFamily: "monospace", fontSize: "0.85rem" }}>
                  {line}
                </p>
              ))}
            </div>
          </div>
        </section>
      ) : (
        <section>
          <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem" }}>
            <button type="button" onClick={() => setMode("register")} disabled={mode === "register"}>
              Register
            </button>
            <button type="button" onClick={() => setMode("login")} disabled={mode === "login"}>
              Login
            </button>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "grid", gap: "0.75rem" }}>
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                style={{ width: "100%" }}
              />
            </label>

            {mode === "register" ? (
              <label>
                Username
                <input
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  required
                  style={{ width: "100%" }}
                />
              </label>
            ) : null}

            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={8}
                style={{ width: "100%" }}
              />
            </label>

            {errorMessage ? <p style={{ color: "crimson" }}>{errorMessage}</p> : null}

            <button type="submit" disabled={isLoading || !canSubmit}>
              {isLoading ? "Please wait..." : mode === "register" ? "Create account" : "Sign in"}
            </button>
          </form>
        </section>
      )}
    </main>
  );
}
