import { FormEvent, MouseEvent as ReactMouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import "./App.css";
import { AuthPanel } from "./components/AuthPanel";
import { GameBoard } from "./components/GameBoard";
import { TopNav } from "./components/TopNav";
import { ForgotPasswordModal } from "./components/modals/ForgotPasswordModal";
import { GuideModal } from "./components/modals/GuideModal";
import { LegalModal } from "./components/modals/LegalModal";
import { CHARACTER_CLASSES } from "./constants/game";
import { DEFAULT_AVATAR_IDS, ONBOARDING_KEY, PASSWORD_RULE, SOCKET_URL, TOKEN_KEY } from "./constants/game";
import { useAudioEngine } from "./hooks/useAudioEngine";
import { callApi } from "./lib/api";
import {
  ActiveMatchResponse,
  AuthMode,
  AuthResponse,
  AuthUser,
  DeckSummary,
  GuideSection,
  MatchFoundPayload,
  MatchState,
  RoomCard,
  RoomState
} from "./types/game";

function validatePassword(password: string): string | null {
  if (!PASSWORD_RULE.test(password)) {
    return "Use 8+ chars with uppercase, lowercase, number, and symbol.";
  }
  return null;
}

export function App() {
  type ToastKind = "info" | "error" | "success";
  type ToastItem = { id: string; message: string; kind: ToastKind };

  const [mode, setMode] = useState<AuthMode>("register");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState<"request" | "reset">("request");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotToken, setForgotToken] = useState("");
  const [forgotPassword, setForgotPassword] = useState("");
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState("");
  const [forgotPasswordVisible, setForgotPasswordVisible] = useState(false);
  const [forgotConfirmVisible, setForgotConfirmVisible] = useState(false);
  const [forgotMessage, setForgotMessage] = useState("");
  const [forgotError, setForgotError] = useState("");
  const [token, setToken] = useState<string>(() => localStorage.getItem(TOKEN_KEY) ?? "");
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [decks, setDecks] = useState<DeckSummary[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [selectedAvatarId, setSelectedAvatarId] = useState<string>(DEFAULT_AVATAR_IDS[0]);
  const [legalView, setLegalView] = useState<"terms" | "privacy" | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [activeMatchState, setActiveMatchState] = useState<MatchState | null>(null);
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [roomMaxPlayers, setRoomMaxPlayers] = useState(4);
  const [hostMode, setHostMode] = useState<"play" | "manage">("play");
  const [animationPreset, setAnimationPreset] = useState<"subtle" | "balanced" | "cinematic">("balanced");
  const [selectedCharacterId, setSelectedCharacterId] = useState<string>(CHARACTER_CLASSES[0].id);
  const [currentRoom, setCurrentRoom] = useState<RoomState | null>(null);
  const [privateHand, setPrivateHand] = useState<RoomCard[]>([]);
  const [tabletopMode, setTabletopMode] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideSection, setGuideSection] = useState<GuideSection>("lore");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [impact, setImpact] = useState(false);
  const [, setClockTick] = useState(0);

  const socketRef = useRef<Socket | null>(null);
  const impactTimerRef = useRef<number | null>(null);
  const lastTurnRef = useRef<number | null>(null);
  const currentUserId = currentUser?.id ?? "";
  const meInRoom = currentRoom?.players.find((player) => player.userId === currentUserId) ?? null;
  const isRoomHost = Boolean(currentRoom && currentRoom.hostUserId === currentUserId);
  const { playSfx } = useAudioEngine(soundEnabled);

  const canSubmit = useMemo(() => {
    if (!/\S+@\S+\.\S+/.test(email)) {
      return false;
    }
    if (mode === "login") {
      return password.length > 0;
    }
    return username.length > 0 && password.length > 0 && confirmPassword.length > 0 && acceptedTerms;
  }, [mode, email, username, password, confirmPassword, acceptedTerms]);

  function pushToast(message: string, kind: ToastKind = "info"): void {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts((prev) => [...prev.slice(-3), { id, message, kind }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((entry) => entry.id !== id));
    }, 3600);
  }

  function clearMessages(): void {
    setErrorMessage("");
    setSuccessMessage("");
  }

  function clearForgotMessages(): void {
    setForgotMessage("");
    setForgotError("");
  }

  function triggerImpact(): void {
    setImpact(true);
    playSfx("error");
    if (impactTimerRef.current) {
      window.clearTimeout(impactTimerRef.current);
    }
    impactTimerRef.current = window.setTimeout(() => setImpact(false), 240);
  }

  function applyTilt(event: ReactMouseEvent<HTMLElement>): void {
    const element = event.currentTarget;
    const rect = element.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const rx = ((y / rect.height) * -8 + 4).toFixed(2);
    const ry = ((x / rect.width) * 8 - 4).toFixed(2);
    element.style.setProperty("--rx", `${rx}deg`);
    element.style.setProperty("--ry", `${ry}deg`);
  }

  function resetTilt(event: ReactMouseEvent<HTMLElement>): void {
    const element = event.currentTarget;
    element.style.setProperty("--rx", "0deg");
    element.style.setProperty("--ry", "0deg");
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
      setPrivateHand([]);
      setTabletopMode(false);
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
    if (!currentUser) {
      return;
    }
    const key = `${ONBOARDING_KEY}_${currentUser.id}`;
    if (localStorage.getItem(key)) {
      return;
    }
    localStorage.setItem(key, "1");
    setGuideSection("lore");
    setGuideOpen(true);
  }, [currentUser?.id]);

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
      pushToast("Realtime connected.", "success");
    });
    socket.on("disconnect", () => {
      setSocketConnected(false);
      pushToast("Realtime disconnected.");
    });
    socket.on("realtime_ready", () => pushToast("Realtime ready.", "success"));
    socket.on("queue_joined", () => pushToast("Joined queue.", "success"));
    socket.on("queue_left", () => pushToast("Left queue."));
    socket.on("queue_error", (payload: { message: string }) => {
      triggerImpact();
      pushToast(payload.message, "error");
    });
    socket.on("room_error", (payload: { message: string }) => {
      triggerImpact();
      pushToast(payload.message, "error");
    });
    socket.on("match_error", (payload: { message: string }) => {
      triggerImpact();
      pushToast(payload.message, "error");
    });
    socket.on("match_found", (payload: MatchFoundPayload) => {
      setActiveMatchState(payload);
      pushToast("Match found.", "success");
    });
    socket.on("match_state", (payload: MatchState) => {
      setActiveMatchState(payload);
      if (lastTurnRef.current !== payload.turn) {
        playSfx("turn");
      }
      lastTurnRef.current = payload.turn;
      pushToast(`Turn ${payload.turn} started.`);
    });
    socket.on("match_completed", (payload: MatchState) => {
      setActiveMatchState(payload);
      pushToast("Match completed.", "success");
    });
    socket.on("room_created", (payload: { roomCode: string }) => {
      setRoomCodeInput(payload.roomCode);
      pushToast(`Room created: ${payload.roomCode}`, "success");
    });
    socket.on("room_state", (payload: { room: RoomState }) => {
      setCurrentRoom(payload.room);
      setRoomCodeInput(payload.room.roomCode);
      setTabletopMode(true);
    });
    socket.on("room_private_state", (payload: { hand: RoomCard[] }) => {
      setPrivateHand(payload.hand ?? []);
    });
    socket.on("room_left", (payload: { roomCode: string }) => {
      if (currentRoom?.roomCode === payload.roomCode) {
        setCurrentRoom(null);
        setPrivateHand([]);
        setTabletopMode(false);
      }
      pushToast("You left the room.");
    });
    socket.on("room_started", (payload: { roomCode: string; playerCount: number }) => {
      setTabletopMode(true);
      pushToast(`Room started (${payload.playerCount} players).`, "success");
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setSocketConnected(false);
    };
  }, [token, currentUserId, playSfx]);

  useEffect(() => {
    if (!activeMatchState?.matchId || !socketConnected) {
      return;
    }
    socketRef.current?.emit("match_sync", { matchId: activeMatchState.matchId });
  }, [activeMatchState?.matchId, socketConnected]);

  useEffect(() => {
    const id = window.setInterval(() => setClockTick((v) => (v + 1) % 100000), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    return () => {
      if (impactTimerRef.current) {
        window.clearTimeout(impactTimerRef.current);
      }
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }
    clearMessages();

    if (mode === "register") {
      const passwordError = validatePassword(password);
      if (passwordError) {
        setErrorMessage(passwordError);
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage("Password and confirm password do not match.");
        return;
      }
      if (!/^[a-zA-Z0-9_]{3,24}$/.test(username)) {
        setErrorMessage("Username must be 3-24 chars and only letters, numbers, underscore.");
        return;
      }
    }

    setIsLoading(true);
    try {
      if (mode === "register") {
        const response = await callApi<AuthResponse>("/auth/register", "POST", {
          email,
          username,
          password,
          avatarId: selectedAvatarId
        });
        localStorage.setItem(TOKEN_KEY, response.token);
        setToken(response.token);
        setCurrentUser(response.user);
        setSuccessMessage("Account created successfully.");
        pushToast("Register success.", "success");
      } else {
        const response = await callApi<AuthResponse>("/auth/login", "POST", { email, password });
        localStorage.setItem(TOKEN_KEY, response.token);
        setToken(response.token);
        setCurrentUser(response.user);
        setSuccessMessage("Welcome back.");
        pushToast("Login success.", "success");
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Authentication failed.");
      triggerImpact();
    } finally {
      setIsLoading(false);
    }
  }

  function handleLogout() {
    playSfx("click");
    socketRef.current?.disconnect();
    socketRef.current = null;
    localStorage.removeItem(TOKEN_KEY);
    setToken("");
    setCurrentUser(null);
    setActiveMatchState(null);
    setCurrentRoom(null);
    setPrivateHand([]);
    setTabletopMode(false);
    setToasts([]);
    clearMessages();
  }

  function handleQueueJoin() {
    if (!socketRef.current) {
      pushToast("Realtime is not connected.", "error");
      return;
    }
    if (!selectedDeckId) {
      pushToast("Select a deck before joining queue.", "error");
      return;
    }
    playSfx("click");
    socketRef.current.emit("queue_join", { deckId: selectedDeckId });
  }

  function handleCreateRoom() {
    if (!socketRef.current) {
      pushToast("Realtime is not connected.", "error");
      return;
    }
    if (!selectedDeckId) {
      pushToast("Deck is required to create a room.", "error");
      return;
    }
    if (!selectedCharacterId) {
      pushToast("Choose a character first.", "error");
      return;
    }
    playSfx("click");
    socketRef.current.emit("room_create", {
      deckId: selectedDeckId,
      characterId: selectedCharacterId,
      hostMode,
      maxPlayers: roomMaxPlayers
    });
  }

  function handleJoinRoom() {
    if (!socketRef.current) {
      pushToast("Realtime is not connected.", "error");
      return;
    }
    if (!selectedDeckId) {
      pushToast("Deck is required to join a room.", "error");
      return;
    }
    if (!selectedCharacterId) {
      pushToast("Choose a character before joining.", "error");
      return;
    }
    if (!roomCodeInput) {
      pushToast("Room code is required to join.", "error");
      return;
    }
    playSfx("click");
    socketRef.current.emit("room_join", {
      roomCode: roomCodeInput,
      deckId: selectedDeckId,
      characterId: selectedCharacterId
    });
  }

  function handleJoinAsHostPlayer() {
    if (!socketRef.current) {
      pushToast("Realtime is not connected.", "error");
      return;
    }
    if (!selectedDeckId) {
      pushToast("Select a deck first.", "error");
      return;
    }
    if (!selectedCharacterId) {
      pushToast("Choose a character first.", "error");
      return;
    }
    if (!currentRoom?.roomCode) {
      pushToast("No active room found.", "error");
      return;
    }
    playSfx("click");
    socketRef.current.emit("room_join", {
      roomCode: currentRoom.roomCode,
      deckId: selectedDeckId,
      characterId: selectedCharacterId
    });
  }

  function handleLeaveRoom() {
    if (!socketRef.current || !currentRoom?.roomCode) {
      return;
    }
    playSfx("click");
    socketRef.current.emit("room_leave", { roomCode: currentRoom.roomCode });
    setPrivateHand([]);
    setTabletopMode(false);
  }

  function handleToggleReady() {
    if (!socketRef.current || !currentRoom?.roomCode || !meInRoom) {
      return;
    }
    playSfx("click");
    socketRef.current.emit("room_ready", { roomCode: currentRoom.roomCode, ready: !meInRoom.ready });
  }

  function handleStartRoom() {
    if (!socketRef.current || !currentRoom?.roomCode) {
      pushToast("No active room found.", "error");
      return;
    }
    if (currentRoom.players.length < 2) {
      pushToast("At least 2 players are required to start.", "error");
      return;
    }
    if (!currentRoom.players.every((player) => player.ready)) {
      pushToast("All players must be ready before start.", "error");
      return;
    }
    playSfx("click");
    socketRef.current.emit("room_start", { roomCode: currentRoom.roomCode });
  }

  async function handleForgotRequest() {
    clearForgotMessages();
    if (!/\S+@\S+\.\S+/.test(forgotEmail)) {
      setForgotError("Enter a valid email address.");
      return;
    }
    try {
      const response = await callApi<{ message: string; resetToken?: string }>("/auth/forgot-password", "POST", { email: forgotEmail });
      setForgotMessage(response.message);
      if (response.resetToken) {
        setForgotToken(response.resetToken);
        setForgotStep("reset");
        setForgotMessage("Dev token generated. Use it below to set a new password.");
      }
    } catch (error) {
      setForgotError(error instanceof Error ? error.message : "Failed to request reset.");
      triggerImpact();
    }
  }

  async function handleForgotReset() {
    clearForgotMessages();
    const passwordError = validatePassword(forgotPassword);
    if (passwordError) {
      setForgotError(passwordError);
      return;
    }
    if (forgotPassword !== forgotConfirmPassword) {
      setForgotError("Password and confirm password do not match.");
      return;
    }
    if (!forgotToken) {
      setForgotError("Reset token is required.");
      return;
    }
    try {
      const response = await callApi<{ message: string }>("/auth/reset-password", "POST", { token: forgotToken, password: forgotPassword });
      setForgotMessage(response.message);
      setForgotPassword("");
      setForgotConfirmPassword("");
      setMode("login");
    } catch (error) {
      setForgotError(error instanceof Error ? error.message : "Failed to reset password.");
      triggerImpact();
    }
  }

  return (
    <div className={`page ${impact ? "impact" : ""} ${tabletopMode ? "tabletop-page" : ""}`}>
      <TopNav
        soundEnabled={soundEnabled}
        showLogout={Boolean(currentUser)}
        username={currentUser?.username}
        onOpenGuide={() => {
          playSfx("click");
          setGuideSection("how");
          setGuideOpen(true);
        }}
        onToggleSound={() => {
          setSoundEnabled((value) => !value);
        }}
        onLogout={handleLogout}
      />

      {!currentUser || !tabletopMode ? (
        <section className="hero">
          <div className="hero-content">
            <h1>Chronicles of the RIFT</h1>
            <p>
              First-time players get a guided lore and battle tutorial. Returning players can always reopen How to Play from
              the top bar.
            </p>
          </div>
        </section>
      ) : null}

      <section className="panel">
        <div className="card">
          {!currentUser ? (
            <AuthPanel
              mode={mode}
              email={email}
              username={username}
              password={password}
              confirmPassword={confirmPassword}
              passwordVisible={passwordVisible}
              confirmPasswordVisible={confirmPasswordVisible}
              acceptedTerms={acceptedTerms}
              selectedAvatarId={selectedAvatarId}
              canSubmit={canSubmit}
              isLoading={isLoading}
              errorMessage={errorMessage}
              successMessage={successMessage}
              onSetMode={(nextMode) => {
                clearMessages();
                setMode(nextMode);
              }}
              onEmailChange={setEmail}
              onUsernameChange={setUsername}
              onPasswordChange={setPassword}
              onConfirmPasswordChange={setConfirmPassword}
              onTogglePasswordVisible={() => setPasswordVisible((value) => !value)}
              onToggleConfirmPasswordVisible={() => setConfirmPasswordVisible((value) => !value)}
              onAcceptedTermsChange={setAcceptedTerms}
              onAvatarChange={setSelectedAvatarId}
              onOpenTerms={() => setLegalView("terms")}
              onOpenPrivacy={() => setLegalView("privacy")}
              onOpenForgot={() => {
                clearForgotMessages();
                setForgotOpen(true);
                setForgotStep("request");
                setForgotEmail(email);
              }}
              onSubmit={handleSubmit}
            />
          ) : (
            <GameBoard
              currentUserId={currentUser.id}
              socketConnected={socketConnected}
              activeMatchState={activeMatchState}
              decks={decks}
              selectedDeckId={selectedDeckId}
              roomCodeInput={roomCodeInput}
              roomMaxPlayers={roomMaxPlayers}
              hostMode={hostMode}
              animationPreset={animationPreset}
              selectedCharacterId={selectedCharacterId}
              tabletopMode={tabletopMode}
              currentRoom={currentRoom}
              privateHand={privateHand}
              meReady={Boolean(meInRoom?.ready)}
              isInRoom={Boolean(meInRoom)}
              isRoomHost={isRoomHost}
              onDeckChange={setSelectedDeckId}
              onRoomCodeInput={(value) => setRoomCodeInput(value.toUpperCase())}
              onRoomMaxPlayersChange={setRoomMaxPlayers}
              onHostModeChange={setHostMode}
              onAnimationPresetChange={setAnimationPreset}
              onCharacterChange={setSelectedCharacterId}
              onCreateRoom={handleCreateRoom}
              onJoinRoom={handleJoinRoom}
              onJoinAsHostPlayer={handleJoinAsHostPlayer}
              onLeaveRoom={handleLeaveRoom}
              onToggleReady={handleToggleReady}
              onStartRoom={handleStartRoom}
              onQueueJoin={handleQueueJoin}
              onEndTurn={() =>
                currentRoom?.status === "in_game"
                  ? socketRef.current?.emit("room_end_turn", { roomCode: currentRoom.roomCode })
                  : socketRef.current?.emit("match_end_turn", { matchId: activeMatchState?.matchId })
              }
              onDrawCard={() => (currentRoom ? socketRef.current?.emit("room_draw_card", { roomCode: currentRoom.roomCode }) : undefined)}
              onPlayCard={(cardInstanceId, targetUserId) =>
                currentRoom
                  ? socketRef.current?.emit("room_play_card", { roomCode: currentRoom.roomCode, cardInstanceId, targetUserId })
                  : undefined
              }
              onConcede={() => socketRef.current?.emit("match_concede", { matchId: activeMatchState?.matchId })}
              onTilt={applyTilt}
              onTiltReset={resetTilt}
            />
          )}
          <p className="muted footer-note">© 2026 Chronicles of the RIFT. All rights reserved.</p>
        </div>
      </section>

      <div className="toast-stack" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.kind}`}>
            {toast.message}
          </div>
        ))}
      </div>
      <GuideModal open={guideOpen} section={guideSection} onSectionChange={setGuideSection} onClose={() => setGuideOpen(false)} />
      <LegalModal view={legalView} onClose={() => setLegalView(null)} />
      <ForgotPasswordModal
        open={forgotOpen}
        step={forgotStep}
        email={forgotEmail}
        token={forgotToken}
        password={forgotPassword}
        confirmPassword={forgotConfirmPassword}
        passwordVisible={forgotPasswordVisible}
        confirmVisible={forgotConfirmVisible}
        error={forgotError}
        message={forgotMessage}
        onEmailChange={setForgotEmail}
        onTokenChange={setForgotToken}
        onPasswordChange={setForgotPassword}
        onConfirmPasswordChange={setForgotConfirmPassword}
        onTogglePasswordVisible={() => setForgotPasswordVisible((value) => !value)}
        onToggleConfirmVisible={() => setForgotConfirmVisible((value) => !value)}
        onRequestReset={handleForgotRequest}
        onSubmitReset={handleForgotReset}
        onChangeStep={setForgotStep}
        onClose={() => setForgotOpen(false)}
      />
    </div>
  );
}
