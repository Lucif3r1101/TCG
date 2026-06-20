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
  journey: "Card Journey",
  about: "About the Dev"
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
            <div className="guide-lore guide-rules">
              <p className="guide-lead">
                Chronicles of the RIFT is a turn-based duel for 2–6 players. Spend mana to summon units and cast
                spells, then attack to drain every rival's life. Last timeline standing wins the Rift Core.
              </p>

              <h4 className="guide-h">① Getting started</h4>
              <ol className="guide-steps">
                <li>Sign in and pick your realm's deck.</li>
                <li>Create a room (2–6 players) or join with a room code.</li>
                <li>Everyone readies up, then the host starts the duel.</li>
              </ol>

              <h4 className="guide-h">② Your turn, step by step</h4>
              <ol className="guide-steps">
                <li><strong>Draw</strong> — tap your deck pile once to draw a card (one manual draw per turn).</li>
                <li><strong>Gain mana</strong> — your ◆ mana refills and grows by 1 each turn (up to 10).</li>
                <li><strong>Play cards</strong> — pay a card's ◆ cost to put it down:
                  <ul className="guide-sub">
                    <li><strong>⚔ Summon</strong> a unit in <em>Attack</em> position — it uses its <b>ATK</b> and can attack next turn.</li>
                    <li><strong>🛡 Set</strong> a unit in <em>Defense</em> position — it guards you using its <b>DEF</b> and can't attack.</li>
                    <li><strong>✦ Cast</strong> a spell — instant effect, then it sits in your spell zone.</li>
                  </ul>
                </li>
                <li><strong>Attack</strong> — tap one of your ready (⚔) units, then tap an enemy unit or the enemy directly.</li>
                <li><strong>End Turn</strong> when you're done.</li>
              </ol>

              <h4 className="guide-h">③ Combat — how damage works</h4>
              <ul className="guide-bullets">
                <li><strong>Unit vs unit (both attacking):</strong> higher ATK wins; the loser is destroyed and its owner takes the ATK difference as life damage. Equal ATK destroys both.</li>
                <li><strong>Attacking a defending unit:</strong> compare your ATK to its <b>DEF</b>. If ATK &gt; DEF the wall is destroyed (no life lost). If ATK &lt; DEF, <em>your attack is repelled and YOU take the difference</em> — so attack blind at your own risk.</li>
                <li><strong>Direct attack:</strong> only allowed when the enemy has no units left — deals your full ATK to their life.</li>
                <li>A unit can attack once per turn, and change position (attack ⇄ defense) once per turn.</li>
              </ul>

              <h4 className="guide-h">④ The bluff — hidden positions</h4>
              <p>
                Your opponents can see your units but <strong>not whether each one is in Attack or Defense</strong>.
                They have to commit to an attack without knowing if they'll smash a weak attacker or crash into a
                high-DEF wall and lose life. Set your strongest walls to punish reckless swings.
              </p>

              <h4 className="guide-h">⑤ Winning</h4>
              <p>Reduce every rival's life to 0. The last duelist standing claims the Rift Core.</p>
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

          {section === "about" ? (
            <div className="guide-lore guide-about">
              <p className="guide-lead">
                Chronicles of the RIFT is designed, built, and maintained by one developer — front to back,
                art pipeline to real-time multiplayer.
              </p>

              <div className="about-dev-card">
                <h3>Rishav Raj</h3>
                <p>
                  Senior software engineer focused on Android, OEM integrations, AI-powered consumer products,
                  and practical full-stack delivery. I like building things that ship cleanly, scale well, and
                  feel good to play.
                </p>
                <div className="about-dev-links">
                  <a className="button nav-btn" href="mailto:rishav_raj11@outlook.com">✉ Email</a>
                  <a className="button nav-btn" href="https://www.linkedin.com/in/raj-rishav11/" target="_blank" rel="noreferrer">LinkedIn</a>
                </div>
              </div>

              <div className="lore-pillars">
                <div className="lore-pillar"><h4>Frontend</h4><p>React + Vite + TypeScript, Socket.IO, CSS-3D battlefield.</p></div>
                <div className="lore-pillar"><h4>Backend</h4><p>Node + Express, real-time rooms, MongoDB Atlas.</p></div>
                <div className="lore-pillar"><h4>Content</h4><p>312 cards across 6 factions with custom art and effects.</p></div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
