import { FormEvent, SyntheticEvent } from "react";
import { getAvatarAssetPath, getAvatarFallbackPath } from "../constants/game";
import { AuthMode } from "../types/game";

type AuthPanelProps = {
  embedded?: boolean;
  mode: AuthMode;
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
  passwordVisible: boolean;
  confirmPasswordVisible: boolean;
  acceptedTerms: boolean;
  selectedAvatarId: string;
  canSubmit: boolean;
  isLoading: boolean;
  errorMessage: string;
  successMessage: string;
  onSetMode: (mode: AuthMode) => void;
  onEmailChange: (value: string) => void;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onTogglePasswordVisible: () => void;
  onToggleConfirmPasswordVisible: () => void;
  onAcceptedTermsChange: (value: boolean) => void;
  onAvatarChange: (value: string) => void;
  onOpenTerms: () => void;
  onOpenPrivacy: () => void;
  onOpenForgot: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
      {!open ? <line x1="4" y1="20" x2="20" y2="4" /> : null}
    </svg>
  );
}

export function AuthPanel(props: AuthPanelProps) {
  const {
    embedded = false,
    mode,
    email,
    username,
    password,
    confirmPassword,
    passwordVisible,
    confirmPasswordVisible,
    acceptedTerms,
    selectedAvatarId,
    canSubmit,
    isLoading,
    errorMessage,
    successMessage,
    onSetMode,
    onEmailChange,
    onUsernameChange,
    onPasswordChange,
    onConfirmPasswordChange,
    onTogglePasswordVisible,
    onToggleConfirmPasswordVisible,
    onAcceptedTermsChange,
    onAvatarChange,
    onOpenTerms,
    onOpenPrivacy,
    onOpenForgot,
    onSubmit
  } = props;

  const isRegister = mode === "register";

  const handleAvatarError = (event: SyntheticEvent<HTMLImageElement, Event>, avatarId: string) => {
    const image = event.currentTarget;
    if (image.dataset.fallbackApplied === "true") return;
    image.dataset.fallbackApplied = "true";
    image.src = getAvatarFallbackPath(avatarId);
  };

  const FACTIONS = [
    { id: "riftforged-sentinel", label: "SENTINEL", color: "#e0b357" },
    { id: "void-ranger", label: "VOID", color: "#a855f7" },
    { id: "ember-arcanist", label: "EMBER", color: "#ef6a36" },
    { id: "ironbound-beastmaster", label: "BEAST", color: "#6abf4b" },
    { id: "chronomancer", label: "CHRONO", color: "#33b6ff" },
    { id: "abyss-revenant", label: "ABYSS", color: "#14c8a0" }
  ];
  const realms = [
    "riftforged-sentinel.jpg", "void-ranger.jpg", "ember-arcanist.jpg",
    "ironbound-beastmaster.jpg", "chronomancer.jpg", "abyss-revenant.jpg"
  ];

  return (
    <div className={`rift-auth ${embedded ? "auth-embedded" : ""}`}>
      <div className="rift-auth-bg" aria-hidden="true">
        {realms.map((src, i) => (
          <div key={src} className="rift-auth-slide" style={{ backgroundImage: `url(/assets/realms/${src})`, animationDelay: `${i * 5}s`, animationDuration: `${realms.length * 5}s` }} />
        ))}
        <div className="rift-auth-veil" />
        {Array.from({ length: 16 }, (_, i) => (
          <span key={`em-${i}`} className="rift-auth-ember" style={{ left: `${5 + (i * 6) % 92}%`, background: i % 3 === 0 ? "#e05c28" : i % 3 === 1 ? "#c9973a" : "#7c3aed", animationDelay: `${(i * 0.5) % 5}s`, animationDuration: `${5 + (i % 4)}s` }} />
        ))}
      </div>

      <div className="rift-auth-center">
        <div className="rift-auth-titlebar">
          <div className="rift-auth-kicker">WELCOME TO</div>
          <h1 className="rift-auth-title-1">Chronicles</h1>
          <h1 className="rift-auth-title-2">OF THE RIFT</h1>
          <p className="rift-auth-tagline">Six fractured realms. Three hundred forgotten champions. One living arena where time itself breaks.</p>
          <div className="rift-auth-factions">
            {FACTIONS.map((f) => (
              <span key={f.id} className="rift-auth-faction" style={{ ["--fc" as string]: f.color }}>{f.label}</span>
            ))}
          </div>
        </div>

      <section className="rift-auth-panel gold-panel">
        <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
          <button className={`auth-tab ${!isRegister ? "active" : ""}`} type="button" role="tab" aria-selected={!isRegister} onClick={() => onSetMode("login")}>LOG IN</button>
          <button className={`auth-tab ${isRegister ? "active" : ""}`} type="button" role="tab" aria-selected={isRegister} onClick={() => onSetMode("register")}>REGISTER</button>
        </div>

        <form className="auth-form" onSubmit={onSubmit}>
          <label className="label">
            Email
            <input
              className="input"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              required
            />
          </label>

          {isRegister ? (
            <label className="label">
              Username
              <input
                className="input"
                type="text"
                autoComplete="username"
                placeholder="Your arena name"
                value={username}
                onChange={(e) => onUsernameChange(e.target.value)}
                required
              />
            </label>
          ) : null}

          <label className="label">
            <span className="label-row">
              Password
              {!isRegister ? (
                <button type="button" className="link auth-forgot" onClick={onOpenForgot}>
                  Forgot?
                </button>
              ) : null}
            </span>
            <div className="input-wrap">
              <input
                className="input"
                type={passwordVisible ? "text" : "password"}
                autoComplete={isRegister ? "new-password" : "current-password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => onPasswordChange(e.target.value)}
                required
              />
              <button className="peek peek-eye" type="button" onClick={onTogglePasswordVisible} aria-label={passwordVisible ? "Hide password" : "Show password"}>
                <EyeIcon open={passwordVisible} />
              </button>
            </div>
          </label>

          {isRegister ? (
            <label className="label">
              Confirm Password
              <div className="input-wrap">
                <input
                  className="input"
                  type={confirmPasswordVisible ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => onConfirmPasswordChange(e.target.value)}
                  required
                />
                <button className="peek peek-eye" type="button" onClick={onToggleConfirmPasswordVisible} aria-label={confirmPasswordVisible ? "Hide password" : "Show password"}>
                  <EyeIcon open={confirmPasswordVisible} />
                </button>
              </div>
            </label>
          ) : null}

          {isRegister ? <p className="auth-hint">Must include uppercase, lowercase, a number, and a symbol.</p> : null}

          {isRegister ? (
            <div className="avatar-picker">
              <p className="label-text">Choose your avatar</p>
              <div className="avatar-grid">
                {Array.from({ length: 14 }, (_, i) => {
                  const avatarId = `avatar-${String(i + 1).padStart(2, "0")}`;
                  return (
                    <button
                      key={avatarId}
                      type="button"
                      className={`avatar-option ${selectedAvatarId === avatarId ? "active" : ""}`}
                      onClick={() => onAvatarChange(avatarId)}
                      aria-label={`Select ${avatarId}`}
                      aria-pressed={selectedAvatarId === avatarId}
                    >
                      <img
                        src={getAvatarAssetPath(avatarId)}
                        alt=""
                        loading="lazy"
                        onError={(event) => handleAvatarError(event, avatarId)}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {isRegister ? (
            <label className="checkbox">
              <input type="checkbox" checked={acceptedTerms} onChange={(e) => onAcceptedTermsChange(e.target.checked)} />
              <span>
                I agree to the{" "}
                <button type="button" className="link" onClick={onOpenTerms}>Terms</button>{" "}
                and{" "}
                <button type="button" className="link" onClick={onOpenPrivacy}>Privacy Policy</button>.
              </span>
            </label>
          ) : null}

          {errorMessage ? <p className="error">{errorMessage}</p> : null}
          {successMessage ? <p className="good">{successMessage}</p> : null}

          <button className="button primary auth-submit gold-btn" type="submit" disabled={isLoading || !canSubmit}>
            {isLoading ? "Summoning…" : isRegister ? "Forge Your Legacy" : "Enter the Rift"}
          </button>

          {!isRegister ? (
            <button type="button" className="rift-auth-forgot-link" onClick={onOpenForgot}>Forgot your access key?</button>
          ) : null}
        </form>
      </section>
      </div>
    </div>
  );
}
