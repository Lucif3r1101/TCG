type ForgotPasswordModalProps = {
  open: boolean;
  step: "request" | "reset";
  email: string;
  token: string;
  password: string;
  confirmPassword: string;
  passwordVisible: boolean;
  confirmVisible: boolean;
  error: string;
  message: string;
  onEmailChange: (value: string) => void;
  onTokenChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onTogglePasswordVisible: () => void;
  onToggleConfirmVisible: () => void;
  onRequestReset: () => void;
  onSubmitReset: () => void;
  onChangeStep: (step: "request" | "reset") => void;
  onClose: () => void;
};

export function ForgotPasswordModal(props: ForgotPasswordModalProps) {
  const {
    open,
    step,
    email,
    token,
    password,
    confirmPassword,
    passwordVisible,
    confirmVisible,
    error,
    message,
    onEmailChange,
    onTokenChange,
    onPasswordChange,
    onConfirmPasswordChange,
    onTogglePasswordVisible,
    onToggleConfirmVisible,
    onRequestReset,
    onSubmitReset,
    onChangeStep,
    onClose
  } = props;

  if (!open) {
    return null;
  }

  return (
    <div className="legal-overlay" role="dialog" aria-modal="true">
      <div className="legal-card">
        <h3>{step === "request" ? "Reset your password" : "Set a new password"}</h3>

        {step === "request" ? (
          <div className="grid">
            <label className="label">
              Account Email
              <input className="input" value={email} onChange={(e) => onEmailChange(e.target.value)} type="email" />
            </label>
            <button className="button primary" type="button" onClick={onRequestReset}>
              Send Reset Token
            </button>
            <button className="button" type="button" onClick={() => onChangeStep("reset")}>
              I already have a token
            </button>
          </div>
        ) : (
          <div className="grid">
            <label className="label">
              Reset Token
              <input className="input" value={token} onChange={(e) => onTokenChange(e.target.value)} type="text" />
            </label>
            <label className="label">
              New Password
              <div className="input-wrap">
                <input
                  className="input"
                  value={password}
                  onChange={(e) => onPasswordChange(e.target.value)}
                  type={passwordVisible ? "text" : "password"}
                />
                <button className="peek" type="button" onClick={onTogglePasswordVisible}>
                  {passwordVisible ? "Hide" : "Show"}
                </button>
              </div>
            </label>
            <label className="label">
              Confirm Password
              <div className="input-wrap">
                <input
                  className="input"
                  value={confirmPassword}
                  onChange={(e) => onConfirmPasswordChange(e.target.value)}
                  type={confirmVisible ? "text" : "password"}
                />
                <button className="peek" type="button" onClick={onToggleConfirmVisible}>
                  {confirmVisible ? "Hide" : "Show"}
                </button>
              </div>
            </label>
            <p className="muted">Password must include uppercase, lowercase, number, and symbol.</p>
            <button className="button primary" type="button" onClick={onSubmitReset}>
              Update Password
            </button>
            <button className="button" type="button" onClick={() => onChangeStep("request")}>
              Back
            </button>
          </div>
        )}

        {error ? <p className="error">{error}</p> : null}
        {message ? <p className="good">{message}</p> : null}
        <button className="button" type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
