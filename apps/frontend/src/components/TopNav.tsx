type TopNavProps = {
  soundEnabled: boolean;
  showLogout: boolean;
  onOpenGuide: () => void;
  onToggleSound: () => void;
  onLogout: () => void;
};

export function TopNav({ soundEnabled, showLogout, onOpenGuide, onToggleSound, onLogout }: TopNavProps) {
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
        <button className="button nav-btn" type="button" onClick={onOpenGuide}>
          How to Play
        </button>
        <button className="button nav-btn" type="button" onClick={onToggleSound}>
          Sound: {soundEnabled ? "On" : "Off"}
        </button>
        {showLogout ? (
          <button className="button nav-btn" type="button" onClick={onLogout}>
            Logout
          </button>
        ) : null}
      </nav>
    </header>
  );
}
