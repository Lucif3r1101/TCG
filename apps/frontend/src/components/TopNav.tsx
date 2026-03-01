type TopNavProps = {
  soundEnabled: boolean;
  onOpenGuide: () => void;
  onToggleSound: () => void;
};

export function TopNav({ soundEnabled, onOpenGuide, onToggleSound }: TopNavProps) {
  return (
    <header className="top-nav">
      <div className="brand">
        <span className="brand-mark">CR</span>
        <div>
          <strong>Chronicles of RIFT</strong>
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
      </nav>
    </header>
  );
}
