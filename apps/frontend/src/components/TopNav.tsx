import { useEffect, useRef, useState } from "react";

// Clean inline line-icons (prototype style) — stroke uses currentColor.
const ICON_PATHS: Record<string, string> = {
  shield: "M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z",
  book: "M5 4h11a2 2 0 012 2v14H7a2 2 0 01-2-2V4z M5 4v12 M19 16H7",
  help: "M12 3a9 9 0 100 18 9 9 0 000-18z M9.5 9a2.5 2.5 0 114 2c-1 .7-1.5 1.2-1.5 2.3 M12 17h.01",
  clock: "M12 3a9 9 0 100 18 9 9 0 000-18z M12 7v5l3 2",
  grid: "M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z",
  info: "M12 3a9 9 0 100 18 9 9 0 000-18z M12 11v6 M12 7.5h.01",
  chart: "M5 20V10 M12 20V4 M19 20v-7",
  volume: "M4 9v6h4l5 4V5L8 9H4z M16 8a5 5 0 010 8",
  logout: "M9 4H5a2 2 0 00-2 2v12a2 2 0 002 2h4 M16 17l5-5-5-5 M21 12H9"
};

function NavIcon({ name }: { name: string }) {
  return (
    <svg className="nav-svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICON_PATHS[name].split(" M").map((seg, i) => <path key={i} d={(i === 0 ? "" : "M") + seg} />)}
    </svg>
  );
}

type TopNavProps = {
  soundEnabled: boolean;
  showLogout: boolean;
  username?: string;
  isAdmin?: boolean;
  onOpenStats?: () => void;
  onOpenLore: () => void;
  onOpenHow: () => void;
  onOpenJourney: () => void;
  onOpenAbout: () => void;
  onOpenLibrary: () => void;
  onOpenProfile: () => void;
  onToggleSound: () => void;
  onLogout: () => void;
};

export function TopNav({
  soundEnabled,
  showLogout,
  username,
  isAdmin,
  onOpenStats,
  onOpenLore,
  onOpenHow,
  onOpenJourney,
  onOpenAbout,
  onOpenLibrary,
  onOpenProfile,
  onToggleSound,
  onLogout
}: TopNavProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close the menu on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const run = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  return (
    <header className="top-nav">
      <div className="brand">
        <img className="brand-logo" src="/assets/branding/chronicles-rift-logo.png" alt="Chronicles of the RIFT logo" />
        <div>
          <strong>Chronicles of the RIFT</strong>
          <p>Tabletop TCG Arena</p>
        </div>
      </div>

      <div className="nav-menu-wrap" ref={menuRef}>
        <button
          className="nav-burger"
          type="button"
          aria-label="Menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span /><span /><span />
        </button>

        {open ? (
          <div className="drawer-overlay" onClick={() => setOpen(false)}>
            <aside className="drawer" role="menu" onClick={(e) => e.stopPropagation()}>
              <div className="drawer-head">
                <strong>RIFT</strong>
                <button className="icon-close" type="button" onClick={() => setOpen(false)} aria-label="Close">×</button>
              </div>

              <nav className="drawer-items">
                {showLogout ? (
                  <button className="nav-menu-item" type="button" role="menuitem" onClick={run(onOpenProfile)}>
                    <span className="nav-ico-chip"><NavIcon name="shield" /></span>
                    <span className="nav-label">Profile{username ? ` · ${username}` : ""}</span>
                  </button>
                ) : null}
                <button className="nav-menu-item" type="button" role="menuitem" onClick={run(onOpenLore)}>
                  <span className="nav-ico-chip"><NavIcon name="book" /></span>
                  <span className="nav-label">Lore</span>
                </button>
                <button className="nav-menu-item" type="button" role="menuitem" onClick={run(onOpenHow)}>
                  <span className="nav-ico-chip"><NavIcon name="help" /></span>
                  <span className="nav-label">How to Play</span>
                </button>
                <button className="nav-menu-item" type="button" role="menuitem" onClick={run(onOpenJourney)}>
                  <span className="nav-ico-chip"><NavIcon name="clock" /></span>
                  <span className="nav-label">Card Journey</span>
                </button>
                <button className="nav-menu-item" type="button" role="menuitem" onClick={run(onOpenLibrary)}>
                  <span className="nav-ico-chip"><NavIcon name="grid" /></span>
                  <span className="nav-label">Card Library</span>
                </button>
                <button className="nav-menu-item" type="button" role="menuitem" onClick={run(onOpenAbout)}>
                  <span className="nav-ico-chip"><NavIcon name="info" /></span>
                  <span className="nav-label">About the Dev</span>
                </button>
                {isAdmin && onOpenStats ? (
                  <button className="nav-menu-item" type="button" role="menuitem" onClick={run(onOpenStats)}>
                    <span className="nav-ico-chip"><NavIcon name="chart" /></span>
                    <span className="nav-label">Analytics</span>
                  </button>
                ) : null}
                <button className="nav-menu-item" type="button" role="menuitem" onClick={run(onToggleSound)}>
                  <span className="nav-ico-chip"><NavIcon name="volume" /></span>
                  <span className="nav-label">Sound</span>
                  <span className="nav-state">{soundEnabled ? "On" : "Off"}</span>
                </button>
              </nav>

              {showLogout ? (
                <button className="drawer-logout" type="button" role="menuitem" onClick={run(onLogout)}>
                  <NavIcon name="logout" /> Logout
                </button>
              ) : null}
            </aside>
          </div>
        ) : null}
      </div>
    </header>
  );
}
