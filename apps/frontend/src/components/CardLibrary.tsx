import { useEffect, useMemo, useState } from "react";
import { API_URL } from "../constants/game";
import { getCardArtSources, handleCardArtError, factionFromSlug } from "../lib/cardArt";

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
    <section className="library" aria-label="Card library">
      <div className="library-head">
        <div>
          <span className="landing-section-kicker">Card Library</span>
          <h1>All Cards of the RIFT</h1>
          <p className="library-sub">
            Browse every card across the six factions — units, spells, costs, and abilities.
          </p>
        </div>
        <button className="button nav-btn" type="button" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="library-filters">
        <input
          className="input"
          type="search"
          placeholder="Search cards by name or ability…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search cards"
        />
        <select className="input" value={faction} onChange={(e) => setFaction(e.target.value)} aria-label="Filter by faction">
          <option value="all">All factions</option>
          {Object.entries(FACTION_LABELS).map(([id, label]) => (
            <option key={id} value={id}>{label}</option>
          ))}
        </select>
        <select className="input" value={type} onChange={(e) => setType(e.target.value)} aria-label="Filter by type">
          <option value="all">All types</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>{t === "unit" ? "Units" : "Spells"}</option>
          ))}
        </select>
        <select className="input" value={rarity} onChange={(e) => setRarity(e.target.value)} aria-label="Filter by rarity">
          <option value="all">All rarities</option>
          {RARITIES.map((r) => (
            <option key={r} value={r}>{r[0].toUpperCase() + r.slice(1)}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="library-status">Loading cards…</p>
      ) : error ? (
        <p className="library-status library-error">{error}</p>
      ) : (
        <>
          <p className="library-count">{filtered.length} of {cards.length} cards</p>
          {filtered.length === 0 ? (
            <p className="library-status">No cards match your filters. Try clearing the search.</p>
          ) : (
            <div className="library-grid">
              {filtered.map((card) => (
                <article key={card.id} className={`library-card rarity-${card.rarity}`}>
                  <div className="library-card-art">
                    <img
                      src={getCardArtSources(card.slug).primary}
                      alt={card.name}
                      loading="lazy"
                      onError={(e) => handleCardArtError(e, card.slug)}
                    />
                    <span className="library-cost" title="Mana cost">{card.cost}</span>
                  </div>
                  <div className="library-card-body">
                    <div className="library-card-title">
                      <h3>{card.name}</h3>
                      <span className={`library-tag tag-${card.rarity}`}>{card.rarity}</span>
                    </div>
                    <p className="library-card-meta">
                      {FACTION_LABELS[card.faction] ?? card.faction} · {card.type === "unit" ? "Unit" : "Spell"}
                    </p>
                    {card.description ? <p className="library-card-desc">{card.description}</p> : null}
                    {card.type === "unit" ? (
                      <div className="library-stats">
                        <span className="stat-atk" title="Attack">⚔ {card.attack}</span>
                        <span className="stat-hp" title="Health">❤ {card.health}</span>
                      </div>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
