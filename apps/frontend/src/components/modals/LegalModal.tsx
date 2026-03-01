type LegalModalProps = {
  view: "terms" | "privacy" | null;
  onClose: () => void;
};

export function LegalModal({ view, onClose }: LegalModalProps) {
  if (!view) {
    return null;
  }

  return (
    <div className="legal-overlay" role="dialog" aria-modal="true">
      <div className="legal-card">
        <h3>{view === "terms" ? "Terms of Service" : "Privacy Policy"}</h3>
        {view === "terms" ? (
          <p className="muted">
            You agree to fair play, no abuse/exploitation, and compliance with local laws. Accounts violating platform
            integrity may be suspended. Game systems may change as balancing updates roll out.
          </p>
        ) : (
          <p className="muted">
            We store account credentials (hashed), gameplay metadata, and match activity to run multiplayer services. We do not
            sell personal data. You may request account deletion by contacting support.
          </p>
        )}
        <button className="button primary" type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
