import { GuideSection } from "../../types/game";
import { LORE_INTRO, LORE_PILLARS } from "../../constants/lore";

type GuideModalProps = {
  open: boolean;
  section: GuideSection;
  onClose: () => void;
};

const TITLES: Record<GuideSection, string> = {
  lore: "The Lore",
  how: "How to Play",
  journey: "Card Journey"
};

// Each guide section is now its own full screen (no sub-tabs). `section` decides
// which screen is shown.
export function GuideModal({ open, section, onClose }: GuideModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="info-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="info-screen" onClick={(e) => e.stopPropagation()}>
        <div className="info-head">
          <div>
            <span className="landing-section-kicker">Chronicles of the RIFT</span>
            <h2>{TITLES[section]}</h2>
          </div>
          <button className="icon-close" type="button" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="info-body">
          {section === "lore" ? (
            <div className="guide-lore">
              {LORE_INTRO.map((para, i) => (
                <p key={i}>{para}</p>
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
              <ol className="guide-steps">
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
              <p>
                Every realm's deck evolves from starter core cards into synergy branches. Build one primary win condition,
                one backup route, and disruption tools so your timeline holds under pressure.
              </p>
              <div className="lore-pillars">
                <div className="lore-pillar"><h4>Core</h4><p>Reliable units and removal that every game wants.</p></div>
                <div className="lore-pillar"><h4>Synergy</h4><p>Cards that amplify your realm's identity and combos.</p></div>
                <div className="lore-pillar"><h4>Tech</h4><p>Answers and disruption for tough matchups.</p></div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
