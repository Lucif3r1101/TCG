import { GuideSection } from "../../types/game";
import { LORE_INTRO, LORE_PILLARS } from "../../constants/lore";

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
          <h3>Chronicles of the RIFT Briefing</h3>
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
          <div className="guide-lore">
            {LORE_INTRO.map((para, i) => (
              <p className="muted" key={i}>{para}</p>
            ))}
            <div className="lore-pillars">
              {LORE_PILLARS.map((pillar) => (
                <div className="lore-pillar" key={pillar.title}>
                  <h4>{pillar.title}</h4>
                  <p>{pillar.text}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {section === "how" ? (
          <div className="guide-lore">
            <ol className="muted guide-steps">
              <li>Sign in and choose your realm's deck.</li>
              <li>Create a room (2-6 players) or join with a code.</li>
              <li>Ready up, then the host starts the duel.</li>
              <li>Each turn: draw, spend mana, play units &amp; spells, then attack.</li>
              <li>Reduce every rival to 0 health to claim the Rift Core and win.</li>
            </ol>
          </div>
        ) : null}

        {section === "journey" ? (
          <div className="guide-lore">
            <p className="muted">
              Every realm's deck evolves from starter core cards into synergy branches. Build one primary win condition, one
              backup route, and disruption tools so your timeline holds under pressure.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
