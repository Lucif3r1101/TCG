import { MouseEvent as ReactMouseEvent, Suspense, SyntheticEvent, lazy, useEffect, useRef, useState } from "react";
import {
  CARD_BACK_ASSET_PATH,
  API_URL,
  CHARACTER_CLASSES,
  DECK_BACK_ASSET_PATH,
  getAvatarAssetPath,
  getAvatarFallbackPath,
  getIconAssetPath
} from "../constants/game";
import { FACTIONS } from "../constants/lore";
import { DeckSummary, MatchState, RoomActionEvent, RoomCard, RoomState } from "../types/game";
import { formatTimer } from "../lib/api";
import { getCardArtSources, handleCardArtError, getCrestSource, getRealmSource } from "../lib/cardArt";
import { DetailCard } from "./CardDetailModal";
import { CardView } from "./CardView";

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

const FACTION_COLORS: Record<string, string> = {
  "riftforged-sentinel": "#e0b357",
  "void-ranger": "#a855f7",
  "ember-arcanist": "#ef6a36",
  "ironbound-beastmaster": "#6abf4b",
  "chronomancer": "#33b6ff",
  "abyss-revenant": "#14c8a0",
};

function ChampionDetail({ champ, taken, isSel, onSelect, onClose, onCardInfo }: { champ: typeof CHARACTER_CLASSES[number]; taken: boolean; isSel: boolean; onSelect: () => void; onClose: () => void; onCardInfo: (card: DetailCard) => void }) {
  const [cards, setCards] = useState<DetailCard[]>([]);
  const faction = FACTIONS.find((f) => f.id === champ.id);
  const lore = faction?.lore ?? "";
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/cards`);
        const data = (await res.json()) as { cards: DetailCard[] };
        if (!active) return;
        setCards((data.cards ?? []).filter((c) => (c.faction === champ.id) || c.slug.startsWith(champ.id)));
      } catch { /* ignore */ }
    })();
    return () => { active = false; };
  }, [champ.id]);
  return (
    <div className="champ-detail-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="champ-detail" onClick={(e) => e.stopPropagation()} style={{ ["--realm" as string]: `url(/assets/realms/${champ.id}.jpg)` }}>
        <button className="champ-detail-close" type="button" onClick={onClose} aria-label="Close">×</button>
        <div className="champ-detail-hero">
          <img className="champ-detail-sprite" src={champ.sprite} alt={champ.name} />
          <div className="champ-detail-meta">
            <div className="champ-detail-crestrow">
              <img className="champ-detail-crest" src={champ.crest} alt="" aria-hidden="true" />
              <span className="champ-card-tag">{champ.tag}</span>
            </div>
            <h2 className="champ-detail-name">{champ.name}</h2>
            <p className="champ-detail-style">{champ.deckStyle}</p>
            <div className="champ-card-ability"><span className="champ-ability-label">✦ Signature Ability</span> {champ.ability}</div>
            <button className="gold-btn champ-detail-select" type="button" disabled={taken} onClick={onSelect}>
              {isSel ? "✓ Selected" : taken ? "Taken" : "⚔ Select this Champion"}
            </button>
          </div>
        </div>

        <div className="champ-detail-lore-grid">
          {faction ? (
            <div className="champ-detail-lore">
              <div className="gp-label">THE REALM · {faction.realm.toUpperCase()}</div>
              <p>{faction.blurb}</p>
            </div>
          ) : null}
          {lore ? (
            <div className="champ-detail-lore">
              <div className="gp-label">HOW IT CAME TO THE RIFT</div>
              <p>{lore}</p>
            </div>
          ) : null}
        </div>

        <div className="champ-detail-lib">
          <div className="gp-label">{champ.name.toUpperCase()} · CARD LIBRARY ({cards.length})</div>
          <div className="champ-lib-grid">
            {cards.map((card) => (
              <div key={card.slug} className="champ-lib-cell" role="button" tabIndex={0} onClick={() => onCardInfo(card)}>
                <img className="champ-lib-card" src={getCardArtSources(card.slug).primary} alt={card.name} loading="lazy" onError={(e) => handleCardArtError(e, card.slug)} />
                <span className="champ-lib-frame" aria-hidden="true" />
                <button className="champ-lib-info card-info-btn" type="button" onClick={(e) => { e.stopPropagation(); onCardInfo(card); }} aria-label="Card details">ⓘ</button>
              </div>
            ))}
            {cards.length === 0 ? <p className="muted">Loading cards…</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function ChampionCarousel({ selectedId, takenIds, onSelect, onViewRealm }: { selectedId: string; takenIds: string[]; onSelect: (id: string) => void; onViewRealm: (id: string) => void }) {
  const champs = CHARACTER_CLASSES;
  const [idx, setIdx] = useState(() => Math.max(0, champs.findIndex((c) => c.id === selectedId)));
  const [dir, setDir] = useState(1);
  useEffect(() => {
    const t = window.setInterval(() => { setDir(1); setIdx((i) => (i + 1) % champs.length); }, 5000);
    return () => window.clearInterval(t);
  }, [champs.length]);
  const go = (d: number) => { setDir(d); setIdx((i) => (i + d + champs.length) % champs.length); };
  const champ = champs[idx];
  const taken = takenIds.includes(champ.id) && champ.id !== selectedId;
  const isSel = selectedId === champ.id;

  return (
    <div className="champ-carousel">
      <button className="champ-arrow left" type="button" onClick={() => go(-1)} aria-label="Previous champion">‹</button>
      <div key={idx} className={`champ-card character-${champ.id} ${dir > 0 ? "slide-from-right" : "slide-from-left"} ${isSel ? "is-selected" : ""}`}>
        <div className="champ-card-art" style={{ backgroundImage: `linear-gradient(180deg, rgba(8,12,22,0.08), rgba(8,12,22,0.95)), url(/assets/realms/${champ.id}.jpg)` }}>
          <img className="champ-card-sprite" src={champ.sprite} alt={champ.name} loading="lazy" />
          <img className="champ-card-crest" src={champ.crest} alt="" aria-hidden="true" />
          <span className="champ-card-tag">{champ.tag}</span>
        </div>
        <div className="champ-card-body">
          <strong className="champ-card-name">{champ.name}</strong>
          <p className="champ-card-style">{champ.deckStyle}</p>
          <div className="champ-card-ability"><span className="champ-ability-label">✦ Signature</span> {champ.ability}</div>
          <div className="champ-card-actions">
            <button className="gold-btn champ-choose-btn" type="button" disabled={taken} onClick={() => onSelect(champ.id)}>
              {isSel ? "✓ Chosen" : taken ? "Taken" : "⚔ Choose"}
            </button>
            <button className="gold-btn ghost champ-realm-btn" type="button" onClick={() => onViewRealm(champ.id)}>Understand the Realm</button>
          </div>
        </div>
      </div>
      <button className="champ-arrow right" type="button" onClick={() => go(1)} aria-label="Next champion">›</button>
      <div className="champ-dots">
        {champs.map((c, i) => (
          <button key={c.id} type="button" className={`champ-dot ${i === idx ? "on" : ""}`} onClick={() => { setDir(i > idx ? 1 : -1); setIdx(i); }} aria-label={c.name} />
        ))}
      </div>
    </div>
  );
}

function LobbyView(props: GameBoardProps) {
  const {
    currentUserId,
    socketConnected,
    selectedCharacterId,
    roomCodeInput,
    roomMaxPlayers,
    hostMode,
    currentRoom,
    meReady,
    isRoomHost,
    onCharacterChange,
    onRoomCodeInput,
    onRoomMaxPlayersChange,
    onHostModeChange,
    onCreateRoom,
    onJoinRoom,
    onLeaveRoom,
    onToggleReady,
    onStartRoom,
    onPractice
  } = props;

  const inRoom = Boolean(currentRoom);
  const [realmDetailId, setRealmDetailId] = useState<string | null>(null);
  const [libCard, setLibCard] = useState<DetailCard | null>(null);
  const detailChamp = CHARACTER_CLASSES.find((c) => c.id === realmDetailId);
  const selectedChamp = CHARACTER_CLASSES.find((c) => c.id === selectedCharacterId);
  const takenIds = (currentRoom?.players ?? []).filter((p) => p.userId !== currentUserId).map((p) => p.characterId);

  const rosterPlayers = inRoom
    ? (currentRoom?.players ?? [])
    : [];

  return (
    <div className="rift-lobby">
      <div className="rift-lobby-bg" aria-hidden="true">
        {(() => {
          // Full-screen realm slideshow. Add more files to this list as new realm art is created.
          const realms = [
            "riftforged-sentinel.jpg", "riftforged-sentinel-2.png", "riftforged-sentinel-3.png",
            "void-ranger.jpg", "void-ranger-2.png", "void-ranger-3.png",
            "ember-arcanist.jpg", "ember-arcanist-2.png", "ember-arcanist-3.png",
            "ironbound-beastmaster.jpg", "ironbound-beastmaster-2.png", "ironbound-beastmaster-3.png",
            "chronomancer.jpg", "chromomancer-2.png", "chromomance-3.png",
            "abyss-revenant.jpg", "abyss-revenant-2.png", "abyss-revenant-3.png",
          ].map((f) => `/assets/realms/${f}`);
          const per = 5;
          const total = realms.length;
          return realms.map((src, i) => (
            <div
              key={i}
              className="rift-lobby-slide"
              style={{ backgroundImage: `url(${src})`, animationDelay: `${i * per}s`, animationDuration: `${total * per}s` }}
            />
          ));
        })()}
        <div className="rift-lobby-bg-veil" />
      </div>

      <div className="rift-lobby-head">
        <div className="rift-lobby-kicker">WAR COUNCIL CHAMBER</div>
        <h1 className="rift-lobby-title">{inRoom ? "Room Lobby" : "Choose Your Champion"}</h1>
        {selectedChamp && !inRoom && !realmDetailId ? (
          <div className="champ-pill champ-pill-head" style={{ ["--realm-col" as string]: FACTION_COLORS[selectedChamp.id] ?? "#e7c46b" }}>
            <img className="champ-pill-crest" src={selectedChamp.crest} alt="" aria-hidden="true" />
            <div className="champ-pill-info">
              <span className="champ-pill-label">YOUR CHAMPION</span>
              <strong className="champ-pill-name">{selectedChamp.name}</strong>
            </div>
          </div>
        ) : null}
      </div>

      {inRoom ? (
        (() => {
          const max = currentRoom?.maxPlayers ?? rosterPlayers.length;
          const readyCount = rosterPlayers.filter((p) => p.ready).length;
          const slots = Array.from({ length: max }, (_, i) => rosterPlayers[i] ?? null);
          return (
            <div className="rift-waitroom">
              <div className="waitroom-banner">
                <div className="waitroom-code">
                  <span className="gp-label">ROOM CODE</span>
                  <strong>{currentRoom?.roomCode}</strong>
                </div>
                <div className="waitroom-meta">
                  <span className="waitroom-chip">{rosterPlayers.length}/{max} duelists</span>
                  <span className="waitroom-chip">{readyCount}/{rosterPlayers.length} ready</span>
                  <span className="waitroom-chip">{currentRoom?.hostMode === "manage" ? "Host Only" : "Host + Play"}</span>
                </div>
              </div>

              {currentRoom?.battle?.winnerId ? (
                <div className="room-result">
                  <span className="room-result-label">⚔ DUEL ENDED</span>
                  <strong>{currentRoom.players.find((p) => p.userId === currentRoom.battle?.winnerId)?.username ?? "Someone"} won!</strong>
                  <span className="room-result-hint">Ready up and rematch, or leave the room.</span>
                </div>
              ) : null}

              <div className="waitroom-slots">
                {slots.map((player, i) => {
                  if (!player) {
                    return (
                      <div key={`empty-${i}`} className="waitroom-slot waitroom-empty">
                        <span className="waitroom-empty-icon">＋</span>
                        <span>Waiting for a duelist…</span>
                      </div>
                    );
                  }
                  const character = CHARACTER_CLASSES.find((c) => c.id === player.characterId);
                  const isHost = player.userId === currentRoom?.hostUserId;
                  return (
                    <div key={player.userId} className={`waitroom-slot ${player.ready ? "is-ready" : ""}`} style={character ? { ["--realm-col" as string]: FACTION_COLORS[character.id] ?? "#e7c46b" } : undefined}>
                      <div className="waitroom-slot-art" style={character ? { backgroundImage: `linear-gradient(180deg, rgba(8,12,22,0.1), rgba(8,12,22,0.92)), url(/assets/realms/${character.id}.jpg)` } : undefined} />
                      <img className="waitroom-av" src={getAvatarAssetPath(player.avatarId)} alt="" onError={(e) => handleAvatarError(e, player.avatarId)} />
                      <strong className="waitroom-name">{player.username}{player.userId === currentUserId ? " (you)" : ""} {isHost ? "👑" : ""}</strong>
                      <span className="waitroom-champ">{character?.name ?? "Choosing…"}</span>
                      <span className={`waitroom-status ${player.ready ? "on" : ""}`}>{player.ready ? "✓ Ready" : "Not ready"}</span>
                    </div>
                  );
                })}
              </div>

              <div className="waitroom-actions">
                <button className="gold-btn" type="button" onClick={onToggleReady}>{meReady ? "Unready" : "✓ Ready Up"}</button>
                {isRoomHost ? <button className="gold-btn" type="button" onClick={onStartRoom}>⚔ {currentRoom?.battle?.winnerId ? "Rematch" : "Start Duel"}</button> : null}
                <button className="gold-btn ghost" type="button" onClick={onLeaveRoom}>Leave Room</button>
              </div>
            </div>
          );
        })()
      ) : (
      <div className="rift-lobby-grid">
        {/* Left: setup */}
        <div className="rift-lobby-left">
          <div className="gold-panel rift-setup">
            <div className="rift-setting">
              <div className="gp-label">PLAYERS</div>
              <div className="rift-pills">
                {[2, 3, 4, 5, 6].map((n) => (
                  <button key={n} type="button" className={`rift-pill ${roomMaxPlayers === n ? "active" : ""}`} onClick={() => onRoomMaxPlayersChange(n)}>{n}</button>
                ))}
              </div>
            </div>
            <div className="rift-setting">
              <div className="gp-label">MODE</div>
              <div className="rift-pills">
                <button type="button" className={`rift-pill wide ${hostMode === "play" ? "active" : ""}`} onClick={() => onHostModeChange("play")}>Host + Play</button>
                <button type="button" className={`rift-pill wide ${hostMode === "manage" ? "active" : ""}`} onClick={() => onHostModeChange("manage")}>Host Only</button>
              </div>
            </div>

            <div className="rift-divider" />

            {!selectedCharacterId ? <p className="rift-pick-hint">Choose a champion on the right to begin →</p> : null}
            <div className="rift-lobby-actions">
              <button className="gold-btn" type="button" onClick={onCreateRoom} disabled={!socketConnected || !selectedCharacterId}>⚔ Create Room</button>
              <button className="gold-btn ghost" type="button" onClick={onPractice} disabled={!selectedCharacterId}>Practice vs Bot</button>
            </div>
            <div className="rift-lobby-join">
              <input className="rift-join-input" placeholder="Enter room code" value={roomCodeInput} onChange={(e) => onRoomCodeInput(e.target.value)} />
              <button className="gold-btn ghost" type="button" onClick={onJoinRoom} disabled={!roomCodeInput || !socketConnected || !selectedCharacterId}>Join</button>
            </div>
          </div>
        </div>

        {/* Right: champion carousel */}
        <div className="rift-lobby-right">
          <ChampionCarousel
            selectedId={selectedCharacterId}
            takenIds={takenIds}
            onSelect={onCharacterChange}
            onViewRealm={setRealmDetailId}
          />
        </div>
      </div>
      )}

      {detailChamp ? (
        <ChampionDetail
          champ={detailChamp}
          taken={takenIds.includes(detailChamp.id) && detailChamp.id !== selectedCharacterId}
          isSel={selectedCharacterId === detailChamp.id}
          onSelect={() => { onCharacterChange(detailChamp.id); setRealmDetailId(null); }}
          onClose={() => setRealmDetailId(null)}
          onCardInfo={setLibCard}
        />
      ) : null}
      {libCard ? <CardView card={libCard} onClose={() => setLibCard(null)} /> : null}
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
  // Mobile: the hand is a collapsible bottom drawer so the board owns the screen.
  const [handOpen, setHandOpen] = useState(false);
  // Collapsible top bar so the essentials stay readable, details on demand.
  const [statusOpen, setStatusOpen] = useState(false);
  const [selectedBoardCardId, setSelectedBoardCardId] = useState<string | null>(null);
  const [focusedOpp, setFocusedOpp] = useState(0); // mobile: which opponent's board fills the battle zone
  const [isMobileView, setIsMobileView] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 768px)");
    const onChange = () => setIsMobileView(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  const [hoveredTargetPlayerId, setHoveredTargetPlayerId] = useState<string | null>(null);
  const [actionHistory, setActionHistory] = useState<RoomActionEvent[]>([]);
  const [defeatedSignals, setDefeatedSignals] = useState<DefeatedSignal[]>([]);
  const [floatDmg, setFloatDmg] = useState<{ id: string; amount: number; mine: boolean }[]>([]);
  const prevHealthRef = useRef<Record<string, number>>({});
  const [fx, setFx] = useState<{ id: string; kind: "slash" | "shield" } | null>(null);
  const [shake, setShake] = useState(false);
  const [selectedHandId, setSelectedHandId] = useState<string | null>(null);
  const [summonFx, setSummonFx] = useState<{ slug: string } | null>(null);
  const [drawReveal, setDrawReveal] = useState<{ slug: string; name: string } | null>(null);
  const prevHandRef = useRef<string[]>([]);
  const justDrewRef = useRef(false);
  const [castFx, setCastFx] = useState<{ slug: string; name: string; arch: string; text?: string } | null>(null);
  const [centerCard, setCenterCard] = useState<{ slug: string; name: string; atk: number; def: number } | null>(null);
  const [graveyardOwner, setGraveyardOwner] = useState<string | null>(null);
  const [detailCard, setDetailCard] = useState<DetailCard | null>(null);
  const [lungeId, setLungeId] = useState<string | null>(null);
  const [flipId, setFlipId] = useState<string | null>(null);
  const [turnBanner, setTurnBanner] = useState<{ text: string; mine: boolean } | null>(null);
  const [attackLine, setAttackLine] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [attackInfo, setAttackInfo] = useState<{ attacker: string; target: string } | null>(null);
  const [clash, setClash] = useState<{ slug: string; name: string; fx: "slash" | "shield"; label: string; tone: "destroy" | "reduce" | "block"; enemySlug?: string; enemyName?: string; mineDie?: boolean; enemyDie?: boolean; dmg?: number; dmgTo?: "me" | "enemy" } | null>(null);
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
  // Seat opponents around the elliptical table rim (desktop). Few players cluster
  // near the top (facing you); more fan out onto the empty left/right sides.
  const oppGeo = (i: number, n: number) => {
    const half = Math.min(105, 18 + (n - 1) * 22);
    const deg = n === 1 ? 270 : 270 - half + (i / (n - 1)) * (2 * half);
    const r = (deg * Math.PI) / 180;
    const cos = Math.cos(r), sin = Math.sin(r);
    return {
      seatLeft: 50 + 42 * cos,
      seatTop: 39 + 29 * sin,
      unitLeft: 50 + 30 * cos,
      unitTop: 50 + 19 * sin,
      tilt: ((50 - (50 + 42 * cos)) / 50) * 8,
    };
  };
  // Backdrop the battlefield with the local player's realm art (derived from
  // any of their cards' slugs), falling back to neutral arena key art.
  const realmSlug = privateHand[0]?.slug ?? me?.board[0]?.slug ?? "";
  const realmBg = getRealmSource(realmSlug) || "/assets/branding/hero-key-art.jpg";
  // Theme the deck back to the player's chosen faction (characterId === faction).
  const myFaction = me?.characterId ?? "";
  const deckBackUrl = myFaction ? `/assets/realms/${myFaction}.jpg` : DECK_BACK_ASSET_PATH;
  const deckCrestUrl = myFaction ? `/assets/icons/crests/${myFaction}-crest.png` : "";
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

  // When you draw, reveal the new card big at center (only you see it), then it tucks into hand.
  useEffect(() => {
    const ids = privateHand.map((c) => c.instanceId);
    const prev = prevHandRef.current;
    const added = privateHand.find((c) => !prev.includes(c.instanceId));
    prevHandRef.current = ids;
    if (justDrewRef.current && added) {
      justDrewRef.current = false;
      setDrawReveal({ slug: added.slug, name: added.name });
      const t = window.setTimeout(() => setDrawReveal(null), 1400);
      return () => window.clearTimeout(t);
    }
  }, [privateHand]);

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
  const ZONES = 5;
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
  const showClash = (fx: "slash" | "shield", label: string, tone: "destroy" | "reduce" | "block", extra?: { enemySlug?: string; enemyName?: string; mineDie?: boolean; enemyDie?: boolean; dmg?: number; dmgTo?: "me" | "enemy" }) => {
    if (!attacker) return;
    setClash({ slug: attacker.slug, name: attacker.name, fx, label, tone, ...extra });
    window.setTimeout(() => setClash(null), 1700);
  };
  const strikePlayer = (targetUserId: string, health: number) => {
    if (attacker && health > 0) {
      const target = opponents.find((p) => p.userId === targetUserId);
      setAttackInfo({ attacker: attacker.name, target: target?.username ?? "the enemy" });
      window.setTimeout(() => setAttackInfo(null), 1400);
      showClash("slash", `−${attacker.attack} LP`, "reduce", { dmg: attacker.attack, dmgTo: "enemy" });
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
    let mineDie = false, enemyDie = false, dmg = 0;
    let dmgTo: "me" | "enemy" | undefined;
    if (targetUnit) {
      if (targetUnit.position === "defense") {
        const def = targetUnit.health;
        if (attacker.attack > def) { fx = "slash"; label = "💥 Destroyed!"; tone = "destroy"; enemyDie = true; }
        else if (attacker.attack < def) { fx = "shield"; label = `🛡 Repelled −${def - attacker.attack} LP`; tone = "reduce"; dmg = def - attacker.attack; dmgTo = "me"; }
        else { fx = "shield"; label = "🛡 Blocked!"; tone = "block"; }
      } else {
        if (attacker.attack > targetUnit.attack) { fx = "slash"; label = "💥 Destroyed!"; tone = "destroy"; enemyDie = true; dmg = attacker.attack - targetUnit.attack; dmgTo = "enemy"; }
        else if (attacker.attack < targetUnit.attack) { fx = "slash"; label = `Repelled −${targetUnit.attack - attacker.attack} LP`; tone = "reduce"; mineDie = true; dmg = targetUnit.attack - attacker.attack; dmgTo = "me"; }
        else { fx = "slash"; label = "💥 Both fall!"; tone = "destroy"; mineDie = true; enemyDie = true; }
      }
    }
    setAttackInfo({ attacker: attacker.name, target: targetUnit?.name ?? "a unit" });
    window.setTimeout(() => setAttackInfo(null), 1400);
    showClash(fx, label, tone, { enemySlug: targetUnit?.slug, enemyName: targetUnit?.name, mineDie, enemyDie, dmg, dmgTo });
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

  // Reusable enemy-unit card (used by desktop seats and the mobile battle zone).
  const renderEnemyUnit = (player: RoomState["players"][number], unit: RoomCard) => {
    const fxClass = fx?.id === unit.instanceId ? `fx-${fx.kind}` : "";
    return (
      <div key={unit.instanceId} className="bf-zone">
        <button
          data-cardid={unit.instanceId}
          className={`tcg-card tcg-enemy rarity-${unit.rarity} stance-attack ${attacker ? "tcg-target" : ""} ${fxClass}`}
          type="button"
          disabled={!attacker}
          onClick={() => strikeUnit(player.userId, unit.instanceId)}
          title={`${unit.name} — ${player.username}`}
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
  };

  return (
    <div className="grid">
      {clash ? (
        <div className="clash-stage" aria-hidden="true">
          <div className="clash-dim" />
          <div className="clash-title"><span className="clash-attacker">{clash.name}</span> ⚔ <span className="clash-defender">{clash.enemyName ?? "Enemy"}</span></div>
          <div className="clash-duo">
            <div className={`clash-card ${clash.mineDie ? "clash-shatter" : ""}`}>
              <img className="clash-art" src={getCardArtSources(clash.slug).primary} alt="" onError={(e) => handleCardArtError(e, clash.slug)} />
              <span className="clash-card-name">{clash.name}</span>
            </div>
            {clash.enemySlug ? (
              <div className={`clash-card ${clash.enemyDie ? "clash-shatter" : ""}`}>
                <img className="clash-art" src={getCardArtSources(clash.enemySlug).primary} alt="" onError={(e) => handleCardArtError(e, clash.enemySlug!)} />
                <span className="clash-card-name">{clash.enemyName}</span>
              </div>
            ) : null}
            {clash.fx === "shield" ? <span className="clash-shield">🛡</span> : <span className="clash-sword">⚔</span>}
            {clash.dmg ? <span className={`clash-dmg ${clash.dmgTo === "me" ? "dmg-self" : "dmg-enemy"}`}>−{clash.dmg}</span> : null}
          </div>
          <div className={`clash-label tone-${clash.tone}`}>{clash.label}</div>
        </div>
      ) : null}
      {drawReveal ? (
        <div className="draw-stage" aria-hidden="true">
          <img className="draw-card" src={getCardArtSources(drawReveal.slug).primary} alt="" onError={(e) => handleCardArtError(e, drawReveal.slug)} />
        </div>
      ) : null}
      {summonFx ? (
        <div className="summon-stage" aria-hidden="true">
          <span className="summon-shock" />
          <span className="summon-glow" />
          <img className="summon-card" src={getCardArtSources(summonFx.slug).primary} alt="" onError={(e) => handleCardArtError(e, summonFx.slug)} />
        </div>
      ) : null}
      {castFx ? (() => {
        const ENEMY = "26%", MINE = "62%";
        const targets: Record<string, { left: string; top: string }[]> = {
          strike: [{ left: "50%", top: ENEMY }],
          volley: [{ left: "28%", top: ENEMY }, { left: "50%", top: "20%" }, { left: "72%", top: ENEMY }],
          empower: [{ left: "50%", top: MINE }],
          rally: [{ left: "34%", top: MINE }, { left: "50%", top: MINE }, { left: "66%", top: MINE }],
          tradeoff: [{ left: "50%", top: MINE }],
          utility: [{ left: "50%", top: MINE }],
        };
        const labels: Record<string, string> = {
          strike: "STRIKE → enemy unit", volley: "VOLLEY → all enemies", empower: "EMPOWER → your unit",
          rally: "RALLY → all your units", tradeoff: "TRADE-OFF → buff + cost", utility: "UTILITY → you",
        };
        const beneficial = ["empower", "rally", "utility"].includes(castFx.arch);
        const color = castFx.arch === "tradeoff" ? "#ff3b2f" : beneficial ? "#41e07a" : "#c4a1ff";
        const spots = targets[castFx.arch] ?? targets.utility;
        return (
          <div className="cast-stage" aria-hidden="true">
            <div className="cast-banner" style={{ color }}>✦ {castFx.name} — {labels[castFx.arch] ?? labels.utility}</div>
            <img className="cast-card" src={getCardArtSources(castFx.slug).primary} alt="" onError={(e) => handleCardArtError(e, castFx.slug)} />
            {spots.map((t, k) => (
              <span key={k} className="cast-burst" style={{ left: t.left, top: t.top, background: `radial-gradient(circle, ${color}, transparent 70%)`, animationDelay: `${0.45 + k * 0.12}s` }} />
            ))}
          </div>
        );
      })() : null}
      {centerCard && !clash && !castFx ? (
        <div className="center-preview" aria-hidden="true">
          <div className="center-preview-dim" />
          <div className="center-preview-wrap">
            <img className="center-preview-card" src={getCardArtSources(centerCard.slug).primary} alt="" onError={(e) => handleCardArtError(e, centerCard.slug)} />
            <span className="cp-atk">{centerCard.atk}</span>
            <span className="cp-def">{centerCard.def}</span>
            <span className="center-preview-name">{centerCard.name}</span>
          </div>
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

      {detailCard ? <CardView card={detailCard} onClose={() => setDetailCard(null)} /> : null}

      {graveyardOwner ? (() => {
        const gravePlayer = currentRoom?.players.find((p) => p.userId === graveyardOwner) ?? null;
        const cards = gravePlayer?.discard ?? [];
        return (
          <div className="legal-overlay grave-overlay" role="dialog" aria-modal="true" onClick={() => setGraveyardOwner(null)}>
            <div className="auth-modal grave-modal" onClick={(e) => e.stopPropagation()}>
              <div className="auth-modal-head">
                <div>
                  <span className="auth-hero-kicker grave-kicker">⚰ Graveyard</span>
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
                      {card.type === "unit" ? (
                        <span className="opp-unit-stats grave-card-stats"><b className="ut-atk">{card.attack}</b><b className="ut-def">{card.health}</b></span>
                      ) : (
                        <span className="grave-stats">Spell</span>
                      )}
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
        {!inGame ? (
          (() => {
            const players = currentRoom?.players ?? [];
            const max = currentRoom?.maxPlayers ?? players.length;
            const readyCount = players.filter((p) => p.ready).length;
            const slots = Array.from({ length: max }, (_, i) => players[i] ?? null);
            return (
              <div className="rift-waitroom">
                <div className="waitroom-bg" aria-hidden="true" />
                <div className="waitroom-banner">
                  <div className="waitroom-code">
                    <span className="gp-label">ROOM CODE</span>
                    <strong>{currentRoom?.roomCode ?? "—"}</strong>
                  </div>
                  <div className="waitroom-meta">
                    <span className="waitroom-chip">{players.length}/{max} duelists</span>
                    <span className="waitroom-chip">{readyCount}/{players.length} ready</span>
                    <span className="waitroom-chip">{currentRoom?.hostMode === "manage" ? "Host Only" : "Host + Play"}</span>
                  </div>
                </div>

                <div className="waitroom-slots">
                  {slots.map((player, i) => {
                    if (!player) {
                      return (
                        <div key={`empty-${i}`} className="waitroom-slot waitroom-empty">
                          <span className="waitroom-empty-icon">＋</span>
                          <span>Waiting for a duelist…</span>
                        </div>
                      );
                    }
                    const character = CHARACTER_CLASSES.find((c) => c.id === player.characterId);
                    const isHost = player.userId === currentRoom?.hostUserId;
                    return (
                      <div key={player.userId} className={`waitroom-slot ${player.ready ? "is-ready" : ""}`} style={character ? { ["--realm-col" as string]: FACTION_COLORS[character.id] ?? "#e7c46b" } : undefined}>
                        <div className="waitroom-slot-art" style={character ? { backgroundImage: `linear-gradient(180deg, rgba(8,12,22,0.1), rgba(8,12,22,0.92)), url(/assets/realms/${character.id}.jpg)` } : undefined} />
                        <img className="waitroom-av" src={getAvatarAssetPath(player.avatarId)} alt="" onError={(e) => handleAvatarError(e, player.avatarId)} />
                        <strong className="waitroom-name">{player.username}{player.userId === props.currentUserId ? " (you)" : ""} {isHost ? "👑" : ""}</strong>
                        <span className="waitroom-champ">{character?.name ?? "Choosing…"}</span>
                        <span className={`waitroom-status ${player.ready ? "on" : ""}`}>{player.ready ? "✓ Ready" : "Not ready"}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="waitroom-actions">
                  {isInRoom ? (
                    <button className="gold-btn" type="button" onClick={onToggleReady}>{meReady ? "Unready" : "✓ Ready Up"}</button>
                  ) : (
                    <button className="gold-btn" type="button" onClick={onJoinAsHostPlayer}>Join as Player</button>
                  )}
                  {isRoomHost ? <button className="gold-btn" type="button" onClick={onStartRoom}>⚔ Start Duel</button> : null}
                  <button className="gold-btn ghost" type="button" onClick={onLeaveRoom}>Leave Room</button>
                </div>
              </div>
            );
          })()
        ) : (
          <>
            {attacker ? (
              <div className="attack-pill">
                <span className="attack-pill-dot" />
                <span className="attack-pill-name">⚔ {attacker.name} — tap a target</span>
                {opponents.filter((p) => p.health > 0 && p.board.length === 0).map((p) => (
                  <button key={`atk-${p.userId}`} className="button attack-direct-btn" type="button" onClick={() => strikePlayer(p.userId, p.health)}>
                    ⚔ {p.username}
                  </button>
                ))}
                <button className="attack-pill-cancel" type="button" onClick={() => setSelectedBoardCardId(null)} title="Cancel attack">✕</button>
              </div>
            ) : null}

            {me?.characterId ? (
              <div className="duel-realm-bg" aria-hidden="true" style={{ backgroundImage: `url(/assets/realms/${me.characterId}.jpg)` }} />
            ) : null}
            <div className={`duel-turnchip ${isMyTurn ? "mine" : ""}`}>
              <span className="duel-turnchip-dot" />
              <span className="duel-turnchip-text">{isMyTurn ? "Your Turn" : `${activePlayerName ?? "Opponent"}'s Turn`}</span>
              <span className="duel-turnchip-timer">⏱ {formatTimer(timer)}</span>
            </div>
            <div
              className={`battlefield ${attacker ? "bf-attacking" : ""} ${shake ? "bf-shake" : ""} ${isMyTurn ? "bf-myturn" : ""}`}
              style={{ ["--realm-bg" as string]: `url(${realmBg})` }}
            >
              <div className="bf-realms" aria-hidden="true">
                {opponents.map((player, i) => {
                  const n = opponents.length;
                  const left = n === 1 ? 50 : 8 + (i / (n - 1)) * 84;
                  return (
                    <div key={player.userId} className="bf-realm bf-realm-enemy" style={{ left: `${left}%`, backgroundImage: `url(/assets/realms/${player.characterId}.jpg)` }} />
                  );
                })}
                {me ? <div className="bf-realm bf-realm-mine" style={{ backgroundImage: `url(/assets/realms/${me.characterId}.jpg)` }} /> : null}
              </div>
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
                {isMobileView ? (
                  <>
                    {/* Mobile: opponents collapse to pods; tap one to expand its board */}
                    <div className="mob-pods">
                      {opponents.length === 0 ? <span className="muted bf-zone-label">Waiting for opponents…</span> : null}
                      {opponents.map((player, i) => (
                        <button key={player.userId} type="button" className={`mob-pod ${focusedOpp === i ? "active" : ""} ${player.userId === activePlayerId ? "mob-pod-turn" : ""}`} onClick={() => setFocusedOpp(i)}>
                          <img className="mob-pod-av" src={getAvatarAssetPath(player.avatarId)} alt="" onError={(e) => handleAvatarError(e, player.avatarId)} />
                          <span className="mob-pod-info">
                            <span className="mob-pod-name">{player.username}</span>
                            <span className="mob-pod-stats">❤{player.health} · ⚔{player.board.length}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                    {(() => {
                      const opp = opponents[Math.min(focusedOpp, Math.max(0, opponents.length - 1))];
                      if (!opp) return null;
                      const targetable = Boolean(attacker) && opp.health > 0;
                      return (
                        <div className="mob-battlezone">
                          <div className="mob-zone-head">
                            <span>{opp.username}'s field {attacker ? "· tap a unit to attack" : ""}</span>
                            {targetable && opp.board.length === 0 ? (
                              <button className="button attack-direct-btn" type="button" onClick={() => strikePlayer(opp.userId, opp.health)}>⚔ {opp.username}</button>
                            ) : null}
                          </div>
                          <div className="mob-zone-units bf-zones">
                            {opp.board.length === 0 ? <span className="seat-empty">No units on the field</span> : opp.board.map((u) => renderEnemyUnit(opp, u))}
                          </div>
                        </div>
                      );
                    })()}
                  </>
                ) : (
                <div className="bf-arena">
                  {/* Perspective ellipse felt — opponents sit along the far arc, you at the near edge */}
                  <div className="bf-table" aria-hidden="true"><span className="bf-table-rim" /></div>
                  {Array.from({ length: 10 }).map((_, i) => (
                    <span key={`em-${i}`} className="bf-ember" aria-hidden="true" style={{ left: `${12 + i * 7.5}%`, background: i % 2 === 0 ? "#e05c28" : "#c9973a", animationDelay: `${i * 0.7}s`, ["--dx" as string]: `${(i % 5 - 2) * 22}px` }} />
                  ))}

                  {opponents.length === 0 ? <span className="muted bf-zone-label bf-arena-wait">Waiting for opponents…</span> : null}

                  {/* Opponent SEATS — upright plates fanned around the rim */}
                  <div className="bf-seats-layer">
                    {opponents.map((player, i) => {
                      const targetable = Boolean(attacker) && player.health > 0;
                      const isTurn = player.userId === activePlayerId;
                      const g = oppGeo(i, opponents.length);
                      return (
                        <div key={player.userId} className={`enemy-seat ${isTurn ? "enemy-seat-turn" : ""}`}
                          style={{ position: "absolute", left: `${g.seatLeft}%`, top: `${g.seatTop}%`, transform: `translate(-50%,-50%) rotate(${g.tilt}deg)` }}>
                          <button
                            data-plateid={player.userId}
                            className={`seat-plate ${targetable ? "plate-target" : ""} ${fx?.id === `player-${player.userId}` ? "fx-slash" : ""}`}
                            type="button"
                            disabled={!targetable}
                            onClick={() => strikePlayer(player.userId, player.health)}
                            title={targetable ? `Attack ${player.username}` : player.username}
                          >
                            <img className="seat-avatar" src={getAvatarAssetPath(player.avatarId)} alt="" onError={(e) => handleAvatarError(e, player.avatarId)} />
                            <span className="seat-name">{player.username}</span>
                            <span className="seat-hpbar"><span style={{ width: `${Math.max(0, Math.min(100, (player.health / 20) * 100))}%` }} /></span>
                            <span className="seat-stats"><b className="plate-hp">❤ {player.health}</b> <b className="seat-mana">◆ {player.mana}/{player.maxMana}</b></span>
                            {fx?.id === `player-${player.userId}` ? <span className="fx-overlay" aria-hidden="true" /> : null}
                          </button>
                          <div className="seat-hand-backs" aria-hidden="true">
                            {Array.from({ length: Math.min(player.handCount, 6) }).map((_, h) => {
                              const hc = Math.min(player.handCount, 6);
                              const t = hc === 1 ? 0 : (h / (hc - 1)) * 2 - 1;
                              return (
                                <span key={h} className="seat-hand-back" style={{ marginLeft: h === 0 ? 0 : -12, transform: `rotate(${t * 10}deg) translateY(${Math.abs(t) * 3}px)` }}>
                                  <img src={`/assets/icons/crests/${player.characterId}-crest.png`} alt="" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Opponent UNITS — overlapped face-up cards on the rim below each seat */}
                  <div className="bf-units-layer">
                    {opponents.map((player, i) => {
                      if (player.board.length === 0) return null;
                      const g = oppGeo(i, opponents.length);
                      return (
                        <div key={player.userId} className="opp-units-row"
                          style={{ position: "absolute", left: `${g.unitLeft}%`, top: `${g.unitTop}%`, transform: "translate(-50%,-50%)" }}>
                          {player.board.map((unit, j) => {
                            const fxClass = fx?.id === unit.instanceId ? `fx-${fx.kind}` : "";
                            return (
                              <div
                                key={unit.instanceId}
                                data-cardid={unit.instanceId}
                                className={`opp-unit-tile rarity-${unit.rarity} ${attacker ? "tcg-target" : ""} ${fxClass}`}
                                role="button"
                                tabIndex={0}
                                style={{ marginLeft: j === 0 ? 0 : -40, zIndex: j }}
                                onClick={() => (attacker ? strikeUnit(player.userId, unit.instanceId) : setDetailCard(unit))}
                                onMouseEnter={() => setCenterCard({ slug: unit.slug, name: unit.name, atk: unit.attack, def: unit.health })}
                                onMouseLeave={() => setCenterCard(null)}
                                title={`${unit.name} — ${player.username}`}
                              >
                                <img className="tcg-art" src={getCardArtSources(unit.slug).primary} alt={unit.name} loading="lazy" onError={(e) => handleCardArtError(e, unit.slug)} />
                                {getCrestSource(unit.slug) ? <img className="tcg-crest" src={getCrestSource(unit.slug)} alt="" aria-hidden="true" /> : null}
                                <span className="tcg-frame" aria-hidden="true" />
                                <span className="opp-unit-stats"><b className="ut-atk">{unit.attack}</b><b className="ut-def">{unit.health}</b></span>
                                <span className="card-info-btn opp-info-btn" role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); setDetailCard(unit); }}>ⓘ</span>
                                {fxClass ? <span className="fx-overlay" aria-hidden="true" /> : null}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
                )}

                <div className="bf-row bf-you">
                  <div className="bf-zones">
                    {(me?.board ?? []).map((unit) => {
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

            {handOpen ? <div className="hand-backdrop" onClick={() => setHandOpen(false)} aria-hidden="true" /> : null}
            <div className={`duel-dock ${handOpen ? "hand-open" : ""}`}>
            <div className="my-seat">
              <div className="my-seat-id">
                <img className="my-seat-avatar" src={getAvatarAssetPath(me?.avatarId ?? "avatar-01")} alt="" onError={(e) => handleAvatarError(e, me?.avatarId ?? "avatar-01")} />
                <div className="my-seat-info">
                  <span className="my-seat-stats"><b className="seat-hp">❤ {me?.health ?? "--"}</b> <b className="seat-mana">◆ {me ? `${me.mana}/${me.maxMana}` : "--"}</b></span>
                </div>
              </div>
            <div className="duel-piles">
              {/* Mobile-only: Hand as a pile card (matches deck/graveyard). */}
              <button className="pile pile-hand" type="button" onClick={() => setHandOpen(true)} title="Open your hand">
                <img className="pile-art pile-deck-back" src={deckBackUrl} alt="" aria-hidden="true" onError={(e) => { (e.currentTarget as HTMLImageElement).src = DECK_BACK_ASSET_PATH; }} />
                {deckCrestUrl ? <img className="pile-deck-crest" src={deckCrestUrl} alt="" aria-hidden="true" /> : null}
                <span className="pile-count">{privateHand.length}</span>
                <span className="pile-label">Hand</span>
              </button>
              <button
                className={`pile pile-deck ${isMyTurn && !battle?.manualDrawUsed ? "pile-draw" : ""}`}
                type="button"
                disabled={!isMyTurn || Boolean(battle?.manualDrawUsed)}
                onClick={() => { justDrewRef.current = true; onDrawCard(); }}
                title="Draw a card"
              >
                <img className="pile-art pile-deck-back" src={deckBackUrl} alt="" aria-hidden="true" onError={(e) => { (e.currentTarget as HTMLImageElement).src = DECK_BACK_ASSET_PATH; }} />
                {deckCrestUrl ? <img className="pile-deck-crest" src={deckCrestUrl} alt="" aria-hidden="true" /> : null}
                <span className="pile-count">{me?.deckCount ?? 0}</span>
                <span className="pile-label">{isMyTurn && !battle?.manualDrawUsed ? "Draw" : "Deck"}</span>
              </button>
              <button
                className="pile pile-discard"
                type="button"
                onClick={() => setGraveyardOwner(props.currentUserId)}
              >
                {me?.discard && me.discard.length > 0 ? (
                  <img className="pile-art" src={getCardArtSources(me.discard[me.discard.length - 1].slug).primary} alt="" onError={(e) => handleCardArtError(e, me.discard![me.discard!.length - 1].slug)} />
                ) : (
                  <>
                    <img className="pile-art pile-deck-back" src={deckBackUrl} alt="" aria-hidden="true" onError={(e) => { (e.currentTarget as HTMLImageElement).src = DECK_BACK_ASSET_PATH; }} />
                    {deckCrestUrl ? <img className="pile-deck-crest" src={deckCrestUrl} alt="" aria-hidden="true" /> : null}
                  </>
                )}
                <span key={`disc-${me?.discardCount ?? 0}`} className="pile-count pile-count-pop">{me?.discardCount ?? 0}</span>
                <span className="pile-label">Grave</span>
              </button>
            </div>
            <div className="seat-actions">
              <button className="hud-btn hud-end" type="button" onClick={onEndTurn} disabled={!isMyTurn}>End Turn ⏭</button>
              <button className="hud-btn" type="button" onClick={onConcede} title="Concede">Concede</button>
              <button className="hud-btn hud-leave" type="button" onClick={onLeaveRoom} title="Leave">Leave</button>
            </div>
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
                <button className="hand-sheet-close" type="button" onClick={() => setHandOpen(false)} aria-label="Close hand">×</button>
              </header>
              <div className="hand-row">
                {privateHand.length === 0 ? <p className="muted">No cards in hand.</p> : null}
                {privateHand.map((card, idx) => {
                  const art = getCardArtSources(card.slug);
                  const affordable = (me?.mana ?? 0) >= card.cost;
                  const playable = isMyTurn && affordable;
                  const reason = !isMyTurn ? "Wait for your turn" : !affordable ? `Needs ${card.cost} mana` : "";
                  const total = privateHand.length;
                  const mid = (total - 1) / 2;
                  const angle = (idx - mid) * 5;
                  const yOff = Math.abs(idx - mid) * 6;
                  const isSel = selectedHandId === card.instanceId;
                  const fanStyle = !isMobileView && !handOpen
                    ? { transform: `rotate(${angle}deg) translateY(${-yOff}px)`, transformOrigin: "bottom center", zIndex: idx + 1 }
                    : undefined;
                  const triggerSummon = (position: "attack" | "defense") => {
                    setSummonFx({ slug: card.slug });
                    window.setTimeout(() => setSummonFx(null), 950);
                    onPlayCard(card.instanceId, undefined, position);
                    setSelectedHandId(null);
                    setHandOpen(false);
                  };
                  return (
                    <article key={card.instanceId} style={fanStyle} onClick={() => playable && setSelectedHandId(isSel ? null : card.instanceId)} className={`hand-card ${card.type === "spell" ? "card-spell" : "card-unit"} ${!affordable ? "hand-unaffordable" : ""} ${playable ? "hand-playable" : ""} ${isSel ? "hand-selected" : ""}`}>
                      <div className="hand-card-media">
                        <img className="hand-card-art" src={art.primary} alt={card.name} loading="lazy" onError={(e) => handleCardArtError(e, card.slug)} />
                        <span className={`hand-cost ${affordable ? "" : "hand-cost-short"}`} title="Mana cost">{card.cost}</span>
                        <button className="card-info-btn" type="button" onClick={(e) => { e.stopPropagation(); setDetailCard(card); }} title="Card details" aria-label="Card details">ⓘ</button>
                        {card.type === "unit" ? (
                          <span className="opp-unit-stats hand-stats"><b className="ut-atk">{card.attack}</b><b className="ut-def">{card.health}</b></span>
                        ) : (
                          <span className="hand-type-tag">Spell</span>
                        )}
                      </div>
                      <strong>{card.name}</strong>
                      <span className="hand-card-desc">{card.type === "spell" && card.spellText ? card.spellText : card.description}</span>
                      <div className="row">
                        {card.type === "unit" ? (
                          <div className="play-stance">
                            <button className="button hand-play-btn" type="button" disabled={!playable} onClick={(e) => { e.stopPropagation(); triggerSummon("attack"); }} title="Summon in Attack position (uses ATK)">⚔ Summon</button>
                            <button className="button hand-play-btn button-secondary" type="button" disabled={!playable} onClick={(e) => { e.stopPropagation(); triggerSummon("defense"); }} title="Set in Defense position (uses DEF, guards you)">🛡 Set</button>
                          </div>
                        ) : (
                          // Spells auto-resolve (e.g. hit the strongest enemy unit) — one clear Cast button.
                          <button className="button hand-play-btn" type="button" disabled={!playable} onClick={(e) => { e.stopPropagation(); setCastFx({ slug: card.slug, name: card.name, arch: (card.archetype || "utility").toLowerCase(), text: card.spellText }); window.setTimeout(() => setCastFx(null), 1500); onPlayCard(card.instanceId); setSelectedHandId(null); setHandOpen(false); }} title={card.spellText || "Cast spell"}>
                            ✦ Cast
                          </button>
                        )}
                      </div>
                      {reason ? <small className="hand-reason">{reason}</small> : null}
                    </article>
                  );
                })}
              </div>
            </div>

            {(() => {
              const sel = privateHand.find((c) => c.instanceId === selectedHandId);
              if (!sel) return null;
              const affordable = (me?.mana ?? 0) >= sel.cost;
              const playable = isMyTurn && affordable;
              const doSummon = (position: "attack" | "defense") => {
                setSummonFx({ slug: sel.slug });
                window.setTimeout(() => setSummonFx(null), 950);
                onPlayCard(sel.instanceId, undefined, position);
                setSelectedHandId(null);
              };
              return (
                <div className="hand-action-bar">
                  {sel.type === "unit" ? (
                    <>
                      <button className="button hab-btn" type="button" disabled={!playable} onClick={() => doSummon("attack")}>⚔ Summon</button>
                      <button className="button hab-btn hab-set" type="button" disabled={!playable} onClick={() => doSummon("defense")}>🛡 Set</button>
                    </>
                  ) : (
                    <button className="button hab-btn" type="button" disabled={!playable} onClick={() => { setCastFx({ slug: sel.slug, name: sel.name, arch: (sel.archetype || "utility").toLowerCase(), text: sel.spellText }); window.setTimeout(() => setCastFx(null), 1500); onPlayCard(sel.instanceId); setSelectedHandId(null); }} title={sel.spellText || "Cast spell"}>✦ Cast{sel.archetype ? ` · ${sel.archetype}` : ""}</button>
                  )}
                  {!playable ? <span className="hab-reason">{!isMyTurn ? "Not your turn" : `Needs ${sel.cost} mana`}</span> : null}
                </div>
              );
            })()}

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
  return <LobbyView {...props} />;
}
