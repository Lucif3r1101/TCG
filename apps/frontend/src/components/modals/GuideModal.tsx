import { GuideSection } from "../../types/game";

type GuideModalProps = {
  open: boolean;
  section: GuideSection;
  onSectionChange: (section: GuideSection) => void;
  onClose: () => void;
};

export function GuideModal({ open, section, onSectionChange, onClose }: GuideModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="legal-overlay" role="dialog" aria-modal="true">
      <div className="guide-card">
        <div className="guide-head">
          <h3>Chronicles of RIFT Briefing</h3>
          <button className="button" type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="tabs">
          <button className={`tab ${section === "lore" ? "active" : ""}`} type="button" onClick={() => onSectionChange("lore")}>
            Lore
          </button>
          <button className={`tab ${section === "how" ? "active" : ""}`} type="button" onClick={() => onSectionChange("how")}>
            How to Play
          </button>
          <button className={`tab ${section === "journey" ? "active" : ""}`} type="button" onClick={() => onSectionChange("journey")}>
            Card Journey
          </button>
        </div>

        {section === "lore" ? (
          <div className="guide-grid">
            <img
              src="https://images.unsplash.com/photo-1511882150382-421056c89033?auto=format&fit=crop&w=1200&q=80"
              alt="Rift battlefield"
            />
            <p className="muted">
              In 2026, the Rift opened six fractured realms and each realm forged a class-based deck identity. Commanders duel
              to stabilize timelines, control energy lanes, and claim dominion over unstable worlds.
            </p>
          </div>
        ) : null}

        {section === "how" ? (
          <div className="guide-grid">
            <img
              src="https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMWh4b2s2NWI4M3k5MW9iOWRwY2tjbW41bWR0aWwycmV6eW9xemM4dSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/26AHONQ79FdWZhAI0/giphy.gif"
              alt="Card game animation"
            />
            <ol className="muted">
              <li>Login and choose a deck.</li>
              <li>Create a room (2-6 players) or join with code.</li>
              <li>Ready up, then host starts the room.</li>
              <li>Take turns, use mana, activate abilities, and end turn.</li>
              <li>Eliminate opponents or complete objective conditions.</li>
            </ol>
          </div>
        ) : null}

        {section === "journey" ? (
          <div className="guide-grid">
            <img
              src="https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&q=80"
              alt="Card collection setup"
            />
            <p className="muted">
              Every character deck evolves from starter core cards to synergy branches. Build one primary win condition, one
              backup route, and disruption tools for tabletop consistency.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
