import { useEffect, useRef, useState } from "react";
import { getIconAssetPath } from "../constants/game";

type TopNavProps = {
  soundEnabled: boolean;
  showLogout: boolean;
  username?: string;
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
                <strong>Menu</strong>
                <button className="icon-close" type="button" onClick={() => setOpen(false)} aria-label="Close">×</button>
              </div>

              <nav className="drawer-items">
                {showLogout ? (
                  <button className="nav-menu-item" type="button" role="menuitem" onClick={run(onOpenProfile)}>
                    <span className="nav-ico-chip"><img className="nav-icon" src={getIconAssetPath("icon-shield")} alt="" aria-hidden="true" /></span>
                    <span className="nav-label">Profile{username ? ` · ${username}` : ""}</span>
                  </button>
                ) : null}
                <button className="nav-menu-item" type="button" role="menuitem" onClick={run(onOpenLore)}>
                  <span className="nav-ico-chip"><img className="nav-icon" src={getIconAssetPath("icon-spell")} alt="" aria-hidden="true" /></span>
                  <span className="nav-label">Lore</span>
                </button>
                <button className="nav-menu-item" type="button" role="menuitem" onClick={run(onOpenHow)}>
                  <span className="nav-ico-chip"><img className="nav-icon" src={getIconAssetPath("icon-unit")} alt="" aria-hidden="true" /></span>
                  <span className="nav-label">How to Play</span>
                </button>
                <button className="nav-menu-item" type="button" role="menuitem" onClick={run(onOpenJourney)}>
                  <span className="nav-ico-chip"><img className="nav-icon" src={getIconAssetPath("icon-timer")} alt="" aria-hidden="true" /></span>
                  <span className="nav-label">Card Journey</span>
                </button>
                <button className="nav-menu-item" type="button" role="menuitem" onClick={run(onOpenLibrary)}>
                  <span className="nav-ico-chip"><img className="nav-icon" src={getIconAssetPath("icon-room")} alt="" aria-hidden="true" /></span>
                  <span className="nav-label">Card Library</span>
                </button>
                <button className="nav-menu-item" type="button" role="menuitem" onClick={run(onOpenAbout)}>
                  <span className="nav-ico-chip"><img className="nav-icon" src={getIconAssetPath("icon-shield")} alt="" aria-hidden="true" /></span>
                  <span className="nav-label">About the Dev</span>
                </button>
                <button className="nav-menu-item" type="button" role="menuitem" onClick={run(onToggleSound)}>
                  <span className="nav-ico-chip"><img className="nav-icon" src={getIconAssetPath("icon-audio")} alt="" aria-hidden="true" /></span>
                  <span className="nav-label">Sound</span>
                  <span className="nav-state">{soundEnabled ? "On" : "Off"}</span>
                </button>
              </nav>

              {showLogout ? (
                <button className="drawer-logout" type="button" role="menuitem" onClick={run(onLogout)}>
                  <img className="nav-icon" src={getIconAssetPath("icon-logout")} alt="" aria-hidden="true" /> Logout
                </button>
              ) : null}
            </aside>
          </div>
        ) : null}
      </div>
    </header>
  );
}
