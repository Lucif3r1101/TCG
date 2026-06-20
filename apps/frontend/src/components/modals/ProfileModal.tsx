import { SyntheticEvent, useState } from "react";
import { callApi } from "../../lib/api";
import { getAvatarAssetPath, getAvatarFallbackPath, PASSWORD_RULE } from "../../constants/game";
import { AuthUser } from "../../types/game";

type ProfileModalProps = {
  open: boolean;
  token: string;
  user: AuthUser;
  onClose: () => void;
  onUpdated: (user: AuthUser) => void;
};

export function ProfileModal({ open, token, user, onClose, onUpdated }: ProfileModalProps) {
  const [username, setUsername] = useState(user.username);
  const [avatarId, setAvatarId] = useState(user.avatarId);
  const [profileMsg, setProfileMsg] = useState("");
  const [profileErr, setProfileErr] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [pwErr, setPwErr] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  if (!open) return null;

  const handleAvatarError = (event: SyntheticEvent<HTMLImageElement, Event>, id: string) => {
    const image = event.currentTarget;
    if (image.dataset.fallbackApplied === "true") return;
    image.dataset.fallbackApplied = "true";
    image.src = getAvatarFallbackPath(id);
  };

  const profileDirty = username !== user.username || avatarId !== user.avatarId;

  const saveProfile = async () => {
    setProfileMsg("");
    setProfileErr("");
    if (username.length < 3 || !/^[a-zA-Z0-9_]+$/.test(username)) {
      setProfileErr("Username must be 3+ chars, letters/numbers/underscore only.");
      return;
    }
    setSavingProfile(true);
    try {
      const res = await callApi<{ user: AuthUser }>("/auth/profile", "PATCH", { username, avatarId }, token);
      onUpdated(res.user);
      setProfileMsg("Profile updated.");
    } catch (e) {
      setProfileErr(e instanceof Error ? e.message : "Could not update profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async () => {
    setPwMsg("");
    setPwErr("");
    if (!PASSWORD_RULE.test(newPassword)) {
      setPwErr("New password needs uppercase, lowercase, a number, and a symbol.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwErr("New passwords do not match.");
      return;
    }
    setSavingPw(true);
    try {
      await callApi<{ message: string }>("/auth/change-password", "POST", { currentPassword, newPassword }, token);
      setPwMsg("Password changed.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e) {
      setPwErr(e instanceof Error ? e.message : "Could not change password.");
    } finally {
      setSavingPw(false);
    }
  };

  return (
    <div className="legal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="auth-modal profile-modal" onClick={(e) => e.stopPropagation()}>
        <div className="auth-modal-head">
          <div>
            <span className="auth-hero-kicker">Your account</span>
            <h3>Profile</h3>
          </div>
          <button className="icon-close" type="button" onClick={onClose} aria-label="Close">×</button>
        </div>

        <p className="auth-hint">Signed in as {user.email}</p>

        {/* Profile */}
        <div className="auth-form">
          <label className="label">
            Username
            <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
          </label>

          <div className="label">
            <span className="label-text">Avatar</span>
            <div className="avatar-grid">
              {Array.from({ length: 14 }, (_, i) => {
                const id = `avatar-${String(i + 1).padStart(2, "0")}`;
                return (
                  <button
                    key={id}
                    type="button"
                    className={`avatar-option ${avatarId === id ? "active" : ""}`}
                    onClick={() => setAvatarId(id)}
                    aria-pressed={avatarId === id}
                  >
                    <img src={getAvatarAssetPath(id)} alt="" loading="lazy" onError={(e) => handleAvatarError(e, id)} />
                  </button>
                );
              })}
            </div>
          </div>

          {profileErr ? <p className="error">{profileErr}</p> : null}
          {profileMsg ? <p className="good">{profileMsg}</p> : null}

          <button className="button primary auth-submit" type="button" onClick={saveProfile} disabled={savingProfile || !profileDirty}>
            {savingProfile ? "Saving…" : "Save Profile"}
          </button>
        </div>

        <hr className="profile-divider" />

        {/* Password */}
        <div className="auth-form">
          <span className="label-text">Change password</span>
          <input
            className="input"
            type="password"
            placeholder="Current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
          />
          <input
            className="input"
            type="password"
            placeholder="New password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
          />
          <input
            className="input"
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
          />
          <p className="auth-hint">Must include uppercase, lowercase, a number, and a symbol.</p>

          {pwErr ? <p className="error">{pwErr}</p> : null}
          {pwMsg ? <p className="good">{pwMsg}</p> : null}

          <button
            className="button auth-submit"
            type="button"
            onClick={changePassword}
            disabled={savingPw || !currentPassword || !newPassword || !confirmPassword}
          >
            {savingPw ? "Updating…" : "Change Password"}
          </button>
        </div>
      </div>
    </div>
  );
}
