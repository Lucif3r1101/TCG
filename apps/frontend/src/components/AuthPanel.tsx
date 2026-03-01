import { FormEvent } from "react";
import { AuthMode } from "../types/game";

type AuthPanelProps = {
  mode: AuthMode;
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
  passwordVisible: boolean;
  confirmPasswordVisible: boolean;
  acceptedTerms: boolean;
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
  onOpenTerms: () => void;
  onOpenPrivacy: () => void;
  onOpenForgot: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function AuthPanel(props: AuthPanelProps) {
  const {
    mode,
    email,
    username,
    password,
    confirmPassword,
    passwordVisible,
    confirmPasswordVisible,
    acceptedTerms,
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
    onOpenTerms,
    onOpenPrivacy,
    onOpenForgot,
    onSubmit
  } = props;

  return (
    <div className="auth-shell">
      <aside className="auth-showcase">
        <p className="auth-kicker">RIFT SEASON 2026</p>
        <h2>{mode === "register" ? "Create Your Battler ID" : "Welcome Back, Challenger"}</h2>
        <p>Enter the arena, assemble your cards, and battle through tactical multiplayer rooms with live turn-based action.</p>
      </aside>

      <section className="auth-panel">
        <div className="tabs">
          <button className={`tab ${mode === "register" ? "active" : ""}`} type="button" onClick={() => onSetMode("register")}>
            Sign Up
          </button>
          <button className={`tab ${mode === "login" ? "active" : ""}`} type="button" onClick={() => onSetMode("login")}>
            Sign In
          </button>
        </div>

        <form className="form" onSubmit={onSubmit}>
          <label className="label">
            Email
            <input className="input" type="email" value={email} onChange={(e) => onEmailChange(e.target.value)} required />
          </label>

          {mode === "login" ? (
            <button type="button" className="link forgot-inline" onClick={onOpenForgot}>
              Forgot password?
            </button>
          ) : null}

          {mode === "register" ? (
            <label className="label">
              Username
              <input className="input" type="text" value={username} onChange={(e) => onUsernameChange(e.target.value)} required />
            </label>
          ) : null}

          <label className="label">
            Password
            <div className="input-wrap">
              <input
                className="input"
                type={passwordVisible ? "text" : "password"}
                value={password}
                onChange={(e) => onPasswordChange(e.target.value)}
                required
              />
              <button className="peek" type="button" onClick={onTogglePasswordVisible}>
                {passwordVisible ? "Hide" : "Show"}
              </button>
            </div>
          </label>

          {mode === "register" ? (
            <label className="label">
              Confirm Password
              <div className="input-wrap">
                <input
                  className="input"
                  type={confirmPasswordVisible ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => onConfirmPasswordChange(e.target.value)}
                  required
                />
                <button className="peek" type="button" onClick={onToggleConfirmPasswordVisible}>
                  {confirmPasswordVisible ? "Hide" : "Show"}
                </button>
              </div>
            </label>
          ) : null}

          {mode === "register" ? (
            <>
              <p className="muted">Password must include uppercase, lowercase, number, and symbol.</p>
              <label className="muted checkbox">
                <input type="checkbox" checked={acceptedTerms} onChange={(e) => onAcceptedTermsChange(e.target.checked)} />
                <span>
                  I agree to the{" "}
                  <button type="button" className="link" onClick={onOpenTerms}>
                    Terms
                  </button>{" "}
                  and{" "}
                  <button type="button" className="link" onClick={onOpenPrivacy}>
                    Privacy Policy
                  </button>
                  .
                </span>
              </label>
            </>
          ) : null}

          {errorMessage ? <p className="error">{errorMessage}</p> : null}
          {successMessage ? <p className="good">{successMessage}</p> : null}

          <button className="button primary" type="submit" disabled={isLoading || !canSubmit}>
            {isLoading ? "Working..." : mode === "register" ? "Create Account" : "Sign In"}
          </button>
        </form>
      </section>
    </div>
  );
}
