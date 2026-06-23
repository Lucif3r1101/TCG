import { getCardArtSources, handleCardArtError } from "../lib/cardArt";
import { DetailCard } from "./CardDetailModal";

// Shared "zoom card + info on the right" view, used by the lobby library,
// the in-game info button, and the Card Library.
export function CardView({ card, onClose }: { card: DetailCard; onClose: () => void }) {
  const inDef = card.position === "defense";
  return (
    <div className="lib-cardview-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <button className="lib-cardview-close" type="button" onClick={onClose} aria-label="Close">×</button>
      <div className="lib-cardview-row" onClick={(e) => e.stopPropagation()}>
        <div className="lib-cardview-card">
          <img src={getCardArtSources(card.slug).primary} alt={card.name} onError={(e) => handleCardArtError(e, card.slug)} />
          <span className="lib-cardview-cost">◆ {card.cost}</span>
          {card.type === "unit" ? (
            <span className="lib-cardview-stats"><b className="ut-atk">⚔ {card.attack}</b><b className="ut-def">🛡 {card.health}</b></span>
          ) : null}
        </div>
        <div className="lib-cardview-info">
          <h3>{card.name}</h3>
          <div className="lib-cardview-tags">
            <span className={`cd-tag tag-${card.rarity}`}>{card.rarity}</span>
            {card.faction ? <span className="cd-tag">{card.faction}</span> : null}
            <span className="cd-tag">{card.type === "unit" ? "Unit" : "Spell"}</span>
            {card.position ? <span className="cd-tag">{inDef ? "Defense" : "Attack"} Stance</span> : null}
          </div>
          <p className="lib-cardview-desc">{card.description}</p>
          <div className="lib-cardview-mana"><span>MANA</span><strong>◆ {card.cost}</strong></div>
          {card.type === "unit" ? (
            <div className="lib-cardview-block"><strong>Unit</strong><span>Summon to your field — fights with ⚔ {card.attack} / 🛡 {card.health}.</span></div>
          ) : (
            <div className="lib-cardview-block lib-spell"><strong>Spell</strong><span>Resolves an effect, then goes to your graveyard.</span></div>
          )}
        </div>
      </div>
    </div>
  );
}
