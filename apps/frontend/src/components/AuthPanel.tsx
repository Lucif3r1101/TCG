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

  return (
    <div className={`auth ${embedded ? "auth-embedded" : ""}`}>
      {embedded ? null : (
        <aside className="auth-hero">
          <img className="auth-hero-logo" src="/assets/branding/chronicles-rift-logo.svg" alt="Chronicles of the RIFT" />
          <span className="auth-hero-kicker">Rift · Season 2026</span>
          <h2>{isRegister ? "Create your Battler ID" : "Welcome back, Challenger"}</h2>
          <p>Assemble your deck, enter tactical multiplayer rooms, and battle through live turn-based duels.</p>
          <ul className="auth-hero-points">
            <li>Six factions, 300+ cards</li>
            <li>Real-time rooms &amp; matchmaking</li>
            <li>Free to play</li>
          </ul>
        </aside>
      )}

      <section className="auth-form-col">
        <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
          <button
            className={`auth-tab ${isRegister ? "active" : ""}`}
            type="button"
            role="tab"
            aria-selected={isRegister}
            onClick={() => onSetMode("register")}
          >
            Sign Up
          </button>
          <button
            className={`auth-tab ${!isRegister ? "active" : ""}`}
            type="button"
            role="tab"
            aria-selected={!isRegister}
            onClick={() => onSetMode("login")}
          >
            Sign In
          </button>
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
              <button className="peek" type="button" onClick={onTogglePasswordVisible} aria-label={passwordVisible ? "Hide password" : "Show password"}>
                {passwordVisible ? "Hide" : "Show"}
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
                <button className="peek" type="button" onClick={onToggleConfirmPasswordVisible} aria-label={confirmPasswordVisible ? "Hide password" : "Show password"}>
                  {confirmPasswordVisible ? "Hide" : "Show"}
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

          <button className="button primary auth-submit" type="submit" disabled={isLoading || !canSubmit}>
            {isLoading ? "Working…" : isRegister ? "Create Account" : "Sign In"}
          </button>

          <p className="auth-switch">
            {isRegister ? "Already have an account?" : "New to the Rift?"}{" "}
            <button type="button" className="link" onClick={() => onSetMode(isRegister ? "login" : "register")}>
              {isRegister ? "Sign in" : "Create one"}
            </button>
          </p>
        </form>
      </section>
    </div>
  );
}
