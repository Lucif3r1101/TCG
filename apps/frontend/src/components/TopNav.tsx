import { useEffect, useRef, useState } from "react";
import { getIconAssetPath } from "../constants/game";

type TopNavProps = {
  soundEnabled: boolean;
  showLogout: boolean;
  username?: string;
  onOpenLore: () => void;
  onOpenHow: () => void;
  onOpenJourney: () => void;
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
        <img className="brand-logo" src="/assets/branding/chronicles-rift-logo.svg" alt="Chronicles of the RIFT logo" />
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
          <div className="nav-menu" role="menu">
            {showLogout ? (
              <button className="nav-menu-item" type="button" role="menuitem" onClick={run(onOpenProfile)}>
                <img className="nav-icon" src={getIconAssetPath("icon-shield")} alt="" aria-hidden="true" />
                Profile{username ? ` · ${username}` : ""}
              </button>
            ) : null}
            <button className="nav-menu-item" type="button" role="menuitem" onClick={run(onOpenLore)}>
              <img className="nav-icon" src={getIconAssetPath("icon-unit")} alt="" aria-hidden="true" /> Lore
            </button>
            <button className="nav-menu-item" type="button" role="menuitem" onClick={run(onOpenHow)}>
              <img className="nav-icon" src={getIconAssetPath("icon-unit")} alt="" aria-hidden="true" /> How to Play
            </button>
            <button className="nav-menu-item" type="button" role="menuitem" onClick={run(onOpenJourney)}>
              <img className="nav-icon" src={getIconAssetPath("icon-unit")} alt="" aria-hidden="true" /> Card Journey
            </button>
            <button className="nav-menu-item" type="button" role="menuitem" onClick={run(onOpenLibrary)}>
              <img className="nav-icon" src={getIconAssetPath("icon-room")} alt="" aria-hidden="true" /> Card Library
            </button>
            <button className="nav-menu-item" type="button" role="menuitem" onClick={run(onToggleSound)}>
              <img className="nav-icon" src={getIconAssetPath("icon-audio")} alt="" aria-hidden="true" /> Sound: {soundEnabled ? "On" : "Off"}
            </button>
            {showLogout ? (
              <button className="nav-menu-item nav-menu-danger" type="button" role="menuitem" onClick={run(onLogout)}>
                <img className="nav-icon" src={getIconAssetPath("icon-logout")} alt="" aria-hidden="true" /> Logout
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </header>
  );
}
