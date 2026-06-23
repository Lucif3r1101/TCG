import { useEffect, useMemo, useState } from "react";
import { API_URL } from "../constants/game";
import { getCardArtSources, handleCardArtError, factionFromSlug } from "../lib/cardArt";
import { DetailCard } from "./CardDetailModal";
import { CardView } from "./CardView";

export type LibraryCard = {
  id: string;
  slug: string;
  name: string;
  description: string;
  faction: string;
  type: "unit" | "spell";
  rarity: "common" | "rare" | "epic" | "legendary";
  cost: number;
  attack: number;
  health: number;
  archetype?: string;
  spellText?: string;
};

type CardLibraryProps = {
  onClose: () => void;
};

const FACTION_LABELS: Record<string, string> = {
  "riftforged-sentinel": "Riftforged Sentinel",
  "void-ranger": "Void Ranger",
  "ember-arcanist": "Ember Arcanist",
  "ironbound-beastmaster": "Ironbound Beastmaster",
  "chronomancer": "Chronomancer",
  "abyss-revenant": "Abyss Revenant"
};

const RARITIES = ["common", "rare", "epic", "legendary"] as const;
const TYPES = ["unit", "spell"] as const;

export function CardLibrary({ onClose }: CardLibraryProps) {
  const [cards, setCards] = useState<LibraryCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [faction, setFaction] = useState("all");
  const [type, setType] = useState("all");
  const [rarity, setRarity] = useState("all");
  const [detail, setDetail] = useState<DetailCard | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/cards`);
        if (!res.ok) throw new Error("Failed to load cards.");
        const data = (await res.json()) as { cards: LibraryCard[] };
        // Older card records may lack `faction`; derive it from the slug.
        const normalized = data.cards.map((c) => ({
          ...c,
          faction: c.faction || factionFromSlug(c.slug)
        }));
        if (active) setCards(normalized);
      } catch {
        if (active) setError("Could not load the card library. Please try again.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cards.filter((c) => {
      if (faction !== "all" && c.faction !== faction) return false;
      if (type !== "all" && c.type !== type) return false;
      if (rarity !== "all" && c.rarity !== rarity) return false;
      if (q && !c.name.toLowerCase().includes(q) && !c.description.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [cards, search, faction, type, rarity]);

  return (
    <section className="rift-library" aria-label="Card library">
      {detail ? <CardView card={detail} onClose={() => setDetail(null)} /> : null}

      <button className="rift-library-close" type="button" onClick={onClose} aria-label="Close">×</button>

      <div className="rift-library-head">
        <div className="rift-library-kicker">CHAMPION CODEX</div>
        <h1 className="rift-library-title">Card Library</h1>
        <div className="rift-library-count">{filtered.length} cards of the RIFT</div>
      </div>

      <div className="gold-panel rift-library-filters">
        <div className="rlf-search">
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            placeholder="Search cards…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search cards"
          />
        </div>
        <select className="rlf-select" value={faction} onChange={(e) => setFaction(e.target.value)} aria-label="Filter by faction">
          <option value="all">All Factions</option>
          {Object.entries(FACTION_LABELS).map(([id, label]) => (
            <option key={id} value={id}>{label}</option>
          ))}
        </select>
        <select className="rlf-select" value={type} onChange={(e) => setType(e.target.value)} aria-label="Filter by type">
          <option value="all">All Types</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>{t === "unit" ? "Units" : "Spells"}</option>
          ))}
        </select>
        <select className="rlf-select" value={rarity} onChange={(e) => setRarity(e.target.value)} aria-label="Filter by rarity">
          <option value="all">All Rarities</option>
          {RARITIES.map((r) => (
            <option key={r} value={r}>{r[0].toUpperCase() + r.slice(1)}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="rift-library-status">Loading cards…</p>
      ) : error ? (
        <p className="rift-library-status library-error">{error}</p>
      ) : filtered.length === 0 ? (
        <div className="rift-library-empty">
          <div className="rift-library-empty-icon">⚔</div>
          <div>No cards match your search</div>
          <small>Try clearing your filters</small>
        </div>
      ) : (
        <div className="rift-library-grid">
          {filtered.map((card) => (
            <button key={card.id} className={`rift-lib-card rarity-${card.rarity}`} type="button" onClick={() => setDetail(card)} title={`${card.name} — tap for details`}>
              <img className="rift-lib-art" src={getCardArtSources(card.slug).primary} alt={card.name} loading="lazy" onError={(e) => handleCardArtError(e, card.slug)} />
              <span className="rift-lib-cost">◆ {card.cost}</span>
              {card.type === "unit" ? (
                <span className="rift-lib-stats"><b className="ut-atk">⚔ {card.attack}</b><b className="ut-def">🛡 {card.health}</b></span>
              ) : <span className="rift-lib-spelltag">Spell</span>}
              <span className="rift-lib-name">{card.name}</span>
              <span className="rift-lib-frame" aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
