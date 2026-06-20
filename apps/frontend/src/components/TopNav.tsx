import { getIconAssetPath } from "../constants/game";

type TopNavProps = {
  soundEnabled: boolean;
  showLogout: boolean;
  username?: string;
  onOpenLore: () => void;
  onOpenHow: () => void;
  onOpenJourney: () => void;
  onOpenLibrary: () => void;
  onToggleSound: () => void;
  onLogout: () => void;
};

export function TopNav({
  soundEnabled,
  showLogout,
  username,
  onOpenLore,
  onOpenHow,
  onOpenJourney,
  onOpenLibrary,
  onToggleSound,
  onLogout
}: TopNavProps) {
  return (
    <header className="top-nav">
      <div className="brand">
        <img className="brand-logo" src="/assets/branding/chronicles-rift-logo.svg" alt="Chronicles of the RIFT logo" />
        <div>
          <strong>Chronicles of the RIFT</strong>
          <p>Tabletop TCG Arena</p>
        </div>
      </div>
      <nav className="top-actions">
        <button className="button nav-btn" type="button" onClick={onOpenLore}>
          <img className="nav-icon" src={getIconAssetPath("icon-unit")} alt="" aria-hidden="true" />
          Lore
        </button>
        <button className="button nav-btn" type="button" onClick={onOpenHow}>
          <img className="nav-icon" src={getIconAssetPath("icon-unit")} alt="" aria-hidden="true" />
          How to Play
        </button>
        <button className="button nav-btn" type="button" onClick={onOpenJourney}>
          <img className="nav-icon" src={getIconAssetPath("icon-unit")} alt="" aria-hidden="true" />
          Card Journey
        </button>
        <button className="button nav-btn" type="button" onClick={onOpenLibrary}>
          <img className="nav-icon" src={getIconAssetPath("icon-unit")} alt="" aria-hidden="true" />
          Card Library
        </button>
        <button className="button nav-btn" type="button" onClick={onToggleSound}>
          <img className="nav-icon" src={getIconAssetPath("icon-audio")} alt="" aria-hidden="true" />
          Sound: {soundEnabled ? "On" : "Off"}
        </button>
        {showLogout ? (
          <button className="button nav-btn" type="button" onClick={onLogout}>
            <img className="nav-icon" src={getIconAssetPath("icon-logout")} alt="" aria-hidden="true" />
            Logout{username ? ` (${username})` : ""}
          </button>
        ) : null}
      </nav>
    </header>
  );
}
